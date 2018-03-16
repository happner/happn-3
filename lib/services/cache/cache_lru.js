module.exports = LRUCache;

var EventEmitter = require("events").EventEmitter;
var LRU = require("lru-cache");
var util = require('util');
var Promise = require('bluebird');
var sift = require('sift');

LRUCache.prototype.set = Promise.promisify(set);
LRUCache.prototype.has = has;
LRUCache.prototype.get = Promise.promisify(get);
LRUCache.prototype.increment = Promise.promisify(increment);
LRUCache.prototype.update = Promise.promisify(update);
LRUCache.prototype.remove = Promise.promisify(remove);
LRUCache.prototype.clear = Promise.promisify(clear);
LRUCache.prototype.all = Promise.promisify(all);
LRUCache.prototype.on = on;
LRUCache.prototype.off = off;

LRUCache.prototype.__emit = __emit;
LRUCache.prototype.__tryCallback = __tryCallback;
LRUCache.prototype.__all = _all;

function LRUCache(opts) {
  this.__cache = LRU(opts);
  this.__eventEmitter = new EventEmitter();
}

function set(key, data, opts, callback) {
  try {
    if (key == null || key == undefined) return callback(new Error('invalid key'));

    if (typeof opts == 'function') {
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};

    var maxAge = undefined;
    if (opts.ttl) maxAge = opts.ttl;

    var cacheItem = {
      data: this.utilities.clone(data),
      key: key,
      ttl: opts.ttl
    };

    this.__cache.set(key, cacheItem, maxAge);

    callback(null, cacheItem);

  } catch (e) {
    callback(e);
  }
}

function get(key, opts, callback) {
  try {
    if (key == null || key == undefined) return callback(new Error('invalid key'));

    if (typeof opts == 'function') {
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};

    var cached = this.__cache.get(key);

    if (cached) return this.__tryCallback(callback, cached.data, null, true);
    else {

      var _this = this;

      if (opts.retrieveMethod) {

        opts.retrieveMethod.call(opts.retrieveMethod, function (e, result) {

          if (e) return callback(e);

          // -1 and 0 are perfectly viable things to cache
          if (result == null || result == undefined) return _this.__tryCallback(callback, null, null);

          _this.set(key, result, opts, function (e) {

            return _this.__tryCallback(callback, result, e, true);
          });
        });

      } else if (opts.default) {

        var value = opts.default.value;
        delete opts.default.value;

        _this.set(key, value, opts.default, function (e) {
          return _this.__tryCallback(callback, value, e, true);
        });

      } else return _this.__tryCallback(callback, null, null);
    }

  } catch (e) {
    this.__tryCallback(callback, null, e)
  }
}

function increment(key, by, callback) {
  try {
    var result = this.__cache.get(key);

    if (typeof result.data == 'number') {
      result.data += by;
      this.__cache.set(key, result);
      return this.__tryCallback(callback, result.data, null);
    }
    return this.__tryCallback(callback, null, null);
  } catch (e) {
    return this.__tryCallback(callback, null, e);
  }
}

function update(key, data, callback) {
  try {
    if (typeof data == 'function') {
      callback = data;
      data = cache;
    }

    var result = this.__cache.get(key);

    if (result != null && result != undefined) {
      result.data = data;
      this.__cache.set(key, result, result.ttl);
      this.__tryCallback(callback, this.__cache.get(key), null);
    } else this.__tryCallback(callback, null, null);

  } catch (e) {
    return this.__tryCallback(callback, null, e);
  }
}

function has(key){
  return this.__cache.has(key);
}

function remove(key, opts, callback) {
  try {
    if (key == null || key == undefined) return callback(new Error('invalid key'));

    if (typeof opts == 'function') {
      callback = opts;
      opts = null;
    }

    var existed = this.__cache.get(key);
    var removed = existed != null && existed != undefined;

    this.__cache.del(key);

    callback(null, removed);

  } catch (e) {
    callback(e);
  }
}

function clear(callback) {
  if (this.__cache) this.__cache.reset();
  if (callback) callback();
}

function all(filter, callback) {
  try {
    if (typeof filter == 'function') {
      callback = filter;
      filter = null;
    }

    try {

      if (filter) return callback(null, sift({
        $and: [filter]
      }, this.__all()));
      else return callback(null, this.__all());

    } catch (e) {
      return callback(e);
    }
  } catch (e) {
    callback(e);
  }
}

function on(key, handler) {
  return this.__eventEmitter.on(key, handler);
}

function off(key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
}

function __emit(key, data) {
  return this.__eventEmitter.emit(key, data);
}

function __tryCallback(callback, data, e, clone) {

  var callbackData = data;

  if (data && clone) callbackData = this.utilities.clone(data);

  if (e) {
    if (callback) return callback(e);
    else throw e;
  }

  if (callback) callback(null, callbackData);
  else return callbackData;

}

function _all() {
  var returnItems = [];
  var values = this.__cache.values();

  values.forEach(function (value) {
    returnItems.push(value.data);
  });

  return returnItems;
}
