module.exports = StaticCache;

var EventEmitter = require("events").EventEmitter;
var util = require('util');
var Promise = require('bluebird');
var sift = require('sift');

StaticCache.prototype.has = has;
StaticCache.prototype.set = Promise.promisify(set);
StaticCache.prototype.get = Promise.promisify(get);
StaticCache.prototype.removeSync = removeSync;
StaticCache.prototype.setSync = setSync;
StaticCache.prototype.getSync = getSync;
StaticCache.prototype.increment = Promise.promisify(increment);
StaticCache.prototype.update = Promise.promisify(update);
StaticCache.prototype.remove = Promise.promisify(remove);
StaticCache.prototype.clear = Promise.promisify(clear);
StaticCache.prototype.all = Promise.promisify(all);
StaticCache.prototype.on = on;
StaticCache.prototype.off = off;
StaticCache.prototype.appendTimeout = appendTimeout;
StaticCache.prototype.clearTimeout = _clearTimeout;

StaticCache.prototype.__emit = __emit;
StaticCache.prototype.__tryCallback = __tryCallback;
StaticCache.prototype.__all = Promise.promisify(__all);

function StaticCache(opts) {
  this.opts = opts;
  this.__cache = {};
  this.__eventEmitter = new EventEmitter();
  this.__timeouts = {};
}

function has(key) {
  return this.__cache[key] != null;
}

function set(key, data, opts, callback) {

  if (typeof opts == 'function') {
    callback = opts;
    opts = null;
  }

  if (!opts) opts = {};
  if (!opts.ttl) opts.ttl = this.opts.defaultTTL;

  var cacheItem = {
    data: opts.clone === false?data:this.utilities.clone(data),
    key: key,
    noclone: opts.clone === false
  };

  if (opts.ttl > 0) {
    var preExisting = this.__cache[key];
    if (preExisting != null && preExisting != undefined) this.clearTimeout(preExisting);
    this.appendTimeout(cacheItem, opts.ttl);
  }

  this.__cache[key] = cacheItem;
  this.__emit('item-set', cacheItem);
  return this.__tryCallback(callback, cacheItem, null);
}

function getSync(key, opts) {

  if (!opts) opts = {};
  var explicitClone = opts.clone === true;//explicitly clone result, even if it was set with clone:false
  if (opts.clone == null) opts.clone = true;//clone result by default
  var cached = this.__cache[key];
  if (cached == null) return null;
  if (cached.noclone && !explicitClone) return cached.data;
  return this.utilities.clone(cached.data);
}

function setSync(key, data, opts) {

  if (!opts) opts = {};
  if (!opts.ttl) opts.ttl = this.opts.defaultTTL;

  var cacheItem = {
    data: opts.clone === false?data:this.utilities.clone(data),
    key: key,
    noclone: opts.clone === false
  };

  if (opts.ttl > 0) {
    var preExisting = this.__cache[key];
    if (preExisting != null && preExisting != undefined) this.clearTimeout(preExisting);
    this.appendTimeout(cacheItem, opts.ttl);
  }

  this.__cache[key] = cacheItem;
  this.__emit('item-set', cacheItem);

  return cacheItem;
}

function removeSync(key) {

  var existing = this.__cache[key];

  delete this.__cache[key];

  if (this.__timeouts[key]) {
    clearTimeout(this.__timeouts[key]);
    delete this.__timeouts[key];
  }

  if (existing) this.__emit('item-removed', key);

  return existing;
}

function get(key, opts, callback) {

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  if (!opts) opts = {};

  var explicitClone = opts.clone === true;//explicitly clone result, even if it was set with clone:false

  if (opts.clone == null) opts.clone = true;//clone result by default

  var cached = this.__cache[key];

  if (cached != null) return this.__tryCallback(callback, cached.data, null, explicitClone || !cached.noclone);

  var _this = this;

  if (opts.retrieveMethod)
    return opts.retrieveMethod.call(opts.retrieveMethod, function (e, result) {
      if (e) return callback(e);
      // -1 and 0 are perfectly viable things to cache
      if (result == null) return _this.__tryCallback(callback, null, null);
      _this.set(key, result, opts, function (e) {
        return _this.__tryCallback(callback, result, e, opts.clone);
      });
    });

  if (opts.default) {
    var value = opts.default.value;
    delete opts.default.value;
    return _this.set(key, value, opts.default, function (e) {
      return _this.__tryCallback(callback, value, e, opts.clone);
    });
  }

  return _this.__tryCallback(callback, null, null);
}

function increment(key, by, callback) {
  if (this.__cache[key] && typeof this.__cache[key].data == 'number') {
    this.__cache[key].data += by;
    return this.__tryCallback(callback, this.__cache[key].data, null, true);
  }
  return this.__tryCallback(callback, null, null);
}

function update(key, data, callback) {

  if (typeof data == 'function') {
    callback = data;
    data = cache;
  }

  if (this.__cache[key]) {
    this.__cache[key].data = data;
    return this.__tryCallback(callback, this.__cache[key], null);
  } else this.__tryCallback(callback, null, null);
}

function remove(key, opts, callback) {

  if (typeof opts == 'function') {
    callback = opts;
    opts = null;
  }

  if (!opts) opts = {};

  var foundItem = false;

  if (this.__cache[key]) {
    foundItem = true;
    delete this.__cache[key];
  }

  if (this.__timeouts[key]) {
    clearTimeout(this.__timeouts[key]);
    delete this.__timeouts[key];
  }

  if (foundItem) this.__emit('item-removed', key);

  return this.__tryCallback(callback, foundItem, null);
}

function clear(callback) {
  this.__cache = {};
  if (callback) callback();
}

function all(filter, callback) {

  if (typeof filter == 'function') {
    callback = filter;
    filter = null;
  }

  this.__all(function (e, items) {

    if (e) return callback(e);
    if (filter) return callback(null, sift({
      $and: [filter]
    }, items));
    else return callback(null, items);
  });
}

function on(key, handler) {
  return this.__eventEmitter.on(key, handler);
}

function off(key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
}

function appendTimeout(data, ttl) {
  var _this = this;

  _this.clearTimeout(data);

  data.ttl = ttl;

  _this.__timeouts[data.key] = setTimeout(function () {

    var thisKey = data.key;
    _this.remove(data.key, function (e) {
      if (e) _this.__emit('error', new Error('failed to remove timed out item'));
      _this.__emit('item-timed-out', {
        key: thisKey
      });
    });

  }, ttl);
}

function _clearTimeout(data) {
  if (this.__timeouts[data.key] !== undefined) clearTimeout(this.__timeouts[data.key]);
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

function __all(callback) {
  var _this = this, allItems = [];

  Object.keys(_this.__cache).forEach(function (itemKey) {
    allItems.push(_this.utilities.clone(_this.__cache[itemKey].data));
  });

  callback(null, allItems);
}
