var path = require('path')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , constants = require('../../constants')
  ;

module.exports = SubscriptionService;

function SubscriptionService(opts) {

  this.log = opts.logger.createLogger('Subscription');

  this.log.$$TRACE('construct(%j)', opts);
}

// Enable subscription to key lifecycle events
util.inherits(SubscriptionService, EventEmitter);

SubscriptionService.prototype.initialize = function (config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    _this.dataService = _this.happn.services.data;

    _this.config = config;

    if (typeof _this.config.filter == 'function') {

      Object.defineProperty(_this, 'originalGetRecipients', {value: _this.getRecipients});

      _this.getRecipients = function (message, getRecipientsCallback) {

        _this.originalGetRecipients(message, function (e, recipients) {

          if (e) return getRecipientsCallback(e);

          try {
            _this.config.filter(message, recipients, function (e, filtered) {

              if (e) return getRecipientsCallback(e);

              getRecipientsCallback(null, filtered);
            });
          } catch (e) {
            getRecipientsCallback(e);
          }
        });
      };
    }

    _this.initializeBuckets(callback);

  } catch (e) {

    callback(e);
  }
};

SubscriptionService.prototype.stats = function (opts) {

  var stats = {
    buckets: {}
  };

  this.__buckets.forEach(function (bucket) {
    stats.buckets[bucket.options.name] = bucket.stats();
  });

  return stats;
};

SubscriptionService.prototype.prepareSubscribeMessage = function (message, callback) {

  try {

    message.request.pathData = {parts: message.request.path.split('@')};

    message.request.pathData.action = message.request.pathData.parts[0].replace('/', '');

    if (message.request.pathData.parts.length > 2) {

      message.request.key = message.request.pathData.parts.slice(1, message.request.pathData.parts.length).join('@');

    } else message.request.key = message.request.pathData.parts[1];

    callback(null, message);

  } catch (e) {
    callback(e);
  }
};

SubscriptionService.prototype.processSubscribe = function (message, callback) {

  try {

    var _this = this;

    _this.addListener(message.request.path, message.request.key, message.session.id, {
      options: message.request.options,
      session: message.session
    }, function (e) {

      if (e)
        return _this.happn.services.error.handleSystem(new Error('subscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e){
          callback(e, message);
        });


      return _this.__doSubscriptionCallback(message, callback);
    });

  } catch (e) {
    if (e) return this.happn.services.error.handleSystem(new Error('subscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e){
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.processUnsubscribe = function (message, callback) {

  try {

    var _this = this;

    _this.removeListener(message.session.id, message.request.path, message.request.key, message.request.options, function (e) {

      if (e) return _this.happn.services.error.handleSystem(new Error('unsubscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.HIGH, function(e){
        callback(e, message);
      });

      message.response = {
        data: {},
        _meta: {
          status: 'ok',
          type: 'response'
        }
      };

      return callback(null, message);

    });
  } catch (e) {
    this.happn.services.error.handleSystem(new Error('unsubscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.HIGH, function(e){
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.processGetRecipients = function (message, callback) {

  try {

    var _this = this;

    _this.getRecipients(message, function (e, recipients) {

      if (e) return _this.happn.services.error.handleSystem(new Error('get recipients failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e){
        callback(e, message);
      });

      message.recipients = recipients;

      return callback(null, message);
    });

  } catch (e) {

    this.happn.services.error.handleSystem(new Error('get recipients failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e){
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.initializeBuckets = function (callback) {

  var _this = this;

  if (!_this.config.buckets) _this.config.buckets = [];

  if (!_this.config.bucketImplementation) _this.config.bucketImplementation = require('./bucket');

  _this.__buckets = [];

  _this.config.buckets.forEach(function (bucketConfig) {

    var implementation = bucketConfig.implementation || _this.config.bucketImplementation;
    //so we can have different types of bucket

    _this.__buckets.push(new implementation({
      name: bucketConfig.name,
      channel: bucketConfig.channel || '*',//any requests
      terminate: bucketConfig.terminate || false//forget about any further subscriptions if true
    }));
  });

  //SET only
  _this.__buckets.push(new _this.config.bucketImplementation({
    name: '__listeners_SET',
    channel: '/SET@*' //all SET requests
  }));

  //REMOVE only
  _this.__buckets.push(new _this.config.bucketImplementation({
    name: '__listeners_REMOVE',
    channel: '/REMOVE@*' //all REMOVE requests
  }));

  //ALL any
  _this.__buckets.push(new _this.config.bucketImplementation({
    name: '__listeners_ONALL',
    channel: '*'//match any request
  }));

  async.eachSeries(_this.__buckets, function (bucketInstance, bucketInstanceCB) {

    bucketInstance.initialize(bucketInstanceCB);
  }, callback);

};

SubscriptionService.prototype.getBuckets = function (channel, first) {

  var _this = this;

  var found = [];

  _this.__buckets.every(function (bucket) {

    if (_this.happn.services.utils.wildcardMatch(bucket.options.channel, channel)) {

      found.push(bucket);

      if (bucket.options.terminate || first) return false;//all buckets following this one will be ignored
    }

    return true;
  });

  return found;
};

SubscriptionService.prototype.__filterTargetRecipients = function (targetClients, recipients, callback) {

  recipients = recipients.filter(function (recipient) {
    if (targetClients.indexOf(recipient.subscription.sessionId) > -1) return true;
    else return false;
  });

  callback(null, recipients);
};

SubscriptionService.prototype.getRecipients = function (message, callback) {

  var _this = this;

  var recipients = [];

  var action = message.request.action.toUpperCase();

  var messageChannel = '/' + action + '@' + message.request.path;

  var buckets = _this.getBuckets(messageChannel);

  if (buckets.length == 0) return callback(null, []);

  async.eachSeries(buckets, function (bucket, bucketCB) {

    bucket.getSubscriptions(message.request.path, function (e, found) {

      if (e) return bucketCB(e);

      found.forEach(function (subscription) {
        recipients.push(subscription);
      });

      bucketCB();
    });

  }, function (e) {

    if (message.request.options && message.request.options.targetClients) return _this.__filterTargetRecipients(message.request.options.targetClients, recipients, callback);

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

SubscriptionService.prototype.addListener = function (channel, key, sessionId, parameters, callback) {

  var bucket = this.getBuckets(channel, true)[0];

  bucket.addSubscription(key, sessionId, parameters, callback);
};

SubscriptionService.prototype.removeListener = function (sessionId, channel, key, parameters, callback) {

  if (channel == '*') return this.clearSubscriptions(sessionId, callback);

  var bucket = this.getBuckets(channel, true)[0];

  bucket.removeSubscription(key, sessionId, parameters, callback);
};

SubscriptionService.prototype.clearSubscriptions = function (sessionId, callback) {

  var _this = this;

  async.eachSeries(_this.__buckets, function (bucket, bucketCB) {

    bucket.removeAllSubscriptions(sessionId, bucketCB);

  }, callback);

};


