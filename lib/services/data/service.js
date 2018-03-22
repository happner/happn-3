module.exports = DataService;

var _s = require('underscore.string'),
  traverse = require('traverse'),
  uuid = require('uuid'),
  sift = require('sift'),
  Promise = require('bluebird'),
  url = require('url'),
  async = require('async'),
  constants = require('../../constants'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  hyperid = require('happner-hyperid').create({urlSafe:true}),
  VersionUpdater = require('./versions/updater')
  ;


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

var PREFIXED_META_FIELDS = META_FIELDS
  .filter(function (metaField) {
    if (metaField == '_meta') return false;
    else return true;
  })
  .map(function (metaField) {
    if (metaField != '_meta') return '_meta.' + metaField;
  });

var UPSERT_TYPE = {
  upsert: 0,
  update: 1,
  insert: 2
};

util.inherits(DataService, EventEmitter);

DataService.prototype.UPSERT_TYPE = UPSERT_TYPE;
DataService.prototype.initialize = initialize;
DataService.prototype.upsert = upsert;
DataService.prototype.remove = remove;
DataService.prototype.get = get;
DataService.prototype.doGet = Promise.promisify(doGet);
DataService.prototype.doRemove = Promise.promisify(doRemove);
DataService.prototype.doStore = Promise.promisify(doStore);
DataService.prototype.doSecureStore = Promise.promisify(doSecureStore);
DataService.prototype.doNoStore = Promise.promisify(doNoStore);
DataService.prototype.getOneByPath = getOneByPath;
DataService.prototype.insertTag = insertTag;
DataService.prototype.saveTag = saveTag;

DataService.prototype.addDataStoreFilter = addDataStoreFilter;
DataService.prototype.removeDataStoreFilter = removeDataStoreFilter;
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
DataService.prototype.__attachProviderEvents = __attachProviderEvents;
DataService.prototype.__getPullOptions = __getPullOptions;
DataService.prototype.__getPushOptions = __getPushOptions;
DataService.prototype.__upsertInternal = __upsertInternal;
DataService.prototype.__iterateDataStores = __iterateDataStores;
DataService.prototype.__updateDatabaseVersions = __updateDatabaseVersions;
DataService.prototype.__compacting = {};

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
}

function initialize(config, callback) {

  var _this = this;

  _this.datastores = {};

  _this.dataroutes = {};

  _this.config = config;

  _this.errorService = _this.happn.services.error;

  if (!_this.config.datastores) _this.config.datastores = [];

  if (_this.config.datastores.length == 0) { //insert the default nedb data store

    var defaultDatastoreConfig = {
      name: 'default',
      provider: 'nedb',
      isDefault: true,
      settings: {}
    };

    if (_this.config.dbfile) _this.config.filename = _this.config.dbfile;

    if (_this.config.filename) defaultDatastoreConfig.settings.filename = _this.config.filename;

    if (_this.config.compactInterval) defaultDatastoreConfig.settings.compactInterval = _this.config.compactInterval;

    _this.config.datastores.push(defaultDatastoreConfig);
  }

  _this.__initializeProviders()
    .then(function(){
      _this.__updateDatabaseVersions();
    })
    .then(callback)
    .catch(callback);
}

function __updateDatabaseVersions(){

  var _this = this;

  return new Promise(function(resolve, reject){

    var versionUpater = new VersionUpdater(_this, _this.happn.services.system);

    versionUpater.analyzeDB(function(e, analysis){

      if (e) return reject(e);

      if (analysis.isNew) return versionUpdater.writeVersionToDB(analysis.moduleDBVersion, resolve, reject);

      if (analysis.matchingVersion) return resolve(analysis);

      if (!_this.config.autoUpdateDBVersion) return reject(new Error('current database version ' + analysis.currentDBVersion + ' does not match ' + analysis.moduleDBVersion));

      versionUpater.updateDB(analysis, resolve, reject);
    });
  });
}

