module.exports = CacheService;

var EventEmitter = require('events').EventEmitter;

var StaticCache = require('./cache_static');
var LRUCache = require('./cache_lru');
var PersistedCache = require('./cache_persist');
var sift = require('sift').default;
const async = require('async');
const util = require('util');

CacheService.prototype.initialize = initialize;
CacheService.prototype.new = _new;
CacheService.prototype.set = util.promisify(set);
CacheService.prototype.get = util.promisify(get);
CacheService.prototype.increment = util.promisify(increment);
CacheService.prototype.update = util.promisify(update);
CacheService.prototype.remove = remove;
CacheService.prototype.clear = clear;
CacheService.prototype.clearAll = clearAll;
CacheService.prototype.on = on;
CacheService.prototype.off = off;
CacheService.prototype.stop = stop;
CacheService.prototype.stopCache = stopCache;
CacheService.prototype.stopAll = stopAll;
CacheService.prototype.filterCacheItems = filterCacheItems;
CacheService.prototype.filterCache = filterCache;

CacheService.prototype.__emit = __emit;

function CacheService(opts) {
  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('Cache');
  } else {
    Logger = require('happn-logger');
    Logger.configure({
      logLevel: 'info'
    });
  }

  this.__eventEmitter = new EventEmitter();

  this.log = Logger.createLogger('Cache');
  this.log.$$TRACE('construct(%j)', opts);

  this.__cache = {};
}

function initialize(config, callback) {
  try {
    if (typeof config === 'function') {
      callback = config;
      config = {};
    }

    if (!config) config = {};
    if (!config.defaultTTL) config.defaultTTL = 0; //one minute
    if (!config.defaultCacheName) config.defaultCacheName = 'default'; //one minute

    if (!config.defaultCacheOpts)
      config.defaultCacheOpts = {
        type: 'static',
        cache: {}
      };

    this.config = config;
    this.__caches = {};
    this.__defaultCache = this.new(config.defaultCacheName, config.defaultCacheOpts);

    callback();
  } catch (e) {
    callback(e);
  }
}

function _new(name, opts) {
  if (!name) throw new Error('all caches must have a name');

  if (typeof opts === 'function') opts = null;

  if (!opts) opts = this.config.defaultCacheOpts;
  if (!opts.type) opts.type = 'static';

  if (!opts.cache) opts.cache = {};

  if (this.__caches[name] && !opts.overwrite)
    throw new Error('a cache by this name already exists');

  if (opts.type.toLowerCase() === 'lru') {
    this.__caches[name] = new LRUCache(opts.cache);
  } else if (opts.type.toLowerCase() === 'persist') {
    opts.cache.key_prefix = name;
    this.__caches[name] = new PersistedCache(opts.cache);
  } else {
    this.__caches[name] = new StaticCache(opts.cache);
  }

  var _this = this;

  Object.defineProperty(this.__caches[name], 'utilities', {
    value: _this.happn.services.utils
  });

  this.__caches[name].on(
    'error',
    function(e) {
      _this.__emit('error', {
        cache: this.cache,
        error: e
      });
    }.bind({
      cache: name
    })
  );

  this.__caches[name].on(
    'item-timed-out',
    function(item) {
      _this.__emit('item-timed-out', {
        cache: this.cache,
        item: item
      });
    }.bind({
      cache: name
    })
  );

  this.__caches[name].on(
    'item-set',
    function(item) {
      _this.__emit('item-set', {
        cache: this.cache,
        item: item
      });
    }.bind({
      cache: name
    })
  );

  this.__caches[name].on(
    'item-removed',
    function(item) {
      _this.__emit('item-removed', {
        cache: this.cache,
        item: item
      });
    }.bind({
      cache: name
    })
  );

  return this.__caches[name];
}

function set(itemKey, data, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  return this.__defaultCache.set(itemKey, data, opts, callback);
}

function get(itemKey, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  return this.__defaultCache.get(itemKey, opts, callback);
}

function increment(itemKey, by, callback) {
  if (typeof by === 'function') {
    callback = by;
    by = 1;
  }

  return this.__defaultCache.increment(itemKey, by, callback);
}

function update(itemKey, data, callback) {
  return this.__defaultCache.update(itemKey, data, callback);
}

function remove(itemKey, opts, callback) {
  this.__defaultCache.remove(itemKey, opts, callback);
}

function clearAll(callback) {
  async.eachSeries(
    Object.keys(this.__caches),
    (cacheKey, cacheKeyCB) => {
      this.clear(cacheKey, cacheKeyCB);
    },
    callback
  );
}

function clear(cache, callback) {
  var cacheToClear;

  if (typeof cache === 'function') {
    callback = cache;
    cache = null;
  }

  //make empty callback
  if (!callback) callback = () => {};

  if (!cache || cache === this.config.defaultCacheName) cacheToClear = this.__defaultCache;
  else cacheToClear = this.__caches[cache];

  if (!cacheToClear) return callback();

  cacheToClear.clear(e => {
    if (e) return callback(e);
    delete this.__caches[cache];
    this.__emit('cache-cleared', cache);
    callback();
  });
}

function stopAll() {
  Object.keys(this.__caches).forEach(cacheKey => {
    this.stopCache(cacheKey);
  });
}

function stopCache(cacheKey) {
  if (this.__caches[cacheKey]) this.__caches[cacheKey].stop();
}

function on(key, handler) {
  return this.__eventEmitter.on(key, handler);
}

function off(key, handler) {
  return this.__eventEmitter.removeListener(key, handler);
}

function stop(opts, callback) {
  if (typeof opts === 'function') callback = opts;
  this.stopAll();
  callback();
}

function filterCacheItems(filter, items) {
  if (!filter) throw this.happn.services.error.SystemError('filter is missing');

  return sift(
    {
      $and: [filter]
    },
    items
  );
}

function filterCache(filter, cache, callback) {
  var _this = this;

  if (!filter) return callback(_this.happn.services.error.SystemError('filter is missing'));

  cache.all(function(e, allItems) {
    if (e) return callback(e);

    try {
      return callback(null, _this.filterCacheItems(allItems));
    } catch (err) {
      return callback(err);
    }
  });
}

function __emit(key, data) {
  return this.__eventEmitter.emit(key, data);
}
