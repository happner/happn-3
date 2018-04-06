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
  var replicatedData = {};

  function createMockHappn(obj) {
    obj.happn = {};
    obj.happn.services = {};

    obj.happn.services.cache = {
      new: function () {}
    };

    obj.happn.services.data = {};

    obj.happn.services.error = {
      handleFatal: function (str, e) {
        console.error(str, e);
      }
    }

    obj.happn.services.replicator = {
      on: function (eventName, handler) {
        replicationSubscriptions[eventName] = handler;
      },
      send: function (eventName, payload, callback) {
        replicatedData[eventName] = payload;
        callback();
      }
    };
  }

  function stubInitializationSteps(obj) {
    obj.__initializeGroups = function () {
      return Promise.resolve();
    };

    obj.__initializeUsers = function () {
    };

    obj.__initializeProfiles = function () {
    };

    obj.__ensureKeyPair = function () {
    };

    obj.__initializeCheckPoint = function () {
    };

    obj.__initializeSessionManagement = function () {
    };

    obj.__ensureAdminUser = function () {
    };
  }

  function stubDataChangedSteps(obj) {

    obj.users = {
      clearCaches: function () {
        return Promise.resolve();
      }
    };

    obj.groups = {
      clearCaches: function () {
      }
    };

    obj.resetSessionPermissions = function () {
    };

    obj.checkpoint = {
      clearCaches: function () {
      }
    };

    obj.emitChanges = function () {
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

  it('replicates the security updates', function (done) {

    replicatedData = {};

    var security = new SecurityService(opts);

    createMockHappn(security);
    stubDataChangedSteps(security);

    security.dataChanged('whatHappnd', 'changedData', 'additionalInfo', function (e) {

      if (e) return done(e);

      try {
        expect(replicatedData).to.eql({
          '/security/dataChanged': {
            additionalInfo: 'additionalInfo',
            changedData: 'changedData',
            whatHappnd: 'whatHappnd'
          }
        });
        done();
      } catch (e) {
        done(e);
      }

    });

  });

});
