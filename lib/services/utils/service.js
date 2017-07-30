var Promise = require('bluebird')
  , deepCopy = require('deep-copy')
  , traverse = require('traverse')
  , ms = require('ms')
  , util = require('util')
  , happnUtils = require('./shared')
  , fs = require('fs-extra')
  ;

module.exports = UtilsService;

function UtilsService(){}

UtilsService.prototype.clone = function (obj, circular) {

  if (!obj) return obj;

  if (typeof obj == 'string')
    return obj.toString();

  if (!circular)
    return happnUtils.clone(obj);
  else
    return deepCopy(obj);//does not exist for browser

};

UtilsService.prototype.wildcardMatch = happnUtils.wildcardMatch.bind(happnUtils);

UtilsService.prototype.checkPath = happnUtils.checkPath;

UtilsService.prototype.removeLeading = happnUtils.removeLeading;

UtilsService.prototype.removeLast = happnUtils.removeLast;

UtilsService.prototype.wildcardMatchMultiple = function (patterns, matchTo) {

  for (var patternIndex in patterns){
    if (this.wildcardMatch(patterns[patternIndex], matchTo)) return true;
  }

  return false;
};

UtilsService.prototype.wildcardAggregate = function (wildcardDict) {

  var sortedKeys = Object.keys(wildcardDict).sort();

  for (var wcPathIndex in sortedKeys) {
    for (var wcPathCompare in  wildcardDict) {
      if (sortedKeys[wcPathIndex] != wcPathCompare) {
        if (this.wildcardMatch(sortedKeys[wcPathIndex], wcPathCompare))
          delete wildcardDict[wcPathCompare];
      }
    }
  }

  return wildcardDict;
};

UtilsService.prototype.replacePrefix = function(str, prefix, rep){

  if (rep == null) rep = "";

  if (str && prefix && str.indexOf(prefix) == 0) return rep + str.substring(prefix.length, str.length);

  return str;
};

UtilsService.prototype.replaceSuffix = function(str, suffix, rep){

  if (rep == null) rep = "";

  if (str && suffix && str.substring(str.length - suffix.length, str.length) == suffix) return str.substring(0, str.length - suffix.length) + rep;

  return str;
};

UtilsService.prototype.isNumeric = function(n){
  return !isNaN(parseFloat(n)) && isFinite(n);
};

UtilsService.prototype.toMilliseconds = function(input){
  if (!input || input == Infinity) return input;
  if (this.isNumeric(input)) return input;
  else return ms(input);
};

UtilsService.prototype.stringContainsAny = function(str, segments, caseInSensitive){
  var containsAny = false;

  segments.every(function(segment){

    var compareSegment = segment;
    var compareStr = str;

    if (caseInSensitive){
      compareSegment = segment.toUpperCase();
      compareStr = str.toUpperCase();
    }

    if (compareStr.indexOf(compareSegment) > -1) {
      containsAny = true;
      return false;
    } else return true;
  });

  return containsAny;
};

UtilsService.prototype.stringifyError = function(err) {
  var plainError = {};
  Object.getOwnPropertyNames(err).forEach(function(key) {
    plainError[key] = err[key];
  });
  return JSON.stringify(plainError);
};

UtilsService.prototype.getFirstMatchingProperty = function(properties, obj){

  var checkProperties = [];

  properties.map(function(propertyName){
    checkProperties.push(propertyName.toLowerCase());
  });

  for (var propertyName in obj) if (checkProperties.indexOf(propertyName.toLowerCase()) > -1) return obj[propertyName];
  return null;
};

UtilsService.prototype.mergeObjects = function(obj1, obj2, opts){

  var _this = this;

  if (!opts) opts = {};

  var newObj = {};

  var getProp = function(obj, propertyName){
    if (!opts.clone) return obj[propertyName];
    return _this.clone(obj[propertyName]);
  };

  for (var propertyName in obj1){
    newObj[propertyName] = getProp(obj1, propertyName);
  }

  for (var propertyName in obj2){
    if (newObj[propertyName] && !opts.overwrite) continue;
    newObj[propertyName] = getProp(obj2, propertyName);
  }

  return newObj;
};

UtilsService.prototype.promisify = function (originalFunction, opts) {

  return function () {
    var args = Array.prototype.slice.call(arguments);
    var _this = this;

    if (opts && opts.unshift) args.unshift(opts.unshift);

    // No promisify if last passed arg is function (ie callback)

    if (typeof args[args.length - 1] == 'function') {
      return originalFunction.apply(this, args);
    }

    return new Promise(function (resolve, reject) {
      // push false callback into arguments
      args.push(function (error, result, more) {
        if (error) return reject(error);
        if (more) {
          var args = Array.prototype.slice.call(arguments);
          args.shift(); // toss undefined error
          return resolve(args); // resolve array of args passed to callback
        }
        return resolve(result);
      });
      try {
        return originalFunction.apply(_this, args);
      } catch (error) {
        return reject(error);
      }
    });
  }
};

UtilsService.prototype.fileExists = function(path){

  try{

    return fs.statSync(path).isFile();

  }catch(e){
    return false;
  }

};

