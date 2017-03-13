var SortedObjectArray = require("sorted-object-array")

;

function PathTrie(options, branch){

  this.options = options?options:{};

  if (!this.options.delimiter) this.options.delimiter = '/';
  if (!this.options.wildcardSingle) this.options.wildcardSingle = '*';
  if (!this.options.wildcardMultiple) this.options.wildcardMultiple = '**';

  this.__cache = new SortedObjectArray('key');

  this.children = new SortedObjectArray('branch');

  this.__subscriptions = new SortedObjectArray('path');

  if (!branch) branch = '';

  this.branch = branch;
}

PathTrie.prototype.__splitPath = function(path){

  if (Array.isArray(path)) return path;

  if (path.indexOf(this.options.delimiter) == 0) path = path.substring(1, path.length);

  return path.split(this.options.delimiter);
};

PathTrie.prototype.addSubscriptionData = function(path, id, dataId, data, depth, originalPath){

  var subscriptionDataIndex = this.__subscriptions.search(originalPath + id);

  var subscription;

  if (subscriptionDataIndex == -1){

    subscription = {
      fullPath:originalPath,
      segment:path,
      id:id,
      refCount:0
    };

  } else subscription = this.__subscriptions.array[subscriptionDataIndex];

  subscription.refCount++;
  subscription.data = data;//overwritten
  subscription.subscriptionData[dataId] = data;

  if (subscriptionDataIndex == -1) this.__subscriptions.insert(subscription);
};

PathTrie.prototype.addSubscription = function(path, id, dataId, data, depth, originalPath){

  var _this = this;

  if (!depth) depth = 1;
  else depth++;

  if (depth == 1) originalPath = path;

  var splitPath = this.__splitPath(path);

  var branch = splitPath[0];

  var childIndex = _this.children.search(branch);

  var child;

  _this.__cache.remove(path + id);//now we can clear the cache

  if (childIndex < 0){

    child = new PathTrie(this.options, branch);

    _this.children.insert(child);

  } else child = _this.children.array[childIndex];

  if (splitPath.length == 1) {//end of branch
    return child.addSubscriptionData(path, id, dataId, data, depth, originalPath);
  }

  child.addSubscription(splitPath.splice(0, 1), id, dataId, data, depth, originalPath);
};

PathTrie.prototype.removeSubscription = function(path, id){

};

PathTrie.prototype.__searchCache = function(path, id){

  var cacheKey = path + id;

  var foundInCache = this.__cache.search(cacheKey);

  if (foundInCache > -1) return this.__cache.array[foundInCache].items;

  return null;
};

PathTrie.prototype.__searchSubscriptions = function(originalPath, id){

  var _this = this;

  _this.__subscriptions.array.forEach(function(subscription){


  });
};

PathTrie.prototype.search = function(path, id, depth, originalPath){

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

  var cached = _this.__searchCache(strPath, id);

  if (cached) return cached;

  var branch = splitPath[0];

  var childIndex = _this.children.search(branch);

  var child;

  if (childIndex < 0) return null;

  child = _this.children.array[childIndex];

  if (splitPath.length == 1) {//end of branch

    return _this.__searchSubscriptions(originalPath, id);
  }

  return child.search(splitPath.splice(0, 1), id, depth, originalPath);
};

module.exports = PathTrie;


