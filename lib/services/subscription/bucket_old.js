var
  SortedObjectArray = require("sorted-object-array")
  , LRU = require("lru-cache")
  , async = require('async')
  ;

function Bucket(options){

  if (!options.cache) options.cache = {max:500};

  if (!options.channel) throw new Error('bucket must be for a specified channel');

  if (!options.name) throw new Error('bucket must have a name');

  if (options.channel == '*') options.action = 'ALL';

  else options.action = options.channel.split('@')[0].replace('/','');

  this.options = options;
}

Bucket.prototype.initialize = function(callback){

  Object.defineProperty(this, '__segments', {value:new SortedObjectArray('path')});

  Object.defineProperty(this, '__cache', {value:new LRU(this.options.cache)});

  Object.defineProperty(this, '__catchall_subscribers', {value:new SortedObjectArray('sessionId')});

  Object.defineProperty(this, '__subscribers', {value:new SortedObjectArray('segment')});

  callback();
};

Bucket.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf('*') == -1) return pattern == matchTo;

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

Bucket.prototype.__updateSegment = function(path){

  var segment = this.__getSegment(path);

  if (!segment) {

    segment = {
      refCount:1
    };

    if (path == '*') segment.path = '*';
    else segment.path = path.split('*')[0];

    this.__segments.insert(segment);

  } else {

    this.__segments.array[segment.index].refCount++;
  }

  return segment.path;
};

Bucket.prototype.__removeSegment = function(path){

  var segment = this.__getSegment(path);

  if (segment){

    this.__segments.array[segment.index].refCount--;

    if (this.__segments.array[segment.index].refCount <= 0) this.__segments.remove(segment.index);
  }

};

Bucket.prototype.__getSmallestSegment = function(path){

  var currentPath = path.split('*')[0];

  var currentLength = path.length;

  var segmentIndex = -1;

  var searching = true;

  while(searching){

    segmentIndex = this.__segments.search(currentPath);//search by segment

    if (segmentIndex > -1){

      return {
        path:this.__segments.array[segmentIndex].path,
        index:segmentIndex,
        refCount:this.__segments.array[segmentIndex].refCount
      };
    }

    currentLength --;

    if (currentLength == 0) searching = false;

    else currentPath = path.substring(0, currentLength);
  }

  return null;
};

Bucket.prototype.__getSegment = function(path){

  var currentPath = path.split('*')[0];

  var currentLength = path.length;

  var segmentIndex = -1;

  var searching = true;

  while(searching){

    segmentIndex = this.__segments.search(currentPath);//search by segment

    if (segmentIndex > -1){

      return {
        path:this.__segments.array[segmentIndex].path,
        index:segmentIndex,
        refCount:this.__segments.array[segmentIndex].refCount
      };
    }

    currentLength --;

    if (currentLength == 0) searching = false;

    else currentPath = path.substring(0, currentLength);
  }

  return null;
};

Bucket.prototype.__getStartIndex = function(segmentPath){

  //binary search finds the first matching index, which may not actually the first one in the alphabetically sorted array
  //we have to find a matching index, then walk backwards until the segment path no longer matches

  var initialStartIndex = this.__subscribers.search(segmentPath);//search by segment

  if (initialStartIndex == -1) return initialStartIndex;

  var startIndex = initialStartIndex;

  while(startIndex >= 0 && this.__subscribers.array[startIndex].segment == segmentPath){
    startIndex--;
  }

  return startIndex + 1;//jump forward a step as the while condition broke because the segment path no longer matches
};

Bucket.prototype.__returnSubscriptions = function(path, subscriptions, callback){
  //puts our subscriptions into the cache and then does callback
  this.__cache.set(path, subscriptions);

  callback(null, subscriptions);
};

Bucket.prototype.getSubscriptions = function(path, callback){

  if (this.__cache.has(path)) return callback(null, this.__cache.get(path));

  var _this = this;

  var recipients = [];

  console.log('getting subscriptions for path ' + path + ':::', _this.__subscribers.array);

  //for * subscriptions
  _this.__catchall_subscribers.array.forEach(function(subscription){
    recipients.push({subscription:subscription, index:-1});
  });

  var segment = this.__getSmallestSegment(path);

  console.log('have segment:::', segment);

  if (segment == null) return this.__returnSubscriptions(path, recipients, callback);

  var startIndex = this.__getStartIndex(segment.path);//search by segment

  if (startIndex == -1) return this.__returnSubscriptions(path, recipients, callback);

  var sliceIndex = startIndex;

  _this.__subscribers.array.slice(startIndex, sliceIndex + segment.refCount).every(function(subscription){

    if (_this.wildcardMatch(subscription.fullPath, path)) {
      recipients.push({subscription:subscription, index:sliceIndex});
    }

    sliceIndex++;

    return subscription.segment == segment.path;//we break out if the wildcard segment no longer matches
  });

  this.__returnSubscriptions(path, recipients, callback);
};