function upsert(path, data, options, callback) {

  var _this = this;

  if (typeof options === 'function') {

    callback = options;
    options = null;
  }

  options = _this.__getPushOptions(path, options);

  if (data) delete data._meta;

  if (options.set_type === 'sibling') {
    //appends an item with a path that matches the message path - but made unique by a shortid at the end of the path
    if (!_s.endsWith(path, '/')) path += '/';

    path += _this.randomId();
  }

  var setData = _this.formatSetData(path, data);

  if (options.tag) {

    if (data != null) return callback(new Error('Cannot set tag with new data.'));

    setData.data = {};

    options.merge = true;
  }

  if (options.merge) {

    return _this.getOneByPath(path, null, function (e, previous) {

      if (e) return callback(e);

      if (!previous) {

        options.upsertType = 2; //just inserting
        return _this.__upsertInternal(path, setData, options, true, callback);
      }

      for (var propertyName in previous.data)
        if (setData.data[propertyName] == null)
          setData.data[propertyName] = previous.data[propertyName];

      setData.created = previous.created;
      setData.modified = Date.now();
      setData._id = previous._id;

      options.updateType = 1; //updating

      _this.__upsertInternal(path, setData, options, true, callback);
    });
  }

  _this.__upsertInternal(path, setData, options, false, callback);
}

function get(path, parameters, callback) {
  var _this = this;

  if (typeof parameters == 'function') {

    callback = parameters;

    parameters = null;
  }

  try {

    var options = _this.__getPullOptions(path, parameters);

    var provider = _this.db(path);

    provider.find(path, options, function (e, items) {

      if (e) return callback(new Error('Find failed on path: ' + path, e));

      if (path.indexOf('*') == -1) { //this is a single item

        if (items.length == 0) return callback(null, null);

        return callback(null, provider.transform(items[0], null, options.fields));
      }

      if (options.path_only) {
        return callback(e, {
          paths: provider.transformAll(items)
        });
      }

      callback(null, provider.transformAll(items, options.fields));
    });

  } catch (e) {
    callback(new Error('Find failed on path: ' + path, e));
  }
}

function doGet(message, callback) {
  var _this = this;

  return this.get(message.request.path, message.request.options, function (e, response) {

    if (e) return _this.errorService.handleSystem(new Error('doGet failed', e), 'DataService', constants.ERROR_SEVERITY.HIGH, function (e) {
      callback(e, message);
    });

    message.response = response;

    return callback(null, message);
  });
}

function doRemove(message, callback) {

  var _this = this;

  return this.remove(message.request.path, message.request.options, function (e, response) {

    if (e) return _this.errorService.handleSystem(new Error('doRemove failed', e), 'DataService', constants.ERROR_SEVERITY.HIGH, function (e) {
      callback(e, message);
    });

    message.response = response;

    return callback(null, message);
  });
}

function doStore(message, callback) {
  var _this = this;

  if (message.request.path.indexOf('*') > -1) return callback(new Error('error upserting item on path ' + path + ', you can only change a single item, no wildcards are allowed on the path'));

  return this.upsert(message.request.path, message.request.data, message.request.options, function (e, response) {

    if (e) return _this.errorService.handleSystem(new Error('doStore failed', e), 'DataService', constants.ERROR_SEVERITY.HIGH, function (e) {
      callback(e, message);
    });

    message.response = response;

    return callback(null, message);
  });
}

function doSecureStore(message, callback) {
  var _this = this;

  if (!message.request.options) message.request.options = {};

  message.request.options.modifiedBy = message.session.user.username;

  return this.upsert(message.request.path, message.request.data, message.request.options, function (e, response) {

    if (e) return _this.errorService.handleSystem(new Error('doSecureStore failed', e), 'DataService', constants.ERROR_SEVERITY.HIGH, function (e) {
      callback(e, message);
    });

    message.response = response;

    return callback(null, message);
  });
}

function doNoStore(message, callback) {
  var _this = this;

  try {

    message.response = this.formatSetData(message.request.path, message.request.data);

    return callback(null, message);

  } catch (e) {

    _this.errorService.handleSystem(new Error('doNoStore failed', e), 'DataService', constants.ERROR_SEVERITY.HIGH, function (e) {
      callback(e, message);
    });
  }
}

function getOneByPath(path, fields, callback) {
  var _this = this;

  _this.db(path).findOne({
    path: path
  }, fields || {}, function (e, findresult) {

    if (e) return _this.errorService.handleSystem(e, 'DataService', constants.ERROR_SEVERITY.MEDIUM, callback);

    return callback(null, findresult);
  });
}

