var _s = require('underscore.string')
  , traverse = require('traverse')
  , uuid = require('uuid')
  , sift = require('sift')
  , Promise = require('bluebird')
  , url = require('url')
  , async = require('async')
  ;

function DataService(opts) {

  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('Data');
  } else {
    Logger = require('happn-logger');
    Logger.configure({logLevel: 'info'});
  }

  this.log = Logger.createLogger('Data');
  this.log.$$TRACE('construct(%j)', opts);
}

DataService.prototype.UPSERT_TYPE = {
  upsert:0,
  update:1,
  insert:2
};

DataService.prototype.stop = function (options, callback) {

  if (typeof options === 'function') callback = options;

  try {
    callback();
  } catch (e) {
    callback(e);
  }
};

DataService.prototype.doGet = Promise.promisify(function(message, callback){

  return this.get(message.request.path, message.request.options, function(e, response){

    if (e) return callback(e);

    message.response = response;

    return callback(null, message);
  });
});

DataService.prototype.doRemove = Promise.promisify(function(message, callback){

  return this.remove(message.request.path, message.request.options, function(e, response){

    if (e) return callback(e);

    message.response = response;

    return callback(null, message);
  });
});

DataService.prototype.doStore = Promise.promisify(function(message, callback){

  return this.upsert(message.request.path, message.request.data, message.request.options, function(e, response){

    if (e) return callback(e);

    message.response = response;

    return callback(null, message);
  });
});

DataService.prototype.doSecureStore = Promise.promisify(function(message, callback){

  if (!message.request.options) message.request.options = {};

  message.request.options.modifiedBy = message.session.user.username;

  return this.upsert(message.request.path, message.request.data, message.request.options, function(e, response){

    if (e) return callback(e);

    message.response = response;

    return callback(null, message);
  });
});

DataService.prototype.doNoStore = Promise.promisify(function(message, callback){

  message.response = this.formatSetData(message.request.path, message.request.data);

  return callback(null, message);
});

DataService.prototype.initialize = function (config, callback) {

  var _this = this;

  _this.datastores = {};

  _this.dataroutes = {};

  _this.config = config;

  var dataStorePos = 0;

  if (!_this.config.datastores) _this.config.datastores = [];

  if (_this.config.datastores.length == 0) { //insert the default nedb data store

    var defaultDatastoreConfig = {
      name:'default',
      provider:'nedb',
      isDefault:true,
      settings:{}
    };

    if (_this.config.dbfile) _this.config.filename = _this.config.dbfile;

    if (_this.config.filename) defaultDatastoreConfig.settings.filename = _this.config.filename;

    _this.config.datastores.push(defaultDatastoreConfig);
  }

  async.eachSeries(_this.config.datastores, function(datastoreConfig, datastoreCallback){

    try {

      if (dataStorePos == 0) _this.defaultDatastore = datastoreConfig.name;//just in case we havent set a default

      dataStorePos++;

      var dataStoreInstance = {};

      if (datastoreConfig.settings) dataStoreInstance.settings = datastoreConfig.settings;

      else dataStoreInstance.settings = {};

      if (!datastoreConfig.patterns) dataStoreInstance.patterns = [];

      else dataStoreInstance.patterns = datastoreConfig.patterns;

      if (!datastoreConfig.provider) datastoreConfig.provider = './providers/nedb';

      if (datastoreConfig.provider == 'nedb') datastoreConfig.provider = './providers/nedb';

      if (datastoreConfig.provider == 'memory' || datastoreConfig.provider == 'mem') datastoreConfig.provider = './providers/memory';

      var DataProvider = require(datastoreConfig.provider);

      dataStoreInstance.provider = new DataProvider(dataStoreInstance.settings);

      Object.defineProperty(dataStoreInstance, '__service', {value:_this});

      dataStoreInstance.provider.initialize(function (e) {

        if (e) return datastoreCallback(e);

        if (dataStoreInstance.provider.transform == null)  dataStoreInstance.provider.transform = _this.transform;
        if (dataStoreInstance.provider.transformAll == null)  dataStoreInstance.provider.transformAll = _this.transformAll;

        _this.datastores[datastoreConfig.name] = dataStoreInstance;

        //make sure we match the special /_TAGS patterns to find the right db for a tag
        dataStoreInstance.patterns.every(function (pattern) {

          if (pattern.indexOf('/') == 0) pattern = pattern.substring(1, pattern.length);

          _this.addDataStoreFilter(pattern, datastoreConfig.name);

          return true;
        });

        //forces the default datastore
        if (datastoreConfig.isDefault) _this.defaultDatastore = datastoreConfig.name;

        datastoreCallback();
      });
    }catch(e){
      datastoreCallback(e);
    }

  }, function(e){

    if (e) return callback(e);

    _this.db = function (path) {

      for (var dataStoreRoute in _this.dataroutes) {

        if (_this.happn.services.utils.wildcardMatch(dataStoreRoute, path)) {

          return _this.dataroutes[dataStoreRoute].provider;
        }
      }
      return _this.datastores[_this.defaultDatastore].provider;
    };

    callback();

  });
};

