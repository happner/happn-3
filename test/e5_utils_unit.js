var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
var Utils = require('../lib/services/utils/service')
var utils = new Utils();

describe(filename, function () {

  it('tests mergeObjects', function (done) {

    var test1 = utils.mergeObjects({
      'test1': 1
    }, {
      'test2': 2
    });

    expect(test1.test1).to.be(1);
    expect(test1.test2).to.be(2);

    var test2 = utils.mergeObjects({
      'test1': 1
    }, {
      'test1': 2
    }, {
      overwrite: true
    });

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
      clone: false
    });

    expect(test3.test).to.be(1);
    expect(test3.test1.hello).to.be(1);

    test3.test1.hello = 4;
    expect(obj2.test1.hello).to.be(4);

    done();

  });

  it('tests whilst', function (done) {

    var sharedUtils = require('../lib/services/utils/shared');

    var keepGoing = true;

    sharedUtils.whilst(function () {
      return keepGoing;
    }, function (attempt, next) {
      if (attempt == 5) keepGoing = false;
      next();
    }, function (e) {

      expect(e).to.be(null);

      var keepGoing = true;

      sharedUtils.whilst(function () {
        return keepGoing;
      }, function (attempt, next) {
        if (attempt == 5) return next(new Error('TEST ERROR'));
        next();
      }, function (e) {
        expect(e).to.not.be(null);
        done();
      })
    })
  });

  it('tests async', function (done) {

    var sharedUtils = require('../lib/services/utils/shared');

    sharedUtils.async([1, 2, 3], function (number, index, next) {
      expect(number == index + 1).to.be(true);
      next();
    }, function (e) {
      expect(e).to.be(undefined);

      sharedUtils.async([1, 2, 3], function (number, index, next) {
        expect(number == index + 1).to.be(true);
        if (number == 2) return next(new Error('TEST ERROR'));
        next();
      }, function (e) {
        expect(e).to.not.be(null);
        done();
      });
    });
  });

  it('tests wildcard stuff', function (done) {

    var sharedUtils = require('../lib/services/utils/shared');

    expect(sharedUtils.prepareWildPath("/a/***/***/****/**/path/***/*/*")).to.be("/a/*/*/*/*/path/*/*/*");
    expect(sharedUtils.wildcardMatch('/test/complex/*/short', '/test/complex/and/short')).to.be(true);
    expect(sharedUtils.wildcardMatch('/test/complex/*', '/test/complex/and/short')).to.be(true);
    expect(sharedUtils.wildcardMatch('/test/*/*/short', '/test/complex/and/short')).to.be(true);
    expect(sharedUtils.wildcardMatch('/test*', '/test/complex/and/short')).to.be(true);
    expect(sharedUtils.wildcardMatch('*/short', '/test/complex/and/short')).to.be(true);
    expect(sharedUtils.wildcardMatch('/test*/short', '/test/complex/and/short')).to.be(true);

    expect(sharedUtils.wildcardMatch('/test/complex/*/short', '/test/complex/and/long')).to.be(false);
    expect(sharedUtils.wildcardMatch('/test/complex/*', '/blah/complex/and/short')).to.be(false);
    expect(sharedUtils.wildcardMatch('/test/*/*/short', '/test/complex/and/long')).to.be(false);
    expect(sharedUtils.wildcardMatch('/test*', '/tes/complex/and/short')).to.be(false);
    expect(sharedUtils.wildcardMatch('*/short', '/test/complex/and/long')).to.be(false);
    expect(sharedUtils.wildcardMatch('/test*/short', '/test/complex/and/short/')).to.be(false);

    done();
  })
});
