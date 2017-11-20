var
  SortedObjectArray = require("sorted-object-array"),
  LRU = require("lru-cache"),
  async = require('async');

function Bucket(options) {

  if (!options.cache) options.cache = {
    max: 500
  };

  if (!options.channel) throw new Error('bucket must be for a specified channel');

  if (!options.name) throw new Error('bucket must have a name');

  if (options.channel == '*') options.action = 'ALL';

  else options.action = options.channel.split('@')[0].replace('/', '');

  this.options = options;
}

Bucket.prototype.initialize = function (callback) {

  var TrieSearch = require('trie-search');

  Object.defineProperty(this, '__segments', {
    value: new TrieSearch('path')
  });

  Object.defineProperty(this, '__cache', {
    value: new LRU(this.options.cache)
  });

  Object.defineProperty(this, '__catchall_subscriptions', {
    value: new SortedObjectArray('sessionId')
  });

  Object.defineProperty(this, '__explicit_subscriptions', {
    value: new SortedObjectArray('fullPath')
  });

  Object.defineProperty(this, '__subscriptions', {
    value: new SortedObjectArray('fullPath')
  });

  callback();
};

Bucket.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf('*') == -1) return pattern == matchTo;

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

Bucket.prototype.__returnSubscriptions = function (path, subscriptions, cacheKey, callback) {
  //puts our subscriptions into the cache and then does callback
  this.__cache.set(cacheKey, subscriptions);

  callback(null, subscriptions);
};

Bucket.prototype.__searchSubscriptions = function (segment) {

  var _this = this;

  var searchIndex = _this.__subscriptions.search(segment);

  if (searchIndex == -1) return [];

  var subscriptionSegment = segment;

  var subscription = _this.__subscriptions.array[searchIndex];

  var walkIndex = searchIndex;

  var subscriptions = [];

  //walk backwards
  while (subscription != null && subscriptionSegment == segment) {

    subscriptions.push({
      subscription: subscription,
      index: walkIndex
    });

    walkIndex--;

    subscription = _this.__subscriptions.array[walkIndex];

    if (subscription) subscriptionSegment = subscription.segment;
  }

  walkIndex = searchIndex;

  //walk forwards
  while (subscription != null && subscriptionSegment == segment) {

    walkIndex++;

    subscription = _this.__subscriptions.array[walkIndex];

    if (subscription) subscriptionSegment = subscription.segment;

    if (subscriptionSegment == segment) subscriptions.push({
      subscription: subscription,
      index: walkIndex
    });
  }

  return subscriptions;
};

Bucket.prototype.getSubscriptions = function (path, options, callback) {

  if (typeof options === 'function') {

    callback = options;
    options = {};
  }

  if (!options) options = {};

  var cache_key = path + '_' + JSON.stringify(options);

  if (this.__cache.has(cache_key)) return callback(null, this.__cache.get(cache_key));

  var _this = this;

  var wildcard = path.indexOf('*') > -1;

  var recipients = [];

  //for * subscriptions
  if (!options.preciseMatch)
    _this.__catchall_subscriptions.array.forEach(function (subscription) {

      recipients.push({
        subscription: subscription,
        index: -1
      });
    });

  if (!wildcard) {

    var explicitsubscriptionIndex = _this.__explicit_subscriptions.search(path);

    if (explicitsubscriptionIndex > -1) recipients.push({
      subscription: _this.__explicit_subscriptions.array[explicitsubscriptionIndex],
      index: -2
    });
  }

  var segment = path.split('/')[0];

  var segments = _this.__segments.get(segment);

  if (segments.length == 0) return this.__returnSubscriptions(path, recipients, cache_key, callback);

  segments.forEach(function (segment) {

    var segmentRecipients = _this.__searchSubscriptions(segment);

    segmentRecipients.forEach(function (recipient) {

      recipients.push(recipient);
    });
  });

  return this.__returnSubscriptions(path, recipients, cache_key, callback);

  // var segment = this.__getSmallestSegment(path);
  //
  // if (segment == null) return this.__returnSubscriptions(path, recipients, cache_key, callback);
  //
  // var startIndex = this.__getStartIndex(segment.path);//search by segment
  //
  // if (startIndex == -1) return this.__returnSubscriptions(path, recipients, cache_key, callback);
  //
  // while (startIndex < _this.__subscriptions.array.length) {
  //
  //   var subscription = _this.__subscriptions.array[startIndex];
  //
  //   if (options.preciseMatch) {
  //     if (subscription.fullPath == path) recipients.push({subscription: subscription, index: startIndex});
  //   } else {
  //     if (_this.wildcardMatch(subscription.fullPath, path)) recipients.push({
  //       subscription: subscription,
  //       index: startIndex
  //     });
  //   }
  //
  //   if (subscription.segment.indexOf(segment.path) < 0)//we break out if the wildcard segment no longer matches
  //     return this.__returnSubscriptions(path, recipients, cache_key, callback);
  //
  //   startIndex++;
  // }
  //
  // return this.__returnSubscriptions(path, recipients, cache_key, callback);
};