function insertTag(snapshotData, tag, path, callback) {
  var baseTagPath = '/_TAGS';

  if (path.substring(0, 1) != '/') baseTagPath += '/';

  var tagPath = baseTagPath + path + '/' + this.randomId();

  var tagData = {

    data: snapshotData,

    _tag: tag,

    path: tagPath
  };

  tagData._meta = {
    path: tagPath,
    tag: tag
  };

  if (snapshotData._meta) {

    if (snapshotData._meta.modifiedBy) tagData._meta.modifiedBy = snapshotData._meta.modifiedBy;

    if (snapshotData._meta.createdBy) tagData._meta.createdBy = snapshotData._meta.createdBy;
  }

  this.__upsertInternal(tagPath, tagData, {
    upsertType: this.UPSERT_TYPE.insert,
    noCache: true
  }, false, callback);
}

function saveTag(path, tag, data, callback) {
  if (!data) {

    var _this = this;

    return _this.getOneByPath(path, null, function (e, found) {

      if (e) return callback(e); //handleSystem was already called here

      if (found) return _this.insertTag(found, tag, path, callback);

      callback(new Error('Attempt to tag something that doesn\'t exist in the first place'));
    });
  }

  this.insertTag(data, tag, path, callback);
}

function addDataStoreFilter(pattern, datastoreKey) {
  if (!datastoreKey) throw new Error('missing datastoreKey parameter');

  var dataStore = this.datastores[datastoreKey];

  if (!dataStore) throw new Error('no datastore with the key ' + datastoreKey + ', exists');

  var tagPattern = pattern.toString();

  if (tagPattern.indexOf('/') == 0) tagPattern = tagPattern.substring(1, tagPattern.length);

  this.dataroutes[pattern] = dataStore;

  this.dataroutes['/_TAGS/' + tagPattern] = dataStore;
}

function removeDataStoreFilter(pattern) {
  var tagPattern = pattern.toString();

  if (tagPattern.indexOf('/') == 0) tagPattern = tagPattern.substring(1, tagPattern.length);

  delete this.dataroutes[pattern];
  delete this.dataroutes['/_TAGS/' + tagPattern];
}

