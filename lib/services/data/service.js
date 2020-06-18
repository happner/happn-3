module.exports = DataService;

var traverse = require('traverse'),
  sift = require('sift').default,
  async = require('async'),
  CONSTANTS = require('../..').constants,
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  hyperid = require('happner-hyperid').create({
    urlSafe: true
  }),
  VersionUpdater = require('./versions/updater'),
  _ = require('lodash'),
  Promise = require('bluebird');

var META_FIELDS = [
  '_meta',
  '_id',
  'path',
  'created',
  'modified',
  'timestamp',
  'createdBy',
  'modifiedBy'
];

var PREFIXED_META_FIELDS = META_FIELDS.filter(function(metaField) {
  return metaField !== '_meta';
}).map(function(metaField) {
  if (metaField !== '_meta') return '_meta.' + metaField;
});

var UPSERT_TYPE = {
  upsert: 0,
  update: 1,
  insert: 2
};

util.inherits(DataService, EventEmitter);

DataService.prototype.UPSERT_TYPE = UPSERT_TYPE;
DataService.prototype.initialize = initialize;
DataService.prototype.upsert = Promise.promisify(upsert);
DataService.prototype.remove = Promise.promisify(remove);
DataService.prototype.get = Promise.promisify(get);
DataService.prototype.count = Promise.promisify(count);
DataService.prototype.processGet = processGet;
DataService.prototype.processCount = processCount;
DataService.prototype.processRemove = processRemove;
DataService.prototype.processStore = processStore;
DataService.prototype.processSecureStore = processSecureStore;
DataService.prototype.processNoStore = processNoStore;
DataService.prototype.getOneByPath = getOneByPath;
DataService.prototype.insertTag = insertTag;
DataService.prototype.saveTag = saveTag;

DataService.prototype.addDataStoreFilter = addDataStoreFilter;
DataService.prototype.removeDataStoreFilter = removeDataStoreFilter;
DataService.prototype.addDataStoreFilterSorted = addDataStoreFilterSorted;
DataService.prototype.removeDataStoreFilterSorted = removeDataStoreFilterSorted;
DataService.prototype.parseFields = parseFields;
DataService.prototype.filter = filter;

DataService.prototype.transform = transform;
DataService.prototype.transformAll = transformAll;
DataService.prototype.formatSetData = formatSetData;
DataService.prototype.randomId = randomId;

DataService.prototype.startCompacting = startCompacting;
DataService.prototype.compact = compact;
DataService.prototype.stop = stop;

DataService.prototype.__initializeProviders = __initializeProviders;
DataService.prototype._insertDataProvider = _insertDataProvider;
DataService.prototype.__attachProviderEvents = __attachProviderEvents;
DataService.prototype.__getPullOptions = __getPullOptions;
DataService.prototype.__upsertInternal = __upsertInternal;
DataService.prototype.__iterateDataStores = __iterateDataStores;
DataService.prototype.__updateDatabaseVersions = __updateDatabaseVersions;
DataService.prototype.__compacting = {};

DataService.prototype.__providerHasFeature = __providerHasFeature;
DataService.prototype.__findDataProviderConfig = __findDataProviderConfig;
DataService.prototype.addDataProviderPatterns = addDataProviderPatterns;

//gets the item.data as an array (from data, _meta container)
DataService.prototype.extractData = extractData;

function DataService(opts) {
  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('Data');
  } else {
    Logger = require('happn-logger');
    Logger.configure({
      logLevel: 'info'
    });
  }

  this.log = Logger.createLogger('Data');
  this.log.$$TRACE('construct(%j)', opts);
  this.datastores = {};
  this.dataroutes = {};
  this.dataroutessorted = [];
}