DataService.prototype.addDataStoreFilter = function (pattern, datastoreKey) {

  if (!datastoreKey) throw new Error('missing datastoreKey parameter');

  var dataStore = this.datastores[datastoreKey];

  if (!dataStore) throw new Error('no datastore with the key ' + datastoreKey + ', exists');

  var tagPattern = pattern.toString();

  if (tagPattern.indexOf('/') == 0) tagPattern = tagPattern.substring(1, tagPattern.length);

  this.dataroutes[pattern] = dataStore;

  this.dataroutes['/_TAGS/' + tagPattern] = dataStore;
};

DataService.prototype.removeDataStoreFilter = function (pattern) {

  var tagPattern = pattern.toString();

  if (tagPattern.indexOf('/') == 0) tagPattern = tagPattern.substring(1, tagPattern.length);

  delete this.dataroutes[pattern];
  delete this.dataroutes['/_TAGS/' + tagPattern];
};

DataService.prototype.getOneByPath = function (path, fields, callback) {

  this.db(path).findOne({path: path}, fields || {}, function (e, findresult) {

    if (e) return callback(e);

    return callback(null, findresult);
  });
};

DataService.prototype.randomId = function(){

  return Date.now() + '_' + uuid.v4().replace(/-/g, '');
};

DataService.prototype.insertTag = function(snapshotData, tag, path, callback){

  var baseTagPath = '/_TAGS';

  if (path.substring(0, 1) != '/') baseTagPath += '/';

  var tagPath = baseTagPath + path + '/' + this.randomId();

  var tagData = {

    data: snapshotData,

    _tag: tag,

    path: tagPath
  };

  tagData._meta = {
    path : tagPath,
    tag : tag
  };

  if (snapshotData._meta){

    if (snapshotData._meta.modifiedBy) tagData._meta.modifiedBy = snapshotData._meta.modifiedBy;

    if (snapshotData._meta.createdBy) tagData._meta.createdBy = snapshotData._meta.createdBy;
  }

  this.__upsertInternal(tagPath, tagData, {upsertType:this.UPSERT_TYPE.insert, noCache:true}, false, callback);

};

DataService.prototype.saveTag = function (path, tag, data, callback) {

  if (!data) {

    var _this = this;

    return _this.getOneByPath(path, null, function (e, found) {

      if (e) return callback(e);

      if (found) return _this.insertTag(found, tag, path, callback);

      return callback(new Error('Attempt to tag something that doesn\'t exist in the first place'));

    });
  }

  this.insertTag(data, tag, path, callback);
};

DataService.prototype.parseFields = function (fields) {

  traverse(fields).forEach(function (value) {

    if (value) {

      if (value.bsonid) this.update(value.bsonid);

      //ignore elements in arrays
      if (this.parent && Array.isArray(this.parent.node)) return;

      if (typeof this.key == 'string') {

        //ignore directives
        if (this.key.indexOf('$') == 0) return;

        //ignore _meta
        if (this.key == '_meta') return;

        //ignore _id
        if (this.key == '_id') return;

        //ignore path
        if (this.key == 'path') return;

        //look in the right place for created
        if (this.key == '_meta.created') {
          fields['created'] = value;
          return this.remove();
        }

        //look in the right place for modified
        if (this.key == '_meta.modified') {
          fields['modified'] = value;
          return this.remove();
        }

        //prepend with data.
        fields['data.' + this.key] = value;
        return this.remove();

      }
    }
  });

  return fields;
};

DataService.prototype.filter = function(criteria, data, callback){

  if (!criteria) return callback(null, data);

  try{

    var filterCriteria = this.parseFields(criteria);

    callback(null, sift(filterCriteria, data));
  }catch(e){
    callback(e);
  }
};

