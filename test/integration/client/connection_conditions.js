describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  //how I found where our possible memory leak on process.on
  //process.on('warning', e => console.warn(e.stack));

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var happnInstance = null;
  var test_id;

  this.timeout(20000);

  before('should initialize the service', function (callback) {

    test_id = Date.now() + '_' + require('shortid').generate();

    try {
      service.create(function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    client.disconnect()
      .then(happnInstance.stop()
        .then(done))
      .catch(done);

  });

  var client;

  it('should connect with default settings', function (callback) {

    try {

      happn_client.create(function (e, instance) {

        if (e) return callback(e);
        client = instance;
        callback();
      });

    } catch (e) {
      callback(e);
    }
  });

  it('should fail to connect, bad port', function (callback) {

    try {

      happn_client.create({
        config: {
          port: 4545
        }
      }, function (e, instance) {

        expect(e.code).to.be('ECONNREFUSED');
        callback();
      });

    } catch (e) {
      callback(e);
    }

  });

  it('should fail to connect, bad ip - connect timeout of 3 seconds', function (callback) {

    try {

      happn_client.create({
        config: {
          host: '99.99.99.99',
          connectTimeout: 3000
        }
      }, function (e) {

        expect(e.toString()).to.be('Error: connection timed out');
        callback();
      });

    } catch (e) {
      callback(e);
    }

  });

});
