describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    context('manage users and groups and permissions', function() {
      var expect = require('expect.js');
      var happn = require('../../../lib/index');
      var service = happn.service;
      var async = require('async');
      var Logger = require('happn-logger');

      var test_id = Date.now() + '_' + require('shortid').generate();

      var testConfigs = {};

      var tempFile = __dirname + '/tmp/testdata_secur_' + require('shortid').generate() + '.db';

      this.timeout(10000);

      testConfigs.data = {
        persist: true,
        filename: tempFile
      };

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
          ['log', 'error', 'utils', 'crypto', 'cache', 'session', 'data', 'security'],
          function(serviceName, eachServiceCB) {
            testServices[serviceName] = new testServices[serviceName]({
              logger: Logger
            });

            testServices[serviceName].happn = happnMock;

            happnMock.services[serviceName] = testServices[serviceName];

            if (serviceName == 'error')
              happnMock.services[serviceName].handleFatal = function(message, e) {
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

      context('checkpoint utility functions', function() {
        it('should get a permission-set key', function(callback) {
          var permissionSetKey = testServices.security.generatePermissionSetKey({
            groups: {
              test1: 'test1',
              test2: 'test2'
            }
          });
          expect(permissionSetKey).to.be(
            require('crypto')
              .createHash('sha1')
              .update('test1/test2')
              .digest('base64')
          );
          callback();
        });

        it(' should compare wildcards', function(callback) {
          expect(
            testServices.utils.wildcardMatch('/test/compare1*', '/test/compare1/blah/*')
          ).to.be(true);
          expect(
            testServices.utils.wildcardMatch('/test/compare1/*', '/test/compare1/blah/*')
          ).to.be(true);
          expect(
            testServices.utils.wildcardMatch(
              '/test/compare2/compare3/*',
              '/test/compare2/compare3/blah'
            )
          ).to.be(true);
          expect(
            testServices.utils.wildcardMatch(
              '/test/compare3/compare4/*',
              '/test/compare3/compare4/blah/blah'
            )
          ).to.be(true);
          expect(
            testServices.utils.wildcardMatch(
              '/test/compare4/*/compare5/*',
              '/test/compare4/blah/compare5/blah'
            )
          ).to.be(true);

          expect(testServices.utils.wildcardMatch('/test/compare1/*', '/dodge/*')).to.be(false);
          expect(testServices.utils.wildcardMatch('/test/compare2/*', '/dodge/explicit')).to.be(
            false
          );

          callback();
        });
      });

      var testGroup = {
        name: 'TEST GROUP' + test_id,
        custom_data: {
          customString: 'custom1',
          customNumber: 0
        }
      };

      var subGroup = {
        name: 'TEST SUB GROUP' + test_id,
        custom_data: {
          customString: 'customSub1',
          customNumber: 1
        }
      };

      var testUser = {
        username: 'TEST USER@blah.com' + test_id,
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        }
      };

      var testPermissions = [];
      var addedGroup;

      it('should create a group', function(callback) {
        testServices.security.users.upsertGroup(testGroup, function(e, result) {
          if (e) return callback(e);

          expect(result.name == testGroup.name).to.be(true);
          expect(result.custom_data.customString == testGroup.custom_data.customString).to.be(true);
          expect(result.custom_data.customNumber == testGroup.custom_data.customNumber).to.be(true);

          addedGroup = result;
          callback();
        });
      });

      it('should create a sub group', function(callback) {
        testServices.security.users.upsertGroup(
          subGroup,
          {
            parent: addedGroup
          },
          function(e, result) {
            if (e) return callback(e);

            expect(result.name == subGroup.name).to.be(true);
            expect(result.custom_data.customString == subGroup.custom_data.customString).to.be(
              true
            );
            expect(result.custom_data.customNumber == subGroup.custom_data.customNumber).to.be(
              true
            );

            addedSubGroup = result;
            callback();
          }
        );
      });

      it('should fail to create a group as it already exists', function(callback) {
        testServices.security.users.upsertGroup(
          testGroup,
          {
            overwrite: false
          },
          function(e, result) {
            if (
              e &&
              e.toString() ==
                'Error: validation failure: group by the name ' + testGroup.name + ' already exists'
            )
              return callback();

            callback(new Error('group was created or lookup failed', e));
          }
        );
      });

      it('should get groups by group name', function(callback) {
        testServices.security.users.listGroups('TEST*', function(e, results) {
          if (e) return callback(e);

          expect(results.length).to.be(2);
          callback();
        });
      });

      it('gets a specific group', function(callback) {
        testServices.security.users.getGroup(testGroup.name, function(e, group) {
          if (e) return callback(e);

          expect(group.name).to.be(testGroup.name);

          callback();
        });
      });

      it('should add permissions to a group', function(callback) {
        testGroup.permissions = {};

        //add set permissions to a group
        testGroup.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_set'] = {
          actions: ['set']
        };

        //add get permissions to a group
        testGroup.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_get'] = {
          actions: ['get']
        };

        //add on permissions to a group
        testGroup.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_on'] = {
          actions: ['on']
        };

        //add remove permissions to a group
        testGroup.permissions[
          '/a5_eventemitter_security_groups/' + test_id + '/permission_remove'
        ] = {
          actions: ['remove']
        };

        //add all permissions to a group
        testGroup.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_all'] = {
          actions: ['*']
        };

        //add all permissions to a wildcard group
        testGroup.permissions['/*' + test_id + '/permission_wildcard/all/*'] = {
          actions: ['*']
        };

        //add set permissions to a wildcard group
        testGroup.permissions['/*' + test_id + '/permission_wildcard/set/*'] = {
          actions: ['set']
        };

        //add multiple permissions to a wildcard group
        testGroup.permissions['/*' + test_id + '/permission_wildcard/multiple/*'] = {
          actions: ['set', 'get']
        };

        //add multiple permissions to a group
        testGroup.permissions['/' + test_id + '/permission_wildcard/multiple'] = {
          actions: ['set', 'on']
        };

        testServices.security.users.upsertGroup(testGroup, function(e, result) {
          if (e) return callback(e);

          expect(
            result.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_set']
              .actions[0]
          ).to.be('set');
          expect(
            result.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_get']
              .actions[0]
          ).to.be('get');
          expect(
            result.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_on']
              .actions[0]
          ).to.be('on');
          expect(
            result.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_remove']
              .actions[0]
          ).to.be('remove');
          expect(
            result.permissions['/a5_eventemitter_security_groups/' + test_id + '/permission_all']
              .actions[0]
          ).to.be('*');

          expect(
            result.permissions['/*' + test_id + '/permission_wildcard/multiple/*'].actions[0]
          ).to.be('set');
          expect(
            result.permissions['/' + test_id + '/permission_wildcard/multiple'].actions[0]
          ).to.be('set');

          expect(
            result.permissions['/*' + test_id + '/permission_wildcard/multiple/*'].actions[1]
          ).to.be('get');
          expect(
            result.permissions['/' + test_id + '/permission_wildcard/multiple'].actions[1]
          ).to.be('on');

          callback();
        });
      });

      var groupToRemove = {
        name: 'GROUP TO REMOVE' + test_id,
        custom_data: {
          customString: 'customSub1',
          customNumber: 0
        }
      };

      it('should delete a group', function(callback) {
        testServices.security.users.upsertGroup(groupToRemove, function(e, result) {
          if (e) return callback(e);

          testServices.security.users.deleteGroup(result, function(e, result) {
            if (e) return callback(e);

            expect(result.removed).to.be(1);

            testServices.security.users.listGroups(groupToRemove.name, function(e, results) {
              if (e) return callback(e);

              expect(results.length).to.be(0);

              callback();
            });
          });
        });
      });

      context('manage users', function() {
        it('should add a user', function(callback) {
          testServices.security.users.upsertUser(
            testUser,
            {
              overwrite: false
            },
            function(e, result) {
              if (e) return callback(e);

              expect(result.password).to.equal(undefined);

              delete result._meta;

              expect(result).to.eql({
                custom_data: {
                  something: 'usefull'
                },
                username: testUser.username
              });

              testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + testUser.username, {}, function(
                e,
                result
              ) {
                expect(result.data.password != 'TEST PWD').to.be(true);

                delete result.data.password;

                expect(result.data).to.eql({
                  custom_data: {
                    something: 'usefull'
                  },
                  username: testUser.username
                });

                callback();
              });
            }
          );
        });

        it('should not add another user with the same name', function(callback) {
          testUser.username += '.org';
          testUser.password = 'TSTPWD';

          testServices.security.users.upsertUser(
            testUser,
            {
              overwrite: false
            },
            function(e, result) {
              if (e) return callback(e);

              var user = result;
              user.password = 'TSTPWD';

              testServices.security.users.upsertUser(
                user,
                {
                  overwrite: false
                },
                function(e, result) {
                  expect(e.toString()).to.equal(
                    'Error: validation failure: user by the name ' +
                      user.username +
                      ' already exists'
                  );
                  callback();
                }
              );
            }
          );
        });

        it('should update a user', function(callback) {
          testUser.username += '.net';
          testUser.password = 'TSTPWD';

          testServices.security.users.upsertUser(testUser, function(e, result) {
            if (e) return callback(e);

            var user = result;

            user.custom_data = {};
            user.password = 'XXX';

            testServices.security.users.upsertUser(user, function(e, result) {
              if (e) return callback(e);

              expect(result.custom_data).to.eql({});

              var user = result;

              testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {}, function(
                e,
                result
              ) {
                delete result.data.password;

                expect(result.data).to.eql({
                  custom_data: {},
                  username: user.username
                });

                callback();
              });
            });
          });
        });

        it('should list users', function(callback) {
          testServices.security.users.listUsers(testUser.username, function(e, users) {
            if (e) return callback(e);

            expect(users.length).to.be(1);

            testServices.security.users.listUsers('*', function(e, users) {
              if (e) return callback(e);

              expect(users.length).to.be(4);

              callback();
            });
          });
        });

        it('can delete a user', function(callback) {
          testUser.username += '.xx';
          testUser.password = 'TST';

          testServices.security.users.upsertUser(testUser, function(e, user) {
            if (e) return callback(e);

            testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {}, function(
              e,
              result
            ) {
              if (e) return callback(e);

              testServices.security.users.deleteUser(user, function(e, result) {
                if (e) return callback(e);

                expect(result.obj.data).to.eql({
                  removed: 1
                });
                expect(result.tree.data).to.eql({
                  removed: 0
                });

                testServices.data.get('/_SYSTEM/_SECURITY/_USER/' + user.username, {}, function(
                  e,
                  result
                ) {
                  expect(result).to.equal(null);
                  expect(result).to.equal(null);
                  callback();
                });
              });
            });
          });

          // testServices.security.users.deleteUser(testUser, function(e, result){
          //    if (e) return callback(e);
          //    addedUser = result;
          // });
        });

        context('delete a user that has groups', function() {
          it('removes the user', function(callback) {
            callback();
          });

          it('removes the group membership', function(callback) {
            callback();
          });
        });
      });

      context('manage users and groups', function() {
        var linkGroup = {
          name: 'LINK GROUP' + test_id,
          custom_data: {
            customString: 'custom1',
            customNumber: 0
          }
        };

        var linkUser = {
          username: 'LINK USER@blah.com' + test_id,
          password: 'LINK PWD',
          custom_data: {
            something: 'usefull'
          }
        };

        var nonExistantGroup = {
          name: 'BAD LINK GROUP' + test_id,
          _meta: {
            path: '/SOME/DODGE/PATH'
          }
        };

        before('should create link between users and groups', function(done) {
          testServices.security.users.upsertGroup(linkGroup, function(e, result) {
            if (e) return done(e);
            linkGroup = result;

            testServices.security.users.upsertUser(linkUser, function(e, result) {
              if (e) return done(e);
              linkUser = result;
              done();
            });
          });
        });

        it('links a group to a user', function(callback) {
          testServices.security.users.linkGroup(linkGroup, linkUser, function(e) {
            if (e) return callback(e);

            testServices.data.get(
              '/_SYSTEM/_SECURITY/_USER/' + linkUser.username + '/_USER_GROUP/' + linkGroup.name,
              {},
              function(e, result) {
                if (e) return callback(e);

                expect(result != null).to.be(true);
                callback();
              }
            );
          });
        });

        it('should list users by groupName', function(callback) {
          testServices.security.users.listUsersByGroup(linkGroup.name, function(e, users) {
            if (e) return callback(e);
            expect(users.length).to.be(1);
            callback();
          });
        });

        it('gets a specific user - ensuring the group is now part of the return object', function(callback) {
          testServices.security.users.getUser(linkUser.username, function(e, user) {
            if (e) return callback(e);

            expect(user.groups[linkGroup.name] != null).to.be(true);
            callback();
          });
        });

        it('gets a specific user - with the includeGroups:false switch, we ensure the group is not part of the user', function(callback) {
          testServices.security.users.getUser(linkUser.username, { includeGroups: false }, function(
            e,
            user
          ) {
            if (e) return callback(e);

            expect(user.groups).to.be(undefined);

            expect(
              testServices.security.users.__cache_users.getSync(linkUser.username + ':nogroups')
            ).to.eql(user);
            expect(
              testServices.security.users.__cache_passwords.getSync(linkUser.username + ':nogroups')
            ).to.not.be(null);
            expect(
              testServices.security.users.__cache_passwords.getSync(linkUser.username + ':nogroups')
            ).to.not.be(undefined);

            testServices.security.users.clearCaches().then(function() {
              expect(
                testServices.security.users.__cache_users.getSync(linkUser.username + ':nogroups')
              ).to.be(null);
              expect(
                testServices.security.users.__cache_passwords.getSync(
                  linkUser.username + ':nogroups'
                )
              ).to.be(null);

              callback();
            });
          });
        });

        it('gets a non-existing user - with the includeGroups:false switch, we ensure we get null back', function(callback) {
          testServices.security.users.getUser(
            'a non existing user',
            { includeGroups: false },
            function(e, user) {
              if (e) return callback(e);

              expect(user).to.be(null);
              callback();
            }
          );
        });

        it('tries to create a user with the :nogroups switch in the user name - we ensure this fails validation', function(callback) {
          var badUser = {
            username: 'TESTBADUSER:nogroups',
            password: 'PWD'
          };

          testServices.security.users.upsertUser(badUser, function(e) {
            expect(e.toString()).to.be(
              "Error: validation failure: username cannot contain the ':nogroups' directive"
            );
            callback();
          });
        });

        it('unlinks a group from a user', function(callback) {
          testServices.security.users.unlinkGroup(linkGroup, linkUser, function(e) {
            testServices.data.get(
              '/_SYSTEM/_SECURITY/_USER/' + linkUser.username + '/_USER_GROUP/' + linkGroup.name,
              {},
              function(e, result) {
                if (e) return callback(e);

                expect(result).to.be(null);
                callback();
              }
            );
          });
        });

        it('fails to link a non-existant group to a user', function(callback) {
          testServices.security.users.linkGroup(nonExistantGroup, linkUser, function(e) {
            if (!e) return callback(new Error('user linked to non existant group'));

            callback();
          });
        });

        it('deletes a group that belongs to a user without un-linking it, then is able to fetch the user', function(done) {
          var thisUser = {
            username: 'thisUser1',
            password: 'thisUser1'
          };

          var thisGroup = {
            name: 'thisGroup1',
            permissions: {}
          };

          thisGroup.permissions['/*' + test_id + '/remove_group'] = {
            actions: ['set', 'get']
          };

          var fetchedGroup;

          testServices.security.groups
            .upsertGroup(thisGroup)
            .then(function() {
              return testServices.security.users.upsertUser(thisUser);
            })
            .then(function() {
              return testServices.security.groups.getGroup('thisGroup1');
            })
            .then(function(gotGroup) {
              fetchedGroup = gotGroup;
              return testServices.security.users.getUser('thisUser1');
            })
            .then(function(fetchedUser) {
              return testServices.security.groups.linkGroup(fetchedGroup, fetchedUser);
            })
            .then(function() {
              return testServices.security.users.getUser('thisUser1');
            })
            .then(function(user) {
              expect(user.groups.thisGroup1).to.not.be(null);
              expect(user.groups.thisGroup1).to.not.be(undefined);
              return testServices.security.groups.deleteGroup(fetchedGroup);
            })
            .then(function() {
              return testServices.security.users.getUser('thisUser1');
            })
            .then(function(user) {
              expect(user.groups.thisGroup1).to.be(undefined);
              done();
            })
            .catch(done);
        });
      });
    });
  }
);
