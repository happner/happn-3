describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var async = require('async');
  var fs = require('fs');
  var happn = require('../../../lib/index');

  var currentService = null;

  var stopService = function (callback) {
    if (currentService) {
      currentService.stop(function (e) {
        if (e && e.toString() != 'Error: Not running') return callback(e);
        callback();
      });
    } else callback();
  };

  var initService = function (name, callback) {

    var doInitService = function () {

      var serviceConfig = {};

      serviceConfig.name = name;

      happn.service.create(serviceConfig,
        function (e, happnService) {
          if (e) return callback(e);
          currentService = happnService;
          callback();
        }
      );
    };

    stopService(function (e) {
      if (e) return callback(e);
      doInitService();
    });
  };

  before('should initialize the service', function (callback) {

    this.timeout(20000);
    initService('f1_client_call_timeout', callback);

  });

  after('should delete the temp data file', function (callback) {

    this.timeout(20000);
    stopService(callback);

  });

  it('should check the default call timeout for the client', function (callback) {

    happn.client.create(function (e, instance) {

      if (e) return callback(e);

      expect(instance.options.callTimeout).to.be(60000);

      instance.disconnect(callback);

    });

  });

  it('should increase the call timeout for the client', function (callback) {

    happn.client.create({
      callTimeout: 40000
    }, function (e, instance) {

      if (e) return callback(e);
      expect(instance.options.callTimeout).to.be(40000);

      instance.disconnect(callback);

    });

  });

  it('should decrease the call timeout for the client, and fail to make a call', function (callback) {

    happn.client.create({
      callTimeout: 40000
    }, function (e, instance) {

      if (e) return callback(e);

      expect(instance.options.callTimeout).to.be(40000);

      instance.set('/test/path', {
        test: 'data'
      }, {
        timeout: 1
      }, function (e) {

        expect(e.toString()).to.be('Error: api request timed out path: /test/path action: set');

        instance.disconnect(callback);

      });
    });
  });
});
