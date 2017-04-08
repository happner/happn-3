var db = require('happn-nedb')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  ;

function NedbProvider (settings){

  if (settings.dbfile)  settings.filename = settings.dbfile;//backward compatable

  if (settings.filename) settings.autoload = true;//we definately autoloading

  if (settings.timestampData == null) settings.timestampData = true;

  this.settings = settings;
}

util.inherits(NedbProvider, EventEmitter);

NedbProvider.prototype.initialize = function(callback){

  this.db = new db(this.settings);

  if (this.settings.compactInterval) return this.startCompacting(this.settings.compactInterval, callback);

  else callback();
};

NedbProvider.prototype.transform = function (dataObj, meta) {

  var transformed = {data:dataObj.data};

  if (!meta) {

    meta = {};

    if (dataObj.created) meta.created = dataObj.created;

    if (dataObj.modified) meta.modified = dataObj.modified;

    if (dataObj.modifiedBy) meta.modifiedBy = dataObj.modifiedBy;
  }

  transformed._meta = meta;

  if (!dataObj._id){
    transformed._meta._id = transformed.path;
  } else {
    transformed._meta.path = dataObj._id;
    transformed._meta._id = dataObj._id;
  }

  if (dataObj._tag) transformed._meta.tag = dataObj._tag;

  return transformed;
};

NedbProvider.prototype.transformAll = function (items, fields) {

  var _this = this;

  return items.map(function (item) {

    return _this.transform(item, null, fields);
  })
};

NedbProvider.prototype.getPathCriteria = function(path){

  var pathCriteria = {$and: []};

  var returnType = path.indexOf('*'); //0,1 == array -1 == single

  if (returnType == 0) pathCriteria.$and.push({'_id': {$regex: new RegExp(path.replace(/[*]/g, '.*'))}});//keys with any prefix ie. */joe/bloggs

  else if (returnType > 0) pathCriteria.$and.push({'_id': {$regex: new RegExp('^' + path.replace(/[*]/g, '.*'))}});//keys that start with something but any suffix /joe/*/bloggs/*

  else pathCriteria.$and.push({'_id': path}); //precise match

  return pathCriteria;
};

NedbProvider.prototype.findOne = function(criteria, fields, callback){

  return this.db.findOne(criteria, fields, callback);
};

NedbProvider.prototype.find = function(path, parameters, callback){

  var _this = this;

  var pathCriteria = _this.getPathCriteria(path);

  if (parameters.criteria) pathCriteria.$and.push(parameters.criteria);

  var searchOptions = {};

  var sortOptions = parameters.options?parameters.options.sort:null;

  if (parameters.options){

    if (parameters.options.fields) searchOptions.fields = parameters.options.fields;

    if (parameters.options.limit) searchOptions.limit = parameters.options.limit;
  }

  var cursor = _this.db.find(pathCriteria, searchOptions.fields);

  if (sortOptions) cursor = cursor.sort(sortOptions);

  if (searchOptions.limit) cursor = cursor.limit(searchOptions.limit);

  cursor.exec(function (e, items) {

    if (e) return callback(e);

    callback(null, items);
  });
};

NedbProvider.prototype.update = function(criteria, data, options, callback){

  return this.db.update(criteria, data, options, callback);
};

NedbProvider.prototype.__getMeta = function(response){

  return {
    created:response.created,
    modified:response.modified,
    modifiedBy:response.modifiedBy,
    path:response._id,
    _id:response._id
  };
};

NedbProvider.prototype.upsert = function(path, setData, options, dataWasMerged, callback){

  var _this = this;

  var setParameters = {$set: {'data': setData.data, '_id': path, 'path': path}};

  if (options.modifiedBy) setParameters.$set.modifiedBy = options.modifiedBy;

  if (setData._tag) setParameters.$set._tag = setData._tag;

  if (!options) options = {};

  options.upsert = true;

  _this.db.update({'_id': path}, setParameters, options, function (err, response, created, upsert, meta) {

    if (err) {

      //data with circular references can cause callstack exceeded errors
      if (err.toString() == 'RangeError: Maximum call stack size exceeded') return callback(new Error('callstack exceeded: possible circular data in happn set method'));
      return callback(err);
    }

    if (meta) meta.path = meta._id;

    else meta = _this.__getMeta(created || setParameters.$set);

    callback(null, response, created, upsert, meta);

  }.bind(_this));
};

