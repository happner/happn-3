var path = require('path')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , Promise = require('bluebird')
  ;

module.exports = SubscriptionService;

function SubscriptionService(opts) {

  this.log = opts.logger.createLogger('Subscription');

  this.log.$$TRACE('construct(%j)', opts);
}

// Enable subscription to key lifecycle events
util.inherits(SubscriptionService, EventEmitter);

SubscriptionService.prototype.stats = function (opts) {

  var stats = {
    buckets:{}
  };

  this.__buckets.forEach(function(bucket){
    stats.bukets[bucket.options.name] = bucket.stats();
  });

  return stats;
};

SubscriptionService.prototype.processSubscribe = Promise.promisify(function(message, callback){

  try{

    var _this = this;

    _this.addListener(message.request.path, message.session.id, message.request.options, function(e){

      if (e) return callback(e);

      return _this.__doSubscriptionCallback(message, callback);
    });

  }catch(e){
    callback(e);
  }
});

SubscriptionService.prototype.processUnsubscribe = Promise.promisify(function(message, callback){

  try{

    this.removeListener(message.session.id, message.request.path, message.request.options, function(e){

      if (e) return callback(e);

      message.response = {
        data: {},
        _meta: {
          status: 'ok',
          type:'response'
        }
      };

      return callback(null, message);

    });
  }catch(e){
    callback(e);
  }
});

SubscriptionService.prototype.processGetRecipients = Promise.promisify(function(message, callback){
  try{

    this.getRecipients(message, function(e, recipients){

      if (e) return callback(e);

      message.recipients = recipients;

      return callback(null, message);
    });

  }catch(e){
    callback(e);
  }
});

SubscriptionService.prototype.initialize = function (config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    _this.dataService = _this.happn.services.data;

    _this.config = config;

    _this.initializeBuckets(callback);

  } catch (e) {

    callback(e);
  }
};

SubscriptionService.prototype.initializeBuckets = function(callback){

  var _this = this;

  if (!_this.config.buckets) _this.config.buckets = [];

  if (!_this.config.bucketImplementation) _this.config.bucketImplementation = require('./bucket');

  _this.__buckets = [];

  _this.config.buckets.forEach(function(bucketConfig){

    var implementation = bucket.config.implementation || _this.config.bucketImplementation;
    //so we can have different types of bucket

    _this.__buckets.push(new implementation({
      name:bucketConfig.name,
      channel:bucketConfig.channel || '*',//any requests
      terminate:bucketConfig.terminate || false,//forget about any further subscriptions if true
      type:bucketConfig.type || 1
    }));
  });

  //SET only
  _this.__buckets.push(new _this.config.bucketImplementation({
    name:'__listeners_SET',
    channel:'/SET@*', //all SET requests
    type:1//type 1 bucket is a precise filter - we get recipients that match the precise incoming path
  }));

  //REMOVE only
  _this.__buckets.push(new _this.config.bucketImplementation({
    name:'__listeners_REMOVE',
    channel:'/REMOVE@*', //all REMOVE requests
    type:1///type 1 bucket is a precise filter - we get recipients that match the precise incoming path
  }));

  //ALL any
  _this.__buckets.push(new _this.config.bucketImplementation({
    name:'__listeners_ONALL',
    channel:'/*@*'//match any request
  }));

  async.eachSeries(_this.__buckets, function(bucketInstance, bucketInstanceCB){

    bucketInstance.initialize(bucketInstanceCB);
  }, callback);

};

SubscriptionService.prototype.getBuckets = function(channel, first){

  var _this = this;
  var found = [];
  var terminated = false;

  _this.__buckets.forEach(function(bucket){

    if (_this.happn.services.utils.wildcardMatch(bucket.options.channel, channel) && terminated == false){

      found.push(bucket);

      if (bucket.options.terminate || first) terminated = true;//all buckets following this one will be ignored
    }
  });

  return found;
};

SubscriptionService.prototype.getRecipients = function(message, callback){

  var _this = this;

  var recipients = [];

  var action = message.request.action.toUpperCase();

  var messageChannel = '/' + action + '@' + message.request.path;

  var buckets = _this.getBuckets(messageChannel);

  if (buckets.length == 0) return callback(null, []);

  async.eachSeries(buckets, function(bucket, bucketCB){

    bucket.getSubscriptions(message.request.path, function(e, found){

      if (e) return bucketCB(e);

      found.forEach(function(subscription){
        recipients.push(subscription);
      });

      bucketCB();
    });

  }, function(e){

    callback(e, recipients);
  });
};

SubscriptionService.prototype.__doSubscriptionCallback = function (message, callback) {

  var _this = this;

  var data = {
    data: {},
    _meta: {
      status: 'ok'
    }
  };

  var doCallback = function () {

    message.response = data;
    callback(null, message);
  };

  var dataPath = message.request.path.split('@')[1];

  if (message.request.options.initialCallback || message.request.options.initialEmit) {

    _this.dataService.get(dataPath, {sort: {'modified': 1}}, function (e, initialItems) {

      if (e) {
        data._meta.status = 'error';
        data.data = e.toString();
        return doCallback();
      }

      if (!initialItems) initialItems = [];

      if (initialItems && !Array.isArray(initialItems)) initialItems = [initialItems];

      data.initialValues = initialItems;

      doCallback();
    });

  } else doCallback();
};

SubscriptionService.prototype.addListener = function (channel, sessionId, parameters, callback) {

  var bucket = this.getBuckets(channel, true)[0];

  bucket.addSubscription(channel.split('@')[1], sessionId, parameters, callback);
};

SubscriptionService.prototype.removeListener = function (sessionId, channel, parameters, callback) {

  var bucket = this.getBuckets(channel, true)[0];

  bucket.removeSubscription(channel.split('@')[1], sessionId, callback);
};

SubscriptionService.prototype.clearSubscriptions = function(sessionId){

};