DataService.prototype.__getPullOptions = function(path, parameters){

  var returnParams = {
    criteria:null,
    options:null
  };

  if (parameters){

    returnParams.options = parameters.options || {};

    if (!parameters.options) parameters.options = {};

    if (parameters.path_only || parameters.options.path_only) returnParams.options.fields = {_meta: 1};

    if (parameters.fields || parameters.options.fields){

      returnParams.options.fields = this.parseFields(parameters.options.fields || parameters.fields);
      returnParams.options.fields._meta = 1;
    }

    if (parameters.sort || parameters.options.sort) returnParams.options.sort = this.parseFields(parameters.sort || parameters.options.sort);

    if (parameters.criteria) returnParams.criteria = this.parseFields(parameters.criteria);

  } else returnParams.options = {};

  return returnParams;
};

DataService.prototype.get = function (path, parameters, callback) {

  var _this = this;

  if (typeof parameters == 'function') {

    callback = parameters;
    parameters = null;
  }

  try {

    var options = _this.__getPullOptions(path, parameters);

    var provider = _this.db(path);

    provider.find(path, options, function (e, items) {

      if (e) return callback(e);

      if (path.indexOf('*') == -1) {//this is a single item

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
    callback(e);
  }
};

DataService.prototype.__getPushOptions = function(path, parameters){

  var options = {};

  if (parameters) options = this.happn.services.utils.clone(parameters);

  return options;
};

DataService.prototype.upsert = function (path, data, options, callback) {

  var _this = this;

  if (typeof options === 'function'){

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

        options.upsertType = 2;//just inserting
        return _this.__upsertInternal(path, setData, options, true, callback);
      }

      for (var propertyName in previous.data)
        if (setData.data[propertyName] == null)
          setData.data[propertyName] = previous.data[propertyName];

      setData.created = previous.created;
      setData.modified = Date.now();
      setData._id = previous._id;

      options.updateType = 1;//updating

      _this.__upsertInternal(path, setData, options, true, callback);
    });
  }

  _this.__upsertInternal(path, setData, options, false, callback);
};

DataService.prototype.transform = function (dataObj, meta, fields) {

  var transformed = {data:dataObj.data};

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
};

DataService.prototype.transformAll = function (items, fields) {

  var _this = this;

  return items.map(function (item) {

    return _this.transform(item, null, fields);
  })
};

DataService.prototype.formatSetData = function (path, data, options) {

  if (typeof data != 'object' ||
    data instanceof Array == true ||
    data instanceof Date == true ||
    data == null)

    data = {value: data};

  if (options && options.modifiedBy)
    return {
      data: data,
      _meta: {
        path: path,
        modifiedBy:options.modifiedBy
      }
    };

  return {
    data: data,
    _meta: {
      path: path
    }
  };
};

DataService.prototype.__upsertInternal = function (path, setData, options, dataWasMerged, callback) {

  var _this = this;

  var provider = _this.db(path);

  provider.upsert(path, setData, options, dataWasMerged, function(e, response, created, upsert, meta){

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
};

DataService.prototype.remove = function (path, options, callback) {

  this.db(path).remove(path, function (err, removed) {

    if (err) return callback(err);

    callback(null, removed);
  });
};

DataService.prototype.__compacting = {};

DataService.prototype.startCompacting = function (dataStoreKey, interval, callback, compactionHandler) {
  try {

    if (typeof dataStoreKey == 'function') {
      compactionHandler = callback;
      callback = dataStoreKey;
      interval = 300000;//defaults the compaction to once every 5 minutes
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

    var _this = this;

    _this.__iterateDataStores(dataStoreKey, function (key, dataStore, next) {

        _this.compact(key, interval, next, compactionHandler);
      },
      callback);

  } catch (e) {
    callback(e);
  }
};

DataService.prototype.stopCompacting = function (dataStoreKey, callback) {

  var _this = this;

  if (typeof dataStoreKey == 'function'){
    callback = dataStoreKey;
    dataStoreKey = null;
  }

  _this.__iterateDataStores(dataStoreKey, function (key, dataStore, next) {

      dataStore.persistence.stopAutocompaction();
      delete _this.__compacting[key];
      next();
    },
    callback);
};

DataService.prototype.compact = function (dataStoreKey, interval, callback, compactionHandler) {

  if (typeof interval == 'function'){
    compactionHandler = callback;
    callback = interval;
    interval = null;
  }

  var dataStore = this.datastores[dataStoreKey];

  this.__compacting[key] = dataStore;

  if (interval) this.__compacting[key].startCompacting(interval, callback, compactionHandler);

  else this.__compacting[key].compact(callback);
};

DataService.prototype.__iterateDataStores = function (dataStoreKey, operator, callback) {

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

      return operator('default', {db: _this.dbInstance, config: _this.config}, callback);
    }

  } catch (e) {
    callback(e);
  }
};

module.exports = DataService;
