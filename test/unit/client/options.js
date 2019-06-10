describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(30000);

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;

  var happnInstance1 = null;

  var http = require('http');

  var serviceConfig1 = {
    port: 10000
  };

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {

      service.create(serviceConfig1, function (e, happnInst1) {

        if (e) return callback(e);

        happnInstance1 = happnInst1;

        callback();

      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    if (happnInstance1) happnInstance1.stop()
      .then(done)
      .catch(done);
    else done();
  });

  it('tests host and port null connection', function (done) {

    var connection = null;

    var options = {
      host: '127.0.0.1',
      port: 10000
    };

    happn.client.create(connection, options)
      .then(function (client) {
        client.disconnect(done);
      })
      .catch(function (e) {
        done(e);
      });
  });

  it('tests host and port null options', function (done) {

    var connection = {
      host: '127.0.0.1',
      port: 10000
    };

    var options = null;

    happn.client.create(connection, options)
      .then(function (client) {
        client.disconnect(done);
      })
      .catch(function (e) {
        done(e);
      });
  });

});
