module.exports = DataService;

const traverse = require('traverse'),
  sift = require('sift').default,
  async = require('async'),
  CONSTANTS = require('../..').constants,
  util = require('../utils/shared'),
  EventEmitter = require('events').EventEmitter,
  hyperid = require('happner-hyperid').create({
    urlSafe: true
  }),
  VersionUpdater = require('./versions/updater');

const META_FIELDS = [
  '_meta',
  '_id',
  'path',
  'created',
  'modified',
  'timestamp',
  'createdBy',
  'modifiedBy'
];

const PREFIXED_META_FIELDS = META_FIELDS.filter(function(metaField) {
  return metaField !== '_meta';
}).map(function(metaField) {
  if (metaField !== '_meta') return '_meta.' + metaField;
});

require('util').inherits(DataService, EventEmitter);

DataService.prototype.UPSERT_TYPE = CONSTANTS.UPSERT_TYPE;
DataService.prototype.initialize = initialize;
DataService.prototype.upsert = util.maybePromisify(upsert);
DataService.prototype.remove = util.maybePromisify(remove);
DataService.prototype.get = util.maybePromisify(get);
DataService.prototype.count = util.maybePromisify(count);
DataService.prototype.processGet = processGet;
DataService.prototype.processCount = processCount;
DataService.prototype.processRemove = processRemove;
DataService.prototype.processStore = processStore;
DataService.prototype.processSecureStore = processSecureStore;
DataService.prototype.processNoStore = processNoStore;
DataService.prototype.getOneByPath = getOneByPath;

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

DataService.prototype.stop = stop;

DataService.prototype.__initializeProviders = __initializeProviders;
DataService.prototype._insertDataProvider = _insertDataProvider;
DataService.prototype.__attachProviderEvents = __attachProviderEvents;
DataService.prototype.__getPullOptions = __getPullOptions;
DataService.prototype.__upsertInternal = __upsertInternal;
DataService.prototype.__iterateDataStores = __iterateDataStores;
DataService.prototype.__updateDatabaseVersions = __updateDatabaseVersions;

DataService.prototype.__providerHasFeature = __providerHasFeature;
DataService.prototype.__findDataProviderConfig = __findDataProviderConfig;
DataService.prototype.addDataProviderPatterns = addDataProviderPatterns;

DataService.prototype.respondToUpsert = respondToUpsert;

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
    //insert the default loki data store as the default

    var defaultDatastoreConfig = {
      name: 'default',
      provider: 'loki',
      isDefault: true,
      settings: {}
    };

    if (this.config.dbfile) this.config.filename = this.config.dbfile;
    if (this.config.filename) defaultDatastoreConfig.settings.filename = this.config.filename;
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
  if (typeof provider[feature] === 'function') return true;
  if (provider.featureset) return provider.featureset[feature];
  return false;
}

function upsert(path, data, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  if (!options) options = {};

  if (data) delete data._meta;

  var setData = this.formatSetData(path, data);

  if (options.merge) {
    const provider = this.db(path);
    if (this.__providerHasFeature(provider, 'merge')) {
      provider.merge(path, setData, this.respondToUpsert(path, provider, setData, callback));
      return;
    }
    //upserting, due to this being non-atomic (concurrency may cause unique index issues)
    options.upsertType = CONSTANTS.UPSERT_TYPE.UPSERT;
    this.getOneByPath(path, (e, previous) => {
      if (e) return callback(e);
      if (!previous) {
        return this.__upsertInternal(path, setData, options, callback);
      }
      previous.data = { ...previous.data, ...setData.data }; //shallow merge
      previous.modified = Date.now();
      this.__upsertInternal(path, previous, options, callback);
    });
    return;
  }

  this.__upsertInternal(path, setData, options, callback);
}

function get(path, parameters, callback) {
  if (typeof parameters === 'function') {
    callback = parameters;
    parameters = null;
  }
  let provider, parsedParameters;
  try {
    provider = this.db(path);
    parsedParameters = this.__getPullOptions(path, parameters);
  } catch (e) {
    callback(e);
    return;
  }

  if (parsedParameters.options.aggregate && !this.__providerHasFeature(provider, 'aggregate'))
    return callback(new Error(`aggregate feature not available for provider on path: ${path}`));

  if (parsedParameters.options.collation && !this.__providerHasFeature(provider, 'collation'))
    return callback(new Error(`collation feature not available for provider on path: ${path}`));

  provider.find(path, parsedParameters, function(e, items) {
    if (e) {
      return callback(e);
    }

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

    var options = this.__getPullOptions(parameters);

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
  if (typeof fields === 'function') {
    callback = fields;
    fields = {};
  }
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
  this.addDataStoreFilterSorted(pattern, dataStore);
}

function removeDataStoreFilter(pattern) {
  this.removeDataStoreFilterSorted(pattern);
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
  ) {
    data = {
      value: data
    };
  }
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

function __upsertInternal(path, setData, options, callback) {
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

  provider.upsert(path, setData, options, this.respondToUpsert(path, provider, setData, callback));
}

function respondToUpsert(path, provider, setData, callback) {
  return (e, created, meta) => {
    if (e) {
      callback(e);
      return;
    }
    if (created) {
      callback(null, provider.transform(created));
      return;
    }
    setData.path = path;
    callback(null, provider.transform(setData, meta));
  };
}

function remove(path, options, callback) {
  if (typeof options === 'function') callback = options;

  this.db(path).remove(path, function(e, removed) {
    if (e) return callback(new Error('error removing item on path ' + path, e));
    callback(null, removed);
  });
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

    dataStoreInstance.patterns = datastoreConfig.patterns || [];
    datastoreConfig.provider = datastoreConfig.provider || './providers/loki';

    if (datastoreConfig.provider === 'loki') datastoreConfig.provider = './providers/loki';
    if (datastoreConfig.provider === 'memory' || datastoreConfig.provider === 'mem') {
      datastoreConfig.provider = './providers/loki';
      dataStoreInstance.settings.filename = null; //no filename
    }

    var DataProvider = require(datastoreConfig.provider);
    dataStoreInstance.provider = new DataProvider(dataStoreInstance.settings, this.log);
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

  _this.__providerEventHandlers[providerKey] = providerEventsHandler;
}

function __getPullOptions(parameters) {
  var returnParams = {
    criteria: null,
    options: {}
  };

  if (!parameters) return returnParams;

  if (!parameters.options) parameters.options = {};
  returnParams.options = parameters.options;

  if (parameters.path_only || parameters.options.path_only) {
    returnParams.options.fields = {
      path: 1,
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