function initialize(config, callback) {
  this.config = config;
  this.errorService = this.happn.services.error;

  if (!this.config.datastores) this.config.datastores = [];

  if (this.config.datastores.length === 0) {
    //insert the default nedb data store

    var defaultDatastoreConfig = {
      name: 'default',
      provider: 'nedb',
      isDefault: true,
      settings: {}
    };

    if (this.config.dbfile) this.config.filename = this.config.dbfile;
    if (this.config.filename) defaultDatastoreConfig.settings.filename = this.config.filename;
    if (this.config.compactInterval)
      defaultDatastoreConfig.settings.compactInterval = this.config.compactInterval;
    this.config.datastores.push(defaultDatastoreConfig);
  }

  if (this.config.secure) this.processStore = this.processSecureStore;

  this.__initializeProviders()
    .then(() => {
      return this.__updateDatabaseVersions();
    })
    .then(() => {
      callback();
    })
    .catch(callback);
}

function __updateDatabaseVersions() {
  return new Promise((resolve, reject) => {
    var versionUpdater = new VersionUpdater(this, this.happn.services.system);

    versionUpdater.analyzeDB((e, analysis) => {
      if (e) return reject(e);
      //make available so we can inspect in our integration tests
      this.dbVersionAnalysis = analysis;

      if (analysis.isNew)
        return versionUpdater.writeVersionToDB(analysis.moduleDBVersion, resolve, reject);

      if (analysis.matchingVersion) return resolve(analysis);

      if (!this.config.autoUpdateDBVersion)
        return reject(
          new Error(
            'current database version ' +
              analysis.currentDBVersion +
              ' does not match ' +
              analysis.moduleDBVersion
          )
        );

      versionUpdater.updateDB(
        analysis,
        logs => {
          this.log.warn(
            'database upgrade from ' + analysis.currentDBVersion + ' to ' + analysis.moduleDBVersion
          );

          logs.forEach(log => {
            this.log.info(log.message);
          });

          versionUpdater.writeVersionToDB(analysis.moduleDBVersion, resolve, reject);
        },
        reject
      );
    });
  });
}

function __providerHasFeature(provider, feature) {
  if (!provider.featureset) return false;
  return provider.featureset[feature] === true;
}

function upsert(path, data, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!options) options = {};

  if (data) delete data._meta;

  if (options.set_type === 'sibling') {
    //appends an item with a path that matches the message path - but made unique by a shortid at the end of the path
    if (!path.endsWith('/')) path += '/';
    path += this.randomId();
  }

  var setData = this.formatSetData(path, data);

  if (options.tag) {
    if (data != null) return callback(new Error('Cannot set tag with new data.'));

    setData.data = {};

    options.merge = true;
  }

  if (options.merge) {
    this.getOneByPath(path, null, (e, previous) => {
      if (e) return callback(e);
      if (!previous) {
        options.upsertType = 2; //inserting
        return this.__upsertInternal(path, setData, options, true, callback);
      }
      previous.data = merge(previous.data, setData.data); //shallow merge
      previous.modified = Date.now();
      options.updateType = 1; //updating
      this.__upsertInternal(path, previous, options, true, callback);
    });
    return;
  }

  this.__upsertInternal(path, setData, options, false, callback);
}

function merge(to, from, deep) {
  if (!deep) return { ...to, ...from };
  return _.merge(to, from);
}

function get(path, parameters, callback) {
  try {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = null;
    }

    var parsedParameters = this.__getPullOptions(path, parameters);
    var provider = this.db(path);

    if (parsedParameters.options.aggregate && !this.__providerHasFeature(provider, 'aggregate'))
      return callback(new Error(`aggregate feature not available for provider on path: ${path}`));

    if (parsedParameters.options.collation && !this.__providerHasFeature(provider, 'collation'))
      return callback(new Error(`collation feature not available for provider on path: ${path}`));

    provider.find(path, parsedParameters, function(e, items) {
      if (e) return callback(e);

      if (parsedParameters.options.aggregate) {
        return callback(null, items);
      }

      if (path.indexOf('*') === -1) {
        //this is a single item
        if (items.length === 0) return callback(null, null);
        return callback(null, provider.transform(items[0], null, parsedParameters.options.fields));
      }

      if (parsedParameters.options.path_only) {
        return callback(e, {
          paths: provider.transformAll(items)
        });
      }

      callback(null, provider.transformAll(items, parsedParameters.options.fields));
    });
  } catch (e) {
    callback(e);
  }
}

