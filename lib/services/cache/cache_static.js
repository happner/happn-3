module.exports = StaticCache;

var EventEmitter = require("events").EventEmitter;
var util = require('util');
var Promise = require('bluebird');
var sift = require('sift');

StaticCache.prototype.set = Promise.promisify(set);
StaticCache.prototype.get = Promise.promisify(get);
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

function set(key, data, opts, callback) {
  try {
    if (typeof opts == 'function') {
      callback = opts;
      opts = null;
    }

    if (!opts) opts = {};
    if (!opts.ttl) opts.ttl = this.opts.defaultTTL;

    var cacheItem = {
      data: this.utilities.clone(data),
      key: key
    };

    if (opts.ttl > 0) {

      var preExisting = this.__cache[key];

      if (preExisting != null && preExisting != undefined) this.clearTimeout(preExisting);

      this.appendTimeout(cacheItem, opts.ttl);
    }

    this.__cache[key] = cacheItem;

    this.__emit('item-set', cacheItem);

    return this.__tryCallback(callback, cacheItem, null);

  } catch (e) {
    return this.__tryCallback(callback, null, e);
  }
};

function get(key, opts, callback) {
  var _this = this;

  try {

    if (typeof opts == 'function') {
      callback = opts;
      opts = {};
    }

    if (!opts) opts = {};

    if (opts.clone == null) opts.clone = true;

    if (!_this.__cache[key]) {

      if (opts.retrieveMethod) {

        opts.retrieveMethod.call(opts.retrieveMethod, function (e, result) {

          if (e) return callback(e);

          // -1 and 0 are perfectly viable things to cache
          if (result == null || result == undefined) return _this.__tryCallback(callback, null, null);

          _this.set(key, result, opts, function (e) {
            return _this.__tryCallback(callback, result, e, opts.clone);
          });

        });

      } else if (opts.default) {

        var value = opts.default.value;
        delete opts.default.value;

        _this.set(key, value, opts.default, function (e) {

          return _this.__tryCallback(callback, value, e, opts.clone);
        });

      } else return _this.__tryCallback(callback, null, null);

    } else return _this.__tryCallback(callback, this.__cache[key].data, null, opts.clone);

  } catch (e) {
    return _this.__tryCallback(callback, null, e);
  }
};

function increment(key, by, callback) {
  try {
    if (this.__cache[key] && typeof this.__cache[key].data == 'number') {
      this.__cache[key].data += by;
      return this.__tryCallback(callback, this.__cache[key].data, null, true);
    }
    return this.__tryCallback(callback, null, null);
  } catch (e) {
    return this.__tryCallback(callback, null, e);
  }
};

function update(key, data, callback) {
  try {
    if (typeof data == 'function') {
      callback = data;
      data = cache;
    }

    if (this.__cache[key]) {
      this.__cache[key].data = data;
      return this.__tryCallback(callback, this.__cache[key], null);
    } else this.__tryCallback(callback, null, null);

  } catch (e) {
    return this.__tryCallback(callback, null, e);
  }
};

function remove(key, opts, callback) {
  try {
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

  } catch (e) {
    return this.__tryCallback(callback, null, e);
  }
};

function clear(callback) {
  this.__cache = {};

  if (callback) callback();
}

function all(filter, callback) {
  try {
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

  } catch (e) {
    callback(e);
  }
};

function on(key, handler) {
  return this.__eventEmitter.on(key, handler);
};

function off(key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
};

function appendTimeout(data, ttl) {
  var _this = this;

  _this.clearTimeout(data);

  data.ttl = ttl;

  _this.__timeouts[data.key] = setTimeout(function () {

    var thisKey = this.key;
    _this.remove(this.key, function (e) {
      if (e) _this.__emit('error', new Error('failed to remove timed out item'));
      _this.__emit('item-timed-out', {
        key: thisKey
      });
    });

  }.bind(data), ttl);
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

};

function __all(callback) {
  try {
    var allItems = [];

    Object.keys(this.__cache).forEach(function (itemKey) {
      allItems.push(this.utilities.clone(this.__cache[itemKey].data));
    }.bind(this));

    callback(null, allItems);

  } catch (e) {
    callback(e);
  }
};
