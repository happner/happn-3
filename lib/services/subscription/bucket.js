var SortedObjectArray = require("sorted-object-array")
  , LRU = require("lru-cache")
  , async = require('async')
  , TrieSearch = require('trie-search')
  ;

function Bucket(options) {

  if (!options.cache) options.cache = {max: 500};

  if (!options.channel) throw new Error('bucket must be for a specified channel');

  if (!options.name) throw new Error('bucket must have a name');

  if (options.channel == '*') options.action = 'ALL';

  else options.action = options.channel.split('@')[0].replace('/', '');

  if (!options.pathSessionDelimiter) options.pathSessionDelimiter = '>>>';

  this.options = options;
}

Bucket.prototype.initialize = function (callback) {

  Object.defineProperty(this, '__segments', {value:new SortedObjectArray('path')});

  Object.defineProperty(this, '__cache', {value: new LRU(this.options.cache)});

  Object.defineProperty(this, '__catchall_subscriptions', {value: new SortedObjectArray('sessionId')});

  Object.defineProperty(this, '__explicit_subscriptions', {value: this.__removableNodeTrie('pathAndSession')});

  Object.defineProperty(this, '__subscriptions', {value: new SortedObjectArray('segment')});

  callback();
};

Bucket.prototype.__removableNodeTrie = function(keyProp){
  var trieSearch = new TrieSearch(keyProp);

  trieSearch.remove = function(key){

    if (this.options.cache) this.clearCache();

    if (!key) this.root = {};//clear all

    var route = key.split('');

    var currentBranch = this.root[route[0]];

    var parentBranch;

    route.slice(1, route.length).every(function(twig, twigIndex){

      parentBranch = currentBranch;

      currentBranch = parentBranch[twig];

      if (currentBranch == null) return false;

      if (twigIndex == route.length - 2){
        //end of our climbing route, climb back a step and cut
        delete parentBranch[twig];
      } else return true;//climb further
    });

  }.bind(trieSearch);

  return trieSearch;
};

Bucket.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf('*') == -1) return pattern == matchTo;

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

//this was abstracted out because we were using it for wildcards and explicit subscriptions
//explicit subscriptions are now handled through the trie, possible optimisation would
//be to have this and the __searchSubscriptions the same thing.

//leaving it for now, this may be a handy abstraction later on, as it is a neat way of pulling out a
//segment from an sorted array.
Bucket.prototype.__getItemsForSegment = function(path, sortedArray, matchesCriteria, overrideIndex){

  var searchIndex = sortedArray.search(path);

  if (searchIndex == -1) return [];

  var subscription = sortedArray.array[searchIndex];

  var walkIndex = searchIndex;

  var subscriptions = [];

  while (matchesCriteria(subscription)){

    subscriptions.push({subscription:subscription, index:overrideIndex != null?overrideIndex : walkIndex});

    walkIndex --;

    subscription = sortedArray.array[walkIndex];
  }

  walkIndex = searchIndex + 1;

  subscription = sortedArray.array[walkIndex];

  while (matchesCriteria(subscription)){

    subscriptions.push({subscription:subscription, index:overrideIndex != null?overrideIndex : walkIndex});

    walkIndex ++;

    subscription = sortedArray.array[walkIndex];
  }

  return subscriptions;
};

Bucket.prototype.__getCatchAllSubscriptions = function(){

  var subscriptions = [];

  this.__catchall_subscriptions.array.forEach(function (subscription) {

    subscriptions.push({subscription: subscription, index: -1});
  });

  return subscriptions;
};

Bucket.prototype.__getExplicitSubscriptions = function(path){

  return this.__explicit_subscriptions.get(path + this.options.pathSessionDelimiter).map(function(subscription){
    return {subscription: subscription, index: -2};
  });
};


Bucket.prototype.__returnSubscriptions = function (path, subscriptions, cacheKey, callback) {
  //puts our subscriptions into the cache and then does callback
  this.__cache.set(cacheKey, subscriptions);

  callback(null, subscriptions);
};

Bucket.prototype.__searchSubscriptions = function(segment, options){

  var _this = this;

  var matchesCriteria = function(subscription){

    if (subscription == null) return false;

    if (this.options.preciseMatch) return subscription.fullPath == this.options.fullPath;

    return (subscription.segment == this.segment);

  }.bind({segment:segment, options:options});

  return this.__getItemsForSegment(segment, _this.__subscriptions, matchesCriteria);
};

