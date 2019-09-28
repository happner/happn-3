module.exports = LRUCache;

var EventEmitter = require('events').EventEmitter;
var LRU = require('lru-cache');
var util = require('util');
var Promise = require('bluebird');
var sift = require('sift').default;

LRUCache.prototype.setSync = setSync;
LRUCache.prototype.getSync = getSync;
LRUCache.prototype.removeSync = removeSync;

LRUCache.prototype.values = values;

LRUCache.prototype.set = Promise.promisify(set);
LRUCache.prototype.has = has;
LRUCache.prototype.get = Promise.promisify(get);
LRUCache.prototype.increment = Promise.promisify(increment);
LRUCache.prototype.update = Promise.promisify(update);
LRUCache.prototype.remove = Promise.promisify(remove);
LRUCache.prototype.clear = Promise.promisify(clear);
LRUCache.prototype.all = Promise.promisify(all);
LRUCache.prototype.stop = stop;
LRUCache.prototype.on = on;
LRUCache.prototype.off = off;

LRUCache.prototype.__emit = __emit;
LRUCache.prototype.__tryCallback = __tryCallback;
LRUCache.prototype.__all = _all;

function LRUCache(opts) {
  if (opts == null) opts = {};

  if (!opts.max) opts.max = 1000;

  this.__cache = new LRU(opts);
  this.__eventEmitter = new EventEmitter();
}

function setSync(key, data, opts) {
  if (!opts) opts = {};

  var maxAge;
  if (opts.ttl) maxAge = opts.ttl;

  var cacheItem = {
    data: opts.clone === false ? data : this.utilities.clone(data),
    key: key,
    ttl: opts.ttl,
    noclone: opts.clone === false
  };

  this.__cache.set(key, cacheItem, maxAge);

  return cacheItem;
}

function getSync(key, opts) {
  if (this.__cache.has(key)) {
    if (!opts) opts = {};
    var explicitClone = opts.clone === true; //explicitly clone result, even if it was set with clone:false
    var cached = this.__cache.get(key);
    if (cached.noclone && !explicitClone) return cached.data;
    return this.utilities.clone(cached.data);
  }

  return null;
}

function set(key, data, opts, callback) {
  if (key == null || key == undefined) return callback(new Error('invalid key'));

  if (typeof opts === 'function') {
    callback = opts;
    opts = null;
  }

  if (!opts) opts = {};

  var maxAge;
  if (opts.ttl) maxAge = opts.ttl;

  var cacheItem = {
    data: opts.clone === false ? data : this.utilities.clone(data),
    key: key,
    ttl: opts.ttl,
    noclone: opts.clone === false
  };

  this.__cache.set(key, cacheItem, maxAge);

  callback(null, cacheItem);
}

function get(key, opts, callback) {
  if (key == null || key == undefined) return this.__tryCallback(callback, null, null);

  if (typeof opts === 'function') {
    callback = opts;
    opts = null;
  }

  if (!opts) opts = {};

  var explicitClone = opts.clone === true; //explicitly clone result, even if it was set with clone:false

  if (opts.clone == null) opts.clone = true; //clone result by default

  var cached = this.__cache.get(key);

  if (cached != null)
    return this.__tryCallback(callback, cached.data, null, explicitClone || !cached.noclone);

  var _this = this;

  if (opts.retrieveMethod)
    return opts.retrieveMethod.call(opts.retrieveMethod, function(e, result) {
      if (e) return callback(e);
      // -1 and 0 are perfectly viable things to cache
      if (result == null) return _this.__tryCallback(callback, null, null);
      _this.set(key, result, opts, function(e) {
        return _this.__tryCallback(callback, result, e, opts.clone);
      });
    });

  if (opts.default) {
    var value = opts.default.value;
    delete opts.default.value;
    return _this.set(key, value, opts.default, function(e) {
      return _this.__tryCallback(callback, value, e, opts.clone);
    });
  }

  return _this.__tryCallback(callback, null, null);
}

function values() {
  return this.__cache.values();
}

function increment(key, by, callback) {
  try {
    var result = this.__cache.get(key);

    if (typeof result.data === 'number') {
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

function has(key) {
  return this.__cache.has(key);
}

function removeSync(key) {
  if (key == null || key == undefined) throw new Error('invalid key');

  var existing = this.__cache.get(key);

  this.__cache.del(key);

  return existing;
}

function remove(key, opts, callback) {
  if (key == null || key == undefined) return callback(new Error('invalid key'));

  if (typeof opts === 'function') {
    callback = opts;
    opts = null;
  }

  var existed = this.__cache.get(key);
  var removed = existed != null && existed != undefined;
  this.__cache.del(key);
  callback(null, removed);
}

function stop() {
  //do nothing
}

function clear(callback) {
  if (this.__cache) this.__cache.reset();
  if (callback) callback();
}

function all(filter, callback) {
  try {
    if (typeof filter === 'function') {
      callback = filter;
      filter = null;
    }

    try {
      if (filter)
        return callback(
          null,
          sift(
            {
              $and: [filter]
            },
            this.__all()
          )
        );
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

  values.forEach(function(value) {
    returnItems.push(value.data);
  });

  return returnItems;
}
