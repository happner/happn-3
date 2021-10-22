const db = require('lokijs'),
  EventEmitter = require('events').EventEmitter,
  fs = require('fs'),
  readline = require('readline'),
  constants = require('../../../constants'),
  async = require('async'),
  util = require('../../utils/shared'),
  _ = require('lodash');

module.exports = class LokiDataProvider extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;

    this.initialize = util.maybePromisify(this.initialize);
    this.stop = util.maybePromisify(this.stop);
    this.upsert = util.maybePromisify(this.upsert);
    this.insert = util.maybePromisify(this.insert);
    this.find = util.maybePromisify(this.find);
    this.remove = util.maybePromisify(this.remove);
    this.operationCount = 0;
  }
  initialize(callback) {
    this.dirty = true;
    this.db = new db();
    this.collection = this.db.addCollection('happn', {
      indices: ['path', 'created', 'modified'],
      unique: ['path']
    });
    this.persistenceOn = this.settings.filename !== null;
    this.operationQueue = async.queue((operation, cb) => {
      this.processOperation(operation, cb);
    }, 1);
    if (!this.persistenceOn) {
      callback();
      return;
    }
    this.settings.snapshotRollOverThreshold = this.settings.snapshotRollOverThreshold || 1e3; // take a snapshot and compact every 1000 records
    this.reconstruct(e => {
      if (e) {
        this.logger.error('failed reconstructing database', e);
        callback(e);
        return;
      }
      callback();
    });
  }
  reconstruct(callback) {
    if (!fs.existsSync(this.settings.filename)) {
      return this.snapshot(callback);
    }
    const reader = readline.createInterface({
      input: fs.createReadStream(this.settings.filename),
      crlfDelay: Infinity
    });
    let lineIndex = 0;

    reader.on('line', line => {
      if (lineIndex === 0) {
        this.db.loadJSON(JSON.parse(line).snapshot, { retainDirtyFlags: false });
        this.collection = this.db.collections[0];
      } else {
        this.mutateDatabase(this.parsePersistedOperation(line));
      }
      lineIndex++;
    });

    reader.on('close', () => {
      this.snapshot(callback);
    });

    reader.on('error', e => {
      callback(e);
    });
  }
  parsePersistedOperation(line) {
    let operation = JSON.parse(line).operation;
    if (operation.operationType === constants.DATA_OPERATION_TYPES.INSERT) {
      delete operation.arguments[0].$loki;
      delete operation.arguments[0].meta;
    }
    return operation;
  }
  stop(callback) {
    if (this.snapshotTimeout) {
      clearTimeout(this.snapshotTimeout);
    }
    callback();
  }
  processOperation(operation, callback) {
    if (operation.operationType === constants.DATA_OPERATION_TYPES.SNAPSHOT) {
      this.snapshot(callback);
      return;
    }
    callback = this.storePlayback(operation, callback);
    let result;
    try {
      result = this.mutateDatabase(operation);
    } catch (e) {
      callback(e);
      return;
    }
    callback(null, result);
  }
  mutateDatabase(operation) {
    switch (operation.operationType) {
      case constants.DATA_OPERATION_TYPES.UPSERT:
        return this.upsertInternal(
          operation.arguments[0],
          operation.arguments[1],
          operation.arguments[2]
        );
      case constants.DATA_OPERATION_TYPES.UPDATE:
        return this.updateInternal(
          operation.arguments[0],
          operation.arguments[1],
          operation.arguments[2]
        );
      case constants.DATA_OPERATION_TYPES.INSERT:
        return this.insertInternal(operation.arguments[0]);
      case constants.DATA_OPERATION_TYPES.REMOVE:
        return this.removeInternal(operation.arguments[0]);
      default:
        throw new Error(`unknown data operation type: ${operation.operationType}`);
    }
  }
  upsertInternal(path, data) {
    if (typeof path !== 'string') {
      throw new Error('argument [path] at position 0 is null or not a string');
    }
    if (path.indexOf('*') > -1) {
      throw new Error(`argument [path] with value ${path} cannot contain wildcards (*)`);
    }
    const found = this.collection.findOne({ path });
    if (found == null) {
      return this.insertInternal({
        path,
        data
      });
    }
    found.data = data;
    return this.updateInternal(found);
  }
  insertInternal(document) {
    return this.collection.insert(document);
  }
  updateInternal(document) {
    return this.collection.update(document);
  }
  snapshot(callback) {
    this.operationCount = 0;
    this.persistSnapshotData({ snapshot: this.db.serialize() }, callback, false);
  }
  storePlayback(operation, callback) {
    return (e, result) => {
      if (e) {
        callback(e);
        return;
      }
      this.persistSnapshotData({ operation }, snapshotFailure => {
        if (snapshotFailure) {
          this.logger.error('failed persisting snapshot data', snapshotFailure);
          callback(snapshotFailure);
          return;
        }
        if (this.operationCount < this.settings.snapshotRollOverThreshold) {
          callback(null, result);
          return;
        }
        this.snapshot(e => {
          if (e) {
            this.logger.error('snapshot rollover failed', e);
            callback(e);
            return;
          }
          callback(null, result);
        });
      });
    };
  }
  persistSnapshotData(data, callback, append = true) {
    if (!data.snapshot) this.operationCount++;
    fs.writeFile(
      this.settings.filename,
      JSON.stringify(data) + '\r\n',
      {
        flag: append ? 'a' : 'w'
      },
      callback
    );
  }
  insert(document, callback) {
    this.operationQueue.push(
      { operationType: constants.DATA_OPERATION_TYPES.INSERT, arguments: [document] },
      callback
    );
  }
  upsert(path, document, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    this.operationQueue.push(
      {
        operationType: constants.DATA_OPERATION_TYPES.UPSERT,
        arguments: [path, document, options]
      },
      callback
    );
  }
  remove(path, callback) {
    this.operationQueue.push(
      { operationType: constants.DATA_OPERATION_TYPES.REMOVE, arguments: [path] },
      callback
    );
  }
  removeInternal(path) {
    return this.collection.removeWhere(this.getPathCriteria(path));
  }
  transformSortOptions(mongoSortOptions) {
    return Object.keys(mongoSortOptions).reduce((lokiSortOptions, fieldName) => {
      lokiSortOptions.push([fieldName, mongoSortOptions[fieldName] === -1]);
      return lokiSortOptions;
    }, []);
  }
  findInternal(path, parameters) {
    let returnArray = [];
    let pathCriteria = this.getPathCriteria(path);
    if (parameters.criteria) pathCriteria = this.addCriteria(pathCriteria, parameters.criteria);
    let results = this.collection.chain().find(pathCriteria);

    if (results.count() === 0) {
      return returnArray;
    }

    let options = parameters.options || {};

    if (options.sort) {
      results.compoundsort(this.transformSortOptions(options.sort));
    }

    returnArray = results.data({ forceClones: true, removeMeta: true });

    if (options.skip) {
      returnArray = returnArray.slice(options.skip);
    }

    if (options.limit) {
      returnArray = returnArray.slice(0, options.limit);
    }

    if (options.fields) {
      returnArray = returnArray.map(item => {
        return _.pick(item, Object.keys(options.fields));
      });
    }
    return returnArray;
  }
  find(path, parameters, callback) {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = {};
    }
    if (parameters == null) {
      parameters = {};
    }
    let returnArray = [];
    try {
      returnArray = this.findInternal(path, parameters);
    } catch (e) {
      callback(e);
      return;
    }
    callback(null, returnArray);
  }
  findOne(criteria, fields, callback) {
    let result = null;
    try {
      result = this.findOneInternal(criteria, fields);
    } catch (e) {
      callback(e);
      return;
    }
    callback(null, result);
  }
  findOneInternal(criteria, fields) {
    let results = this.findInternal('*', { criteria, fields });
    if (results.length >= 0) {
      return results[0];
    }
    return null;
  }
  addCriteria(pathObject, criteria) {
    return { $and: [pathObject, criteria] };
  }
  getPathCriteria(path) {
    if (path.indexOf('*') === -1) {
      return { path };
    }
    return {
      path: { $regex: '^' + this.escapeRegex(this.preparePath(path)).replace(/\\\*/g, '.*') + '$' }
    };
  }
  preparePath(path) {
    return path.replace(/(\*)\1+/g, '$1');
  }
  escapeRegex(str) {
    return str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&');
  }
};
