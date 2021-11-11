const test = require('../../__fixtures/utils/test_helper').create();
test.describe(__filename, 10000, function() {
  var Logger = require('happn-logger');
  const util = require('util');
  var Services = {};

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

      serviceInstance.initialize(config, function() {
        //console.log(`service ${serviceName} initialized...`);
        callback();
      });
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

  function createUsersAndGroups(happn, callback) {
    let done = e => {
      if (e) return callback(e);
      setTimeout(callback, 1000);
    };
    var upsertedGroups = [];
    var upsertedUsers = [];

    var groups = [];
    var users = [];

    for (var ii = 0; ii < 10; ii++) groups.push({ name: 'test_' + ii });

    for (var i = 0; i < 10; i++)
      users.push({
        username: 'test_' + i,
        password: 'test_' + i,
        custom_data: { role: 'OEM Admin', extra: i }
      });

    test.async.each(
      groups,
      function(group, groupCB) {
        happn.services.security.groups.upsertGroup(group, function(e, upsertedGroup) {
          if (e) return groupCB(e);

          upsertedGroups.push(upsertedGroup);

          groupCB();
        });
      },
      function(e) {
        if (e) return done(e);

        test.async.each(
          users,
          function(user, userCB) {
            happn.services.security.users.upsertUser(user, function(e, upsertedUser) {
              if (e) return userCB(e);

              upsertedUsers.push(upsertedUser);

              userCB();
            });
          },
          function(e) {
            if (e) return done(e);

            test.async.each(
              upsertedUsers,
              function(upsertedUser, upsertedUserCB) {
                test.async.each(
                  upsertedGroups,
                  function(upsertedGroup, upsertedGroupCB) {
                    happn.services.security.groups.linkGroup(
                      upsertedGroup,
                      upsertedUser,
                      upsertedGroupCB
                    );
                  },
                  upsertedUserCB
                );
              },
              done
            );
          }
        );
      }
    );
  }

  it('tests upserting an undefined user', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      happn.services.security.users.upsertUser(undefined, function(e) {
        test.expect(e.message).to.be('user is null or not an object');
        done();
      });
    });
  });

  it('tests deleting an undefined user', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      happn.services.security.users.deleteUser(undefined, function(e) {
        test.expect(e.message).to.be('user is null or not an object');
        done();
      });
    });
  });

  it('tests deleting a reserved user', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      happn.services.security.users.deleteUser({ username: '_ANONYMOUS' }, function(e) {
        test.expect(e.message).to.be('unable to delete a user with the reserved name: _ANONYMOUS');
        happn.services.security.users.deleteUser({ username: '_ADMIN' }, function(e) {
          test.expect(e.message).to.be('unable to delete a user with the reserved name: _ADMIN');
          done();
        });
      });
    });
  });

  it('tests deleting an undefined user - promise', function(done) {
    mockServices(async (e, happn) => {
      try {
        await happn.services.security.users.deleteUser(undefined);
      } catch (e) {
        test.expect(e.message).to.be('user is null or not an object');
        done();
      }
    });
  });

  it('tests deleting a reserved user - promise', function(done) {
    mockServices(async (_e, happn) => {
      try {
        await happn.services.security.users.deleteUser({ username: '_ANONYMOUS' });
      } catch (e) {
        test.expect(e.message).to.be('unable to delete a user with the reserved name: _ANONYMOUS');
        done();
      }
    });
  });

  it('tests deleting a user happy path - promise', function(done) {
    mockServices(async (_e, happn) => {
      happn.services.security.users.permissionManager = {
        removeAllUserPermissions: () => {}
      };
      happn.services.security.users.dataService = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_users = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_passwords = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.securityService.dataChanged = (
        whatHappned,
        data,
        additionalInfo,
        callback
      ) => {
        callback(null, { whatHappned, data, additionalInfo });
      };

      happn.services.security.users
        .deleteUser({ username: 'test' })
        .then(deleted => {
          test.expect(deleted).to.eql({
            obj: {
              path: '/_SYSTEM/_SECURITY/_USER/test'
            },
            tree: {
              path: '/_SYSTEM/_SECURITY/_USER/test/*'
            }
          });
          done();
        })
        .catch(done);
    });
  });

  it('tests deleting a user happy path - callback', function(done) {
    mockServices(async (_e, happn) => {
      happn.services.security.users.permissionManager = {
        removeAllUserPermissions: () => {}
      };
      happn.services.security.users.dataService = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_users = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_passwords = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.securityService.dataChanged = (
        whatHappned,
        data,
        additionalInfo,
        callback
      ) => {
        callback(null, { whatHappned, data, additionalInfo });
      };

      happn.services.security.users.deleteUser({ username: 'test' }, (e, deleted) => {
        test.expect(e).to.eql(null);
        test.expect(deleted).to.eql({
          obj: {
            path: '/_SYSTEM/_SECURITY/_USER/test'
          },
          tree: {
            path: '/_SYSTEM/_SECURITY/_USER/test/*'
          }
        });
        done();
      });
    });
  });

  it('tests deleting a user sad path - promise', function(done) {
    mockServices(async (_e, happn) => {
      happn.services.security.users.permissionManager = {
        removeAllUserPermissions: () => {
          throw new Error('test');
        }
      };
      happn.services.security.users.dataService = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_users = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_passwords = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.securityService.dataChanged = (
        whatHappned,
        data,
        additionalInfo,
        callback
      ) => {
        callback(null, { whatHappned, data, additionalInfo });
      };

      happn.services.security.users
        .deleteUser({ username: 'test' })
        .then(() => {
          done(new Error('untest.expected'));
        })
        .catch(e => {
          test.expect(e.message).to.be('test');
          done();
        });
    });
  });

  it('tests deleting a user sad path - callback', function(done) {
    mockServices(async (_e, happn) => {
      happn.services.security.users.permissionManager = {
        removeAllUserPermissions: () => {
          throw new Error('test');
        }
      };
      happn.services.security.users.dataService = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_users = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.__cache_passwords = {
        remove: path => {
          return { path };
        }
      };
      happn.services.security.users.securityService.dataChanged = (
        whatHappned,
        data,
        additionalInfo,
        callback
      ) => {
        callback(null, { whatHappned, data, additionalInfo });
      };

      happn.services.security.users.deleteUser({ username: 'test' }, e => {
        test.expect(e.message).to.be('test');
        done();
      });
    });
  });

  it('searches for users  a custom filter to ensure we dont have to trim out groups, this will allow us to optimise the listUsers method', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        happn.services.data.get(
          '/_SYSTEM/_SECURITY/_USER/*',
          { criteria: { 'custom_data.role': { $in: ['SMC Admin', 'OEM Admin'] } } },
          function(e, results) {
            if (e) return done(e);

            test.expect(results.length === 10).to.be(true);

            done();
          }
        );
      });
    });
  });

  it('searches for users  a custom filter to ensure we dont have to trim out groups, this will allow us to optimise the listUsers method, negative test', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        happn.services.data.get('/_SYSTEM/_SECURITY/_USER/*', function(e, results) {
          if (e) return done(e);

          test.expect(results.length > 10).to.be(true);

          done();
        });
      });
    });
  });

  it('searches for users with the $exists filter and other criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        happn.services.data.get(
          '/_SYSTEM/_SECURITY/_USER/*',
          {
            criteria: {
              'custom_data.role': { $containsAny: ['SMC Admin', 'OEM Admin'] },
              username: { $exists: true }
            }
          },
          function(e, results) {
            if (e) return done(e);

            test.expect(results.length === 10).to.be(true);

            done();
          }
        );
      });
    });
  });

  it('searches for users with the $exists filter and no other criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        setTimeout(() => {
          happn.services.data.get(
            '/_SYSTEM/_SECURITY/_USER/*',
            { criteria: { username: { $exists: true } } },
            function(e, results) {
              if (e) return done(e);
              test.expect(results.length === 11).to.be(true); //11 to compensate for the admin user
              done();
            }
          );
        }, 1000);
      });
    });
  });

  it('searches for users with the listUsers method, no criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        happn.services.security.users.listUsers('*', function(e, users) {
          if (e) return done(e);
          test.expect(users.length === 11).to.be(true); //11 to compensate for the admin user
          done();
        });
      });
    });
  });

  it('searches for users with the listUsers method, null criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        happn.services.security.users.listUsers('*', null, function(e, users) {
          if (e) return done(e);

          test.expect(users.length === 11).to.be(true); //11 to compensate for the admin user

          done();
        });
      });
    });
  });

  it('searches for users with the listUsers method, undefined criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        happn.services.security.users.listUsers('*', undefined, function(e, users) {
          if (e) return done(e);

          test.expect(users.length === 11).to.be(true); //11 to compensate for the admin user

          done();
        });
      });
    });
  });

  it('searches for users with the listUsers method, additional criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);

      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        happn.services.security.users.listUsers(
          '*',
          { criteria: { 'custom_data.role': { $in: ['SMC Admin', 'OEM Admin'] } } },
          function(e, users) {
            if (e) return done(e);

            test.expect(users.length === 10).to.be(true); //11 to compensate for the admin user

            done();
          }
        );
      });
    });
  });

  it('tests the __getUserNamesFromGroupLinks method', function(done) {
    var userGroupLinks = [
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_0/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_0/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_1/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_1/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_2/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_2/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_3/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_3/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_4/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_4/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_5/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_5/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_6/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_6/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_7/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_7/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_8/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_8/_USER_GROUP/test_1'
        }
      },
      {
        _meta: {
          path: '/_SYSTEM/_SECURITY/_USER/test_9/_USER_GROUP/test_1',
          _id: '/_SYSTEM/_SECURITY/_USER/test_9/_USER_GROUP/test_1'
        }
      }
    ];
    mockServices(function(e, happn) {
      if (e) return done(e);
      var userNames = happn.services.security.users.__getUserNamesFromGroupLinks(userGroupLinks);
      test
        .expect(userNames)
        .to.eql([
          'test_0',
          'test_1',
          'test_2',
          'test_3',
          'test_4',
          'test_5',
          'test_6',
          'test_7',
          'test_8',
          'test_9'
        ]);
      done();
    });
  });

  it('tests the __getUserNamesFromGroupLinks method, empty links', function(done) {
    var userGroupLinks = [];
    mockServices(function(e, happn) {
      if (e) return done(e);
      var userNames = happn.services.security.users.__getUserNamesFromGroupLinks(userGroupLinks);
      test.expect(userNames).to.eql([]);
      done();
    });
  });

  it('tests the __getUserNamesFromGroupLinks method, null links', function(done) {
    var userGroupLinks = null;
    mockServices(function(e, happn) {
      if (e) return done(e);
      var userNames = happn.services.security.users.__getUserNamesFromGroupLinks(userGroupLinks);
      test.expect(userNames).to.eql([]);
      done();
    });
  });

  it('searches for users with the listUsersByGroup method, exact match to group', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users.listUserNamesByGroup('test_1').then(function(userNames) {
          if (e) return done(e);
          test
            .expect(userNames.sort())
            .to.eql([
              'test_0',
              'test_1',
              'test_2',
              'test_3',
              'test_4',
              'test_5',
              'test_6',
              'test_7',
              'test_8',
              'test_9'
            ]);
          done();
        });
      });
    });
  });

  it('searches for users with the listUsersByGroup method, group name not matching', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users
          .listUserNamesByGroup('lizard-group')
          .then(function(userNames) {
            if (e) return done(e);
            test.expect(userNames).to.eql([]);
            done();
          });
      });
    });
  });

  it('searches for users with the listUsersByGroup method, group name null', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users
          .listUserNamesByGroup(null)
          .then(function() {
            done(new Error('untest.expected execution'));
          })
          .catch(function(e) {
            test.expect(e.toString()).to.be('Error: validation error: groupName must be specified');
            done();
          });
      });
    });
  });

  it('searches for users with the listUsersByGroup method, exact match to group', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users.listUsersByGroup('test_1', function(e, users) {
          if (e) return done(e);
          test.expect(users.length === 10).to.be(true); //11 to compensate for the admin user
          done();
        });
      });
    });
  });

  it('searches for users with the listUsersByGroup method, exact match to group, extra criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users.listUsersByGroup(
          'test_1',
          { criteria: { 'custom_data.extra': 1 } },
          function(e, users) {
            if (e) return done(e);
            test.expect(users.length === 1).to.be(true); //11 to compensate for the admin user
            done();
          }
        );
      });
    });
  });

  it('searches for users with the listUsersByGroup method, exact match to group, unmatched extra criteria', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users.listUsersByGroup(
          'test_1',
          { criteria: { 'custom_data.extra': 1000 } },
          function(e, users) {
            if (e) return done(e);
            test.expect(users.length === 0).to.be(true); //11 to compensate for the admin user
            done();
          }
        );
      });
    });
  });

  it('searches for users with the listUsersByGroup method, unmatched group name', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users.listUsersByGroup('lizard-group', function(e, users) {
          if (e) return done(e);
          test.expect(users.length === 0).to.be(true); //11 to compensate for the admin user
          done();
        });
      });
    });
  });

  it('searches for users with the listUsersByGroup method, null group name', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users.listUsersByGroup(null, function(e) {
          test.expect(e.toString()).to.be('Error: validation error: groupName must be specified');
          done();
        });
      });
    });
  });

  it('tests getUserNoGroups', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);
        happn.services.security.users.getUser('test_1', (e, user) => {
          test.expect(e).to.be(null);
          test.expect(test._.omit(user, ['userid'])).to.eql({
            username: 'test_1',
            custom_data: { role: 'OEM Admin', extra: 1 },
            groups: {
              test_0: { data: {} },
              test_1: { data: {} },
              test_2: { data: {} },
              test_3: { data: {} },
              test_4: { data: {} },
              test_5: { data: {} },
              test_6: { data: {} },
              test_7: { data: {} },
              test_8: { data: {} },
              test_9: { data: {} }
            },
            permissions: {}
          });
        });
        happn.services.security.users.getUserNoGroups('test_1', (e, user) => {
          test.expect(e).to.be(null);
          test.expect(test._.omit(user, ['userid'])).to.eql({
            username: 'test_1',
            custom_data: { role: 'OEM Admin', extra: 1 },
            permissions: {}
          });
          happn.services.security.users.getUser('test_1', (e, user) => {
            test.expect(e).to.be(null);
            test.expect(test._.omit(user, ['userid'])).to.eql({
              username: 'test_1',
              custom_data: { role: 'OEM Admin', extra: 1 },
              groups: {
                test_0: { data: {} },
                test_1: { data: {} },
                test_2: { data: {} },
                test_3: { data: {} },
                test_4: { data: {} },
                test_5: { data: {} },
                test_6: { data: {} },
                test_7: { data: {} },
                test_8: { data: {} },
                test_9: { data: {} }
              },
              permissions: {}
            });
            done();
          });
        });
      });
    });
  });

  it('tests getUserNoGroups returns user permissions', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      let user = {
        username: 'test_permissions',
        password: 'test_permissions',
        custom_data: { role: 'OEM Admin', extra: 27 },
        permissions: {
          'test/path/1': {
            actions: ['get', 'on', 'set']
          },
          'test/path/2': {
            prohibit: ['put', 'delete', 'post']
          },
          'test/path/3': {
            actions: ['get', 'on', 'set'],
            prohibit: ['put', 'delete', 'post']
          }
        }
      };
      happn.services.security.users.upsertUser(user, (e, upsertedUser) => {
        happn.services.security.users.getUserNoGroups('test_permissions', (e, retrievedUser) => {
          try {
            test
              .expect(test._.omit(upsertedUser, ['userid']))
              .to.eql(test._.omit(user, ['password']));
            test.expect(test._.omit(retrievedUser, ['userid'])).to.eql({
              username: 'test_permissions',
              custom_data: { role: 'OEM Admin', extra: 27 },
              permissions: {
                'test/path/1': {
                  actions: ['get', 'on', 'set']
                },
                'test/path/2': {
                  prohibit: ['delete', 'post', 'put']
                },
                'test/path/3': {
                  actions: ['get', 'on', 'set'],
                  prohibit: ['delete', 'post', 'put']
                }
              }
            });
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });

  it('__upsertUser should add a user', function(done) {
    mockServices(function(e, happn) {
      if (e) return done(e);
      createUsersAndGroups(happn, function(e) {
        if (e) return done(e);

        const user = {
          username: 'test_user',
          password: 'test_user',
          custom_data: { role: 'OEM Admin', extra: 'user_extra' }
        };

        happn.services.security.users.__upsertUser(user).then(upsertedUser => {
          if (e) return done(e);

          try {
            test.expect(upsertedUser.username).to.be(user.username);
            test.expect(upsertedUser.custom_data).to.eql(user.custom_data);
            test.expect(upsertedUser.permissions).to.eql({});

            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });
});
