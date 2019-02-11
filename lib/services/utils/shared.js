module.exports = {
  /*
   Shared between the browser client and the server and nodejs client
   */
  prepareWildPath: function (path) {

    //strips out duplicate sequential wildcards, ie simon***bishop -> simon*bishop

    if (!path) return '';

    var prepared = '';

    var lastChar = null;

    for (var i = 0; i < path.length; i++) {

      if (path[i] == '*' && lastChar == '*') continue;

      prepared += path[i];

      lastChar = path[i];
    }

    return prepared;
  },
  makeRe: function (pattern) {

    return new RegExp("^" + this.escapeRegex(pattern).replace(/\\\*/g, ".*") + "$", "i");
  },
  escapeRegex: function (str) {

    if (typeof str !== 'string') throw new TypeError('Expected a string');

    return str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
  },
  wildcardMatch: function (pattern, matchTo) {

    //precise match, no wildcards
    if (pattern.indexOf('*') == -1) return pattern == matchTo;

    var preparedPattern = this.prepareWildPath(pattern); //replace **,***,**** with *

    //one is * or ** or *** etc
    if (preparedPattern == '*') return true; //one is anything

    if (preparedPattern == matchTo) return true; //equal to each other

    return this.makeRe(preparedPattern).test(matchTo);
  },
  whilst: function (test, iterator, cb) {

    cb = cb || noop;

    if (!test()) return cb(null);

    var _this = this;

    _this.__attempts = 0;

    var next = function (err, args) {

      _this.__attempts++;

      if (err) return cb(err, _this.__attempts);

      if (test.apply(this, args)) return iterator(_this.__attempts, next);

      cb.apply(null, [null].concat(args, _this.__attempts));

    }.bind(_this);

    iterator(_this.__attempts, next);
  },
  //taken from https://github.com/alessioalex/tiny-each-async
  async: function (arr, parallelLimit, iteratorFn, cb) {

    var pending = 0;
    var index = 0;
    var lastIndex = arr.length - 1;
    var called = false;
    var limit;
    var callback;
    var iterate;

    if (typeof parallelLimit === 'number') {
      limit = parallelLimit;
      iterate = iteratorFn;
      callback = cb || function noop() {};
    } else {
      iterate = parallelLimit;
      callback = iteratorFn || function noop() {};
      limit = arr.length;
    }

    if (!arr.length) {
      return callback();
    }

    var iteratorLength = iterate.length;

    var shouldCallNextIterator = function shouldCallNextIterator() {
      return (!called && (pending < limit) && (index < lastIndex));
    };

    var iteratorCallback = function iteratorCallback(err) {
      if (called) {
        return;
      }

      pending--;

      if (err || (index === lastIndex && !pending)) {

        called = true;
        callback(err);

      } else if (shouldCallNextIterator()) {
        processIterator(++index);
      }
    };

    var processIterator = function processIterator() {
      pending++;

      var args = (iteratorLength === 2) ? [arr[index], iteratorCallback] :
        [arr[index], index, iteratorCallback];

      iterate.apply(null, args);

      if (shouldCallNextIterator()) {
        processIterator(++index);
      }
    };

    processIterator();
  },
  clone: function (obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  checkPath: function (path, action) {

    if (action == 'set' && path.indexOf('*') > -1)
      throw new Error('Bad path, if the action is \'set\' the path cannot contain the * wildcard character');

    if (path.match(/^[a-zA-Z0-9\/(){}+=&:%@._*-\s]+$/) == null)
      throw new Error('Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*');
  },
  computeiv: function (secret) {

    if (typeof(secret) !== 'string')
      throw new Error('secret must be a string and cannot be null or undefined');

    if(secret.length !== 32)
      throw new Error('secret must be 32 chars long');

    var iv = '';

    for (x = 0; x < 32; x = x + 2) iv += secret[x];

    return iv;
  }
};
