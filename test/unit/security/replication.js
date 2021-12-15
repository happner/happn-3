const async = require('async');
describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var SecurityService = require('../../../lib/services/security/service');

    var opts = {
      logger: {
        createLogger: function() {
          return {
            $$TRACE: function() {},
            createLogger: function() {
              return {
                $$TRACE: function() {}
              };
            }
          };
        }
      }
    };

    var replicationSubscriptions = {};
    var replicatedData = {};

    function createMockHappn(obj) {
      obj.happn = {};
      obj.happn.services = {};
      obj.happn.config = {
        services: {
          security: {}
        }
      };

      obj.happn.services.cache = {
        new: function() {}
      };

      obj.happn.services.data = {
        //eslint-disable-next-line
        get:function(path, callback){
          callback(null, null);
        },
        //eslint-disable-next-line
        upsert:function(path, data, callback){
          callback(null, data);
        }
      };

      obj.happn.services.error = {
        handleFatal: function(str, e) {
          //eslint-disable-next-line no-console
          console.error(str, e);
        }
      };

      obj.happn.services.replicator = {
        on: function(eventName, handler) {
          replicationSubscriptions[eventName] = handler;
        },
        send: function(eventName, payload, callback) {
          replicatedData[eventName] = payload;
          callback();
        }
      };
    }

    function stubInitializationSteps(obj) {
      obj.__initializeGroups = function() {
        return Promise.resolve();
      };

      obj.__initializeUsers = function() {};

      obj.__initializeProfiles = function() {};

      obj.__ensureKeyPair = function() {};

      obj.__initializeCheckPoint = function() {};

      obj.__initializeSessionManagement = function() {};

      obj.__ensureAdminUser = function() {};

      obj.__initializeAuthProviders = function() {};
    }

    function stubDataChangedSteps(obj) {
      obj.users = {
        clearCaches: function() {
          return Promise.resolve();
        }
      };

      obj.groups = {
        clearCaches: function() {
          return Promise.resolve();
        }
      };

      obj.resetSessionPermissions = function() {
        return Promise.resolve();
      };

      obj.checkpoint = {
        clearCaches: function() {
          return Promise.resolve();
        }
      };

      obj.emitChanges = function() {};
    }

    it('subscribes to replication service security updates', function(done) {
      replicationSubscriptions = {};

      var security = new SecurityService(opts);

      createMockHappn(security);
      stubInitializationSteps(security);

      security.initialize({}, function(e) {
        if (e) return done(e);

        expect(Object.keys(replicationSubscriptions)).to.eql(['/security/dataChanged']);

        done();
      });
    });

    it('replicates the security updates', function(done) {
      replicatedData = {};

      var security = new SecurityService(opts);

      security.__dataChangedQueue = async.queue((task, callback) => {
        security.__dataChangedInternal(
          task.whatHappnd,
          task.changedData,
          task.additionalInfo,
          callback
        );
      }, 1);

      createMockHappn(security);
      stubDataChangedSteps(security);

      security.dataChanged('unlink-group', 'changedData', 'additionalInfo', function(e) {
        if (e) return done(e);

        try {
          expect(replicatedData).to.eql({
            '/security/dataChanged': {
              additionalInfo: 'additionalInfo',
              changedData: 'changedData',
              whatHappnd: 'unlink-group'
            }
          });
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  }
);
