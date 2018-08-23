module.exports = NedbProvider;

var db = require('happn-nedb'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  BatchDataItem = require('../batch_data_item');

var batchData = {};

util.inherits(NedbProvider, EventEmitter);

NedbProvider.prototype.initialize = initialize;
NedbProvider.prototype.insert = insert;
NedbProvider.prototype.batchInsert = batchInsert;
NedbProvider.prototype.upsert = upsert;
NedbProvider.prototype.increment = increment;
NedbProvider.prototype.update = update;
NedbProvider.prototype.remove = remove;
NedbProvider.prototype.find = find;
NedbProvider.prototype.findOne = findOne;

NedbProvider.prototype.transform = transform;
NedbProvider.prototype.transformAll = transformAll;
NedbProvider.prototype.escapeRegex = escapeRegex;
NedbProvider.prototype.preparePath = preparePath;
NedbProvider.prototype.getPathCriteria = getPathCriteria;

NedbProvider.prototype.startCompacting = startCompacting;
NedbProvider.prototype.stopCompacting = stopCompacting;
NedbProvider.prototype.compact = compact;
NedbProvider.prototype.stop = stop;

NedbProvider.prototype.__getMeta = __getMeta;
NedbProvider.prototype.__attachCompactionHandler = __attachCompactionHandler;

function NedbProvider(settings) {
  if (settings.dbfile) settings.filename = settings.dbfile; //backward compatable

  if (settings.filename) settings.autoload = true; //we definately autoloading

  if (settings.timestampData == null) settings.timestampData = true;

  this.settings = settings;
}

function initialize(callback) {
  this.db = new db(this.settings);

  if (this.settings.compactInterval) return this.startCompacting(this.settings.compactInterval, callback);

  else callback();
}

function insert(data, options, callback) {
  if (options.batchSize > 0) return this.batchInsert(data, options, callback);

  this.db.insert(data, options, callback);
}

function batchInsert(data, options, callback) {
  var _this = this;

  options.batchTimeout = options.batchTimeout || 500;

  //keyed by our batch sizes
  if (!batchData[options.batchSize]) batchData[options.batchSize] = new BatchDataItem(options, _this.db);

  batchData[options.batchSize].insert(data, callback);
}

function increment(path, counterName, increment, callback) {

  var setParameters = {
    $inc: {}
  };

  setParameters.$inc['data.' + counterName + '.value'] = increment;

  var _this = this;

  _this.db.update({
    '_id': path
  }, setParameters, {upsert: true}, function(e){

    if (e) return callback(e);

    var fields = {};

    fields['data.' + counterName + '.value'] = 1;

    _this.findOne({_id:path}, fields, function(e, found){

      if (e) return callback(new Error('increment happened but fetching new value failed: ' + e.toString()));

      callback(null, found.data[counterName].value);
    });
  });
}

function upsert(path, setData, options, dataWasMerged, callback) {
  var _this = this;

  var setParameters = {
    $set: {
      'data': setData.data,
      '_id': path,
      'path': path
    }
  };

  if (options.modifiedBy) setParameters.$set.modifiedBy = options.modifiedBy;

  if (setData._tag) setParameters.$set._tag = setData._tag;

  if (!options) options = {};

  options.upsert = true;

  _this.db.update({
    '_id': path
  }, setParameters, options, function (err, response, created, upserted, meta) {

    if (err) {

      //data with circular references can cause callstack exceeded errors
      if (err.toString() == 'RangeError: Maximum call stack size exceeded') return callback(new Error('callstack exceeded: possible circular data in happn set method'));
      return callback(err);
    }

    if (meta) meta.path = meta._id;

    else meta = _this.__getMeta(created || setParameters.$set);

    callback(null, response, created, upserted, meta);
  });
}

function update(criteria, data, options, callback) {
  return this.db.update(criteria, data, options, callback);
}

function remove(path, callback) {
  return this.db.remove(this.getPathCriteria(path), {
    multi: true
  }, function (e, removed) {

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
}

function find(path, parameters, callback) {
  var _this = this;

  var pathCriteria = _this.getPathCriteria(path);

  if (parameters.criteria) pathCriteria.$and.push(parameters.criteria);

  var searchOptions = {};

  var sortOptions = parameters.options ? parameters.options.sort : null;

  if (parameters.options) {

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
}

function findOne(criteria, fields, callback) {
  return this.db.findOne(criteria, fields, callback);
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

  if (!dataObj._id) {
    transformed._meta._id = transformed.path;
  } else {
    transformed._meta.path = dataObj._id;
    transformed._meta._id = dataObj._id;
  }

  if (dataObj._tag) transformed._meta.tag = dataObj._tag;

  return transformed;
}

function transformAll(items, fields) {
  var _this = this;

  return items.map(function (item) {

    return _this.transform(item, null, fields);
  });
}

function escapeRegex(str) {
  if (typeof str !== 'string') throw new TypeError('Expected a string');

  return str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function preparePath(path) {
  //strips out duplicate sequential wildcards, ie simon***bishop -> simon*bishop

  if (!path) return '*';

  var prepared = '';

  var lastChar = null;

  for (var i = 0; i < path.length; i++) {

    if (path[i] == '*' && lastChar == '*') continue;

    prepared += path[i];

    lastChar = path[i];
  }

  return prepared;
}

function getPathCriteria(path) {
  var pathCriteria = {
    $and: []
  };

  var returnType = path.indexOf('*'); //0,1 == array -1 == single

  if (returnType > -1) {

    //strip out **,***,****
    var searchPath = this.preparePath(path);

    searchPath = '^' + this.escapeRegex(searchPath).replace(/\\\*/g, ".*") + '$';

    pathCriteria.$and.push({
      '_id': {
        $regex: new RegExp(searchPath)
      }
    }); //keys with any prefix ie. */joe/bloggs

  } else pathCriteria.$and.push({
    '_id': path
  }); //precise match

  return pathCriteria;
}

function __getMeta(response) {
  return {
    created: response.created,
    modified: response.modified,
    modifiedBy: response.modifiedBy,
    path: response._id || response.path,
    _id: response._id || response.path
  };
}

function startCompacting(interval, callback, compactionHandler) {
  try {
    if (typeof interval == 'function') {

      compactionHandler = callback;
      callback = interval;
      interval = 60 * 1000 * 5; //5 minutes
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
}

function stopCompacting(callback) {
  this.db.persistence.stopAutocompaction();
  callback();
}

function compact(callback) {
  if (this.db.inMemoryOnly) return callback();

  this.__attachCompactionHandler(callback, true);

  this.db.persistence.compactDatafile();
}

function stop(callback) {
  callback();
}

function __attachCompactionHandler(handler, once) {

  var _this = this;

  var handlerFunc = function (data) {
    _this.emit('compaction-successful', data); //emit as provider
    if (typeof this.handler == 'function') this.handler(data); //do locally bound handler
  }.bind({
    handler: handler
  });

  if (once) return _this.db.once('compaction.done', handlerFunc);

  _this.db.on('compaction.done', handlerFunc);
}