function processGet(message, callback) {
  return this.get(message.request.path, message.request.options, (e, response) => {
    if (e)
      return this.errorService.handleSystem(e, 'DataService', CONSTANTS.ERROR_SEVERITY.HIGH, e => {
        callback(e, message);
      });
    message.response = response;
    return callback(null, message);
  });
}

function count(path, parameters, callback) {
  try {
    if (typeof parameters === 'function') {
      callback = parameters;
      parameters = null;
    }

    var provider = this.db(path);
    if (!provider.count) return callback(new Error('Database provider does not support count'));

    var options = this.__getPullOptions(path, parameters);

    provider.count(path, options, function(e, count) {
      if (e) return callback(e);
      callback(null, count);
    });
  } catch (e) {
    callback(e);
  }
}

function processCount(message, callback) {
  return this.count(message.request.path, message.request.options, (e, response) => {
    if (e)
      return this.errorService.handleSystem(e, 'DataService', CONSTANTS.ERROR_SEVERITY.HIGH, e => {
        callback(e, message);
      });
    message.response = response;
    return callback(null, message);
  });
}

function processRemove(message, callback) {
  return this.remove(message.request.path, message.request.options, (e, response) => {
    if (e)
      return this.errorService.handleSystem(
        e,
        'DataService',
        CONSTANTS.ERROR_SEVERITY.HIGH,
        function(e) {
          callback(e, message);
        }
      );

    message.response = response;

    return callback(null, message);
  });
}

function processStore(message, callback) {
  if (!message.request.options) message.request.options = {};
  if (message.request.options.noStore) return this.processNoStore(message, callback);

  this.upsert(
    message.request.path,
    message.request.data,
    message.request.options,
    (e, response) => {
      if (e)
        return this.errorService.handleSystem(
          e,
          'DataService',
          CONSTANTS.ERROR_SEVERITY.HIGH,
          e => {
            callback(e);
          }
        );

      message.response = response;
      return callback(null, message);
    }
  );
}

function processSecureStore(message, callback) {
  if (!message.request.options) message.request.options = {};
  if (message.request.options.noStore) return this.processNoStore(message, callback);
  message.request.options.modifiedBy = message.session.user.username;

  this.upsert(
    message.request.path,
    message.request.data,
    message.request.options,
    (e, response) => {
      if (e)
        return this.errorService.handleSystem(
          e,
          'DataService',
          CONSTANTS.ERROR_SEVERITY.HIGH,
          e => {
            callback(e);
          }
        );

      message.response = response;
      return callback(null, message);
    }
  );
}

function processNoStore(message, callback) {
  message.response = this.formatSetData(message.request.path, message.request.data);
  return callback(null, message);
}

function getOneByPath(path, fields, callback) {
  this.db(path).findOne(
    {
      path: path
    },
    fields || {},
    (e, findresult) => {
      if (e)
        return this.errorService.handleSystem(
          e,
          'DataService',
          CONSTANTS.ERROR_SEVERITY.MEDIUM,
          callback
        );
      return callback(null, findresult);
    }
  );
}

function insertTag(snapshotData, tag, path, callback) {
  var baseTagPath = '/_TAGS';

  if (path.substring(0, 1) !== '/') baseTagPath += '/';
  var tagPath = baseTagPath + path + '/' + this.randomId();
  var tagData = {
    data: {
      data: snapshotData.data,
      _meta: {
        path: snapshotData.path,
        created: snapshotData.created,
        modified: snapshotData.modified,
        modifiedBy: snapshotData.modifiedBy,
        createdBy: snapshotData.createdBy
      }
    },
    _tag: tag,
    path: tagPath
  };

  tagData._meta = {
    path: tagPath,
    tag: tag
  };

  this.__upsertInternal(
    tagPath,
    tagData,
    {
      upsertType: this.UPSERT_TYPE.insert,
      noCache: true
    },
    false,
    callback
  );
}

