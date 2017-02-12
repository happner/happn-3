var
  SortedObjectArray = require("sorted-object-array")
  , LRU = require("lru-cache")
  ;

function Bucket(options){

  if (!options.cache) options.cache = {max:500};

  this.options = options;
}

Bucket.prototype.initialize = function(callback){

  Object.defineProperty(this, '__subscribers', {value:new SortedObjectArray('segment')});

  Object.defineProperty(this, '__cache', {value:new LRU(this.options.cache)});

  callback();
};

Bucket.prototype.wildcardMatch = function (pattern, matchTo) {

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));
  var matchResult = matchTo.match(regex);

  if (matchResult) return true;
  return false;
};

Bucket.prototype.getSubscriptions = function(path, callback){

  if (this.options.type == 0) return this.__subscribers.array;

  if (this.__cache.has(path)) return this.__cache.get(path);

  var segment = path.split('*')[0];

  var startIndex = this.__subscribers.search(segment);//search by segment

  if (startIndex == -1) return callback(null, []);

  var _this = this;

  var recipients = [];

  var sliceIndex = startIndex;

  _this.__subscribers.array.slice(startIndex, _this.__subscribers.array.length).every(function(subscription){

    if (_this.wildcardMatch(subscription.fullPath, path)) recipients.push({subscription:subscription, index:sliceIndex});

    sliceIndex++;

    return subscription.segment == segment;//we break out if the wildcard segment no longer matches
  });

  callback(null, recipients);
};

Bucket.prototype.addSubscription = function(path, sessionId, callback){

  var _this = this;

  if (!callback) callback = function(){};//in case we have a bucket that needs a callback

  _this.getSubscriptions(path, function(e, subscriptions) {

    if (e) return callback(e);

    var foundSubscription = false;

    subscriptions.forEach(function(recipient){

      if (recipient.subscription.sessionId == sessionId) {

        _this.__subscribers.array[recipient.index].refCount++;

        foundSubscription = true;
      }
    });

    if (!foundSubscription) {
      _this.__subscribers.insert({
        segment:path.split('*')[0],
        fullPath:path,
        sessionId:sessionId,
        refCount:1});
    }

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.removeSubscription = function(path, sessionId, callback){

  var _this = this;

  if (!callback) callback = function(){};//in case we have a bucket that needs a callback

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

    _this.__cache.reset();

    callback();
  });
};

Bucket.prototype.allSubscriptions = function(){

  return this.__subscribers.array;
};

module.exports = Bucket;


