module.exports = PersistedCache;

var EventEmitter = require("events").EventEmitter;
var util = require('util');
var async = require('async');
var lt = require('long-timeout');
var Promise = require('bluebird');
var sift = require('sift');

PersistedCache.prototype.set = Promise.promisify(set);
PersistedCache.prototype.get = Promise.promisify(get);
PersistedCache.prototype.increment = Promise.promisify(increment);
PersistedCache.prototype.update = Promise.promisify(update);
PersistedCache.prototype.remove = Promise.promisify(remove);
PersistedCache.prototype.clear = Promise.promisify(clear);
PersistedCache.prototype.all = Promise.promisify(all);
PersistedCache.prototype.sync = Promise.promisify(sync);
PersistedCache.prototype.on = on;
PersistedCache.prototype.off = off;
PersistedCache.prototype.appendTimeout = appendTimeout;
PersistedCache.prototype.clearTimeout = clearTimeout;

PersistedCache.prototype.__emit = __emit;
PersistedCache.prototype.__getData = __getData;
PersistedCache.prototype.__persistData = __persistData;
PersistedCache.prototype.__removeData = __removeData;
PersistedCache.prototype.__tryCallback = __tryCallback;
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

    var doCallBack = function () {

      this.__cache[key] = cacheItem;

      this.__emit('item-set', cacheItem);

      return this.__tryCallback(callback, cacheItem, null);

    }.bind(this);

    if (!opts.noPersist) {

      this.__persistData(key, cacheItem, function (e) {

        if (e) return this.__tryCallback(callback, null, e);
        doCallBack();

      });

    } else doCallBack();

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

    if (!_this.__cache[key]) {

      if (_this.__synced) return _this.__tryCallback(callback, null, null); //we are in sync with the db

      _this.__getData(key, function (e, item) {

        if (e) return callback(e);

        if (item) return _this.__tryCallback(callback, item.data, null, true);

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

      });

    } else return _this.__tryCallback(callback, this.__cache[key].data, null, true);

  } catch (e) {
    return _this.__tryCallback(callback, null, e);
  }
};

function increment(key, by, callback) {
  try {
    if (this.__cache[key] && typeof this.__cache[key].data == 'number') {

      this.__cache[key].data += by;

      var dataItem = {
        data: this.__cache[key].data,
        key: key
      };

      return this.__persistData(key, dataItem, function (e) {

        if (e) this.__tryCallback(callback, null, e);
        else this.__tryCallback(callback, this.__cache[key].data, null);

      }.bind(this));
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

      return this.__persistData(key, this.__cache[key], function (e) {

        if (e) this.__tryCallback(callback, null, e);
        else this.__tryCallback(callback, this.__cache[key], null);

      }.bind(this));

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
      var _this = this;

      //delete the item
      return this.__removeData(key, function (e) {

        if (e) return callback(e);
        delete _this.__cache[key];

        _this.__emit('item-removed', key);

        this.__tryCallback(callback, true, null);
      }.bind(this));

    } else this.__tryCallback(callback, foundItem, null);


  } catch (e) {
    return this.__tryCallback(callback, null, e);
  }
};

function clear(callback) {
  this.dataStore.remove(this.opts.key_prefix + '/*', {}, function (e) {

    if (e) return callback(e);
    this.__cache = {};

    callback();

  }.bind(this));
};

function all(filter, callback) {
  try {
    if (typeof filter == 'function') {
      callback = filter;
      filter = null;
    }

    try {
      this.__all(function (e, items) {

        if (e) return callback(e);
        if (filter) return callback(null, sift({
          $and: [filter]
        }, items));
        else return callback(null, items);

      });

    } catch (e) {
      return callback(e);
    }
  } catch (e) {
    callback(e);
  }
};

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

  _this.__timeouts[data.key] = lt.setTimeout(function () {

    var thisKey = this.key;

    _this.remove(this.key, function (e) {
      if (e) _this.__emit('error', new Error('failed to remove timed out item'));
      _this.__emit('item-timed-out', {
        key: thisKey
      });
    });

  }.bind(data), ttl);

  data.ttl = ttl;
};

function clearTimeout(data) {
  if (this.__timeouts[data.key] !== undefined) lt.clearTimeout(this.__timeouts[data.key]);
};

function __all(callback) {
  var _this = this;

  var returnAll = function () {
    var allItems = [];

    Object.keys(_this.__cache).forEach(function (itemKey) {
      allItems.push(_this.utilities.clone(_this.__cache[itemKey].data));
    });

    callback(null, allItems);

  };

  if (!_this.__synced)
    _this.sync(function (e) {

      if (e) return callback(e);

      returnAll();
    });
  else returnAll();
};

function __emit(key, data) {
  return this.__eventEmitter.emit(key, data);
};

function __getData(key, callback) {
  this.dataStore.get(this.opts.key_prefix + '/' + key, {}, function (e, item) {

    if (e) return callback(e);

    if (!item) return callback(null, null);

    this.__cache[key] = item;

    return callback(null, item);

  }.bind(this));
};

function __persistData(key, data, callback) {
  this.dataStore.upsert(this.opts.key_prefix + '/' + key, data, {
    merge: true
  }, callback);
};

function __removeData(key, callback) {
  this.dataStore.remove(this.opts.key_prefix + '/' + key, {}, callback);
};

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
