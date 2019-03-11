module.exports = PersistedCache;

var EventEmitter = require("events").EventEmitter;
var util = require('util');
var async = require('async');
var lt = require('long-timeout');
var Promise = require('bluebird');
var sift = require('sift').default;

PersistedCache.prototype.has = has;
PersistedCache.prototype.set = Promise.promisify(set);
PersistedCache.prototype.get = Promise.promisify(get);
PersistedCache.prototype.increment = Promise.promisify(increment);
PersistedCache.prototype.update = Promise.promisify(update);
PersistedCache.prototype.remove = Promise.promisify(remove);
PersistedCache.prototype.clear = Promise.promisify(clear);
PersistedCache.prototype.all = Promise.promisify(all);
PersistedCache.prototype.__returnAll = __returnAll;
PersistedCache.prototype.sync = Promise.promisify(sync);
PersistedCache.prototype.on = on;
PersistedCache.prototype.off = off;
PersistedCache.prototype.appendTimeout = appendTimeout;
PersistedCache.prototype.clearTimeout = _clearTimeout;

PersistedCache.prototype.__emit = __emit;
PersistedCache.prototype.__getData = __getData;
PersistedCache.prototype.__persistData = __persistData;
PersistedCache.prototype.__removeData = __removeData;
PersistedCache.prototype.__tryCallback = __tryCallback;
PersistedCache.prototype.__setCallback = __setCallback;
PersistedCache.prototype.__all = __all;

function PersistedCache(opts) {
  if (!opts.dataStore) throw new Error('no dataStore defined for a persisted cache');

  this.dataStore = opts.dataStore;

  this.__cache = {};
  this.__eventEmitter = new EventEmitter();

  if (!opts.key_prefix) opts.key_prefix = '/_SYSTEM/_CACHE/default';
  else opts.key_prefix = '/_SYSTEM/_CACHE/' + opts.key_prefix;

  this.opts = opts;

  this.__timeouts = {};
}

function has(key) {
  return this.__cache[key] != null;
}

function __setCallback(key, cacheItem, callback) {

  this.__cache[key] = cacheItem;

  this.__emit('item-set', cacheItem);

  return this.__tryCallback(callback, cacheItem, null);
}

function set(key, data, opts, callback) {

  var _this = this;

  if (typeof opts == 'function') {
    callback = opts;
    opts = null;
  }

  if (!opts) opts = {};
  if (!opts.ttl) opts.ttl = _this.opts.defaultTTL;

  var cacheItem = {
    data: this.utilities.clone(data),
    key: key
  };

  if (opts.ttl > 0) {

    var preExisting = this.__cache[key];

    if (preExisting != null && preExisting != undefined) _this.clearTimeout(key);

    _this.appendTimeout(cacheItem, opts.ttl);
  }

  if (opts.noPersist)  return _this.__setCallback(key, cacheItem, callback);

  _this.__persistData(key, cacheItem, function (e) {

    if (e) return _this.__tryCallback(callback, null, e);

    _this.__setCallback(key, cacheItem, callback);
  });
}

function get(key, opts, callback) {

  if (typeof opts == 'function') {
    callback = opts;
    opts = {};
  }

  if (!opts) opts = {};

  var cached = this.__cache[key];

  if (cached != null) return this.__tryCallback(callback, cached.data, null, true);

  if (this.__synced) return this.__tryCallback(callback, null, null); //we are in sync with the db, null value

  var _this = this;

  _this.__getData(key, function (e, item) {

    if (e) return callback(e);

    if (item) return _this.__tryCallback(callback, item.data, null, true);

    if (opts.retrieveMethod)
      return opts.retrieveMethod.call(opts.retrieveMethod, function (e, result) {

        if (e) return callback(e);

        // -1 and 0 are perfectly viable things to cache
        if (result == null || result == undefined) return _this.__tryCallback(callback, null, null);

        _this.set(key, result, opts, function (e) {
          return _this.__tryCallback(callback, result, e, true);
        });
      });

    if (opts.default) {

      var value = opts.default.value;
      delete opts.default.value;

      return _this.set(key, value, opts.default, function (e) {
        return _this.__tryCallback(callback, value, e, true);
      });
    }

    return _this.__tryCallback(callback, null, null);
  });
}