function saveTag(path, tag, data, callback) {
  if (!data) {
    return this.getOneByPath(path, null, (e, found) => {
      if (e) return callback(e); //handleSystem was already called here
      if (found) return this.insertTag(found, tag, path, callback);
      callback(new Error("Attempt to tag something that doesn't exist in the first place"));
    });
  }

  this.insertTag(data, tag, path, callback);
}

function addDataStoreFilterSorted(pattern, dataStore) {
  this.dataroutes[pattern] = dataStore;
  this.dataroutessorted.push(pattern);
  this.dataroutessorted = this.dataroutessorted.sort((a, b) => {
    return b.length - a.length;
  });
}

function removeDataStoreFilterSorted(pattern) {
  delete this.dataroutes[pattern];
  this.dataroutessorted = this.dataroutessorted.filter(patternFilter => {
    // eslint-disable-next-line eqeqeq
    return patternFilter != pattern;
  });
}

function addDataStoreFilter(pattern, datastoreKey) {
  if (!datastoreKey) throw new Error('missing datastoreKey parameter');
  var dataStore = this.datastores[datastoreKey];
  if (!dataStore) throw new Error('no datastore with the key ' + datastoreKey + ', exists');
  var tagPattern = pattern.toString();
  if (tagPattern.indexOf('/') === 0) tagPattern = tagPattern.substring(1, tagPattern.length);
  this.addDataStoreFilterSorted(pattern, dataStore);
  this.addDataStoreFilterSorted('/_TAGS/' + tagPattern, dataStore);
}

function removeDataStoreFilter(pattern) {
  var tagPattern = pattern.toString();
  if (tagPattern.indexOf('/') === 0) tagPattern = tagPattern.substring(1, tagPattern.length);
  this.removeDataStoreFilterSorted(pattern);
  this.removeDataStoreFilterSorted('/_TAGS/' + tagPattern);
}

function parseFields(fields) {
  var lastError;

  traverse(fields).forEach(function(value) {
    if (value != null) {
      if (value.bsonid) this.update(value.bsonid);

      //ignore elements in arrays
      if (this.parent && Array.isArray(this.parent.node)) return;

      if (typeof this.key === 'string') {
        if (this.key === '$regex') {
          let expression = value;
          if (typeof expression !== 'string' && !Array.isArray(expression)) {
            lastError = new Error('$regex parameter value must be an Array or a string');
            return;
          }
          if (typeof expression === 'string') expression = [expression]; //allow for just a string
          return this.update(RegExp.apply(null, expression));
        }

        //ignore directives
        if (this.key.indexOf('$') === 0) return;

        if (META_FIELDS.indexOf(this.key) > -1) return;

        //look in the right place for meta fields if they have been prefixed with meta.
        if (PREFIXED_META_FIELDS.indexOf(this.key) > -1) {
          if (!this.parent) fields[this.key.replace('_meta.', '')] = value;
          else this.parent.node[this.key.replace('_meta.', '')] = value;
          return this.remove();
        }

        if (this.key.indexOf('_data.') === 0) {
          if (!this.parent) fields[this.key.substring(1)] = value;
          //remove _
          else this.parent.node[this.key.substring(1)] = value;
          return this.remove();
        }
        //prepend with data.
        if (this.key.indexOf('data.') !== 0) {
          if (!this.parent) fields['data.' + this.key] = value;
          else this.parent.node['data.' + this.key] = value;
          return this.remove();
        }
      }
    }
  });

  if (lastError) throw lastError;
  return fields;
}