Bucket.prototype.__getSegments = function(path) {

  var _this = this;

  var pathSegment = path.split('*')[0];

  var searchTerm = '';

  var segments = [];

  pathSegment.split('').forEach(function(character){

    searchTerm += character;

    if (_this.__segments.search(searchTerm) > -1) segments.push(searchTerm);

  });

  return segments;
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

  var segments = this.__getSegments(path);

  if (segments.length == 0) return this.__returnSubscriptions(path, recipients, cache_key, callback);

  segments.forEach(function(segment){

    var segmentRecipients = _this.__searchSubscriptions(segment, options);

    segmentRecipients.forEach(function(recipient){

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
};

Bucket.prototype.__removeExplicitSubscription = function(path, sessionId, options, callback){

  // var pathAndSession = path + this.options.pathSessionDelimiter + sessionId;
  //
  // var subscription = this.__explicit_subscriptions.get(pathAndSession)[0];
  //
  // if (!subscription) return callback();

  this.__explicit_subscriptions.remove(path + this.options.pathSessionDelimiter + sessionId);

  this.__cache.reset();

  callback();
};

Bucket.prototype.__addExplicitSubscription = function (path, sessionId, data, callback) {

  var pathAndSession = path + this.options.pathSessionDelimiter + sessionId;

  var subscription = this.__explicit_subscriptions.get(pathAndSession)[0];

  var insert = true;

  if (subscription){

    insert = false;

  } else {

    subscription = {
      pathAndSession:pathAndSession,
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

  if (insert) this.__explicit_subscriptions.add(subscription);

  this.__cache.reset();

  callback();
};

Bucket.prototype.__updateSegment = function(path){

  var pathSegment = path.split('*')[0];

  var segmentIndex = this.__segments.search(pathSegment);

  if (segmentIndex == -1) this.__segments.insert({path:pathSegment, refCount:1});

  else this.__segments.array[segmentIndex].refCount++;

  return pathSegment;
};

Bucket.prototype.addSubscription = function (path, sessionId, data, callback) {

  var _this = this;

  if (typeof data == 'function') {
    callback = data;
    data = null;
  }

  if (!callback) callback = function () {};//in case we have a bucket that needs a callback

  var wildcard = path.indexOf('*') > -1;

  if (!wildcard) return _this.__addExplicitSubscription(path, sessionId, data, callback);

  if (path == '*') return _this.__addCatchAllSubscription(sessionId, data, callback);

  var segment = _this.__updateSegment(path);

  _this.getSubscriptions(segment, {preciseMatch: true, fullPath:path}, function (e, subscriptions) {

    if (e) return callback(e);

    var foundSubscription = null, insert = false;

    subscriptions.forEach(function (recipient) {

      if (recipient.subscription.sessionId == sessionId && recipient.index > -1) {

        foundSubscription = _this.__subscriptions.array[recipient.index];
      }
    });

    if (!foundSubscription) {

      foundSubscription = {
        segment: segment,
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

    if (insert) _this.__subscriptions.insert(foundSubscription);

    _this.__cache.reset();

    setImmediate(callback);
  });

  // var subscriptionIndex = _this.__subscriptions.search(segment);
  //
  // if (subscriptionIndex == -1){
  //
  //   subscription = {
  //     segment:segment,
  //     fullPath: path,
  //     sessionId: sessionId,
  //     data: data,
  //     subscriptionData: {},
  //     action: _this.options.action,
  //     refCount: data.options.refCount
  //   };
  //
  //   insert = true;
  //
  // } else {
  //
  //   subscription = _this.__subscriptions.array[subscriptionIndex];
  //
  //   subscription.data = data;//overwritten with the most recent data
  //
  //   subscription.refCount += data.options.refCount;
  // }
  //
  // if (data.options.listenerId != null) subscription.subscriptionData[data.options.listenerId] = data;
  //
  // if (insert) _this.__subscriptions.insert(subscription);
  //
  // _this.__cache.reset();
  //
  // setImmediate(callback);
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
    this.__explicit_subscriptions.array = [];

    this.__cache.reset();

  } else {

    var _this = this;

    var subscriptionsToRemove = [];

    var explicitSubscriptionsToRemove = [];

    this.__subscriptions.array.forEach(function (subscription) {
      if (subscription.sessionId == sessionId) subscriptionsToRemove.push(subscription);
    });

    this.__explicit_subscriptions.get('').forEach(function (subscription) {
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

Bucket.prototype.__removeSegment = function(path){

  var pathSegment = path.split('*')[0];

  var segmentIndex = this.__segments.search(pathSegment);

  if (segmentIndex > -1){
    this.__segments.array[segmentIndex].refCount --;
    if (this.__segments.array[segmentIndex].refCount <= 0) this.__segments.array.splice(segmentIndex, 1);
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

  var segment = path.split('*')[0];

  this.getSubscriptions(segment, {preciseMatch: true, fullPath:path}, function (e, subscriptions) {

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

    removeIndexes.reverse().forEach(function (removeIndex) {
      _this.__subscriptions.array.splice(removeIndex, 1);
    });

    _this.__removeSegment(path);

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.allSubscriptions = function () {

  var subscriptions = [];

  this.__explicit_subscriptions.get('').forEach(function (subscription) {
    subscriptions.push(subscription);
  });

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