Bucket.prototype.__addCatchAllSubscription = function(sessionId, data, callback){

  var subscriptionIndex = this.__catchall_subscribers.search(sessionId);

  if (subscriptionIndex > -1) this.__catchall_subscribers.array[subscriptionIndex].refCount++;

  else this.__catchall_subscribers
    .insert({
      sessionId:sessionId,
      data:data,
      refCount:1,
      fullPath:'*',
      action:this.options.action
    });

  this.__cache.reset();

  callback();
};

Bucket.prototype.addSubscription = function(path, sessionId, data, callback){

  var _this = this;

  if (typeof data == 'function'){
    callback = data;
    data = null;
  }

  if (!callback) callback = function(){};//in case we have a bucket that needs a callback

  if (path == '*') return _this.__addCatchAllSubscription(sessionId, data, callback);

  var segmentPath = _this.__updateSegment(path);

  _this.getSubscriptions(path, function(e, subscriptions) {

    if (e) return callback(e);

    var foundSubscription = false;

    subscriptions.forEach(function(recipient){

      if (recipient.subscription.sessionId == sessionId && recipient.index > -1) {

        _this.__subscribers.array[recipient.index].refCount++;
        _this.__subscribers.array[recipient.index].data = data;//updates/overwrites

        foundSubscription = true;
      }
    });

    if (!foundSubscription) {

      _this.__subscribers.insert({
        segment:segmentPath,
        fullPath:path,
        sessionId:sessionId,
        data:data,
        action:_this.options.action,
        refCount:1});
    }

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.__removeCatchAllSubscription = function(sessionId, callback){

  var subscriptionIndex = this.__catchall_subscribers.search(sessionId);

  if (subscriptionIndex > -1){

    this.__catchall_subscribers.array[subscriptionIndex].refCount--;

    if (this.__catchall_subscribers.array[subscriptionIndex].refCount <= 0)
      this.__catchall_subscribers.remove(subscriptionIndex);

    this.__cache.reset();
  }

  callback();
};

Bucket.prototype.removeAllSubscriptions = function(sessionId, callback){

  if (typeof sessionId === 'function'){
    callback = sessionId;
    sessionId = null;
  }

  if (!sessionId){

    this.__segments.array = [];
    this.__subscribers.array = [];
    this.__catchall_subscribers.array = [];

    this.__cache.reset();

  } else {

    var _this = this;

    var subscriptionsToRemove = [];

    this.__subscribers.array.forEach(function(subscription){
      if (subscription.sessionId == sessionId) subscriptionsToRemove.push(subscription);
    });

    _this.__catchall_subscribers.array.every(function(subscription, index){
      if (subscription.sessionId == sessionId) {
        _this.__catchall_subscribers.remove(index);
        return false;
      }
      return true;
    });

    if (subscriptionsToRemove.length == 0){

      _this.__cache.reset();

      return callback();
    }

    async.eachSeries(subscriptionsToRemove, function(subscription, subscriptionCB){

      _this.removeSubscription(subscription.fullPath, subscription.sessionId, subscriptionCB);

    }, callback);
  }
};

Bucket.prototype.removeSubscription = function(path, sessionId, callback){

  var _this = this;

  if (!callback) callback = function(){};//in case we have a bucket that needs a callback

  if (path == '*') return _this.__removeCatchAllSubscription(sessionId, callback);

  this.getSubscriptions(path, function(e, subscriptions){

    if (e) return callback(e);

    var removeIndexes = [];

    subscriptions.forEach(function(recipient){

      if (recipient.subscription.sessionId == sessionId) {

        _this.__subscribers.array[recipient.index].refCount--;

        if (_this.__subscribers.array[recipient.index].refCount <= 0) removeIndexes.push(recipient.index);
      }
    });

    removeIndexes.forEach(function(removeIndex){
      _this.__subscribers.remove(removeIndex);
    });

    _this.__removeSegment(path);

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.allSubscriptions = function(){

  var subscriptions = [];

  this.__subscribers.array.forEach(function(subscription){
    subscriptions.push(subscription);
  });

  this.__catchall_subscribers.array.forEach(function(subscription){
    subscriptions.push(subscription);
  });

  return subscriptions;
};

Bucket.prototype.stats = function(){
  return {};
};

module.exports = Bucket;