function filter(criteria, data, callback) {
  if (!criteria) return callback(null, data);

  try {
    var filterCriteria = this.parseFields(criteria);
    callback(null, sift(filterCriteria, data));
  } catch (e) {
    callback(new Error('Filter of resultset failed', e));
  }
}

function transform(dataObj, meta) {
  var transformed = {
    data: dataObj.data
  };

  if (!meta) {
    meta = {};
    if (dataObj.created) meta.created = dataObj.created;
    if (dataObj.modified) meta.modified = dataObj.modified;
    if (dataObj.modifiedBy) meta.modifiedBy = dataObj.modifiedBy;
  }

  transformed._meta = meta;
  transformed._meta.path = dataObj.path;
  transformed._meta._id = dataObj.path;

  if (dataObj._tag) transformed._meta.tag = dataObj._tag;
  return transformed;
}

function transformAll(items, fields) {
  return items.map(item => {
    return this.transform(item, null, fields);
  });
}

function formatSetData(path, data, options) {
  if (
    typeof data !== 'object' ||
    data instanceof Array === true ||
    data instanceof Date === true ||
    data == null
  )
    data = {
      value: data
    };

  if (options && options.modifiedBy)
    return {
      data: data,
      _meta: {
        path: path,
        modifiedBy: options.modifiedBy
      }
    };

  return {
    data: data,
    _meta: {
      path: path
    }
  };
}

function __upsertInternal(path, setData, options, dataWasMerged, callback) {
  var provider = this.db(path);

  if (options.increment != null) {
    if (typeof provider.increment !== 'function')
      return callback(new Error('db provider does not have an increment function'));
    if (!setData.data || typeof setData.data.value !== 'string')
      return callback(new Error('invalid increment counter field name, must be a string'));
    if (isNaN(options.increment))
      return callback(new Error('increment option value must be a number'));

    return provider.increment(path, setData.data.value, options.increment, function(e, gaugeValue) {
      if (e) return callback(e);
      setData.data.gauge = setData.data.value;
      setData.data.value = gaugeValue;
      callback(null, provider.transform(setData));
    });
  }

  provider.upsert(path, setData, options, dataWasMerged, (e, _response, created, _upsert, meta) => {
    if (e) return callback(e);

    if (dataWasMerged) {
      //always merged if being tagged
      if (options.tag) return this.insertTag(setData, options.tag, path, callback);
      if (created) return callback(null, provider.transform(created));
      setData.path = meta.path;
      return callback(null, provider.transform(setData, meta));
    }

    if (created) return callback(null, provider.transform(created));
    setData.path = path;
    callback(null, provider.transform(setData, meta));
  });
}

function remove(path, options, callback) {
  if (typeof options === 'function') callback = options;

  this.db(path).remove(path, function(e, removed) {
    if (e) return callback(new Error('error removing item on path ' + path, e));
    callback(null, removed);
  });
}

function startCompacting(dataStoreKey, interval, callback, compactionHandler) {
  try {
    if (typeof dataStoreKey === 'function') {
      compactionHandler = callback;
      callback = dataStoreKey;
      interval = 300000; //defaults the compaction to once every 5 minutes
      dataStoreKey = null;
    }

    if (typeof dataStoreKey === 'number') {
      compactionHandler = callback;
      callback = interval;
      interval = dataStoreKey;
      dataStoreKey = null;
    }

    if (typeof interval === 'function') {
      compactionHandler = callback;
      interval = dataStoreKey;
      callback = interval;
    }

    interval = parseInt(interval.toString());

    if (interval < 5000) throw new Error('interval must be at least 5000 milliseconds');

    this.__iterateDataStores(
      dataStoreKey,
      (key, dataStore, next) => {
        this.compact(key, interval, next, compactionHandler);
      },
      callback
    );
  } catch (e) {
    this.errorService.handleSystem(e, 'DataService', CONSTANTS.ERROR_SEVERITY.HIGH, callback);
  }
}

