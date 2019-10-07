describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var async = require('async');
    var fs = require('fs');
    var happn = require('../../../lib/index');

    var currentService = null;

    var stopService = function(callback) {
      if (currentService) {
        currentService.stop(function(e) {
          if (e && e.toString() != 'Error: Not running') return callback(e);
          callback();
        });
      } else callback();
    };

    var initService = function(name, callback) {
      var doInitService = function() {
        var serviceConfig = {
          secure: true
        };

        serviceConfig.name = name;

        happn.service.create(serviceConfig, function(e, happnService) {
          if (e) return callback(e);
          currentService = happnService;
          callback();
        });
      };

      stopService(function(e) {
        if (e) return callback(e);
        doInitService();
      });
    };

    var getClient = function(service, callback) {
      service.services.session.localClient(
        {
          username: '_ADMIN',
          password: 'happn'
        },
        function(e, instance) {
          if (e) return callback(e);

          callback(null, instance);
        }
      );
    };

    before('should initialize the service', function(callback) {
      this.timeout(20000);
      initService('b2_eventemitter_security_stoppingstarting', callback);
    });

    after('should delete the temp data file', function(callback) {
      this.timeout(20000);
      stopService(callback);
    });

    it('should do a successful ping pong to the server via the client, via http get', function(callback) {
      function doRequest(path, token, callback) {
        var request = require('request');

        var options = {
          url: 'http://127.0.0.1:55000' + path
        };

        if (token) options.url += '?happn_token=' + token;

        request(options, function(error, response, body) {
          callback(response, body);
        });
      }

      initService('http_get_ping_pong', function(e) {
        if (e) return callback(e);

        doRequest('/ping', null, function(resp, body) {
          expect(body).to.be('pong');
          callback();
        });
      });
    });
  }
);
