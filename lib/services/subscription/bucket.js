var
  SortedObjectArray = require("sorted-object-array")
  , LRU = require("lru-cache")
  , async = require('async')
  ;

function Bucket(options) {

  if (!options.cache) options.cache = {max: 500};

  if (!options.channel) throw new Error('bucket must be for a specified channel');

  if (!options.name) throw new Error('bucket must have a name');

  if (options.channel == '*') options.action = 'ALL';

  else options.action = options.channel.split('@')[0].replace('/', '');

  this.options = options;
}

Bucket.prototype.initialize = function (callback) {

  Object.defineProperty(this, '__segments', {value: new SortedObjectArray('path')});

  Object.defineProperty(this, '__cache', {value: new LRU(this.options.cache)});

  Object.defineProperty(this, '__catchall_subscribers', {value: new SortedObjectArray('sessionId')});

  Object.defineProperty(this, '__subscribers', {value: new SortedObjectArray('segment')});

  Object.defineProperty(this, '__explicit_subscribers', {value: new SortedObjectArray('fullPath')});

  callback();
};

Bucket.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf('*') == -1) return pattern == matchTo;

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

Bucket.prototype.__updateSegment = function (path) {

  var segment = this.__getSegment(path);

  if (!segment) {

    segment = {
      refCount: 1
    };

    if (path == '*') segment.path = '*';
    else segment.path = path.split('*')[0];

    this.__segments.insert(segment);

  } else {

    this.__segments.array[segment.index].refCount++;
  }

  return segment.path;
};

Bucket.prototype.__removeSegment = function (path) {

  var segment = this.__getSegment(path);

  if (segment) {

    this.__segments.array[segment.index].refCount--;

    if (this.__segments.array[segment.index].refCount <= 0) this.__segments.remove(segment.index);
  }

};

Bucket.prototype.__getSmallestSegment = function (path) {

  var segmentPath = path.split('*')[0];

  var currentPath = segmentPath.substring(0, 1);//start at the first character

  var currentLength = 1;

  var segmentIndex = -1;

  var searching = true;

  while (searching) {

    segmentIndex = this.__segments.search(currentPath);//search by segment

    if (segmentIndex > -1) {

      return {
        path: this.__segments.array[segmentIndex].path,
        index: segmentIndex,
        refCount: this.__segments.array[segmentIndex].refCount
      };
    }

    currentLength++;

    if (currentLength == (segmentPath.length + 1)) searching = false;

    else currentPath = segmentPath.substring(0, currentLength);
  }

  return null;
};

Bucket.prototype.__getSegment = function (path) {

  var currentPath = path.split('*')[0];

  var currentLength = path.length;

  var segmentIndex = -1;

  var searching = true;

  while (searching) {

    segmentIndex = this.__segments.search(currentPath);//search by segment

    if (segmentIndex > -1) {

      return {
        path: this.__segments.array[segmentIndex].path,
        index: segmentIndex,
        refCount: this.__segments.array[segmentIndex].refCount
      };
    }

    currentLength--;

    if (currentLength == 0) searching = false;

    else currentPath = path.substring(0, currentLength);
  }

  return null;
};

Bucket.prototype.__getStartIndex = function (segmentPath) {

  //binary search finds the first matching index, which may not actually the first one in the alphabetically sorted array
  //we have to find a matching index, then walk backwards until the segment path no longer matches

  var initialStartIndex = this.__subscribers.search(segmentPath);//search by segment

  if (initialStartIndex == -1) return initialStartIndex;

  var startIndex = initialStartIndex;

  while (startIndex >= 0 && this.__subscribers.array[startIndex].segment == segmentPath) {
    startIndex--;
  }

  return startIndex + 1;//jump forward a step as the while condition broke because the segment path no longer matches
};

Bucket.prototype.__returnSubscriptions = function (path, subscriptions, cacheKey, callback) {
  //puts our subscriptions into the cache and then does callback
  this.__cache.set(cacheKey, subscriptions);

  callback(null, subscriptions);
};

Bucket.prototype.__getItemsForSegment = function(path, sortedArray, matchesCriteria){

  var searchIndex = sortedArray.search(path);

  // console.log('searchIndex:::', searchIndex);
  //
  // console.log('path:::', path);

  if (searchIndex == -1) return [];

  var subscription = sortedArray.array[searchIndex];

  var walkIndex = searchIndex;

  var subscriptions = [];

  //walk backwards
  while (matchesCriteria(subscription)){

    //console.log('pushing::::');
    subscriptions.push({subscription:subscription, index:walkIndex});

    walkIndex --;

    subscription = sortedArray.array[walkIndex];
  }

  walkIndex = searchIndex + 1;

  subscription = sortedArray.array[walkIndex];

  //walk forwards
  while (matchesCriteria(subscription)){

    //console.log('pushing::::');
    subscriptions.push({subscription:subscription, index:walkIndex});

    walkIndex ++;

    subscription = sortedArray.array[walkIndex];
  }

  return subscriptions;
};

