describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var Promise = require('bluebird');
  var expect = require('expect.js');
  var SecurityService = require('../../../lib/services/security/service');

  var opts = {
    logger: {
      createLogger: function () {
        return {
          $$TRACE: function () {},
          createLogger: function () {
            return {
              $$TRACE: function () {}
            }
          }
        }
      }
    }
  }

  var replicationSubscriptions = {};

  function createMockHappn(obj) {
    obj.happn = {};
    obj.happn.services = {};

    obj.happn.services.cache = {
      new: function () {}
    };

    obj.happn.services.data = {};

    obj.happn.services.replicator = {
      on: function (eventName, handler) {
        replicationSubscriptions[eventName] = handler;
      }
    };
  }

  function stubInitializationSteps(obj) {

    // initialization mocks
    obj.__initializeGroups = function () {
      return Promise.resolve();
    };

    obj.__initializeUsers = function () {
      return Promise.resolve();
    };

    obj.__initializeProfiles = function () {
      return Promise.resolve();
    };

    obj.__ensureKeyPair = function () {
      return Promise.resolve();
    };

    obj.__initializeCheckPoint = function () {
      return Promise.resolve();
    };

    obj.__initializeSessionManagement = function () {
      return Promise.resolve();
    };

    obj.__ensureAdminUser = function () {
      return Promise.resolve();
    };

  }

  it('subscribes to replication service security updates', function (done) {

    replicationSubscriptions = {};

    var security = new SecurityService(opts);

    createMockHappn(security);
    stubInitializationSteps(security);

    security.initialize({}, function (e) {

      if (e) return done(e);

      expect(Object.keys(replicationSubscriptions)).to.eql(['/security/dataChanged']);

      done();

    });

  });

  it('replicates the security updates');

});
