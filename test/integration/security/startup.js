describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var async = require('async');
    var Logger = require('happn-logger');

    var testConfigs = {};

    testConfigs.data = {};

    testConfigs.security = {};

    var testServices = {};

    testServices.cache = require('../../../lib/services/cache/service');
    testServices.crypto = require('../../../lib/services/crypto/service');
    testServices.data = require('../../../lib/services/data/service');
    testServices.security = require('../../../lib/services/security/service');
    testServices.session = require('../../../lib/services/session/service');
    testServices.utils = require('../../../lib/services/utils/service');
    testServices.error = require('../../../lib/services/error/service');
    testServices.log = require('../../../lib/services/log/service');
    testServices.subscription = require('../../../lib/services/subscription/service');

    var checkpoint = require('../../../lib/services/security/checkpoint');
    testServices.checkpoint = new checkpoint({
      logger: Logger
    });

    var initializeMockServices = function(callback) {
      var happnMock = {
        config: {
          services: {
            security: {}
          }
        },
        services: {
          system: {
            package: require('../../../package.json')
          }
        }
      };

      async.eachSeries(
        ['log', 'error', 'utils', 'crypto', 'cache', 'session', 'data', 'security', 'subscription'],
        function(serviceName, eachServiceCB) {
          testServices[serviceName] = new testServices[serviceName]({
            logger: Logger
          });
          testServices[serviceName].happn = happnMock;

          happnMock.services[serviceName] = testServices[serviceName];

          if (serviceName == 'error')
            happnMock.services[serviceName].handleFatal = function(message, e) {
              console.log('FATAL FAILURE:::', message);
              throw e;
            };

          if (serviceName == 'session') {
            happnMock.services[serviceName].config = {};
            return happnMock.services[serviceName].initializeCaches(eachServiceCB);
          }

          if (!happnMock.services[serviceName].initialize) return eachServiceCB();
          else testServices[serviceName].initialize(testConfigs[serviceName], eachServiceCB);
        },
        callback
      );
    };

    before('should initialize the service', initializeMockServices);

    it('should have a default keypair in memory', function(callback) {
      expect(testServices.security._keyPair != undefined).to.be(true);
      callback();
    });

    it('the default keypair in memory must exist in the system security leaf', function(callback) {
      testServices.data.get('/_SYSTEM/_SECURITY/_SETTINGS/KEYPAIR', {}, function(e, response) {
        if (e) return callback(e);

        if (!response) return callback(new Error('keypair doesnt exist in database'));

        expect(testServices.crypto.serializeKeyPair(testServices.security._keyPair)).to.be(
          response.data.value
        );
        expect(
          testServices.crypto.deserializeKeyPair(response.data.value).privateKey.toString()
        ).to.be(testServices.security._keyPair.privateKey.toString());
        expect(
          testServices.crypto.deserializeKeyPair(response.data.value).publicKey.toString()
        ).to.be(testServices.security._keyPair.publicKey.toString());

        callback();
      });
    });

    it('should have a default admin group', function(callback) {
      testServices.data.get('/_SYSTEM/_SECURITY/_GROUP/_ADMIN', {}, function(e, response) {
        if (e) return callback(e);

        if (!response) return callback(new Error('admin group doesnt exist in database'));

        testServices.security.groups.getGroup('_ADMIN', function(e, group) {
          if (e) return callback(e);

          expect(group.permissions['*'].actions[0]).to.be('*');

          callback();
        });
      });
    });

    it('should have a default admin user', function(callback) {
      testServices.data.get('/_SYSTEM/_SECURITY/_USER/_ADMIN*', {}, function(e, response) {
        if (e) return callback(e);

        if (!response) return callback(new Error('admin user doesnt exist in database'));

        expect(response[0]._meta.path).to.be('/_SYSTEM/_SECURITY/_USER/_ADMIN');
        expect(response[1]._meta.path).to.be('/_SYSTEM/_SECURITY/_USER/_ADMIN/_USER_GROUP/_ADMIN');

        callback();
      });
    });
  }
);
