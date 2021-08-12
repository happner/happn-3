var expect = require('expect.js');
var Utils = require('../../../lib/services/utils/service');
var utils = new Utils();

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    it('tests mergeObjects', function(done) {
      var test1 = utils.mergeObjects(
        {
          test1: 1
        },
        {
          test2: 2
        }
      );

      expect(test1.test1).to.be(1);
      expect(test1.test2).to.be(2);

      var test2 = utils.mergeObjects(
        {
          test1: 1
        },
        {
          test1: 2
        },
        {
          overwrite: true
        }
      );

      expect(test2.test1).to.be(2);

      var obj1 = {
        test: 1
      };

      var obj2 = {
        test: 2,
        test1: {
          hello: 1
        }
      };

      var test3 = utils.mergeObjects(obj1, obj2, {
        overwrite: false,
        clone: true
      });

      expect(test3.test).to.be(1);
      expect(test3.test1.hello).to.be(1);

      test3.test1.hello = 4;
      expect(obj2.test1.hello).to.be(1);

      obj1 = {
        test: 1
      };
      obj2 = {
        test: 2,
        test1: {
          hello: 1
        }
      };

      test3 = utils.mergeObjects(obj1, obj2, {
        overwrite: false,
        clone: false
      });

      expect(test3.test).to.be(1);
      expect(test3.test1.hello).to.be(1);

      test3.test1.hello = 4;
      expect(obj2.test1.hello).to.be(4);

      done();
    });

    it('tests whilst', function(done) {
      var sharedUtils = require('../../../lib/services/utils/shared');

      var keepGoing = true;

      sharedUtils.whilst(
        function() {
          return keepGoing;
        },
        function(attempt, next) {
          if (attempt === 5) keepGoing = false;
          next();
        },
        function(e) {
          expect(e).to.be(null);

          var keepGoing = true;

          sharedUtils.whilst(
            function() {
              return keepGoing;
            },
            function(attempt, next) {
              if (attempt === 5) return next(new Error('TEST ERROR'));
              next();
            },
            function(e) {
              expect(e).to.not.be(null);
              done();
            }
          );
        }
      );
    });

    it('tests async', function(done) {
      var sharedUtils = require('../../../lib/services/utils/shared');

      sharedUtils.async(
        [1, 2, 3],
        function(number, index, next) {
          expect(number === index + 1).to.be(true);
          next();
        },
        function(e) {
          expect(e).to.be(undefined);

          sharedUtils.async(
            [1, 2, 3],
            function(number, index, next) {
              expect(number === index + 1).to.be(true);
              if (number === 2) return next(new Error('TEST ERROR'));
              next();
            },
            function(e) {
              expect(e).to.not.be(null);
              sharedUtils.async(
                [1, 2, 3],
                1,
                function(number, index, next) {
                  expect(number === index + 1).to.be(true);
                  next();
                },
                function(e) {
                  expect(e).to.be(undefined);
                  done();
                }
              );
            }
          );
        }
      );
    });

    it('tests wildcardMatch', function(done) {
      var sharedUtils = require('../../../lib/services/utils/shared');

      expect(sharedUtils.prepareWildPath('/a/***/***/****/**/path/***/*/*')).to.be(
        '/a/*/*/*/*/path/*/*/*'
      );
      expect(sharedUtils.wildcardMatch('/test/complex/*/short', '/test/complex/and/short')).to.be(
        true
      );
      expect(sharedUtils.wildcardMatch('/test/complex/*', '/test/complex/and/short')).to.be(true);
      expect(sharedUtils.wildcardMatch('/test/*/*/short', '/test/complex/and/short')).to.be(true);
      expect(sharedUtils.wildcardMatch('/test*', '/test/complex/and/short')).to.be(true);
      expect(sharedUtils.wildcardMatch('*/short', '/test/complex/and/short')).to.be(true);
      expect(sharedUtils.wildcardMatch('/test*/short', '/test/complex/and/short')).to.be(true);

      expect(sharedUtils.wildcardMatch('/test/complex/*/short', '/test/complex/and/long')).to.be(
        false
      );
      expect(sharedUtils.wildcardMatch('/test/complex/*', '/blah/complex/and/short')).to.be(false);
      expect(sharedUtils.wildcardMatch('/test/*/*/short', '/test/complex/and/long')).to.be(false);
      expect(sharedUtils.wildcardMatch('/test*', '/tes/complex/and/short')).to.be(false);
      expect(sharedUtils.wildcardMatch('*/short', '/test/complex/and/long')).to.be(false);
      expect(sharedUtils.wildcardMatch('/test*/short', '/test/complex/and/short/')).to.be(false);

      done();
    });

    it('tests checkPath', function(done) {
      var sharedUtils = require('../../../lib/services/utils/shared');

      var checkPathTest = function(path, action) {
        try {
          sharedUtils.checkPath(path, action);
          return 'ok';
        } catch (e) {
          return e.toString();
        }
      };

      var notOk =
        'Error: Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*';

      expect(
        checkPathTest('factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*')
      ).to.be('ok');
      expect(checkPathTest('factory1@I&J(western-cape)/conveyer_2/stats/*', 'set')).to.be(
        "Error: Bad path, if the action is 'set' the path cannot contain the * wildcard character"
      );
      expect(checkPathTest('factory1@I&J(western-cape)/conveyer_2/stats/$set')).to.be(notOk);
      expect(checkPathTest('/test/user name/*')).to.be('ok');
      done();
    });

    it('test computeiv function', function(done) {
      var secret = 'thirtytwobitsecret12345678901234';
      var iv2 = utils.computeiv(secret);
      expect(iv2).to.eql('tittoisce1357913');

      function tryComputeIv(secretTry) {
        try {
          return utils.computeiv(secretTry);
        } catch (e) {
          return e.message;
        }
      }

      expect(tryComputeIv('test')).to.eql('secret must be 32 chars long');
      expect(tryComputeIv(null)).to.eql('secret must be a string and cannot be null or undefined');
      expect(tryComputeIv(undefined)).to.eql(
        'secret must be a string and cannot be null or undefined'
      );
      expect(tryComputeIv(1)).to.eql('secret must be a string and cannot be null or undefined');
      expect(tryComputeIv([])).to.eql('secret must be a string and cannot be null or undefined');

      done();
    });

    it('test removeLast function', function() {
      expect(utils.removeLast('test', '/')).to.eql('test');
      expect(utils.removeLast('test/', '/')).to.eql('test');
      expect(utils.removeLast(null)).to.eql(null);
      expect(utils.removeLast(undefined, '/')).to.eql(undefined);
      expect(utils.removeLast(null, '/')).to.eql(null);
      expect(utils.removeLast('test', undefined)).to.eql('test');
      expect(utils.removeLast('test', null)).to.eql('test');
    });

    it('tests asyncCallback - client side dezalgo', function(done) {
      var callback = function(param1, param2, param3) {
        expect(param1).to.be('param1');
        expect(param2).to.be('param2');
        expect(param3).to.be('param3');
        done();
      };
      utils.asyncCallback(callback, 'param1', 'param2', 'param3');
    });

    it('tests wrapImmediate', function(done) {
      var callback = function(param1, param2, param3) {
        expect(param1).to.be('param1');
        expect(param2).to.be('param2');
        expect(param3).to.be('param3');
        done();
      };
      utils.wrapImmediate(callback);
      callback('param1', 'param2', 'param3');
    });

    it('tests wrapImmediate', function(done) {
      var started = Date.now();
      var callback = function(param1, param2, param3) {
        expect(param1).to.be('param1');
        expect(param2).to.be('param2');
        expect(param3).to.be('param3');
        expect(Date.now() - started >= 1000).to.be(true);
        done();
      };
      utils.wrapImmediate(callback, 1000)('param1', 'param2', 'param3');
    });

    it('tests wildcardMatch utils service ', function(done) {
      expect(utils.wildcardMatch('/test/complex/*/short', '/test/complex/and/short')).to.be(true);
      expect(utils.wildcardMatch('/test/complex/*', '/test/complex/and/short')).to.be(true);
      expect(utils.wildcardMatch('/test/*/*/short', '/test/complex/and/short')).to.be(true);
      expect(utils.wildcardMatch('/test*', '/test/complex/and/short')).to.be(true);
      expect(utils.wildcardMatch('*/short', '/test/complex/and/short')).to.be(true);
      expect(utils.wildcardMatch('/test*/short', '/test/complex/and/short')).to.be(true);

      expect(
        utils.wildcardMatch('/test/complex/*/short', '/test/complex/and/long', 'defaultMax')
      ).to.be(false);
      expect(utils.wildcardMatch('/test/complex/*', '/blah/complex/and/short', 'defaultMax')).to.be(
        false
      );
      expect(utils.wildcardMatch('/test/complex/*', '/blah/complex/and/short', 'defaultMax')).to.be(
        false
      );
      expect(utils.wildcardMatch('/test/*/*/short', '/test/complex/and/long', 'defaultMax')).to.be(
        false
      );
      expect(utils.wildcardMatch('/test*', '/tes/complex/and/short', 'defaultMax')).to.be(false);
      expect(utils.wildcardMatch('*/short', '/test/complex/and/long', 'defaultMax')).to.be(false);
      expect(utils.wildcardMatch('/test*/short', '/test/complex/and/short/', 'defaultMax')).to.be(
        false
      );

      expect(
        utils.wildcardMatch('/test/complex/*/short', '/test/complex/and/long', 'small', 3)
      ).to.be(false);
      expect(utils.wildcardMatch('/test/complex/*', '/blah/complex/and/short', 'small', 3)).to.be(
        false
      );
      expect(utils.wildcardMatch('/test/complex/*', '/blah/complex/and/short', 'small', 3)).to.be(
        false
      );
      expect(utils.wildcardMatch('/test/*/*/short', '/test/complex/and/long', 'small', 3)).to.be(
        false
      );
      expect(utils.wildcardMatch('/test*', '/tes/complex/and/short', 'small', 3)).to.be(false);
      expect(utils.wildcardMatch('*/short', '/test/complex/and/long', 'small', 3)).to.be(false);
      expect(utils.wildcardMatch('/test*/short', '/test/complex/and/short/', 'small', 3)).to.be(
        false
      );

      expect(
        utils.wildcardMatch('/test/complex/*/short', '/test/complex/and/long', 'object', 1, true)
      ).to.be(false);
      expect(
        utils.wildcardMatch('/test/complex/*', '/blah/complex/and/short', 'object', 1, true)
      ).to.be(false);
      expect(
        utils.wildcardMatch('/test/complex/*', '/blah/complex/and/short', 'object', 1, true)
      ).to.be(false);
      expect(
        utils.wildcardMatch('/test/*/*/short', '/test/complex/and/long', 'object', 1, true)
      ).to.be(false);
      expect(utils.wildcardMatch('/test*', '/tes/complex/and/short', 'object', 1, true)).to.be(
        false
      );
      expect(utils.wildcardMatch('*/short', '/test/complex/and/long', 'object', 1, true)).to.be(
        false
      );
      expect(
        utils.wildcardMatch('/test*/short', '/test/complex/and/short/', 'object', 1, true)
      ).to.be(false);

      expect(utils.regexCaches.default.length > 0).to.be(true);
      expect(utils.regexCaches.defaultMax.max).to.be(10000);
      expect(utils.regexCaches.defaultMax.length).to.be(6);
      expect(utils.regexCaches.small.length).to.be(3);
      expect(utils.regexCaches.small.max).to.be(3);

      expect(utils.regexCaches.object.length).to.be(6);
      expect(utils.regexCaches.object.max).to.be(undefined);
      var errMessage = '';
      try {
        expect(utils.wildcardMatch('/test*', '/tes/complex/and/short', undefined, 1, true)).to.be(
          false
        );
      } catch (e) {
        errMessage = e.message;
      }
      expect(errMessage).to.be('The default regex cache must be of type LRU');
      done();
    });
  }
);
