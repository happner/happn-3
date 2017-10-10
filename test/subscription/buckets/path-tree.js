var SortedObjectArray = require("sorted-object-array");

function PathTree(options, branch) {

  this.options = options ? options : {};

  if (!this.options.delimiter) this.options.delimiter = '/';
  if (!this.options.wildcardSingle) this.options.wildcardSingle = '*';
  if (!this.options.wildcardMultiple) this.options.wildcardMultiple = '**';

  this.__cache = new SortedObjectArray('key');

  this.children = new SortedObjectArray('branch');

  this.__subscriptions = new SortedObjectArray('key');

  if (!branch) branch = '';

  this.branch = branch;
}

PathTree.prototype.__clearCache = function (key) {

  if (!key) return this.__cache.array = [];

  this.__cache.remove(key);
};

PathTree.prototype.__splitPath = function (path) {

  if (Array.isArray(path)) return path;

  if (path.indexOf(this.options.delimiter) == 0) path = path.substring(1, path.length);

  return path.split(this.options.delimiter);
};

PathTree.prototype._addSubscriptionData = function (path, id, dataId, data, depth, originalPath) {

  var subscriptionKey = originalPath + id;

  var subscriptionSegment = originalPath.split('*')[0];

  var subscriptionDataIndex = this.__subscriptions.search(subscriptionKey);

  var subscription;

  if (subscriptionDataIndex == -1) {

    subscription = {
      fullPath: originalPath,
      key: subscriptionKey,
      segment: subscriptionSegment,
      id: id,
      refCount: 0,
      subscriptionData: {}
    };

  } else subscription = this.__subscriptions.array[subscriptionDataIndex];

  subscription.refCount++;
  subscription.data = data; //overwritten
  subscription.subscriptionData[dataId] = data;

  if (subscriptionDataIndex == -1) {

    this.__subscriptions.insert(subscription);
  }
};

PathTree.prototype.addSubscription = function (path, id, dataId, data, depth, originalPath) {

  var _this = this;

  if (!depth) depth = 1;

  else depth++;

  if (depth == 1) originalPath = path;

  var splitPath = this.__splitPath(path);

  var branch = splitPath[0];

  var childIndex = _this.children.search(branch);

  var child;

  _this.__clearCache(path + id);

  if (childIndex < 0) {

    child = new PathTree(this.options, branch);
    _this.children.insert(child);

  } else child = _this.children.array[childIndex];

  if (splitPath.length == 1) //end of branch
    return child._addSubscriptionData(path, id, dataId, data, depth, originalPath);

  child.addSubscription(splitPath.slice(1, splitPath.length), id, dataId, data, depth, originalPath);
};

PathTree.prototype._removeSubscriptionData = function (path, id, dataId, data, depth, originalPath) {

  var subscriptionKey = originalPath + id;

  var subscriptionDataIndex = this.__subscriptions.search(subscriptionKey);

  var subscription;

  if (subscriptionDataIndex == -1) {

    return;

  } else subscription = this.__subscriptions.array[subscriptionDataIndex];

  subscription.refCount--;

  if (subscription.refCount == 0) this.__subscriptions.array.splice(subscriptionDataIndex, 1);
};

PathTree.prototype.removeSubscription = function (path, id, dataId, data, depth, originalPath) {

  var _this = this;

  if (!depth) depth = 1;

  else depth++;

  if (depth == 1) {
    originalPath = path;
    _this.__clearCache(path + id);
  }

  var splitPath = this.__splitPath(path);

  var branch = splitPath[0];

  var childIndex = _this.children.search(branch);

  var child;

  if (childIndex < 0) return; //doesnt exist - cannot remove

  else child = _this.children.array[childIndex];

  if (splitPath.length == 1) //end of branch
    return child._removeSubscriptionData(path, id, dataId, data, depth, originalPath);

  child.removeSubscription(splitPath.slice(1, splitPath.length), id, dataId, data, depth, originalPath);
};