function compact(
  dataStoreKey, //what dataStore - if undefined we will compact all data stores
  interval, //compaction interval
  callback, //callback on compaction cycle started or single compaction ended
  compactionHandler
) {
  //every time a compaction happens this is called

  if (typeof interval === 'function') {
    compactionHandler = callback;
    callback = interval;
    interval = null;
  }

  if (typeof dataStoreKey === 'function') {
    callback = dataStoreKey;
    compactionHandler = null;
    interval = null;
    dataStoreKey = null;
  }

  if (dataStoreKey == null) {
    this.__iterateDataStores((key, dataStore, next) => {
      this.compact(key, null, next, null);
    }, callback);
  } else {
    var dataStore = this.datastores[dataStoreKey];
    this.__compacting[dataStoreKey] = dataStore;

    if (interval)
      this.__compacting[dataStoreKey].provider.startCompacting(
        interval,
        callback,
        compactionHandler
      );
    else {
      this.__compacting[dataStoreKey].provider.compact(e => {
        if (e) this.errorService.handleSystem(e, 'DataService', CONSTANTS.ERROR_SEVERITY.MEDIUM);
        delete this.__compacting[dataStoreKey];

        callback();
      });
    }
  }
}

function stop(options, callback) {
  if (typeof options === 'function') callback = options;

  this.__iterateDataStores(function(key, dataStore, next) {
    if (dataStore.provider.stop) return dataStore.provider.stop(next);
    next();
  }, callback);
}

function __initializeProviders() {
  return new Promise((resolve, reject) => {
    var dataStorePos = 0;
    async.eachSeries(
      this.config.datastores,
      (datastoreConfig, datastoreCallback) => {
        this._insertDataProvider(dataStorePos, datastoreConfig, e => {
          if (e) return datastoreCallback(e);
          dataStorePos++;
          datastoreCallback();
        });
      },
      e => {
        if (e) return reject(e);

        this.defaultProviderConfig = this.datastores[this.defaultDatastore];
        this.defaultProvider = this.defaultProviderConfig.provider;

        this.db = function(path) {
          return this.__findDataProviderConfig(path).provider;
        };
        resolve();
      }
    );
  });
}

function __findDataProviderConfig(path) {
  for (var dataStoreRoute of this.dataroutessorted)
    if (this.happn.services.utils.wildcardMatch(dataStoreRoute, path, 'DATASTORE_ROUTES', 0, true))
      return this.dataroutes[dataStoreRoute];
  return this.defaultProviderConfig;
}

function addDataProviderPatterns(route, patterns) {
  const providerConfig = this.__findDataProviderConfig(route);
  patterns.forEach(pattern => {
    this.addDataStoreFilter(pattern, providerConfig.name);
  });
}

function _insertDataProvider(dataStorePos, datastoreConfig, callback) {
  try {
    //eslint-disable-next-line
    if (dataStorePos === 0 && this.defaultDatastore == null)
      this.defaultDatastore = datastoreConfig.name; //just in case we haven't set a default

    var dataStoreInstance = { name: datastoreConfig.name };
    dataStoreInstance.settings = datastoreConfig.settings || {};
    //eslint-disable-next-line
    if (dataStoreInstance.settings.compactInterval == null && this.config.compactInterval != null)
      dataStoreInstance.settings.compactInterval = this.config.compactInterval;

    dataStoreInstance.patterns = datastoreConfig.patterns || [];
    datastoreConfig.provider = datastoreConfig.provider || './providers/nedb';

    if (datastoreConfig.provider === 'nedb') datastoreConfig.provider = './providers/nedb';
    if (datastoreConfig.provider === 'memory' || datastoreConfig.provider === 'mem') {
      datastoreConfig.provider = './providers/nedb';
      dataStoreInstance.settings.filename = null; //no filename
    }

    var DataProvider = require(datastoreConfig.provider);
    dataStoreInstance.provider = new DataProvider(dataStoreInstance.settings);
    Object.defineProperty(dataStoreInstance, '__service', {
      value: this
    });

    this.__attachProviderEvents(datastoreConfig.name, dataStoreInstance.provider);
    dataStoreInstance.provider.initialize(e => {
      if (e) return callback(e);

      if (dataStoreInstance.provider.transform == null)
        dataStoreInstance.provider.transform = this.transform;
      if (dataStoreInstance.provider.transformAll == null)
        dataStoreInstance.provider.transformAll = this.transformAll;
      this.datastores[datastoreConfig.name] = dataStoreInstance;
      //make sure we match the special /_TAGS patterns to find the right db for a tag
      dataStoreInstance.patterns.forEach(pattern => {
        this.addDataStoreFilter(pattern, datastoreConfig.name);
      });
      //forces the default datastore
      if (datastoreConfig.isDefault) this.defaultDatastore = datastoreConfig.name;
      callback();
    });
  } catch (e) {
    callback(e);
  }
}

