var SortedObjectArray = require("sorted-object-array")
  , LRU = require("lru-cache")
  ;

function PathTree(options, branch) {

  this.options = options ? options : {};

  if (!this.options.delimiter) this.options.delimiter = '/';
  if (!this.options.wildcardSingle) this.options.wildcardSingle = '*';
  if (!this.options.wildcardMultiple) this.options.wildcardMultiple = '**';
  if (!this.options.patternIdDivider) this.options.patternIdDivider = '>>>';
  if (!this.options.cache) this.options.cache = {max: 500};

  this.__cache = new LRU(this.options.cache);

  this.children = new SortedObjectArray('branch');

  this.__subscriptions_explicit = new SortedObjectArray('key');

  this.__subscriptions_wildcard = new SortedObjectArray('key');

  if (!branch) branch = '';

  this.branch = branch;
}

PathTree.prototype.__clearCache = function(key){

  if (!key) return this.__cache.reset();

  this.__cache.del(key);
};

PathTree.prototype.__splitPath = function (path) {

  if (Array.isArray(path)) return path;

  if (path.indexOf(this.options.delimiter) == 0) path = path.substring(1, path.length);

  return path.split(this.options.delimiter);
};

PathTree.prototype._addSubscriptionData = function (path, id, dataId, data, depth, originalPath) {

  var subscriptionKey = originalPath + this.options.patternIdDivider + id;

  var subscriptionArray = originalPath.indexOf('*') > -1? this.__subscriptions_wildcard: this.__subscriptions_explicit;

  //var subscriptionSegment = originalPath.split('*')[0];

  var subscriptionDataIndex = subscriptionArray.search(subscriptionKey);

  var subscription;

  if (subscriptionDataIndex == -1) {

    subscription = {
      fullPath:originalPath,
      key: subscriptionKey,
      //segment: subscriptionSegment,
      id: id,
      refCount: 0,
      subscriptionData:{}
    };

  } else subscription = subscriptionArray.array[subscriptionDataIndex];

  subscription.refCount++;
  subscription.data = data;//overwritten

  if (dataId) subscription.subscriptionData[dataId] = data;

  if (subscriptionDataIndex == -1) {

    subscriptionArray.insert(subscription);
  }
};

PathTree.prototype.addSubscription = function (path, id, dataId, data, depth, originalPath) {

  var _this = this;

  if (!depth) depth = 1;

  else depth++;

  if (depth == 1) {

    originalPath = path;
    _this.__cache.reset();
  }

  var splitPath = _this.__splitPath(path);

  var branch = splitPath[0];

  var childIndex = _this.children.search(branch);

  var child;

  if (childIndex < 0) {

    child = new PathTree(_this.options, branch);
    _this.children.insert(child);

  } else child = _this.children.array[childIndex];

  if (splitPath.length == 1) //end of branch
    return child._addSubscriptionData(path, id, dataId, data, depth, originalPath);

  child.addSubscription(splitPath.slice(1, splitPath.length), id, dataId, data, depth, originalPath);
};

PathTree.prototype._removeSubscriptionData = function(path, id, options, originalPath){

  var subscriptionKey = originalPath + this.options.patternIdDivider + id;

  var subscriptionArray = originalPath.indexOf('*') > -1? this.__subscriptions_wildcard: this.__subscriptions_explicit;

  var subscriptionDataIndex = subscriptionArray.search(subscriptionKey);

  var subscription;

  if (subscriptionDataIndex == -1) {

    return;

  } else subscription = subscriptionArray.array[subscriptionDataIndex];

  if (options.dataId) delete subscription.subscriptionData[options.dataId];

  subscription.refCount -= (options.refCount == null?1:options.refCount);

  if (subscription.refCount == 0) {
    subscriptionArray.array.splice(subscriptionDataIndex, 1);
  }
};

PathTree.prototype.removeSubscriptions = function (id) {

  var _this = this;

  _this.__subscriptions.array.reverse().forEach(function(subscription, index){

    if (id == null || subscription.id == id) _this.__subscriptions.array.splice(index, 1);
  });

  _this.children.array.forEach(function(child){
    child.removeSubscriptions(id);
  });
};