Bucket.prototype.__addCatchAllSubscription = function (sessionId, data, callback) {

  var subscriptionIndex = this.__catchall_subscriptions.search(sessionId);

  var subscription;

  var insert = true;

  if (subscriptionIndex > -1) {

    subscription = this.__catchall_subscriptions.array[subscriptionIndex];
    insert = false;
  } else
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
};

Bucket.prototype.__removeExplicitSubscription = function (path, sessionId, options, callback) {

  var subscriptionIndex = this.__explicit_subscriptions.search(path);

  if (subscriptionIndex > -1) {

    this.__explicit_subscriptions.array[subscriptionIndex].refCount -= options.refCount;

    if (this.__explicit_subscriptions.array[subscriptionIndex].refCount <= 0)
      this.__explicit_subscriptions.remove(subscriptionIndex);

    this.__cache.reset();
  }

  callback();
};

Bucket.prototype.__addExplicitSubscription = function (path, sessionId, data, callback) {

  var subscriptionIndex = this.__explicit_subscriptions.search(path);

  var subscription;

  var insert = true;

  if (subscriptionIndex > -1) {

    subscription = this.__explicit_subscriptions.array[subscriptionIndex];
    insert = false;
  } else
    subscription = {
      sessionId: sessionId,
      data: data,
      refCount: 0,
      fullPath: path,
      action: this.options.action,
      subscriptionData: {}
    };

  subscription.refCount += data.options.refCount;

  subscription.data = data; //overwritten

  if (data.options.listenerId != null)
    subscription.subscriptionData[data.options.listenerId] = data;

  if (insert) this.__explicit_subscriptions.insert(subscription);

  this.__cache.reset();

  callback();
};

Bucket.prototype.__updateSegment = function (path) {

  var pathSegment = path.split('/')[0];

  var segments = this.__segments.get(pathSegment);

  var found = false;

  segments.every(function (segment) {

    if (segment.path == pathSegment) {
      found = true;
      return false;
    }
    return true;
  });

  if (!found) this.__segments.add({
    path: pathSegment
  });

  return pathSegment;
};

Bucket.prototype.addSubscription = function (path, sessionId, data, callback) {

  var _this = this;

  if (typeof data == 'function') {
    callback = data;
    data = null;
  }

  if (!callback) callback = function () {}; //in case we have a bucket that needs a callback

  var wildcard = path.indexOf('*') > -1;

  if (!wildcard) return _this.__addExplicitSubscription(path, sessionId, data, callback);

  if (path == '*') return _this.__addCatchAllSubscription(sessionId, data, callback);

  var subscriptionIndex = _this.__subscriptions.search(path);

  var subscription, insert = false;

  var segment = _this.__updateSegment(path);

  if (subscriptionIndex == -1) {

    subscription = {
      segment: segment,
      fullPath: path,
      sessionId: sessionId,
      data: data,
      subscriptionData: {},
      action: _this.options.action,
      refCount: data.options.refCount
    };

    insert = true;

  } else {

    subscription = _this.__subscriptions.array[subscriptionIndex];

    subscription.data = data; //overwritten with the most recent data

    subscription.refCount += data.options.refCount;
  }

  if (data.options.listenerId != null) subscription.subscriptionData[data.options.listenerId] = data;

  if (insert) _this.__subscriptions.insert(subscription);

  _this.__cache.reset();

  callback();
};

