var async = require('async')
  , db = require('happn-nedb')
  ;

function NedbProvider (settings){

  if (settings.dbfile) //backward compatable
    settings.filename = settings.dbfile;

  if (settings.filename) settings.autoload = true;//we definately autoloading

  settings.timestampData = true;

  this.settings = settings;
}

NedbProvider.prototype.initialize = function(callback){

  this.db = new db(this.settings);
  callback();
};

NedbProvider.prototype.findOne = function(criteria, fields, callback){

  return this.db.findOne(criteria, fields, callback);
};

NedbProvider.prototype.find = function(criteria, searchOptions, sortOptions, callback){

  if (!sortOptions) return this.data
    .find(criteria, searchOptions).toArray(callback);

  this.data
    .find(criteria, searchOptions)
    .sort(sortOptions)
    .toArray(callback);
};

var batchData = {};

function BatchDataItem(options, data){

  this.options = options;
  this.queued = [];
  this.callbacks = [];
  this.data = data;

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
  _this.data.insert(emptyQueued, this.options, function(e, response){

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

NedbProvider.prototype.batchInsert = function(data, options, callback){

  var _this = this;

  options.batchTimeout = options.batchTimeout || 500;

  //keyed by our batch sizes
  if (!batchData[options.batchSize]) batchData[options.batchSize] = new BatchDataItem(options, _this.data);

  batchData[options.batchSize].insert(data, callback);

};

NedbProvider.prototype.insert = function(data, options, callback){

  if (this.config.policy.set){
    for(var option in this.config.policy.set){
      if (options[option] === undefined) options[option] = this.config.policy.set[option];
    }
  }

  if (options.batchSize > 0) return this.batchInsert(data, options, callback);

  this.data.insert(data, options, callback);
};

NedbProvider.prototype.update = function(criteria, data, options, callback){

  return this.data.update(criteria, data, {upsert: true}, callback);
};

NedbProvider.prototype.findAndModify = function(criteria, data, callback){

  return this.data.findAndModify(criteria, null, data, {upsert: true, "new": true}, function(e, item){
    if (e) return callback(e);
    if (item) return callback(null, item.value);
    callback(null, null);
  });
};

NedbProvider.prototype.remove = function(criteria, callback){

  return this.data.remove(criteria, {multi: true}, callback);
};

module.exports.create = function(config, callback){

  try{

    var store = new NedbProvider(config);

    store.initialize(function(e){

      if (e) return callback(e);

      callback(null, store);
    });

  }catch(e){
    callback(e);
  }
};