function increment(key, by, callback) {

  var _this = this;

  if (_this.__cache[key] && typeof _this.__cache[key].data == 'number') {

    _this.__cache[key].data += by;

    var dataItem = {
      data: this.__cache[key].data,
      key: key
    };

    return _this.__persistData(key, dataItem, function (e) {

      if (e) _this.__tryCallback(callback, null, e);
      else _this.__tryCallback(callback, _this.__cache[key].data, null);
    });
  }

  return this.__tryCallback(callback, null, null);
}

function update(key, data, callback) {

  if (typeof data == 'function') {
    callback = data;
    data = cache;
  }

  var _this = this;

  if (_this.__cache[key]) {

    _this.__cache[key].data = data;

    return _this.__persistData(key, _this.__cache[key], function (e) {

      if (e) return _this.__tryCallback(callback, null, e);
      _this.__tryCallback(callback, _this.__cache[key], null);
    });

  } else _this.__tryCallback(callback, null, null);
}

function remove(key, opts, callback) {

  var _this = this;

  if (typeof opts == 'function') {
    callback = opts;
    opts = null;
  }

  if (!opts) opts = {};

  var foundItem = false;

  if (_this.__cache[key])
    return _this.__removeData(key, function (e) {

      if (e) return callback(e);
      delete _this.__cache[key];
      _this.__emit('item-removed', key);
      _this.__tryCallback(callback, true, null);
    });

  _this.__tryCallback(callback, foundItem, null);
}

function clear(callback) {

  var _this = this;

  _this.dataStore.remove(_this.opts.key_prefix + '/*', {}, function (e) {

    if (e) {
      if (callback) return callback(e);
      throw e;
    }
    _this.__cache = {};
    if (callback) callback();
  });
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

function sync(callback) {
  var _this = this;

  _this.dataStore.get(this.opts.key_prefix + '/*', {}, function (e, items) {

    if (e) return callback(e);

    if (!items || items.length == 0) {

      _this.__synced = true;
      return callback(null);
    }

    async.eachSeries(items, function (item, itemCB) {

      if (item.data.ttl) {
        if ((Date.now() - item._meta.modified) > item.data.ttl) {
          return _this.__removeData(item.data.key, itemCB);
        }
      }

      _this.set(item.data.key, item.data.data, {
        ttl: item.data.ttl,
        noPersist: true
      }, itemCB);

    }, function (e) {

      if (e) return callback(e);
      _this.__synced = true;
      callback();
    });
  });
}

function on(key, handler) {
  return this.__eventEmitter.on(key, handler);
}

function off(key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
}

function appendTimeout(data, ttl) {

  this.clearTimeout(data.key);

  this.__timeouts[data.key] = lt.setTimeout(() => {

    var thisKey = data.key;

    this.remove(data.key, (e) => {
      if (e) this.__emit('error', new Error('failed to remove timed out item'));
      this.__emit('item-timed-out', {
        key: thisKey
      });
    });

  }, ttl);

  data.ttl = ttl;
}

function _clearTimeout(key) {
  if (this.__timeouts[key] !== undefined) clearTimeout(this.__timeouts[key]);
}

function __returnAll(callback) {

  var allItems = [];

  Object.keys(this.__cache).forEach((itemKey) => {
    allItems.push(this.utilities.clone(this.__cache[itemKey].data));
  });

  callback(null, allItems);
}

function __all(callback) {

  var _this = this;

  if (!_this.__synced)
    _this.sync(function (e) {

      if (e) return callback(e);

      _this.__returnAll(callback);
    });
  else _this.__returnAll(callback);
}

function __emit(key, data) {
  return this.__eventEmitter.emit(key, data);
}

function __getData(key, callback) {

  var _this = this;

  _this.dataStore.get(_this.opts.key_prefix + '/' + key, {}, function (e, item) {

    if (e) return callback(e);

    if (!item) return callback(null, null);

    _this.__cache[key] = item;

    return callback(null, item);
  });
}

function __persistData(key, data, callback) {
  this.dataStore.upsert(this.opts.key_prefix + '/' + key, data, {
    merge: true
  }, callback);
}

function __removeData(key, callback) {
  this.dataStore.remove(this.opts.key_prefix + '/' + key, {}, callback);
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
