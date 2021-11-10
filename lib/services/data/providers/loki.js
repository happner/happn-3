const db = require('lokijs'),
  EventEmitter = require('events').EventEmitter,
  fs = require('fs-extra'),
  readline = require('readline'),
  constants = require('../../../constants'),
  async = require('async'),
  util = require('../../utils/shared'),
  _ = require('lodash'),
  path = require('path');

module.exports = class LokiDataProvider extends EventEmitter {
  constructor(settings, logger) {
    super();
    this.settings = settings;
    this.logger = logger;

    this.initialize = util.maybePromisify(this.initialize);
    this.stop = util.maybePromisify(this.stop);
    this.upsert = util.maybePromisify(this.upsert);
    this.increment = util.maybePromisify(this.increment);
    this.merge = util.maybePromisify(this.merge);
    this.insert = util.maybePromisify(this.insert);
    this.find = util.maybePromisify(this.find);
    this.findOne = util.maybePromisify(this.findOne);
    this.remove = util.maybePromisify(this.remove);
    this.count = util.maybePromisify(this.count);
    this.operationCount = 0;
  }
  initialize(callback) {
    this.dirty = true;
    this.db = new db();
    this.collection = this.db.addCollection('happn', {
      indices: ['path', 'created', 'modified'],
      unique: ['path']
    });
    this.persistenceOn = this.settings.filename != null;
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
    let errorHappened = false;

    reader.on('line', line => {
      if (lineIndex === 0) {
        this.db.loadJSON(JSON.parse(line).snapshot, { retainDirtyFlags: false });
        this.collection = this.db.collections[0];
      } else {
        try {
          this.mutateDatabase(this.parsePersistedOperation(line));
        } catch (e) {
          this.logger.error(`failed reconstructing line ${line}`);
          errorHappened = true;
          reader.close();
          callback(e);
        }
      }
      lineIndex++;
    });

    reader.on('close', () => {
      if (!errorHappened) {
        this.snapshot(callback);
      }
    });

    reader.on('error', e => {
      this.logger.error(`reconstruction reader error ${e.message}`);
      if (!errorHappened) {
        callback(e);
      }
      errorHappened = true;
    });
  }
  parsePersistedOperation(line) {
    let operation = JSON.parse(line).operation;
    if (operation.operationType === constants.DATA_OPERATION_TYPES.INSERT) {
      delete operation.arguments[0].$loki;
      delete operation.arguments[0].meta;
    }
    if (operation.operationType === constants.DATA_OPERATION_TYPES.UPSERT) {
      delete operation.arguments[1]._meta.$loki;
      delete operation.arguments[1]._meta.meta;
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
      this.logger.error(`failed mutating database: ${operation.arguments[0]}`, e);
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
      case constants.DATA_OPERATION_TYPES.INCREMENT:
        return this.incrementInternal(
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
  upsertInternal(path, upsertDocument, options) {
    if (typeof path !== 'string') {
      throw new Error('argument [path] at position 0 is null or not a string');
    }
    options = options || {};
    let document = this.collection.findOne({ path });
    let result,
      created,
      meta = upsertDocument._meta || {};
    meta.path = path;
    if (document == null) {
      document = meta;
      document.data = upsertDocument.data;
      created = document;
      result = this.insertInternal(document);
    } else {
      if (options.merge) {
        document.data = { ...document.data, ...upsertDocument.data };
      } else {
        document.data = upsertDocument.data;
      }
      _.merge(document, meta);
      result = this.updateInternal(document);
    }
    return { result, document, created };
  }
  insertInternal(document) {
    const now = Date.now();
    document.created = now;
    document.modified = now;
    return this.collection.insert(document);
  }
  updateInternal(document) {
    document.modified = Date.now();
    return this.collection.update(document);
  }
  snapshot(callback) {
    this.operationCount = 0;
    this.persistSnapshotData({ snapshot: this.db.serialize() }, callback);
  }
  storePlayback(operation, callback) {
    return (e, result) => {
      if (e) {
        callback(e);
        return;
      }
      if (!this.persistenceOn) {
        callback(null, result);
        return;
      }
      this.appendOperationData({ operation }, appendFailure => {
        if (appendFailure) {
          this.logger.error('failed persisting operation data', appendFailure);
          callback(appendFailure);
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

  getFileStream() {
    if (this.fileStream == null) {
      let realPath = fs.realpathSync(this.settings.filename);
      fs.ensureDirSync(path.dirname(realPath));
      this.fileStream = fs.createWriteStream(realPath, { flags: 'a' });
    }
    return this.fileStream;
  }

  appendOperationData(operationData, callback) {
    this.operationCount++;
    const fileStream = this.getFileStream();
    fileStream.write(`${JSON.stringify(operationData)}\r\n`, this.fsync(callback));
  }

  persistSnapshotData(snapshotData, callback) {
    fs.writeFile(
      this.settings.filename,
      `${JSON.stringify(snapshotData)}\r\n`,
      {
        flag: 'w'
      },
      this.fsync(callback)
    );
  }
  fsync(callback) {
    return e => {
      if (e) {
        callback(e);
        return;
      }
      if (!this.settings.fsync) {
        callback(null);
        return;
      }
      fs.open(this.settings.filename, 'r+', (errorOpening, fd) => {
        if (errorOpening) {
          callback(new Error(`failed syncing to storage device: ${errorOpening.message}`));
          return;
        }
        fs.fsync(fd, errorSyncing => {
          if (errorSyncing) {
            this.logger.error(`fsync to file ${this.settings.filename} failed`, e);
            callback(errorSyncing);
            return;
          }
          callback(null);
        });
      });
    };
  }
  insert(document, callback) {
    this.operationQueue.push(
      { operationType: constants.DATA_OPERATION_TYPES.INSERT, arguments: [document] },
      callback
    );
  }
  merge(path, document, callback) {
    this.upsert(path, document, { merge: true }, callback);
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
      (e, response) => {
        if (e) {
          callback(e);
          return;
        }
        callback(null, response.created, this.getMeta(response.document));
      }
    );
  }
  remove(path, callback) {
    this.operationQueue.push(
      { operationType: constants.DATA_OPERATION_TYPES.REMOVE, arguments: [path] },
      callback
    );
  }
  removeInternal(path) {
    const toRemove = this.collection.chain().find(this.getPathCriteria(path));
    const removed = toRemove.count();
    if (removed > 0) {
      toRemove.remove();
    }
    return {
      data: {
        removed
      },
      _meta: {
        timestamp: Date.now(),
        path: path
      }
    };
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
    if (!parameters) parameters = {};
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
  count(path, parameters, callback) {
    let pathCriteria = this.getPathCriteria(path);
    if (parameters.criteria) {
      pathCriteria = this.addCriteria(this.getPathCriteria(path), parameters.criteria);
    }
    let count = 0;
    try {
      count = this.collection.count(pathCriteria);
    } catch (e) {
      callback(e);
      return;
    }
    callback(null, { data: { value: count } });
  }
  findOne(criteria, fields, callback) {
    if (typeof fields === 'function') {
      callback = fields;
      fields = null;
    }
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
    if (results.length > 0) {
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
  increment(path, counterName, increment, callback) {
    if (typeof increment === 'function') {
      callback = increment;
      increment = 1;
    }
    this.operationQueue.push(
      {
        operationType: constants.DATA_OPERATION_TYPES.INCREMENT,
        arguments: [path, counterName, increment]
      },
      callback
    );
  }
  incrementInternal(path, counterName, increment) {
    let recordToIncrement = this.findOneInternal({ path }) || {
      data: { [counterName]: { value: 0 } }
    };
    if (recordToIncrement.data[counterName] == null) {
      recordToIncrement.data[counterName] = { value: 0 };
    }
    recordToIncrement.data[counterName].value += increment;
    this.upsertInternal(path, recordToIncrement);
    return recordToIncrement.data[counterName].value;
  }
  getMeta(document) {
    return {
      created: document.created,
      modified: document.modified,
      modifiedBy: document.modifiedBy,
      path: document.path
    };
  }
  transform(dataObj, meta) {
    return {
      data: dataObj.data,
      _meta: meta || {
        path: dataObj.path,
        created: dataObj.created,
        modified: dataObj.modified,
        modifiedBy: dataObj.modifiedBy
      }
    };
  }
};