PathTree.prototype.__checkCache = function (path, id) {

  if (!id) id = '';

  var cacheKey = path + id;

  var foundInCache = this.__cache.search(cacheKey);

  if (foundInCache > -1) return this.__cache.array[foundInCache].items;

  return null;
};

PathTree.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf('*') == -1) return pattern == matchTo;

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

PathTree.prototype.__getItemsForSegment = function (path, sortedArray, matchesCriteria, options) {

  var searchIndex = sortedArray.search(path);

  if (searchIndex == -1) return [];

  var subscription = sortedArray.array[searchIndex];

  var walkIndex = searchIndex;

  var subscriptions = [];

  while (matchesCriteria(subscription)) {

    if (this.wildcardMatch(subscription.fullPath, options.fullPath))
      subscriptions.push({
        subscription: subscription,
        index: walkIndex
      });

    walkIndex--;

    subscription = sortedArray.array[walkIndex];
  }

  walkIndex = searchIndex + 1;

  subscription = sortedArray.array[walkIndex];

  while (matchesCriteria(subscription)) {

    if (this.wildcardMatch(subscription.fullPath, options.fullPath))
      subscriptions.push({
        subscription: subscription,
        index: walkIndex
      });

    walkIndex++;

    subscription = sortedArray.array[walkIndex];
  }

  return subscriptions;
};

PathTree.prototype.__updateCache = function (path, id, subscriptions) {

  var _this = this;

  if (!id) id = '';

  var cacheKey = path + id;

  _this.__cache.insert(cacheKey, subscriptions);

};

PathTree.prototype._searchSubscriptions = function (originalPath, id) {

  var _this = this;

  var cached = _this.__checkCache(originalPath, id);

  if (cached) return cached;

  var subscriptions = [];

  if (id) {

    //so looking for a specific subscription

    if (_this.branch == '*') {

      //no filtering necessary - all subscriptions under * get pulled out
      subscriptions = _this.__subscriptions.array.map(function (subscription) {
        if (subscription.id == id)
          return subscription;
      });
    } else subscriptions = _this.__subscriptions.array.map(function (subscription) {
      if (_this.wildcardMatch(subscription.fullPath, originalPath) && subscription.id == id)
        return subscription;
    });

  } else {

    if (_this.branch == '*') {

      //no filtering necessary - all subscriptions under * get pulled out
      subscriptions = _this.__subscriptions.array.map(function (subscription) {
        return subscription;
      });
    } else subscriptions = _this.__subscriptions.array.map(function (subscription) {
      if (_this.wildcardMatch(subscription.fullPath, originalPath))
        return subscription;
    });
  }

  _this.__updateCache(originalPath, id, subscriptions);

  return subscriptions;
};

PathTree.prototype.search = function (path, id, depth, originalPath) {

  var _this = this;

  if (!depth) depth = 1;

  else depth++;

  if (depth == 1) originalPath = path;

  var strPath = path;

  var splitPath;

  if (Array.isArray(path)) {

    strPath = path.join(_this.options.delimiter);
    splitPath = path;

  } else splitPath = this.__splitPath(path);

  var cached = _this.__checkCache(strPath, id);

  if (cached) return cached;

  var branch = splitPath[0];

  var kids = [];

  if (_this.branch == '*') {
    kids = _this.children.array;
  } else {

    var child = _this.__childByBranch(branch);

    var wildChild = _this.__childByBranch('*');

    if (child) kids.push(child);

    if (wildChild) kids.push(wildChild);
  }

  var subscriptions = [];

  kids.forEach(function (child) {

    if (splitPath.length == 1) {
      return child._searchSubscriptions(originalPath, id).forEach(function (subscription) {
        subscriptions.push(subscription);
      });
    }

    child.search(splitPath.slice(1, splitPath.length), id, depth, originalPath).forEach(function (subscription) {
      subscriptions.push(subscription);
    });
  });

  return subscriptions;
};

PathTree.prototype.__childByBranch = function (branch) {

  var childIndex = this.children.search(branch);

  if (childIndex < 0) return null;

  return this.children.array[childIndex];
};

module.exports = PathTree;
