module.exports = {
  /*
   Shared between the browser client and the server and nodejs client
   */
  prepareWildPath: function(path) {
    //strips out duplicate sequential wildcards, ie simon***bishop -> simon*bishop
    return path.replace(/(.)\1+/g, "*");
  },
  makeRe: function(pattern) {
    return new RegExp("^" + this.escapeRegex(pattern).replace(/\\\*/g, ".*") + "$", "i");
  },
  escapeRegex: function(str) {
    if (typeof str !== "string") throw new TypeError("Expected a string");
    return str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
  },
  wildcardPreliminaryMatch: function(pattern, matchTo) {
    if (pattern.indexOf("*") === -1) return pattern === matchTo;
    const preparedPattern = pattern.replace(/(.)\1+/g, "*"); //strip out *** ****** and replace with *
    if (preparedPattern === "*") return true;
    return preparedPattern;
  },
  wildcardMatch: function(pattern, matchTo) {
    const preparedOrMatched = this.wildcardPreliminaryMatch(pattern, matchTo);
    if (typeof preparedOrMatched === "boolean") return preparedOrMatched; //we have a match result, return it
    //try a starts with reject
    const initialSegment = preparedOrMatched.split("*").pop();
    if (initialSegment.length > 0 && matchTo.indexOf(initialSegment) === -1) return false;
    return this.makeRe(preparedOrMatched).test(matchTo);
  },
  whilst: function(test, iterator, cb) {
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
  async: function(arr, parallelLimit, iteratorFn, cb) {
    var pending = 0;
    var index = 0;
    var lastIndex = arr.length - 1;
    var called = false;
    var limit;
    var callback;
    var iterate;

    if (typeof parallelLimit === "number") {
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
      return !called && pending < limit && index < lastIndex;
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

      var args =
        iteratorLength === 2
          ? [arr[index], iteratorCallback]
          : [arr[index], index, iteratorCallback];

      iterate.apply(null, args);

      if (shouldCallNextIterator()) {
        processIterator(++index);
      }
    };

    processIterator();
  },
  clone: function(obj) {
    return JSON.parse(JSON.stringify(obj));
  },
  checkPath: function(path, action) {
    if (action === "set" && path.indexOf("*") > -1)
      throw new Error(
        "Bad path, if the action is 'set' the path cannot contain the * wildcard character"
      );

    if (path.match(/^[a-zA-Z0-9/(){}+=&:%@._*\-\s]+$/) == null)
      throw new Error(
        "Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*"
      );
  },
  computeiv: function(secret) {
    if (typeof secret !== "string")
      throw new Error("secret must be a string and cannot be null or undefined");

    if (secret.length !== 32) throw new Error("secret must be 32 chars long");

    var iv = "";

    for (let x = 0; x < 32; x = x + 2) iv += secret[x];

    return iv;
  },
  removeLast: function(str, last) {
    if (
      !str || //null undefined or empty
      !str.substring || //not a string
      !last || //last is null undefined or empty
      str[str.length - 1] !== last
    )
      //string doesnt end with specified last character
      return str;

    return str.substring(0, str.length - 1);
  },
  asyncCallback: function() {
    var fn = arguments[0].bind.apply(arguments[0], Array.from(arguments));
    if (setImmediate) return setImmediate(fn);
    setTimeout(fn, 0);
  },
  wrapImmediate: function(fn, timeout) {
    return function() {
      if (timeout) return setTimeout(fn.bind(this), timeout, ...arguments);
      if (setImmediate) {
        setImmediate(fn.bind(this), ...arguments);
        return;
      }
      setTimeout(fn.bind(this), ...arguments);
    };
  },
  isPromise: function(obj) {
    return (
      !!obj &&
      (typeof obj === "object" || typeof obj === "function") &&
      typeof obj.then === "function"
    );
  },
  maybePromisify: function(originalFunction, opts) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      var _this = this;

      if (opts && opts.unshift) args.unshift(opts.unshift);
      if (args[args.length - 1] == null) args.splice(args.length - 1);

      // No promisify if last passed arg is function (ie callback)

      if (typeof args[args.length - 1] === "function") {
        return originalFunction.apply(this, args);
      }

      return new Promise(function(resolve, reject) {
        // push false callback into arguments
        args.push(function(error, result, more) {
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
    };
  }
};

function noop() {}
