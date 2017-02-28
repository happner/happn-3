  module.exports = {
    /*
      Shared between the browser client and the server and nodejs client
    */
    wildcardMatch: function (pattern, matchTo) {

      var regex = new RegExp(pattern.replace(/[*]/g, '.*'));
      var matchResult = matchTo.match(regex);

      if (matchResult) return true;
      return false;
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
    }
  };
