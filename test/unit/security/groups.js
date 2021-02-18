const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  this.timeout(10000);
  var async = require('async');
  var Logger = require('happn-logger');
  const util = require('util');
  var Services = {};
  const CONSTANTS = require('../../../lib/').constants;
  const SD_EVENTS = CONSTANTS.SECURITY_DIRECTORY_EVENTS;

  Services.SecurityService = require('../../../lib/services/security/service');
  Services.CacheService = require('../../../lib/services/cache/service');
  Services.DataService = require('../../../lib/services/data/service');
  Services.CryptoService = require('../../../lib/services/crypto/service');
  Services.ProtocolService = require('../../../lib/services/protocol/service');
  Services.SubscriptionService = require('../../../lib/services/subscription/service');
  Services.PublisherService = require('../../../lib/services/publisher/service');
  Services.UtilsService = require('../../../lib/services/utils/service');
  Services.SessionService = require('../../../lib/services/session/service');
  Services.SystemService = require('../../../lib/services/system/service');
  Services.ErrorService = require('../../../lib/services/error/service');
  Services.LogService = require('../../../lib/services/log/service');

  var mockService = util.promisify(function(happn, serviceName, config, callback) {
    if (typeof config === 'function') {
      callback = config;
      if (config !== false) config = {};
    }

    try {
      var serviceClass = Services[serviceName + 'Service'];

      var serviceInstance = new serviceClass({
        logger: Logger
      });

      serviceInstance.happn = happn;

      serviceInstance.config = config;

      happn.services[serviceName.toLowerCase()] = serviceInstance;

      if (typeof serviceInstance.initialize !== 'function' || config === false) return callback();

      serviceInstance.initialize(config, callback);
    } catch (e) {
      callback(e);
    }
  });

  var mockServices = function(callback) {
    var happn = {
      services: {},
      config: {}
    };

    mockService(happn, 'Crypto')
      .then(mockService(happn, 'Utils'))
      .then(mockService(happn, 'Log'))
      .then(mockService(happn, 'Error'))
      .then(mockService(happn, 'Session', false))
      .then(mockService(happn, 'Protocol'))
      .then(mockService(happn, 'Publisher'))
      .then(mockService(happn, 'Data'))
      .then(mockService(happn, 'Cache'))
      .then(mockService(happn, 'System'))
      .then(mockService(happn, 'Security'))
      .then(mockService(happn, 'Subscription'))
      .then(function() {
        happn.services.session.initializeCaches.bind(happn.services.session)(function(e) {
          if (e) return callback(e);
          callback(null, happn);
        });
      })
      .catch(callback);
  };

  it('tests adding a group with no permissions', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_1'
      };

      happn.services.security.groups.upsertGroup(testGroup, function(e, result) {
        if (e) return done(e);

        test.expect(result.name).to.be('TEST_GR_1');
        test.expect(result.permissions).to.be(undefined);

        done();
      });
    });
  });

  it('fails adding a group, fails to attach permissions, invalid actions', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_2',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': ['get', 'on']
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function(e) {
        test
          .expect(e.toString())
          .to.be(
            'Error: group permissions invalid: missing allowed actions or prohibit rules: /test/path/2'
          );
        done();
      });
    });
  });

  it('tests upserting an undefined group', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      happn.services.security.groups.upsertGroup(undefined, function(e) {
        test.expect(e.message).to.be('group is null or not an object');
        done();
      });
    });
  });

  it('tests deleting an undefined group', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      happn.services.security.groups.deleteGroup(undefined, function(e) {
        test.expect(e.message).to.be('group is null or not an object');
        done();
      });
    });
  });

  it('adds a group with valid permissions', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_3',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function(e) {
        if (e) return done(e);

        happn.services.security.groups.getGroup(testGroup.name, function(e, fetchedGroup) {
          if (e) return done(e);

          test.expect(fetchedGroup.permissions['/test/path/1'].actions).to.eql(['*']);
          test.expect(fetchedGroup.permissions['/test/path/2'].actions).to.eql(['get', 'on']);

          done();
        });
      });
    });
  });

  it('adds a group with valid permissions, then adds further permissions, we check that the permissions have been merged in the fetched group', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_4',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function(e) {
        if (e) return done(e);

        happn.services.security.groups
          .upsertPermission(testGroup.name, '/test/path/*', 'get')
          .then(function() {
            happn.services.security.groups.getGroup(testGroup.name, function(e, fetchedGroup) {
              if (e) return done(e);

              test.expect(fetchedGroup.permissions['/test/path/1'].actions).to.eql(['*']);
              test.expect(fetchedGroup.permissions['/test/path/2'].actions).to.eql(['get', 'on']);
              test.expect(fetchedGroup.permissions['/test/path/*'].actions).to.eql(['get']);

              done();
            });
          })
          .catch(done);
      });
    });
  });

  it('does a whole bunch of edits to the same permissions in parallel, we then check all the correct permissions exist in the group', function(done) {
    var permissionCount = 1000;

    this.timeout(permissionCount * 10);

    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_5',
        permissions: {
          '/test/path/test': { actions: ['*'] },
          '/test/path/*': { actions: ['get', 'on'] }
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function(e) {
        if (e) return done(e);

        var permissions = [];

        for (var permCounter = 0; permCounter < permissionCount; permCounter++)
          permissions.push('/test/path/' + permCounter.toString());

        async.each(
          permissions,
          function(permission, permissionCB) {
            happn.services.security.groups
              .upsertPermission(testGroup.name, permission, 'get')
              .then(function() {
                permissionCB();
              })
              .catch(done);
          },
          function(e) {
            if (e) return done(e);

            happn.services.security.groups.getGroup(testGroup.name, function(e, fetchedGroup) {
              if (e) return done(e);

              test.expect(fetchedGroup.permissions['/test/path/test'].actions).to.eql(['*']);
              test.expect(fetchedGroup.permissions['/test/path/*'].actions).to.eql(['get', 'on']);

              for (var permCounter = 0; permCounter < permissionCount; permCounter++)
                test
                  .expect(fetchedGroup.permissions['/test/path/' + permCounter.toString()].actions)
                  .to.eql(['get']);

              done();
            });
          }
        );
      });
    });
  });

  it('does a whole bunch of edits to the same group in parallel, we then check all the correct permissions exist in the group', function(done) {
    var permissionCount = 1000;

    this.timeout(permissionCount * 15);

    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_5',
        permissions: {
          '/test/path/test': { actions: ['*'] },
          '/test/path/*': { actions: ['get', 'on'] }
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function(e) {
        if (e) return done(e);

        var permissions = [];

        for (var permCounter = 0; permCounter < permissionCount; permCounter++)
          permissions.push('/test/path/' + permCounter.toString());

        async.each(
          permissions,
          function(permission, permissionCB) {
            var updateGroup = {
              name: 'TEST_GR_5',
              permissions: {
                '/test/path/test': { actions: ['*'] },
                '/test/path/*': { actions: ['get', 'on'] }
              }
            };

            updateGroup.permissions[permission] = { actions: ['get'] };

            happn.services.security.groups.upsertGroup(updateGroup, permissionCB);
          },
          function(e) {
            if (e) return done(e);

            happn.services.security.groups.getGroup(testGroup.name, function(e, fetchedGroup) {
              if (e) return done(e);

              test.expect(fetchedGroup.permissions['/test/path/test'].actions).to.eql(['*']);
              test.expect(fetchedGroup.permissions['/test/path/*'].actions).to.eql(['get', 'on']);

              for (var permCounter = 0; permCounter < permissionCount; permCounter++)
                test
                  .expect(fetchedGroup.permissions['/test/path/' + permCounter.toString()].actions)
                  .to.eql(['get']);

              done();
            });
          }
        );
      });
    });
  });

  it('adds a group with valid permissions, removes a permission - we ensure the permission removal has worked', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_4',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      happn.services.security.groups.upsertGroup(testGroup, function(e) {
        if (e) return done(e);

        happn.services.security.groups
          .upsertPermission(testGroup.name, '/test/path/*', 'get')
          .then(function() {
            return happn.services.security.groups.removePermission(
              testGroup.name,
              '/test/path/*',
              'get'
            );
          })
          .then(function() {
            return happn.services.security.groups.removePermission(
              testGroup.name,
              '/test/path/2',
              'on'
            );
          })
          .then(function() {
            happn.services.security.groups.getGroup(testGroup.name, function(e, fetchedGroup) {
              if (e) return done(e);

              test.expect(fetchedGroup.permissions['/test/path/1'].actions).to.eql(['*']);
              test.expect(fetchedGroup.permissions['/test/path/2'].actions).to.eql(['get']);
              test.expect(fetchedGroup.permissions['/test/path/*']).to.be(undefined);

              done();
            });
          })
          .catch(done);
      });
    });
  });

  it('lists a bunch of groups', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup1 = {
        name: 'TEST_ALL_GR_10',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      var testGroup2 = {
        name: 'TEST_ALL_GR_20',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      var testGroup3 = {
        name: 'TEST_ALL_GR_30',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      var testGroup4 = {
        name: 'TEST_ALL_GR_40',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      happn.services.security.groups
        .upsertGroup(testGroup1)
        .then(function() {
          return happn.services.security.groups.upsertGroup(testGroup2);
        })
        .then(function() {
          return happn.services.security.groups.upsertGroup(testGroup3);
        })
        .then(function() {
          return happn.services.security.groups.upsertGroup(testGroup4);
        })
        .then(function() {
          happn.services.security.groups.listGroups('TEST_ALL_GR_*', function(e, fetchedGroups) {
            if (e) return done(e);

            test.expect(fetchedGroups.length).to.be(4);
            test.expect(fetchedGroups[0].name).to.not.be(null);
            test.expect(fetchedGroups[0].name).to.not.be(undefined);

            done();
          });
        })
        .catch(done);
    });
  });

  it('adds a group with valid permissions, the updates the group, prohibiting some actions - we check the prohibited permissions have been removed', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup = {
        name: 'TEST_GR_3',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      var testGroup1 = {
        name: 'TEST_GR_3',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { prohibit: ['on'] }
        }
      };

      happn.services.security.groups
        .upsertGroup(testGroup)
        .then(function() {
          return happn.services.security.groups.getGroup(testGroup.name);
        })
        .then(function(fetched) {
          test.expect(fetched.permissions['/test/path/1'].actions).to.eql(['*']);
          test.expect(fetched.permissions['/test/path/2'].actions).to.eql(['get', 'on']);
          return happn.services.security.groups.upsertGroup(testGroup1);
        })
        .then(function() {
          return happn.services.security.groups.getGroup(testGroup.name);
        })
        .then(function(fetched) {
          test.expect(fetched.permissions['/test/path/1'].actions).to.eql(['*']);
          test.expect(fetched.permissions['/test/path/2'].actions).to.eql(['get']);
          done();
        });
    });
  });

  it('tests the group caches', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      var testGroup1 = {
        name: 'TEST_ALL_GR_100',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      var testGroup2 = {
        name: 'TEST_ALL_GR_200',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      var testGroup3 = {
        name: 'TEST_ALL_GR_300',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      var testGroup4 = {
        name: 'TEST_ALL_GR_400',
        permissions: {
          '/test/path/1': { actions: ['*'] },
          '/test/path/2': { actions: ['get', 'on'] }
        }
      };

      happn.services.security.groups
        .upsertGroup(testGroup1)
        .then(function() {
          return happn.services.security.groups.upsertGroup(testGroup2);
        })
        .then(function() {
          return happn.services.security.groups.upsertGroup(testGroup3);
        })
        .then(function() {
          return happn.services.security.groups.upsertGroup(testGroup4);
        })
        .then(function() {
          return happn.services.security.groups.getGroup('TEST_ALL_GR_100');
        })
        .then(function() {
          return happn.services.security.groups.getGroup('TEST_ALL_GR_200');
        })
        .then(function() {
          return happn.services.security.groups.getGroup('TEST_ALL_GR_300');
        })
        .then(function() {
          return happn.services.security.groups.getGroup('TEST_ALL_GR_400');
        })
        .then(function() {
          return test.delay(3000);
        })
        .then(function() {
          test.expect(happn.services.security.groups.__cache_groups.keys().length).to.be(5);
          test.expect(happn.services.security.groups.permissionManager.cache.keys().length).to.be(5);
          happn.services.security.groups.clearCaches(SD_EVENTS.UPSERT_GROUP, {
            name: 'TEST_ALL_GR_100'
          });
          test.expect(happn.services.security.groups.__cache_groups.keys().length).to.be(4);
          test.expect(happn.services.security.groups.permissionManager.cache.keys().length).to.be(4);
          happn.services.security.groups.clearCaches(SD_EVENTS.DELETE_GROUP, {
            obj: { name: 'TEST_ALL_GR_200' }
          });
          test.expect(happn.services.security.groups.__cache_groups.keys().length).to.be(3);
          test.expect(happn.services.security.groups.permissionManager.cache.keys().length).to.be(3);
          happn.services.security.groups.clearCaches(SD_EVENTS.PERMISSION_UPSERTED, {
            groupName: 'TEST_ALL_GR_300'
          });
          test.expect(happn.services.security.groups.__cache_groups.keys().length).to.be(2);
          test.expect(happn.services.security.groups.permissionManager.cache.keys().length).to.be(2);
          happn.services.security.groups.clearCaches(SD_EVENTS.PERMISSION_REMOVED, {
            groupName: 'TEST_ALL_GR_400'
          });
          test.expect(happn.services.security.groups.__cache_groups.keys().length).to.be(1);
          test.expect(happn.services.security.groups.permissionManager.cache.keys().length).to.be(1);
          done();
        })
        .catch(done);
    });
  });
});
