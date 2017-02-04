var _s = require('underscore.string')
  , traverse = require('traverse')
  , uuid = require('node-uuid')
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

  if (typeof options === 'function')
    callback = options;

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

  async.eachSeries(_this.config.datastores, function(datastoreConfig, datastoreCallback){

    if (dataStorePos == 0) _this.defaultDatastore = datastoreConfig.name;//just in case we havent set a default

    dataStorePos++;

    var dataStore = {

    };

    if (datastoreConfig.settings) dataStore.settings = datastoreConfig.settings;

    else dataStore.settings = {};

    if (!datastoreConfig.patterns) dataStore.patterns = [];

    else dataStore.patterns = [];

    if (!datastoreConfig.provider) datastoreConfig.provider = './providers/nedb';

    if (datastoreConfig.provider == 'nedb') datastoreConfig.provider = './providers/nedb';

    if (datastoreConfig.provider == 'memory' || datastoreConfig.provider == 'mem') datastoreConfig.provider = './providers/memory';

    var DataProvider = require(datastoreConfig.provider);

    dataStore.provider = new DataProvider(dataStore.settings);

    dataStore.provider.initialize(function(e){

      if (e) return datastoreCallback(e);

      _this.datastores[datastoreConfig.name] = dataStore;

      //make sure we match the special /_TAGS patterns to find the right db for a tag
      dataStore.patterns.every(function (pattern) {

        if (pattern.indexOf('/') == 0) pattern = pattern.substring(1, pattern.length);

        _this.addDataStoreFilter(pattern, datastoreConfig.name);

        return true;
      });

      //forces the default datastore
      if (datastoreConfig.isDefault) _this.defaultDatastore = datastoreConfig.name;

    });

  }, function(e){

    if (e) return callback(e);

    _this.db = function (path) {

      for (var dataStoreRoute in _this.dataroutes) if (_this.happn.services.utils.wildcardMatch(dataStoreRoute, path)) {

        return _this.dataroutes[dataStoreRoute].provider;
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

  if (tagPattern.indexOf('/') == 0)
    tagPattern = tagPattern.substring(1, tagPattern.length);

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

DataService.prototype.__doFind = function(path, searchOptions, sortOptions, callback){

  var _this = this;

  if (!sortOptions) return _this.db(path)
    .find(_this.getPathCriteria(path), searchOptions, null, callback);

  _this.db(path)
    .find(_this.getPathCriteria(path), searchOptions, _this.parseFields(sortOptions), callback);

};

DataService.prototype.getPathCriteria = function(path){

  var returnType = path.indexOf('*'); //0,1 == array -1 == single

  if (returnType == 0) return {'path': {$regex: new RegExp(path.replace(/[*]/g, '.*'))}};//keys with any prefix ie. */joe/bloggs

  else if (returnType > 0) return {'path': {$regex: new RegExp('^' + path.replace(/[*]/g, '.*'))}};//keys that start with something but any suffix /joe/*/bloggs/*

  else return {'path': path}; //precise match
};

DataService.prototype.get = function (path, parameters, callback) {

  var _this = this;

  try {

    if (typeof parameters == 'function') {
      callback = parameters;
      parameters = null;
    }

    var dbFields = {};

    if (!parameters) parameters = {options:{}};

    else {

      if (!parameters.options) parameters.options = {};

      else {

        if (parameters.options.path_only) dbFields = {_meta: 1};

        else if (parameters.options.fields){

          dbFields = parameters.options.fields;
          dbFields._meta = 1;

          dbFields = _this.parseFields(dbFields);//only necessary if we passed in fields
        }
      }
    }

    var searchOptions = {fields:dbFields};

    _this.__doFind(path, searchOptions, parameters.options.sort, function (e, items) {

      if (e) return callback(e);

      if (path.indexOf('*') == -1) {//this is a single item
        if (items.length == 0) return callback(null, null);
        return callback(null, _this.transform(items[0], null, parameters.options.fields));
      }

      _this.filter(parameters.criteria, items, function(e, filtered){

        if (e) return callback(e);

        if (parameters.options.limit) filtered = filtered.slice(0, parameters.options.limit);

        if (parameters.options.path_only) {
          return callback(e, {
            paths: _this.transformAll(filtered)
          });
        }

        callback(null, _this.transformAll(filtered, parameters.options.fields));
      });
    });

  } catch (e) {
    callback(e);
  }
};

DataService.prototype.upsert = function (path, data, options, callback) {

  var _this = this;

  if (typeof options === 'function'){
    callback = options;
    options = null;
  }

  options = options ? options : {};

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

  if (fields) for (var fieldName in transformed) if (fields[fieldName] != 1) delete transformed[fieldName];

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

  var modifiedOn = Date.now();

  var setParameters = {
    $set: {"data": setData.data, "path": path, "modified": modifiedOn},
    $setOnInsert: {"created": modifiedOn}
  };

  if (options.tag) return this.saveTag(path, options.tag, setData, callback);

  var _this = this;

  if (setData._tag) setParameters.$set._tag = setData._tag;

  if (setData._meta && setData._meta.modifiedBy) setParameters.$set.modifiedBy = setData._meta.modifiedBy;

  if (options.upsertType === _this.UPSERT_TYPE.insert){
    //cheapest, but may break if duplicates found
    return _this.db(path).insert(setParameters.$set, options, function (err, response) {

      if (err) return callback(err);

      callback(null, _this.transform(response.ops[0]));

    });
  }

  if (options.upsertType === _this.UPSERT_TYPE.update){
    //updating and matching to a doc
    return _this.db(path).update({"path": path}, setParameters, options, function (err) {

      if (err) return callback(err);

      callback(null, _this.transform(setParameters.$set));

    });
  }
  //default - as previous a findAndModify - costly

  _this.db(path).findAndModify({"path": path}, setParameters, function (err, response) {

    if (err) return callback(err);

    callback(null, _this.transform(response));
  });
};

DataService.prototype.remove = function (path, options, callback) {

  this.db(path).remove(this.getPathCriteria(path), function (err, removed) {

    if (err) return callback(err);

    callback(null, {
      'data': {
        removed: removed.result.n
      },
      '_meta': {
        timestamp: Date.now(),
        path: path
      }
    });
  });

};

DataService.prototype.compact = function (dataStoreKey, callback) {
  this.log.warn('compact not implemented');
  callback();
};

DataService.prototype.startCompacting = function (dataStoreKey, interval, callback, compactionHandler) {
  this.log.warn('startCompacting not implemented');
  callback();
};

DataService.prototype.stopCompacting = function (dataStoreKey, callback) {
  this.log.warn('stopCompacting not implemented');
  callback();
};

module.exports = DataService;

//stopCompacting
