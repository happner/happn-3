describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function() {

  var happn = require('../../../lib/index');
  var serviceInstance;
  var adminClient;
  var expect = require('expect.js');
  var test_id = Date.now() + '_' + require('shortid').generate();

  var testClient;

  var getService = function(config, callback) {
    happn.service.create(config,
      callback
    );
  };

  before('it starts completely defaulted service', function(done) {

    getService({
      secure: true
    }, function(e, service) {
      if (e) return done(e);
      serviceInstance = service;
      done();
    });
  });

  after('should delete the temp data file', function(callback) {

    this.timeout(15000);

    if (testClient) testClient.disconnect({
      reconnect: false
    });
    if (adminClient) adminClient.disconnect({
      reconnect: false
    });

    setTimeout(function() {
      serviceInstance.stop(function() {
        callback();
      });
    }, 3000);
  });

  context('login', function() {

    it('authenticates with the _ADMIN user, using the default password', function(done) {

      serviceInstance.services.session.localClient({
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

    });

    it('fails to authenticate with the _ADMIN user, using a bad password', function(done) {

      serviceInstance.services.session.localClient({
          username: '_ADMIN',
          password: 'bollocks'
        })

        .then(function() {
          done(new Error('this was not meant to happn...'));
        })

        .catch(function(e) {
          expect(e.toString()).to.be('AccessDenied: Invalid credentials');
          done();
        });

    });
  });

  context('resources access testing', function() {

    var testGroup = {
      name: 'TEST GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup.permissions = {};

    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/all_access'] = {
      actions: ['*']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/on'] = {
      actions: ['on']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/on_all/*'] = {
      actions: ['on']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/remove'] = {
      actions: ['remove']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/remove_all/*'] = {
      actions: ['remove']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/get'] = {
      actions: ['get']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/get_all/*'] = {
      actions: ['get']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/set'] = {
      actions: ['set']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/set_all/*'] = {
      actions: ['set']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/all/*'] = {
      actions: ['*']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on'] = {
      actions: ['get', 'on']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on'] = {
      actions: ['get']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/comp/on_not_get'] = {
      actions: ['on']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_get'] = {
      actions: ['set']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_on'] = {
      actions: ['set']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/remove-permission'] = {
      actions: ['set']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/prohibit-permission'] = {
      actions: ['set']
    };

    var testUser = {
      username: 'TEST USER@blah.com' + test_id,
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    var addedTestGroup;
    var addedTestuser;

    before('creates a group and a user, adds the group to the user, logs in with test user', function(done) {

      serviceInstance.services.security.users.upsertGroup(testGroup, {
        overwrite: false
      }, function(e, result) {

        if (e) return done(e);
        addedTestGroup = result;

        serviceInstance.services.security.users.upsertUser(testUser, {
          overwrite: false
        }, function(e, result) {

          if (e) return done(e);
          addedTestuser = result;

          serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function(e) {

            if (e) return done(e);

            serviceInstance.services.session.localClient({
                username: testUser.username,
                password: 'TEST PWD'
              })

              .then(function(clientInstance) {
                testClient = clientInstance;
                done();
              })

              .catch(function(e) {
                done(e);
              });

          });
        });
      });
    });

    before('adds new permissions to the upserted group', function(done) {

      testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/new_permission'] = {
        actions: ['get', 'set']
      };

      serviceInstance.services.security.users.upsertGroup(testGroup, {}, function(e, upsertedGroup) {

        if (e) return done(e);
        expect(upsertedGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/new_permission']).to.eql({
          actions: ['get', 'set']
        });
        return done();

      });
    });

    it('checks allowed on, and prevented from on', function(done) {

      testClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/on', {}, function(message) {}, function(e) {

        if (e) return done(e);

        testClient.on('/TEST/a7_eventemitter_security_access/dodge/' + test_id + '/on', {}, function(message) {

        }, function(e) {

          if (!e) return done(new Error('you managed to subscribe, which should be impossible based on your permissions'));

          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();

        });
      });
    });

    it('delegated authority: checks allowed on, and prevented from on', function(done) {

      adminClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/on', {
        onBehalfOf:testClient.session.user.username
      }, function(message) {

      }, function(e) {

        if (e) return done(e);

        adminClient.on('/TEST/a7_eventemitter_security_access/dodge/' + test_id + '/on', {
          onBehalfOf:testClient.session.user.username
        }, function(message) {

        }, function(e) {

          if (!e) return done(new Error('you managed to subscribe, which should be impossible based on your permissions'));

          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();
        });
      });
    });

    it('checks allowed set, and prevented from set', function(done) {

      testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/set', {}, function(e, result) {

        if (e) return done(e);

        expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/set');

        testClient.set('/TEST/a7_eventemitter_security_access/dodge/' + test_id + '/set', {
          test: 'test'
        }, {}, function(e, result) {

          if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();

        });
      });
    });

    it('delegated authority: checks allowed set, and prevented from set', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/set', {}, {
          onBehalfOf:testClient.session.user.username
      }, function(e, result) {

        if (e) return done(e);

        expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/set');

        adminClient.set('/TEST/a7_eventemitter_security_access/dodge/' + test_id + '/set', {
          test: 'test'
        }, {
          onBehalfOf:testClient.session.user.username
        }, function(e, result) {

          if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();

        });
      });
    });

    it('checks allowed get, and prevented from get', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);

        testClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {}, function(e, result) {

          if (e) return done(e);
          expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/get');

          testClient.get('/TEST/a7_eventemitter_security_access/dodge/' + test_id + '/get', {}, function(e, result) {

            if (!e) return done(new Error('you managed to get data which you do not have permissions for'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();

          });
        });
      });
    });

    it('delegated authority: checks allowed get, and prevented from get', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);

        adminClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {
          onBehalfOf:testClient.session.user.username
        }, function(e, result) {

          if (e) return done(e);
          expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/get');

          adminClient.get('/TEST/a7_eventemitter_security_access/dodge/' + test_id + '/get', {
            onBehalfOf:testClient.session.user.username
          }, function(e, result) {

            if (!e) return done(new Error('you managed to get data which you do not have permissions for'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();

          });
        });
      });
    });

    it('checks allowed get but not set', function(done) {

      testClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {}, function(e, result) {

        if (e) return done(e);
        expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/get');

        testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {
          test: 'test'
        }, {}, function(e, result) {
          if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();
        });
      });
    });

    it('delegated authority: checks allowed get but not set', function(done) {

      adminClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {
          onBehalfOf:testClient.session.user.username
      }, function(e, result) {

        if (e) return done(e);
        expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/get');

        adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/get', {
          test: 'test'
        }, {
            onBehalfOf:testClient.session.user.username
        }, function(e, result) {
          if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();
        });
      });
    });

    it('checks allowed get and on but not set', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);
        testClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {}, function(e, result) {

          if (e) return done(e);
          expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on');

          testClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {}, function(message) {}, function(e) {

            if (e) return done(e);

            testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {
              test: 'test'
            }, {}, function(e, result) {

              if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            });

          });
        });
      });
    });

    it('delegated authority: checks allowed get and on but not set', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);
        adminClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {
          onBehalfOf:testClient.session.user.username
        }, function(e, result) {

          if (e) return done(e);
          expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on');

          adminClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {
            onBehalfOf:testClient.session.user.username
          }, function(message) {}, function(e) {

            if (e) return done(e);

            adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_on', {
              test: 'test'
            }, {
              onBehalfOf:testClient.session.user.username
            }, function(e, result) {

              if (!e) return done(new Error('you just set data that you shouldnt have permissions to set'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            });

          });
        });
      });
    });

    it('checks allowed get but not on', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);
        testClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on', {}, function(e, result) {

          if (e) return done(e);
          expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on');

          testClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on', {}, function(message) {}, function(e) {

            if (!e) return done(new Error('this should not have been allowed...'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();

          });
        });
      });
    });

    it('delegated authority: checks allowed get but not on', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);
        adminClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on', {
          onBehalfOf:testClient.session.user.username
        }, function(e, result) {

          if (e) return done(e);
          expect(result._meta.path).to.be('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on');

          adminClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/get_not_on', {
            onBehalfOf:testClient.session.user.username
          }, function(message) {}, function(e) {

            if (!e) return done(new Error('this should not have been allowed...'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();
          });
        });
      });
    });

    it('checks allowed on but not get', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/on_not_get', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);
        testClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/on_not_get', {}, function(e, result) {

          if (!e) return done(new Error('this should not have been allowed...'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');

          testClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/on_not_get', {}, function(message) {}, done);

        });
      });
    });

    it('delegated authority: checks allowed on but not get', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/on_not_get', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);
        adminClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/on_not_get', {
          onBehalfOf:testClient.session.user.username
        }, function(e, result) {

          if (!e) return done(new Error('this should not have been allowed...'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');

          adminClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/on_not_get', {
            onBehalfOf:testClient.session.user.username
          }, function(message) {}, done);

        });
      });
    });

    it('checks allowed set but not get', function(done) {

      testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_get', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {

        if (e) return done(e);
        testClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_get', {}, function(e, result) {

          if (!e) return done(new Error('this should not have been allowed...'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();

        });
      });
    });

    it('delegated authority: checks allowed set but not get', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_get', {
        'test-set': 'test-set-val'
      }, {
        onBehalfOf:testClient.session.user.username
      }, function(e, setResult) {

        if (e) return done(e);
        adminClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_get', {
            onBehalfOf:testClient.session.user.username
        }, function(e, result) {

          if (!e) return done(new Error('this should not have been allowed...'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();

        });
      });
    });

    it('checks allowed set but not on', function(done) {

      testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_on', {
        'test-set': 'test-set-val'
      }, {}, function(e, setResult) {
        if (e) return done(e);
        testClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_on', {}, function(message) {}, function(e) {

          if (!e) return done(new Error('this should not have been allowed...'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();
        });
      });
    });

    it('delegated authority: checks allowed set but not on', function(done) {

      adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_on', {
        'test-set': 'test-set-val'
      }, {
        onBehalfOf:testClient.session.user.username
      }, function(e, setResult) {
        if (e) return done(e);
        testClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/comp/set_not_on', {
          onBehalfOf:testClient.session.user.username
        }, function(message) {}, function(e) {
          if (!e) return done(new Error('this should not have been allowed...'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();
        });
      });
    });

    it('checks allowed get all', function(done) {
      testClient.get('/TEST/a7_eventemitter_security_access/' + test_id + '/get_all/' + test_id, {}, done);
    });

    it('checks allowed on all', function(done) {
      testClient.on('/TEST/a7_eventemitter_security_access/' + test_id + '/on_all/' + test_id, {}, function(message) {}, done);
    });

    it('checks allowed set all', function(done) {
      testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/set_all/' + test_id, {
        'test-set': 'test-set-val'
      }, {}, done);
    });

    it('checks against a permission that doesnt exist', function(done) {
      testClient.get('/TEST/a7_eventemitter_security_access/whatevs' + test_id + '/get_all/' + test_id, {}, function(e, getResult) {

        if (!e) return done(new Error('this should not have been allowed...'));
        expect(e.toString()).to.be('AccessDenied: unauthorized');
        done();

      });
    });

    it('unlinks the test group from the user, checks that the user no longer has access', function(done) {

      this.timeout(5000);

      serviceInstance.services.security.users.unlinkGroup(addedTestGroup, addedTestuser, function(e) {

        if (e) return done(e);

        setTimeout(function() {

          testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/set', {
            test: 'data'
          }, {}, function(e, result) {

            if (!e) return done(new Error('this should not have been allowed...'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();
          });

        }, 2000);
      });
    });

    it('re-links the test group to the test user, tests we have access again', function(done) {

      this.timeout(5000);

      serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function(e) {

        if (e) return done(e);

        setTimeout(function() {

          testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/set', {
            test: 'data'
          }, {}, done);

        }, 2000);
      });
    });

    it('tests the remove permission', function(done) {

      testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/remove-permission', {
        test: 'data'
      }, function(e, result) {

        if (e) return done(e);

        //groupName, path, action
        serviceInstance.services.security.groups.removePermission(addedTestGroup.name, '/TEST/a7_eventemitter_security_access/' + test_id + '/remove-permission', 'set')
          .then(function() {

            testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/remove-permission', {
              test: 'data'
            }, function(e, result) {
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            });
          })
          .catch(done);
      });
    });

    it('tests the upsert permission', function(done) {

      serviceInstance.services.security.groups.upsertPermission(addedTestGroup.name, '/TEST/a7_eventemitter_security_access/' + test_id + '/remove-permission', 'set')
        .then(function() {

          testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/remove-permission', {
            test: 'data'
          }, done);
        })
        .catch(done);
    });


    it('tests the prohibit permission', function(done) {

      var prohibitPath = '/TEST/a7_eventemitter_security_access/' + test_id + '/prohibit-permission';

      testClient.set(prohibitPath, {
        test: 'data'
      }, function(e, result) {

        if (e) return done(e);

        delete addedTestGroup.permissions[prohibitPath].actions;
        addedTestGroup.permissions[prohibitPath].prohibit = ['set'];

        //groupName, path, action
        serviceInstance.services.security.groups.upsertGroup(addedTestGroup)
          .then(function() {

            testClient.set(prohibitPath, {
              test: 'data'
            }, function(e, result) {
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            });
          })
          .catch(done);
      });
    });

    it('deletes the test user, tests we are notified about the session closure, then have no access, on delegated authority as well', function(done) {

      testClient.onSystemMessage(function(eventType, data) {

        if (eventType == 'server-side-disconnect') {

          testClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/set', {
            test: 'data'
          }, {}, function(e) {

            if (!e) return done(new Error('this should not have been allowed...'));
            expect(e.toString()).to.be('Error: client is disconnected');

            adminClient.set('/TEST/a7_eventemitter_security_access/' + test_id + '/set', {test:'data'}, {
              onBehalfOf:testClient.session.user.username
            }, function(e){
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            })
          });
        }
      });

      serviceInstance.services.security.users.deleteUser(addedTestuser, function(e) {
        if (e) return done(e);
      });
    });
  });
});
