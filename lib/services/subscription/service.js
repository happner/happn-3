var path = require('path')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , Promise = require('bluebird')
  , RecipientBucket = require('./bucket')
  ;

module.exports = SubscriptionService;

function SubscriptionService(opts) {

  this.log = opts.logger.createLogger('Subscription');
  this.log.$$TRACE('construct(%j)', opts);

  this.__listeners_SET = {};
  this.__listeners_REMOVE = {};
  this.__listeners_ALL = {};
  this.__listeners_ONALL = {};
  this.__listeners_wildcard_ALL = {};
  this.__listeners_wildcard_SET = {};
  this.__listeners_wildcard_REMOVE = {};

  this.__reservedMetaKeys = [
    'created',
    'modified',
    'path',
    'action',
    'type',
    'published',
    'status',
    'eventId',
    'sessionId'
  ];

}

// Enable subscription to key lifecycle events
util.inherits(SubscriptionService, EventEmitter);

SubscriptionService.prototype.stats = function (opts) {
  return {
    listeners_SET: this.__listeners_SET,
    listeners_REMOVE: this.__listeners_REMOVE,
    listeners_ALL: this.__listeners_ALL,
    listeners_ONALL: this.__listeners_ONALL,
    listeners_wildcard_ALL: this.__listeners_wildcard_ALL,
    listeners_wildcard_SET: this.__listeners_wildcard_SET,
    listeners_wildcard_REMOVE: this.__listeners_wildcard_REMOVE
  }
};

SubscriptionService.prototype.processSubscribe = Promise.promisify(function(message, callback){
  try{

    this.addListener(message.request.path, message.session.id, message.request.options);

    return this.__doSubscriptionCallback(message, callback);

  }catch(e){
    callback(e);
  }
});

SubscriptionService.prototype.processUnsubscribe = Promise.promisify(function(message, callback){
  try{

    this.removeListener(message.session.id, message.request.path, message.request.options);

    message.response = {
      data: {},
      _meta: {
        status: 'ok',
        type:'response'
      }
    };

    return callback(null, message);

  }catch(e){
    callback(e);
  }
});

SubscriptionService.prototype.processGetRecipients = Promise.promisify(function(message, callback){
  try{

    message.recipients = this.getRecipients(message);

    return callback(null, message);

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

    _this.securityService = _this.happn.services.security;

    _this.queueService = _this.happn.services.queue;

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

  _this.__buckets.push(new _this.config.bucketImplementation({
    name:'__listeners_ONALL',
    channel:'*',//match any request
    type:0//type 0 bucket means it is unfiltered - we get all recipients
  }));

  _this.__buckets.push(new _this.config.bucketImplementation({
    name:'__listeners_ALL',
    channel:'*', //all precise requests
    type:1//type 1 bucket is a precise filter - we get recipients that match the precise incoming path
  }));

  _this.__buckets.push(new _this.config.bucketImplementation({
    name:'__listeners_SET',
    channel:'/SET/@*', //all SET requests
    type:1//type 1 bucket is a precise filter - we get recipients that match the precise incoming path
  }));

  _this.__buckets.push(new _this.config.bucketImplementation({
    name:'__listeners_REMOVE',
    channel:'/REMOVE/@*', //all REMOVE requests
    type:1///type 1 bucket is a precise filter - we get recipients that match the precise incoming path
  }));

  async.eachSeries(_this.__buckets, function(bucketInstance, bucketInstanceCB){

    bucketInstance.initialize(bucketInstanceCB);
  }, callback);

};

SubscriptionService.prototype.getBuckets = function(channel){

  var _this = this;
  var found = [];
  var terminated = false;

  _this.__buckets.forEach(function(bucket){

    if (_this.happn.services.utils.wildcardMatch(bucket.options.channel, channel) && terminated == false){

      found.push(bucket);

      if (bucket.options.terminate) terminated = true;//all buckets following this one will be ignored
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
        recipients.push(subscription.data);
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

SubscriptionService.prototype.addListener = function (channel, sessionId, parameters) {

  var audienceGroup = this.getAudienceGroup(channel);

  if (!audienceGroup[channel]) audienceGroup[channel] = {};

  var refCount = parameters.refCount;

  if (!refCount) refCount = 1;

  if (!audienceGroup[channel][sessionId]) audienceGroup[channel][sessionId] = refCount;

  else audienceGroup[channel][sessionId] += refCount;
};

SubscriptionService.prototype.decrementEventReference = function (audienceGroup, sessionId, channel, refCount) {

  if (!channel) {
    for (var channel in audienceGroup) {
      if (audienceGroup[channel]) {

        if (audienceGroup[channel][sessionId])
          delete audienceGroup[channel][sessionId];

        if (Object.keys(audienceGroup[channel]).length == 0)
          delete audienceGroup[channel];
      }
    }
  } else {
    if (audienceGroup[channel] && audienceGroup[channel][sessionId]) {
      audienceGroup[channel][sessionId] -= refCount;//decrement the listener counter

      if (audienceGroup[channel][sessionId] <= 0) {
        delete audienceGroup[channel][sessionId];

        if (Object.keys(audienceGroup[channel]).length == 0)
          delete audienceGroup[channel];
      }
    }
  }
};

SubscriptionService.prototype.removeListener = function (sessionId, channel, parameters) {
  if (channel == '*') {
    this.decrementEventReference(this.__listeners_SET, sessionId);
    this.decrementEventReference(this.__listeners_REMOVE, sessionId);
    this.decrementEventReference(this.__listeners_ALL, sessionId);
    this.decrementEventReference(this.__listeners_ONALL, sessionId);
    this.decrementEventReference(this.__listeners_wildcard_ALL, sessionId);
    this.decrementEventReference(this.__listeners_wildcard_SET, sessionId);
    this.decrementEventReference(this.__listeners_wildcard_REMOVE, sessionId);
  } else {
    this.decrementEventReference(this.getAudienceGroup(channel), sessionId, channel, parameters.refCount);
  }
};

SubscriptionService.prototype.getAudienceGroup = function (channel, opts) {

  if (channel == '/ALL@*') return this.__listeners_ONALL; //listeners subscribed to everything

  if (!opts) {
    // opts is missing in calls from addListener() and removeListener()
    opts = {
      hasWildcard: channel.indexOf('*') > -1,
      targetAction: channel.split('@')[0].replace('/', '')
    }
  }

  if (opts.hasWildcard) return this['__listeners_wildcard_' + opts.targetAction];
  return this['__listeners_' + opts.targetAction];
};

SubscriptionService.prototype.clearSubscriptions = function(sessionId){
  this.removeListener(sessionId, '*');
};

SubscriptionService.prototype.getAudienceSessions = function(sessions, opts){

  var sessionIds = Object.keys(sessions);

  if (!opts.targetClients) return sessionIds;

  return sessionIds.reduce(function(matchingSessionIds, sessionId){

    if (opts.targetClients.indexOf(sessionId) > -1) matchingSessionIds.push(sessionId);
    return matchingSessionIds;

  }, []);
};
