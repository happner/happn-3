var
  SortedObjectArray = require("sorted-object-array")
  , LRU = require("lru-cache")
  , async = require('async')
  ;

function Bucket(options) {

  if (!options.cache) options.cache = {max: 500};

  if (!options.channel) throw new Error('bucket must be for a specified channel');

  if (!options.name) throw new Error('bucket must have a name');

  if (options.channel == '*') options.action = 'ALL';

  else options.action = options.channel.split('@')[0].replace('/', '');

  this.options = options;
}

Bucket.prototype.initialize = function (callback) {

  Object.defineProperty(this, '__segments', {value: new SortedObjectArray('path')});

  Object.defineProperty(this, '__cache', {value: new LRU(this.options.cache)});

  Object.defineProperty(this, '__catchall_subscribers', {value: new SortedObjectArray('sessionId')});

  Object.defineProperty(this, '__subscribers', {value: new SortedObjectArray('segment')});

  Object.defineProperty(this, '__explicit_subscribers', {value: new SortedObjectArray('fullPath')});

  callback();
};

Bucket.prototype.wildcardMatch = function (pattern, matchTo) {

  if (pattern.indexOf('*') == -1) return pattern == matchTo;

  var regex = new RegExp(pattern.replace(/[*]/g, '.*'));

  var matchResult = matchTo.match(regex);

  if (matchResult) return true;

  return false;
};

Bucket.prototype.getSubscriptions = function (path, options, callback) {

};

Bucket.prototype.addSubscription = function (path, sessionId, data, callback) {

};

Bucket.prototype.removeAllSubscriptions = function (sessionId, callback) {

};

Bucket.prototype.removeSubscription = function (path, sessionId, options, callback) {

};

Bucket.prototype.allSubscriptions = function () {

};