function parseFields(fields) {
  traverse(fields).forEach(function (value) {

    if (value) {

      if (value.bsonid) this.update(value.bsonid);

      //ignore elements in arrays
      if (this.parent && Array.isArray(this.parent.node)) return;

      if (typeof this.key == 'string') {

        //ignore directives
        if (this.key.indexOf('$') == 0) return;

        if (META_FIELDS.indexOf(this.key) > -1) return;

        //look in the right place for meta fields if they have been prefixed with meta.
        if (PREFIXED_META_FIELDS.indexOf(this.key) > -1) {

          fields[this.key.replace('_meta.', '')] = value;
          return this.remove();
        }

        if (this.key.indexOf('_data.') == 0) {
          fields[this.key.substring(1)] = value; //remove _
          return this.remove();
        }

        //prepend with data.
        if (this.key.indexOf('data.') != 0) {
          fields['data.' + this.key] = value;
          return this.remove();
        }
      }
    }
  });

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

function transform(dataObj, meta, fields) {
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
  var _this = this;

  return items.map(function (item) {

    return _this.transform(item, null, fields);
  })
}

function formatSetData(path, data, options) {
  if (typeof data != 'object' ||
    data instanceof Array == true ||
    data instanceof Date == true ||
    data == null)

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

DataService.prototype.__upsertInternal = function (path, setData, options, dataWasMerged, callback) {

  var _this = this;

  var provider = _this.db(path);

  provider.upsert(path, setData, options, dataWasMerged, function(e, response, created, upsert, meta){

    if (e) return callback(e);

    if (dataWasMerged) {

      //always merged if being tagged
      if (options.tag) return _this.insertTag(setData, options.tag, path, callback);

      if (created) return callback(null, provider.transform(created));

      setData.path = meta.path;

      return callback(null, provider.transform(setData, meta));

    } else {

      if (created) return callback(null, provider.transform(created));

      setData.path = path;

      callback(null, provider.transform(setData, meta));
    }
  });
}

function remove (path, options, callback) {

  if (typeof options == 'function') callback = options;

  this.db(path).remove(path, function (e, removed) {

    if (e) return callback(new Error('error removing item on path ' + path, e));

    callback(null, removed);
  });
}

function startCompacting(dataStoreKey, interval, callback, compactionHandler) {
  var _this = this;

  try {

    if (typeof dataStoreKey == 'function') {
      compactionHandler = callback;
      callback = dataStoreKey;
      interval = 300000; //defaults the compaction to once every 5 minutes
      dataStoreKey = null;
    }

    if (typeof dataStoreKey == 'number') {
      compactionHandler = callback;
      callback = interval;
      interval = dataStoreKey;
      dataStoreKey = null;
    }

    if (typeof interval == 'function') {
      compactionHandler = callback;
      interval = dataStoreKey;
      callback = interval;
    }

    interval = parseInt(interval.toString());

    if (interval < 5000) throw new Error('interval must be at least 5000 milliseconds');

    _this.__iterateDataStores(dataStoreKey, function (key, dataStore, next) {

      _this.compact(key, interval, next, compactionHandler);

    }, callback);

  } catch (e) {
    _this.errorService.handleSystem(new Error('failure doing db compaction', err), 'DataService', constants.ERROR_SEVERITY.HIGH, callback);
  }
}

function stopCompacting(dataStoreKey, callback) {
  var _this = this;

  if (typeof dataStoreKey == 'function') {
    callback = dataStoreKey;
    dataStoreKey = null;
  }

  _this.__iterateDataStores(dataStoreKey, function (key, dataStore, next) {

      dataStore.persistence.stopAutocompaction();
      delete _this.__compacting[key];
      next();
    },
    callback);
}

function compact(dataStoreKey, //what dataStore - if undefined we will compact all data stores
  interval, //compaction interval
  callback, //callback on compaction cycle started or single compaction ended
  compactionHandler) { //every time a compaction happens this is called

  var _this = this;

  if (typeof interval == 'function') {
    compactionHandler = callback;
    callback = interval;
    interval = null;
  }

  if (typeof dataStoreKey == 'function') {
    callback = dataStoreKey;
    compactionHandler = null;
    interval = null;
    dataStoreKey = null;
  }

  if (dataStoreKey == null) {

    _this.__iterateDataStores(function (key, dataStore, next) {
        _this.compact(key, null, next, null);
      },
      callback);

  } else {

    var dataStore = _this.datastores[dataStoreKey];

    _this.__compacting[dataStoreKey] = dataStore;

    if (interval) _this.__compacting[dataStoreKey].provider.startCompacting(interval, callback, compactionHandler);

    else {

      _this.__compacting[dataStoreKey].provider.compact(function (e) {

        if (e) _this.errorService.handleSystem(new Error('data provider compaction failed', e), 'DataService.compaction', constants.ERROR_SEVERITY.MEDIUM);

        delete _this.__compacting[dataStoreKey];

        callback();
      });
    }
  }
}

function stop(options, callback) {
  if (typeof options === 'function') callback = options;

  try {
    callback();
  } catch (e) {
    callback(e);
  }
}

function __initializeProviders() {

  var _this = this;

  return new Promise(function(resolve, reject){

    var dataStorePos = 0;

    async.eachSeries(_this.config.datastores, function (datastoreConfig, datastoreCallback) {

      try {

        if (dataStorePos == 0) _this.defaultDatastore = datastoreConfig.name; //just in case we haven't set a default

        dataStorePos++;

        var dataStoreInstance = {};

        if (datastoreConfig.settings) dataStoreInstance.settings = datastoreConfig.settings;

        else dataStoreInstance.settings = {};

        if (dataStoreInstance.settings.compactInterval == null &&
          _this.config.compactInterval != null)
          dataStoreInstance.settings.compactInterval = _this.config.compactInterval;

        if (!datastoreConfig.patterns) dataStoreInstance.patterns = [];

        else dataStoreInstance.patterns = datastoreConfig.patterns;

        if (!datastoreConfig.provider) datastoreConfig.provider = './providers/nedb';

        if (datastoreConfig.provider == 'nedb') datastoreConfig.provider = './providers/nedb';

        if (datastoreConfig.provider == 'memory' || datastoreConfig.provider == 'mem') {
          datastoreConfig.provider = './providers/nedb';
          dataStoreInstance.settings.filename = null; //no filename
        }

        var DataProvider = require(datastoreConfig.provider);

        dataStoreInstance.provider = new DataProvider(dataStoreInstance.settings);

        Object.defineProperty(dataStoreInstance, '__service', {
          value: _this
        });

        _this.__attachProviderEvents(datastoreConfig.name, dataStoreInstance.provider);

        dataStoreInstance.provider.initialize(function (e) {

          if (e) return datastoreCallback(e);

          if (dataStoreInstance.provider.transform == null) dataStoreInstance.provider.transform = _this.transform;
          if (dataStoreInstance.provider.transformAll == null) dataStoreInstance.provider.transformAll = _this.transformAll;

          _this.datastores[datastoreConfig.name] = dataStoreInstance;

          //make sure we match the special /_TAGS patterns to find the right db for a tag
          dataStoreInstance.patterns.every(function (pattern) {

            _this.addDataStoreFilter(pattern, datastoreConfig.name);

            return true;
          });

          //forces the default datastore
          if (datastoreConfig.isDefault) _this.defaultDatastore = datastoreConfig.name;

          datastoreCallback();
        });

      } catch (e) {

        datastoreCallback(e);
      }

    }, function (e) {

      if (e) return reject(e);

      _this.db = function (path) {

        for (var dataStoreRoute in _this.dataroutes) {

          if (_this.happn.services.utils.wildcardMatch(dataStoreRoute, path)) return _this.dataroutes[dataStoreRoute].provider;
        }
        return _this.datastores[_this.defaultDatastore].provider;
      };

      resolve();
    });
  });
}

function __detachProviderEvents(provider) {
  if (typeof provider.removeAllListeners != 'function') return;

  provider.removeAllListeners('compaction-successful');
}

//bind to all possible events coming out of a provider - funnel into single 'provider-event'
function __attachProviderEvents(providerKey, provider) {
  var _this = this;

  if (typeof provider.on != 'function') return;

  if (!_this.__providerEventHandlers) _this.__providerEventHandlers = {};

  var providerEventsHandler = function (data) {
    this.service.emit('provider-event', {
      eventName: this.eventName,
      eventData: data,
      provider: this.providerKey
    });
  };

  //only one event so far, but there could be more, use bind to ensure we emit the correct eventName etc.
  provider.on('compaction-successful', providerEventsHandler.bind({
    service: _this,
    providerKey: providerKey,
    eventName: 'compaction-successful'
  }));

  _this.__providerEventHandlers[providerKey] = providerEventsHandler;
}

function __getPullOptions(path, parameters) {
  var returnParams = {
    criteria: null,
    options: null
  };

  if (parameters) {

    returnParams.options = parameters.options || {};

    if (!parameters.options) parameters.options = {};

    if (parameters.path_only || parameters.options.path_only) returnParams.options.fields = {
      _meta: 1
    };

    if (parameters.fields || parameters.options.fields) {

      returnParams.options.fields = this.parseFields(parameters.options.fields || parameters.fields);
      returnParams.options.fields._meta = 1;
    }

    if (parameters.sort || parameters.options.sort) returnParams.options.sort = this.parseFields(parameters.sort || parameters.options.sort);

    if (parameters.criteria) returnParams.criteria = this.parseFields(parameters.criteria);

  } else returnParams.options = {};

  return returnParams;
}

function __getPushOptions(path, parameters) {

  var options = {};

  if (parameters) options = this.happn.services.utils.clone(parameters);

  return options;
}

function __upsertInternal(path, setData, options, dataWasMerged, callback) {
  var _this = this;

  var provider = _this.db(path);

  provider.upsert(path, setData, options, dataWasMerged, function (e, response, created, upsert, meta) {

    if (dataWasMerged) {

      //always merged if being tagged
      if (options.tag) return _this.insertTag(setData, options.tag, path, callback);

      if (created) return callback(null, provider.transform(created));

      setData.path = meta.path;

      return callback(null, provider.transform(setData, meta));

    } else {

      if (created) return callback(null, provider.transform(created));

      setData.path = path;

      callback(null, provider.transform(setData, meta));
    }
  });
}

function __iterateDataStores(dataStoreKey, operator, callback) {
  var _this = this;

  try {

    if (typeof dataStoreKey == 'function') {

      callback = operator;
      operator = dataStoreKey;
      dataStoreKey = null;
    }

    if (dataStoreKey) {

      if (!_this.datastores) return callback(new Error('datastore with key ' + dataStoreKey + ', specified, but multiple datastores not configured'));

      if (!_this.datastores[dataStoreKey]) return callback(new Error('datastore with key ' + dataStoreKey + ', does not exist'));

      return operator(dataStoreKey, _this.datastores[dataStoreKey], callback);
    }

    if (_this.datastores) {

      async.eachSeries(Object.keys(_this.datastores), function (key, next) {

        operator(key, _this.datastores[key], next);
      }, callback);
    } else {

      return operator('default', {
        db: _this.dbInstance,
        config: _this.config
      }, callback);
    }

  } catch (e) {
    callback(e);
  }
}

function randomId(){

  return hyperid();
}


function extractData(data){

  return data.map(function(item){
    return item.data;
  });
}
