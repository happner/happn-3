var expect = require('expect.js');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    it('starts up system and app-land services', function(done) {
      var ServiceManager = require('../../../lib/services/manager');
      var serviceManager = new ServiceManager();

      var systemServices = [
        'utils',
        'error',
        'log',
        'data',
        'system',
        'cache',
        'connect',
        'crypto',
        'transport',
        'session',
        'protocol',
        'security',
        'subscription',
        'publisher',
        'queue',
        'layer',
        'stats'
      ];

      var serviceConfig = {
        services: {}
      };

      systemServices.forEach(function(serviceName) {
        serviceConfig.services[serviceName] = {
          instance: {
            initialize: function(config, cb) {
              cb();
            },
            stop: function(opts, cb) {
              cb();
            }
          }
        };
      });

      serviceConfig.services.myService1 = {
        instance: {
          initialize: function(config, cb) {
            cb();
          },
          stop: function(opts, cb) {
            cb();
          },
          test: function() {
            return 'TEST1';
          }
        }
      };

      serviceConfig.services.myService2 = {
        instance: {
          initialize: function(config, cb) {
            cb();
          },
          stop: function(opts, cb) {
            cb();
          },
          test: function() {
            return 'TEST2';
          }
        }
      };

      var happn = {
        services: {},

        log: {
          $$TRACE: function(message) {
            console.log(message);
          },
          error: function(message) {
            console.log(message);
          },
          info: function(message) {
            console.log(message);
          }
        }
      };

      serviceManager.initialize(serviceConfig, happn, function(e) {
        if (e) return done(e);

        expect(happn.services.myService1.test()).to.be('TEST1');
        expect(happn.services.myService2.test()).to.be('TEST2');

        serviceManager.stop(done);
      });
    });
  }
);
