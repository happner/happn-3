var SortedObjectArray = require("sorted-object-array")
  , LRU = require("lru-cache")
  , _ = require('underscore.string')
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

  this.__subscriptions_explicit.listType = 'explicit';

  this.__subscriptions_wildcard = new SortedObjectArray('key');

  this.__subscriptions_explicit.listType = 'wildcard';

  if (!branch) branch = '';

  this.branch = branch;
}

PathTree.prototype.__clearCache = function (key) {

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

  var subscriptionArray = (originalPath.indexOf(this.options.wildcardSingle) > -1) || (this.branch == this.options.wildcardMultiple) ? this.__subscriptions_wildcard : this.__subscriptions_explicit;

  var subscriptionDataIndex = subscriptionArray.search(subscriptionKey);

  var subscription;

  if (subscriptionDataIndex == -1) {

    subscription = {
      fullPath: originalPath,
      key: subscriptionKey,
      id: id,
      refCount: 0,
      subscriptionData: {},
      action:(data.options && data.options.event_type != null)?data.options.event_type.toUpperCase():'ALL'
    };

    if (this.options.appendSubscriptionProperties){
      for (var propertyName in this.options.appendSubscriptionProperties) {
        if (!subscription.hasOwnProperty(propertyName))
          subscription[propertyName] = this.options.appendSubscriptionProperties[propertyName];
      }
    }

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

  if (splitPath.length == 1 || branch == _this.options.wildcardMultiple) //end of branch
    return child._addSubscriptionData(path, id, dataId, data, depth, originalPath);

  child.addSubscription(splitPath.slice(1, splitPath.length), id, dataId, data, depth, originalPath);
};

PathTree.prototype._removeSubscriptionData = function (path, id, options, originalPath) {

  var subscriptionKey = originalPath + this.options.patternIdDivider + id;

  var subscriptionArray = originalPath.indexOf(this.options.wildcardSingle) > -1 || this.branch == this.options.wildcardMultiple? this.__subscriptions_wildcard : this.__subscriptions_explicit;

  var subscriptionDataIndex = subscriptionArray.search(subscriptionKey);

  var subscription;

  if (subscriptionDataIndex == -1) {

    return;

  } else subscription = subscriptionArray.array[subscriptionDataIndex];

  if (options.dataId) delete subscription.subscriptionData[options.dataId];

  subscription.refCount -= (options.refCount == null ? 1 : options.refCount);

  if (subscription.refCount == 0) subscriptionArray.array.splice(subscriptionDataIndex, 1);
};

PathTree.prototype.removeSubscriptions = function (id) {

  var _this = this;

  _this.__subscriptions_explicit.array.reverse().forEach(function (subscription, index) {

    if (id == null || subscription.id == id) _this.__subscriptions_explicit.array.splice(index, 1);
  });

  _this.__subscriptions_wildcard.array.reverse().forEach(function (subscription, index) {

    if (id == null || subscription.id == id) _this.__subscriptions_wildcard.array.splice(index, 1);
  });

  _this.children.array.forEach(function (child) {
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

  if (splitPath.length == 1 || branch == _this.options.wildcardMultiple) //end of branch
    return child._removeSubscriptionData(path, id, options, originalPath);

  child.removeSubscription(splitPath.slice(1, splitPath.length), id, options, depth, originalPath);
};

PathTree.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf(this.options.wildcardSingle) == -1 &&
      pattern.indexOf(this.options.wildcardMultiple) == -1)
      return pattern == matchTo;

  var regexPattern = pattern
    .replace(new RegExp('[' + this.options.wildcardMultiple + ']', 'g'), '.*')
    .replace(new RegExp('[' + this.options.wildcardSingle + ']', 'g'), '.*');

  return matchTo.match(new RegExp(regexPattern)) != null;
};

PathTree.prototype.__updateCache = function (path, id, subscriptions) {

  this.__cache.set(path + this.options.patternIdDivider + (id == null ? '' : id), subscriptions);
};

PathTree.prototype._searchSubscriptions = function (originalPath, id) {

  var _this = this;

  var subscriptions = [];

  if (id){

    _this.__subscriptions_explicit.array.every(function (subscription) {
      if ((subscription.id == id) && subscription.fullPath == originalPath){
        subscriptions.push(subscription);
        return false;//can be only 1 that matches
      }
      return true;
    });

    _this.__subscriptions_wildcard.array.map(function (subscription) {
      if ((subscription.id == id) && _this.wildcardMatch(subscription.fullPath, originalPath))
        subscriptions.push(subscription);
    });

  } else {

    _this.__subscriptions_explicit.array.map(function (subscription) {

      if (subscription.fullPath == originalPath)
        subscriptions.push(subscription);
    });

    _this.__subscriptions_wildcard.array.map(function (subscription) {

      if (_this.wildcardMatch(subscription.fullPath, originalPath))
        subscriptions.push(subscription);
    });
  }

  return subscriptions;
};

PathTree.prototype.search = function (path, id, depth, originalPath) {

  var _this = this;

  if (!depth) depth = 1;

  else depth++;

  if (depth == 1) {

    originalPath = path;

    var cacheKey = originalPath + this.options.patternIdDivider + (id == null ? '' : id);

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

  var subscriptions = [];

  if (_this.branch == this.options.wildcardSingle) kids = _this.children.array;

  else if (_this.branch == this.options.wildcardMultiple) {

    _this._searchSubscriptions(originalPath, id).forEach(function (subscription) {
      subscriptions.push(subscription);
    });
  }
  else {

    var child = _this.__childByBranch(branch);

    var wildChild = _this.__childByBranch(this.options.wildcardSingle);

    var wildChildMultiple = _this.__childByBranch(this.options.wildcardMultiple);

    if (child) kids.push(child);

    if (wildChild) kids.push(wildChild);

    if (wildChildMultiple) kids.push(wildChildMultiple);
  }

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

  if (depth == 1) _this.__updateCache(originalPath, id, subscriptions);

  return subscriptions;
};

PathTree.prototype.__childByBranch = function (branch) {

  var childIndex = this.children.search(branch);

  if (childIndex < 0) return null;

  return this.children.array[childIndex];
};

PathTree.prototype.all = function () {

  var _this = this;

  var subscriptions = [];

  _this.__subscriptions_explicit.array.map(function (subscription) {
    subscriptions.push(subscription);
  });

  _this.__subscriptions_wildcard.array.map(function (subscription) {
    subscriptions.push(subscription);
  });

  _this.children.array.forEach(function (child) {
    child.all().forEach(function (subscription) {
      subscriptions.push(subscription);
    });
  });

  return subscriptions;
};

module.exports = PathTree;