NedbProvider.prototype.remove = function(path, callback){

  return this.db.remove(this.getPathCriteria(path), {multi: true}, function(e, removed){

    if (e) return callback(e);

    callback(null, {
      'data': {
        removed: removed
      },
      '_meta': {
        timestamp: Date.now(),
        path: path
      }
    });
  });
};

function BatchDataItem(options, db){

  this.options = options;
  this.queued = [];
  this.callbacks = [];
  this.db = db;

}

BatchDataItem.prototype.empty = function(){

  clearTimeout(this.timeout);

  var opIndex = 0;

  var _this = this;

  var emptyQueued = [];

  var callbackQueued = [];

  //copy our insertion data to local scope

  emptyQueued.push.apply(emptyQueued, this.queued);

  callbackQueued.push.apply(callbackQueued, this.callbacks);

  //reset our queues
  this.queued = [];

  this.callbacks = [];

  //insert everything in the queue then loop through the results
  _this.db.insert(emptyQueued, this.options, function(e, response){

    // do callbacks for all inserted items
    callbackQueued.forEach(function(cb){

      if (e) return cb.call(cb, e);

      cb.call(cb, null, {ops:[response.ops[opIndex]]});

      opIndex++;

    });

  }.bind(this));
};

BatchDataItem.prototype.insert = function(data, callback){

  this.queued.push(data);

  this.callbacks.push(callback);

  //epty the queue when we have reached our batch size
  if (this.queued.length >= this.options.batchSize) return this.empty();

  //as soon as something lands up in the queue we start up a timer to ensure it is emptied even when there is a drop in activity
  if (this.queued.length == 1) this.initialize();//we start the timer now
};

BatchDataItem.prototype.initialize = function(){

  //empty our batch based on the timeout
  this.timeout = setTimeout(this.empty.bind(this), this.options.batchTimeout);
};

var batchData = {};

NedbProvider.prototype.batchInsert = function(data, options, callback){

  var _this = this;

  options.batchTimeout = options.batchTimeout || 500;

  //keyed by our batch sizes
  if (!batchData[options.batchSize]) batchData[options.batchSize] = new BatchDataItem(options, _this.db);

  batchData[options.batchSize].insert(data, callback);

};

NedbProvider.prototype.insert = function(data, options, callback){

  if (options.batchSize > 0) return this.batchInsert(data, options, callback);

  this.db.insert(data, options, callback);
};

NedbProvider.prototype.__attachCompactionHandler = function(handler, once){

  var _this = this;

  var handlerFunc = function(data){
    _this.emit('compaction-successful', data);//emit as provider
    if (typeof this.handler == 'function') this.handler(data);//do locally bound handler
  }.bind({handler:handler});

  if (once) return _this.db.once('compaction.done', handlerFunc);

  _this.db.on('compaction.done', handlerFunc);
};

NedbProvider.prototype.startCompacting = function (interval, callback, compactionHandler) {
  try {

    if (typeof interval == 'function') {

      compactionHandler = callback;
      callback = interval;
      interval = 60 * 1000 * 5;//5 minutes
    }

    interval = parseInt(interval.toString());

    if (interval < 5000) throw new Error('interval must be at least 5000 milliseconds');

    if (this.db.inMemoryOnly) return callback();

    this.__attachCompactionHandler(compactionHandler);

    this.db.persistence.setAutocompactionInterval(interval);

    callback();

  } catch (e) {

    callback(e);
  }
};

NedbProvider.prototype.stopCompacting = function (callback) {

  this.db.persistence.stopAutocompaction();
  callback();
};

NedbProvider.prototype.compact = function (callback) {

  if (this.db.inMemoryOnly) return callback();

  this.__attachCompactionHandler(callback, true);

  this.db.persistence.compactDatafile();
};

NedbProvider.prototype.stop = function(callback){
  callback();
};

module.exports = NedbProvider;