Bucket.prototype.__removeCatchAllSubscription = function (sessionId, options, callback) {

  var subscriptionIndex = this.__catchall_subscriptions.search(sessionId);

  if (subscriptionIndex > -1) {

    this.__catchall_subscriptions.array[subscriptionIndex].refCount -= options.refCount;

    if (this.__catchall_subscriptions.array[subscriptionIndex].refCount <= 0)
      this.__catchall_subscriptions.remove(subscriptionIndex);

    this.__cache.reset();
  }

  callback();
};

Bucket.prototype.removeAllSubscriptions = function (sessionId, callback) {

  if (typeof sessionId === 'function') {
    callback = sessionId;
    sessionId = null;
  }

  if (!sessionId) {

    this.__segments.array = [];
    this.__subscriptions.array = [];
    this.__catchall_subscriptions.array = [];

    this.__cache.reset();

  } else {

    var _this = this;

    var subscriptionsToRemove = [];

    var explicitSubscriptionsToRemove = [];

    this.__subscriptions.array.forEach(function (subscription) {
      if (subscription.sessionId == sessionId) subscriptionsToRemove.push(subscription);
    });

    this.__explicit_subscriptions.array.forEach(function (subscription) {
      if (subscription.sessionId == sessionId) explicitSubscriptionsToRemove.push(subscription);
    });

    _this.__catchall_subscriptions.array.every(function (subscription, index) {
      if (subscription.sessionId == sessionId) {
        _this.__catchall_subscriptions.remove(index);
        return false;
      }
      return true;
    });

    if (subscriptionsToRemove.length == 0 && explicitSubscriptionsToRemove == 0) {

      _this.__cache.reset();

      return callback();
    }

    async.eachSeries(subscriptionsToRemove, function (subscription, subscriptionCB) {

      setImmediate(function () {
        _this.removeSubscription(subscription.fullPath, subscription.sessionId, subscriptionCB)
      });

    }, function (e) {

      if (e) return callback(e);

      async.eachSeries(explicitSubscriptionsToRemove, function (subscription, subscriptionCB) {

        setImmediate(function () {
          _this.removeSubscription(subscription.fullPath, subscription.sessionId, subscriptionCB);
        });
      }, callback);
    });
  }
};

Bucket.prototype.removeSubscription = function (path, sessionId, options, callback) {

  var _this = this;

  if (typeof options == 'function') {
    callback = options;
    options = null;
  }

  if (!callback) callback = function () {}; //in case we have a bucket that needs a callback

  if (!options) options = {}; //in case we have a bucket that needs a callback

  if (!options.refCount) options.refCount = 1;

  var wildcard = path.indexOf('*') > -1;

  if (!wildcard) return _this.__removeExplicitSubscription(path, sessionId, options, callback);

  if (path == '*') return _this.__removeCatchAllSubscription(sessionId, options, callback);

  this.getSubscriptions(path, {
    preciseMatch: true
  }, function (e, subscriptions) {

    if (e) return callback(e);

    var removeIndexes = [];

    subscriptions.forEach(function (recipient) {

      if (recipient.subscription.sessionId == sessionId) {

        _this.__subscriptions.array[recipient.index].refCount -= options.refCount;

        //refCount is not the same as listenerId
        delete recipient.subscription.subscriptionData[options.listenerId];

        if (_this.__subscriptions.array[recipient.index].refCount <= 0) removeIndexes.push(recipient.index);
      }
    });

    removeIndexes.forEach(function (removeIndex) {
      _this.__subscriptions.remove(removeIndex);
    });

    _this.__removeSegment(path);

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.allSubscriptions = function () {

  var subscriptions = [];

  this.__subscriptions.array.forEach(function (subscription) {
    subscriptions.push(subscription);
  });

  this.__catchall_subscriptions.array.forEach(function (subscription) {
    subscriptions.push(subscription);
  });

  return subscriptions;
};

Bucket.prototype.stats = function () {
  return {};
};

module.exports = Bucket;