Bucket.prototype.__getCatchAllSubscriptions = function(){

  var subscriptions = [];

  this.__catchall_subscribers.array.forEach(function (subscription) {

    subscriptions.push({subscription: subscription, index: -1});
  });

  return subscriptions;
};

Bucket.prototype.__getExplicitSubscriptions = function(path){

  var matchesCriteria = function(subscription){

    if (subscription == null) return false;

    return subscription.fullPath == this.path;

  }.bind({path:path});

  return this.__getItemsForSegment(path, this.__explicit_subscribers, matchesCriteria);
};

Bucket.prototype.__getWildcardSubscriptions = function(path, options, segment){

  var _this = this;

  var matchesCriteria = function(subscription){

    if (subscription == null) return false;

    //console.log('matches this:::', this);

    // console.log('matches sub:::', subscription);
    //
    // console.log('matches sub:::', subscription.fullPath.indexOf(this.segment) != 0);
    //
    // console.log('matches sub:::', subscription.fullPath == this.path);
    //
    // console.log('matches sub:::', _this.wildcardMatch(subscription.fullPath, this.path));

    if (subscription.fullPath.indexOf(this.segment) != 0) return false;

    if (this.options.preciseMatch) {
      return (subscription.fullPath == this.path);
    } else {
      return (_this.wildcardMatch(subscription.fullPath, this.path));
    }
  }

  .bind({path:path, options:options, segment:segment});

  return this.__getItemsForSegment(segment, _this.__subscribers, matchesCriteria);
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

  var recipients = [];

  //for * subscriptions
  if (!options.preciseMatch)
    _this.__getCatchAllSubscriptions().forEach(function(recipient){
      recipients.push(recipient);
    });

  _this.__getExplicitSubscriptions(path).forEach(function(recipient){
    recipients.push(recipient);
  });

  var segment = this.__getSmallestSegment(path);

  if (segment == null) return this.__returnSubscriptions(path, recipients, cache_key, callback);

  var startIndex = this.__getStartIndex(segment.path);//search by segment

  if (startIndex == -1) return this.__returnSubscriptions(path, recipients, cache_key, callback);

  //console.log('getting wildcard:::', path);
  _this.__getWildcardSubscriptions(path, options, segment.path).forEach(function(recipient){
    recipients.push(recipient);
  });

  return this.__returnSubscriptions(path, recipients, cache_key, callback);
};

