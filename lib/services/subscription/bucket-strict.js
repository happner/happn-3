var SortedObjectArray = require("sorted-object-array")
  , async = require('async')
  , SubscriptionTree = require('./subscription-tree')
  , LRU = require("lru-cache")
  ;

function StrictBucket(options) {

  if (!options.cache) options.cache = {max: 500};

  if (!options.channel) throw new Error('Bucket must be for a specified channel');

  if (!options.name) throw new Error('Bucket must have a name');

  if (options.channel == '*') options.action = 'ALL';

  else options.action = options.channel.split('@')[0].replace('/', '');

  if (!options.pathSessionDelimiter) options.pathSessionDelimiter = '>>>';

  if (!options.subscriptionTree) options.subscriptionTree = {};

  if (!options.subscriptionTree.cache) options.subscriptionTree.cache = options.cache;

  this.options = options;
}

StrictBucket.prototype.initialize = function (callback) {

  try{

    Object.defineProperty(this, '__cache', {value: new LRU(this.options.cache)});

    Object.defineProperty(this, '__catchall_subscriptions', {value: new SortedObjectArray('sessionId')});

    Object.defineProperty(this, '__subscriptions', {value: new SubscriptionTree(this.options.subscriptionTree)});

    callback();

  }catch(e){
    callback(e);
  }
};

StrictBucket.prototype.__getCatchAllSubscriptions = function () {

  var subscriptions = [];

  this.__catchall_subscriptions.array.forEach(function (subscription) {

    subscriptions.push({subscription: subscription, index: -1});
  });

  return subscriptions;
};

StrictBucket.prototype.getSubscriptions = function (path, options, callback) {

  try{

    if (typeof options === 'function') {

      callback = options;
      options = {};
    }

    if (!options) options = {};

    if (!options.fullPath) options.fullPath = path;

    var cache_key = path + '_' + JSON.stringify(options);

    if (this.__cache.has(cache_key)) return callback(null, this.__cache.get(cache_key));

    var _this = this;

    var recipients = _this.__subscriptions.search(path).map(function(recipient, recipientIndex){
      return {subscription:recipient, index:recipientIndex};
    });

    //for * subscriptions
    if (!options.preciseMatch)
      _this.__getCatchAllSubscriptions().forEach(function (recipient) {
        recipients.push(recipient);
      });

    return callback(null, recipients);

  }catch(e){
    callback(e);
  }
};

StrictBucket.prototype.__returnSubscriptions = function (path, subscriptions, cacheKey, callback) {
  //puts our subscriptions into the cache and then does callback
  //this.__cache.set(cacheKey, subscriptions);

  callback(null, subscriptions);
};

StrictBucket.prototype.__addCatchAllSubscription = function (sessionId, data, callback) {

  try{

    var subscriptionIndex = this.__catchall_subscriptions.search(sessionId);

    var subscription;

    var insert = true;

    if (subscriptionIndex > -1) {

      subscription = this.__catchall_subscriptions.array[subscriptionIndex];
      insert = false;
    }
    else
      subscription = {
        sessionId: sessionId,
        data: data,
        refCount: 0,
        fullPath: '*',
        action: this.options.action,
        subscriptionData: {}
      };

    subscription.refCount += data.options.refCount;
    subscription.data = data; //overwritten

    if (data.options.listenerId != null)
      subscription.subscriptionData[data.options.listenerId] = data;

    if (insert) this.__catchall_subscriptions.insert(subscription);

    this.__cache.reset();

    callback();

  }catch(e){
    callback(e);
  }
};

StrictBucket.prototype.addSubscription = function (path, sessionId, data, callback) {

  var _this = this;

  try{

    if (typeof data == 'function') {
      callback = data;
      data = null;
    }

    if (!callback) callback = function () {};//in case we have a StrictBucket that needs a callback

    if (path == '*') return _this.__addCatchAllSubscription(sessionId, data, callback);

    _this.__subscriptions.addSubscription(path, sessionId, data.options.listenerId, data);

    this.__cache.reset();

    callback();

  }catch(e){
    callback(e);
  }
};

StrictBucket.prototype.__removeCatchAllSubscription = function (sessionId, options, callback) {

  try{

    var subscriptionIndex = this.__catchall_subscriptions.search(sessionId);

    if (subscriptionIndex > -1) {

      this.__catchall_subscriptions.array[subscriptionIndex].refCount -= options.refCount;

      if (this.__catchall_subscriptions.array[subscriptionIndex].refCount <= 0)
        this.__catchall_subscriptions.remove(subscriptionIndex);

      this.__cache.reset();
    }

    callback();

  }catch(e){

    callback(e);
  }
};

StrictBucket.prototype.removeAllSubscriptions = function (sessionId, callback) {

  try{

    if (typeof sessionId === 'function') {
      callback = sessionId;
      sessionId = null;
    }

    if (!sessionId) {

      this.__subscriptions.removeSubscriptions();
      this.__catchall_subscriptions.array = [];

    } else {

      var _this = this;

      _this.__subscriptions.removeSubscriptions(sessionId);

      _this.__catchall_subscriptions.array.every(function (subscription) {
        if (subscription.sessionId == sessionId) {
          _this.__catchall_subscriptions.remove(sessionId);
          return false;
        }
        return true;
      });
    }

    this.__cache.reset();

    callback();

  }catch(e){

    callback(e);
  }
};

StrictBucket.prototype.removeSubscription = function (path, sessionId, options, callback) {

  var _this = this;

  try{

    if (typeof options == 'function') {
      callback = options;
      options = null;
    }

    if (!callback) callback = function () {};//in case we have a StrictBucket that needs a callback

    if (!options) options = {};//in case we have a StrictBucket that needs a callback

    if (!options.refCount) options.refCount = 1;

    if (path == '*') return _this.__removeCatchAllSubscription(sessionId, options, callback);

    _this.__subscriptions.removeSubscription(path, sessionId, options);

    this.__cache.reset();

    callback();

  }catch(e){

    callback(e);
  }
};

StrictBucket.prototype.allSubscriptions = function () {

  var subscriptions = [];

  this.__subscriptions.all().forEach(function (subscription) {
    subscriptions.push(subscription);
  });

  this.__catchall_subscriptions.array.forEach(function (subscription) {
    subscriptions.push(subscription);
  });

  return subscriptions;
};

StrictBucket.prototype.stats = function () {
  return {};
};

module.exports = StrictBucket;
