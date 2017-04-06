  module.exports = {
    /*
      Shared between the browser client and the server and nodejs client
    */
    wildcardMatch: function (pattern, matchTo) {
      return matchTo.match(new RegExp(pattern.replace(/[*]/g, '.*'))) != null;
    },
    whilst: function (test, iterator, cb){

      cb = cb || noop;

      if (!test()) return cb(null);

      var _this = this;

      _this.__attempts = 0;

      var next = function(err, args) {

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
        callback = cb || function noop() {
          };
      } else {
        iterate = parallelLimit;
        callback = iteratorFn || function noop() {
          };
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

        var args = (iteratorLength === 2) ? [arr[index], iteratorCallback]
          : [arr[index], index, iteratorCallback];

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
    checkPath:function (path) {
      if (path.match(/^[a-zA-Z0-9@.//_*/-\s]+$/) == null)
        throw 'Bad path, can only contain alphanumeric characters, forward slashes, underscores @ and minus signs, and the * wildcard character ie: /this/is/an/example/of/1/with/an/_*-12hello';
    },
    removeLeading:function(leading, str){

      if (str === null || str === undefined) return str;
      if (leading == null) return str;
      if (leading == '') return str;

      var cloned = str.toString();
      if (cloned.indexOf(leading) == 0) cloned = cloned.substring(1, cloned.length);

      return cloned;
    },
    removeLast:function(last, str){

    if (str === null || str === undefined) return str;
    if (last == null) return str;
    if (last == '') return str;

    var cloned = str.toString();
    if (cloned[cloned.length - 1] == last) cloned = cloned.substring(0, cloned.length - 1);

    return cloned;
    }
  };