Bucket.prototype.__addCatchAllSubscription = function (sessionId, data, callback) {

  var subscriptionIndex = this.__catchall_subscribers.search(sessionId);

  var subscription;

  var insert = true;

  if (subscriptionIndex > -1) {

    subscription = this.__catchall_subscribers.array[subscriptionIndex];
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

  if (insert) this.__catchall_subscribers.insert(subscription);

  this.__cache.reset();

  callback();
};

Bucket.prototype.__removeExplicitSubscription = function(path, sessionId, options, callback){

  var subscriptionIndex = this.__explicit_subscribers.search(path);

  if (subscriptionIndex > -1) {

    this.__explicit_subscribers.array[subscriptionIndex].refCount -= options.refCount;

    if (this.__explicit_subscribers.array[subscriptionIndex].refCount <= 0)
      this.__explicit_subscribers.remove(subscriptionIndex);

    this.__cache.reset();
  }

  callback();
};

Bucket.prototype.__addExplicitSubscription = function (path, sessionId, data, callback) {

  var subscriptionIndex = this.__explicit_subscribers.search(path);

  var subscription;

  var insert = false;

  if (subscriptionIndex > -1){

    subscription = this.__explicit_subscribers.array[subscriptionIndex];

    insert = subscription.sessionId != sessionId;

  } else insert = true;

  if (insert){

    subscription = {
      sessionId: sessionId,
      data: data,
      refCount: 0,
      fullPath: path,
      action: this.options.action,
      subscriptionData: {}
    };
  }

  subscription.refCount += data.options.refCount;

  subscription.data = data; //overwritten

  if (data.options.listenerId != null) subscription.subscriptionData[data.options.listenerId] = data;

  if (insert) this.__explicit_subscribers.insert(subscription);

  this.__cache.reset();

  callback();
};

Bucket.prototype.addSubscription = function (path, sessionId, data, callback) {

  var _this = this;

  if (typeof data == 'function') {
    callback = data;
    data = null;
  }

  if (!callback) callback = function () {
  };//in case we have a bucket that needs a callback

  var wildcard = path.indexOf('*') > -1;

  if (!wildcard) return _this.__addExplicitSubscription(path, sessionId, data, callback);

  if (path == '*') return _this.__addCatchAllSubscription(sessionId, data, callback);

  var segmentPath = _this.__updateSegment(path);

  _this.getSubscriptions(path, {preciseMatch: true}, function (e, subscriptions) {

    if (e) return callback(e);

    //console.log('got:::', subscriptions);

    var foundSubscription = null, insert = false;

    subscriptions.forEach(function (recipient) {

      if (recipient.subscription.sessionId == sessionId && recipient.index > -1) {

        foundSubscription = _this.__subscribers.array[recipient.index];
        //console.log('found:::');
      }
    });

    if (!foundSubscription) {

      foundSubscription = {
        segment: segmentPath,
        fullPath: path,
        sessionId: sessionId,
        data: data,
        subscriptionData: {},
        action: _this.options.action,
        refCount: 0
      };

      insert = true;
    }

    foundSubscription.data = data;//overwritten with the most recent data

    foundSubscription.refCount += data.options.refCount;
    //do not be confused, the data.options.refCount is the client-side listener reference

    //TODO: test for backward compatibility
    if (data.options.listenerId != null) foundSubscription.subscriptionData[data.options.listenerId] = data;

    if (insert) _this.__subscribers.insert(foundSubscription);

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.__removeCatchAllSubscription = function (sessionId, options, callback) {

  var subscriptionIndex = this.__catchall_subscribers.search(sessionId);

  if (subscriptionIndex > -1) {

    this.__catchall_subscribers.array[subscriptionIndex].refCount -= options.refCount;

    if (this.__catchall_subscribers.array[subscriptionIndex].refCount <= 0)
      this.__catchall_subscribers.remove(subscriptionIndex);

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
    this.__subscribers.array = [];
    this.__catchall_subscribers.array = [];

    this.__cache.reset();

  } else {

    var _this = this;

    var subscriptionsToRemove = [];

    var explicitSubscriptionsToRemove = [];

    this.__subscribers.array.forEach(function (subscription) {
      if (subscription.sessionId == sessionId) subscriptionsToRemove.push(subscription);
    });

    this.__explicit_subscribers.array.forEach(function (subscription) {
      if (subscription.sessionId == sessionId) explicitSubscriptionsToRemove.push(subscription);
    });

    _this.__catchall_subscribers.array.every(function (subscription, index) {
      if (subscription.sessionId == sessionId) {
        _this.__catchall_subscribers.remove(index);
        return false;
      }
      return true;
    });

    if (subscriptionsToRemove.length == 0 && explicitSubscriptionsToRemove == 0) {

      _this.__cache.reset();

      return callback();
    }

    async.eachSeries(subscriptionsToRemove, function (subscription, subscriptionCB) {

      setImmediate(function(){
        _this.removeSubscription(subscription.fullPath, subscription.sessionId, subscriptionCB)
      });

    }, function(e){

      if (e) return callback(e);

      async.eachSeries(explicitSubscriptionsToRemove, function (subscription, subscriptionCB) {

        setImmediate(function() {
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

  if (!callback) callback = function () {};//in case we have a bucket that needs a callback

  if (!options) options = {};//in case we have a bucket that needs a callback

  if (!options.refCount) options.refCount = 1;

  var wildcard = path.indexOf('*') > -1;

  if (!wildcard) return _this.__removeExplicitSubscription(path, sessionId, options, callback);

  if (path == '*') return _this.__removeCatchAllSubscription(sessionId, options, callback);

  this.getSubscriptions(path, {preciseMatch: true}, function (e, subscriptions) {

    if (e) return callback(e);

    var removeIndexes = [];

    subscriptions.forEach(function (recipient) {

      if (recipient.subscription.sessionId == sessionId) {

        _this.__subscribers.array[recipient.index].refCount -= options.refCount;

        //refCount is not the same as listenerId
        delete recipient.subscription.subscriptionData[options.listenerId];

        if (_this.__subscribers.array[recipient.index].refCount <= 0) removeIndexes.push(recipient.index);
      }
    });

    removeIndexes.forEach(function (removeIndex) {
      _this.__subscribers.remove(removeIndex);
    });

    _this.__removeSegment(path);

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.allSubscriptions = function () {

  var subscriptions = [];

  this.__subscribers.array.forEach(function (subscription) {
    subscriptions.push(subscription);
  });

  this.__catchall_subscribers.array.forEach(function (subscription) {
    subscriptions.push(subscription);
  });

  return subscriptions;
};

Bucket.prototype.stats = function () {
  return {};
};

module.exports = Bucket;


