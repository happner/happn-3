describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const happn = require('../../../lib/index');
    let serviceInstance;
    let adminClient;
    const expect = require('expect.js');
    const test_id = Date.now() + '_' + require('shortid').generate();
    let testClient;

    function getService(config, callback) {
      happn.service.create(config, callback);
    }

    beforeEach('it starts secure service, with lockTokenToUserId switched on', function(done) {
      this.timeout(5000);
      getService(
        {
          secure: true,
          services: {
            security: {
              config: {
                updateSubscriptionsOnSecurityDirectoryChanged: true,
                lockTokenToUserId: true
              }
            }
          }
        },
        function(e, service) {
          if (e) return done(e);
          serviceInstance = service;
          serviceInstance.services.session
            .localClient({
              username: '_ADMIN',
              password: 'happn'
            })

            .then(function(clientInstance) {
              adminClient = clientInstance;
              done();
            })

            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    afterEach('should delete the temp data file', function(callback) {
      this.timeout(15000);

      if (testClient)
        testClient.disconnect({
          reconnect: false
        });
      if (adminClient)
        adminClient.disconnect({
          reconnect: false
        });

      setTimeout(function() {
        serviceInstance.stop(function() {
          callback();
        });
      }, 3000);
    });

    context('testing persisting on permissions -unlinking groups', function() {
      let addedTestGroup;
      let addedTestuser;

      let testGroup2 = {
        name: 'TEST GROUP2' + test_id,
        custom_data: {
          customString: 'custom1',
          customNumber: 0
        }
      };
      testGroup2.permissions = {};
      testGroup2.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/group/on'] = {
        actions: ['on']
      };

      var testUser = {
        username: 'TEST USER@blah.com' + test_id,
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        }
      };

      beforeEach(
        'creates a group and a user, adds the group to the user, logs in with test user',
        async () => {
          addedTestGroup = await serviceInstance.services.security.users.upsertGroup(
            testGroup2,
            {}
          );
          addedTestuser = await serviceInstance.services.security.users.upsertUser(testUser, {});

          await serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser);

          testClient = await serviceInstance.services.session.localClient({
            username: testUser.username,
            password: 'TEST PWD'
          });
        }
      );

      it('checks allowed on ', function(done) {
        testClient.on(
          '/TEST/a7_eventemitter_security_access/' + test_id + '/group/on',
          {},
          function() {},
          done
        );
      });

      it('checks not allowed on ', function(done) {
        testClient.on(
          '/TEST/a7_eventemitter_security_access/cheat/group/on',
          {},
          function() {},
          e => {
            expect(e.toString()).to.eql('AccessDenied: unauthorized');
            done();
          }
        );
      });

      it('unlinks the test group from the user, checks that the user no longer has access', function(done) {
        this.timeout(5000);
        testClient.on(
          '/TEST/a7_eventemitter_security_access/' + test_id + '/group/on',
          {},
          function() {},
          () => {
            serviceInstance.services.security.users.unlinkGroup(
              addedTestGroup,
              addedTestuser,
              function(e) {
                if (e) return done(e);

                setTimeout(function() {
                  testClient.on(
                    '/TEST/a7_eventemitter_security_access/' + test_id + '/group/on',
                    {},
                    function() {},
                    function(e) {
                      if (!e) return done(new Error('this should not have been allowed...'));
                      expect(e.toString()).to.be('AccessDenied: unauthorized');
                      done();
                    }
                  );
                }, 2000);
              }
            );
          }
        );
      });

      it('links the test group,  checks that events fire', function(done) {
        this.timeout(10000);
        let fired = false;
        serviceInstance.services.security.users
          .linkGroup(addedTestGroup, addedTestuser)
          .then(() => {
            testClient.on(
              '/TEST/a7_eventemitter_security_access/' + test_id + '/group/on',
              {},
              function() {
                fired = true;
              },
              function(e) {
                if (e) done(e);
                adminClient.set(
                  '/TEST/a7_eventemitter_security_access/' + test_id + '/group/on',
                  { prop1: 1 },
                  null,
                  function() {
                    expect(fired).to.be(true);
                    done();
                  }
                );
              }
            );
          });
      });

      it('unlinks the test group from the user, checks that events no longer fire', function(done) {
        this.timeout(10000);
        let fired = false;
        testClient.on(
          '/TEST/a7_eventemitter_security_access/' + test_id + '/group/on',
          {},
          function() {
            fired = true;
          },
          function(e) {
            if (e) done(e);
            serviceInstance.services.security.users.unlinkGroup(
              addedTestGroup,
              addedTestuser,
              function(e) {
                if (e) return done(e);
                try {
                  adminClient.set(
                    '/TEST/a7_eventemitter_security_access/' + test_id + '/group/on',
                    { prop1: 1 },
                    null,
                    function() {
                      expect(fired).to.be(false);
                      done();
                    }
                  );
                } catch (e) {
                  done(e);
                }
              }
            );
          }
        );
      });
    });

    context('testing events firing - multiple groups', function() {
      let addedTestGroup, addedTestGroup2;
      let addedTestuser;
      let testGroup1 = {
        name: 'TEST GROUP1' + test_id,
        custom_data: {
          customString: 'custom1',
          customNumber: 0
        }
      };
      testGroup1.permissions = {};
      testGroup1.permissions[
        '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on'
      ] = {
        actions: ['on']
      };
      let testGroup3 = {
        name: 'TEST GROUP3' + test_id,
        custom_data: {
          customString: 'custom1',
          customNumber: 0
        }
      };
      testGroup3.permissions = {};
      testGroup3.permissions[
        '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on'
      ] = {
        actions: ['on']
      };
      testGroup3.permissions[
        '/TEST/a7_eventemitter_security_access/' + test_id + '/2ndgrouponly/on'
      ] = {
        actions: ['on']
      };

      var testUser = {
        username: 'TEST USER4@blah.com' + test_id,
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        }
      };

      beforeEach(
        'creates a group and a user, adds the group to the user, logs in with test user',
        async () => {
          addedTestGroup = await serviceInstance.services.security.users.upsertGroup(testGroup1, {
            overwrite: false
          });
          addedTestGroup2 = await serviceInstance.services.security.users.upsertGroup(testGroup3, {
            overwrite: false
          });
          addedTestuser = await serviceInstance.services.security.users.upsertUser(testUser, {
            overwrite: false
          });

          await serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser);
          await serviceInstance.services.security.users.linkGroup(addedTestGroup2, addedTestuser);
          testClient = await serviceInstance.services.session.localClient({
            username: testUser.username,
            password: 'TEST PWD'
          });
        }
      );

      it('checks allowed on ', function(done) {
        testClient.on(
          '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
          {},
          function() {},
          done
        );
      });

      it('remove permission from  the first test group , checks that events common  to both groups still fire ', function(done) {
        this.timeout(5000);
        let fired = false;
        testClient.on(
          '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
          {},
          () => {
            fired = true;
          },
          function(e) {
            if (e) done(e);
            serviceInstance.services.security.groups
              .removePermission(
                addedTestGroup.name,
                '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
                'on'
              )
              .then(() => {
                adminClient.set(
                  '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
                  { prop1: 1 },
                  null,
                  () => {
                    expect(fired).to.be(true);
                    testClient.on(
                      '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
                      {},
                      function() {},
                      done
                    );
                  }
                );
              });
          }
        );
      });

      it('unlink from  the first test group , checks that events common  to both groups still fire ', function(done) {
        this.timeout(5000);
        let fired = false;
        testClient.on(
          '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
          {},
          () => {
            fired = true;
          },
          e => {
            if (e) done(e);
            serviceInstance.services.security.users.unlinkGroup(
              addedTestGroup2,
              addedTestuser,
              e => {
                if (e) done(e);
                try {
                  adminClient.set(
                    '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
                    { prop1: 1 },
                    null,
                    () => {
                      expect(fired).to.be(true);
                      testClient.on(
                        '/TEST/a7_eventemitter_security_access/' + test_id + '/twogroups/on',
                        {},
                        function() {},
                        done
                      );
                    }
                  );
                } catch (e) {
                  done(e);
                }
              }
            );
          }
        );
      });
    });

    context('testing persisting on permissions -user permissions', function() {
      let addedTestuser2;

      var testUser2 = {
        username: 'TEST USER2@blah.com' + test_id,
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        },
        permissions: {}
      };
      testUser2.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/user/on'] = {
        actions: ['on']
      };

      beforeEach(
        'creates a group and a user, adds the group to the user, logs in with test user',
        async () => {
          addedTestuser2 = await serviceInstance.services.security.users.upsertUser(testUser2, {});

          testClient = await serviceInstance.services.session.localClient({
            username: testUser2.username,
            password: 'TEST PWD'
          });
        }
      );

      it('removes the permission from the user, checks that the user no longer has access', function(done) {
        this.timeout(5000);

        serviceInstance.services.security.users
          .removePermission(
            addedTestuser2.username,
            '/TEST/a7_eventemitter_security_access/' + test_id + '/user/on',
            'on'
          )
          .then(() => {
            setTimeout(function() {
              testClient.on(
                '/TEST/a7_eventemitter_security_access/' + test_id + '/user/on',
                {},
                function() {},
                function(e) {
                  if (!e) return done(new Error('this should not have been allowed...'));
                  expect(e.toString()).to.be('AccessDenied: unauthorized');
                  done();
                }
              );
            }, 2000);
          });
      });

      it('removes the permission from the user, checks that events no longer fire', function(done) {
        this.timeout(10000);
        let fired = false;
        testClient.on(
          '/TEST/a7_eventemitter_security_access/' + test_id + '/user/on',
          {},
          function() {
            fired = true;
          },
          e => {
            if (e) done(e);
            serviceInstance.services.security.users
              .removePermission(
                addedTestuser2.username,
                '/TEST/a7_eventemitter_security_access/' + test_id + '/user/on',
                'on'
              )
              .then(() => {
                setTimeout(
                  () =>
                    adminClient.set(
                      '/TEST/a7_eventemitter_security_access/' + test_id + '/user/on',
                      { prop1: 1 },
                      null,
                      function() {
                        expect(fired).to.be(false);
                        done();
                      }
                    ),
                  2000
                );
              });
          }
        );
      });
    });
  }
);