//bind to all possible events coming out of a provider - funnel into single 'provider-event'
function __attachProviderEvents(providerKey, provider) {
  const _this = this;

  if (typeof provider.on !== 'function') return;
  if (!_this.__providerEventHandlers) _this.__providerEventHandlers = {};

  var providerEventsHandler = function(data) {
    this.service.emit('provider-event', {
      eventName: this.eventName,
      eventData: data,
      provider: this.providerKey
    });
  };

  //only one event so far, but there could be more, use bind to ensure we emit the correct eventName etc.
  provider.on(
    'compaction-successful',
    providerEventsHandler.bind({
      service: _this,
      providerKey: providerKey,
      eventName: 'compaction-successful'
    })
  );

  _this.__providerEventHandlers[providerKey] = providerEventsHandler;
}

function __getPullOptions(path, parameters) {
  var returnParams = {
    criteria: null,
    options: {}
  };

  if (!parameters) return returnParams;

  if (!parameters.options) parameters.options = {};
  returnParams.options = parameters.options;

  if (parameters.path_only || parameters.options.path_only) {
    returnParams.options.fields = {
      _meta: 1
    };
    returnParams.options.path_only = true;
  }

  if (parameters.fields || parameters.options.fields) {
    returnParams.options.fields = this.parseFields(parameters.options.fields || parameters.fields);
    returnParams.options.fields._meta = 1;
  }

  if (parameters.aggregate || parameters.options.aggregate)
    returnParams.options.aggregate = parameters.aggregate || parameters.options.aggregate;

  if (parameters.sort || parameters.options.sort)
    returnParams.options.sort = this.parseFields(parameters.sort || parameters.options.sort);
  if (parameters.collation || parameters.options.collation)
    returnParams.options.collation = parameters.collation || parameters.options.collation;
  if (parameters.criteria) returnParams.criteria = this.parseFields(parameters.criteria);

  return returnParams;
}

function __iterateDataStores(dataStoreKey, operator, callback) {
  if (typeof dataStoreKey === 'function') {
    callback = operator;
    operator = dataStoreKey;
    dataStoreKey = null;
  }

  if (dataStoreKey) {
    if (!this.datastores)
      return callback(
        new Error(
          'datastore with key ' +
            dataStoreKey +
            ', specified, but multiple datastores not configured'
        )
      );
    if (!this.datastores[dataStoreKey])
      return callback(new Error('datastore with key ' + dataStoreKey + ', does not exist'));

    return operator(dataStoreKey, this.datastores[dataStoreKey], callback);
  }

  if (this.datastores) {
    async.eachSeries(
      Object.keys(this.datastores),
      (key, next) => {
        operator(key, this.datastores[key], next);
      },
      callback
    );
  } else {
    return operator(
      'default',
      {
        db: this.dbInstance,
        config: this.config
      },
      callback
    );
  }
}

function randomId() {
  return hyperid();
}

function extractData(data) {
  return data.map(function(item) {
    return item.data;
  });
}