PathTree.prototype.removeSubscription = function (path, id, options, depth, originalPath) {

  var _this = this;

  if (!depth) depth = 1;

  else depth++;

  if (depth == 1) {

    originalPath = path;
    if (!options) options = {};
    _this.__cache.reset();
  }

  var splitPath = this.__splitPath(path);

  var branch = splitPath[0];

  var childIndex = _this.children.search(branch);

  var child;

  if (childIndex < 0) return;//doesnt exist - cannot remove

  else child = _this.children.array[childIndex];

  if (splitPath.length == 1) //end of branch
    return child._removeSubscriptionData(path, id, options, originalPath);

  child.removeSubscription(splitPath.slice(1, splitPath.length), id, options, depth, originalPath);
};

PathTree.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf('*') == -1) return pattern == matchTo;

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

PathTree.prototype.__updateCache = function (path, id, subscriptions) {

  this.__cache.set(path + this.options.patternIdDivider + (id==null?'':id), subscriptions);
};

PathTree.prototype._searchSubscriptions = function (originalPath, id) {

  var _this = this;

  var subscriptions = [];

  if (id) {

    //so looking for a specific subscription

    if (_this.branch == '*'){

      //no filtering necessary - all subscriptions under * get pulled out
      _this.__subscriptions_explicit.array.map(function(subscription){
        if (subscription.id == id) subscriptions.push(subscription);
      });

      _this.__subscriptions_wildcard.array.map(function(subscription){
        if (subscription.id == id) subscriptions.push(subscription);
      });

    } else {

      //no filtering necessary - all subscriptions under * get pulled out
      _this.__subscriptions_explicit.array.map(function(subscription){
        if ((subscription.id == id) && subscription.fullPath == originalPath)
          subscriptions.push(subscription);
      });

      _this.__subscriptions_wildcard.array.map(function(subscription){
        if ((subscription.id == id) && _this.wildcardMatch(subscription.fullPath, originalPath))
          subscriptions.push(subscription);
      });
    }
  } else {

    if (_this.branch == '*'){

      //no filtering necessary - all subscriptions under * get pulled out
      _this.__subscriptions_explicit.array.map(function(subscription){

        subscriptions.push(subscription);
      });

      _this.__subscriptions_wildcard.array.map(function(subscription){

        subscriptions.push(subscription);
      });

    } else {

      _this.__subscriptions_explicit.array.map(function(subscription){

        if (subscription.fullPath == originalPath)
          subscriptions.push(subscription);
      });

      _this.__subscriptions_wildcard.array.map(function(subscription){

        if (_this.wildcardMatch(subscription.fullPath, originalPath))
          subscriptions.push(subscription);
      });
    }
  }

  return subscriptions;
};

PathTree.prototype.search = function (path, id, depth, originalPath) {

  var _this = this;

  if (!depth) depth = 1;

  else depth++;

  if (depth == 1){

    originalPath = path;

    var cacheKey = originalPath + this.options.patternIdDivider + (id==null?'':id);

    if (this.__cache.has(cacheKey)) {
      return this.__cache.get(cacheKey);//even if it is null
    }
  }

  var splitPath;

  if (Array.isArray(path)) {

    splitPath = path;

  } else splitPath = this.__splitPath(path);

  var branch = splitPath[0];

  var kids = [];

  if (_this.branch == '*'){
    kids = _this.children.array;
  }
  else {

    var child = _this.__childByBranch(branch);

    var wildChild = _this.__childByBranch('*');

    if (child) kids.push(child);

    if (wildChild) kids.push(wildChild);
  }

  var subscriptions = [];

  kids.forEach(function (child) {

    if (splitPath.length == 1){
      return child._searchSubscriptions(originalPath, id).forEach(function(subscription){
        subscriptions.push(subscription);
      });
    }

    child.search(splitPath.slice(1, splitPath.length), id, depth, originalPath).forEach(function (subscription) {
      subscriptions.push(subscription);
    });
  });

  if (depth == 1){

    _this.__updateCache(originalPath, id, subscriptions);
  }

  return subscriptions;
};

PathTree.prototype.__childByBranch = function(branch){

  var childIndex = this.children.search(branch);

  if (childIndex < 0) return null;

  return this.children.array[childIndex];
};

PathTree.prototype.all = function(){

  var _this = this;

  var subscriptions = [];

  _this.__subscriptions_explicit.array.map(function(subscription){
    subscriptions.push(subscription);
  });

  _this.__subscriptions_wildcard.array.map(function(subscription){
    subscriptions.push(subscription);
  });

  _this.children.array.forEach(function(child){
    child.all().forEach(function(subscription){
      subscriptions.push(subscription);
    });
  });

  return subscriptions;
};

module.exports = PathTree;


