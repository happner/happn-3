describe.only(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function() {

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

  var warnings = [];

  before('it starts completely defaulted service', function(done) {

    getService({
      secure: true
    }, function(e, service) {

      if (e) return done(e);

      serviceInstance = service;

      serviceInstance.services.security.checkpoint.log.warn = function(message){
        warnings.push(message);
      };

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
      serviceInstance.stop({
        reconnect: false
      }, function() {
        callback();
      });
    }, 5000);
  });

  context('resources access testing', function() {

    var testGroup = {
      name: 'TEST GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup.permissions = {
      '/explicit/test/*': {
        actions: ['*']
      },
      '/gauges/{{user.username}}': {
        actions: ['*']
      },
      '/gauges/{{user.username}}/*': {
        actions: ['*']
      },
      '/custom/{{user.custom_data.custom_field1}}': {
        actions: ['get', 'set']
      },
      '/custom/{{user.custom_data.custom_field2}}': {
        actions: ['on', 'set']
      },
      '/forbidden/{{user.custom_data.custom_field_forbidden}}': {
        actions: ['*']
      }
    };

    var testUser = {
      username: 'TEST USER@blah.com' + test_id,
      password: 'TEST PWD',
      custom_data: {
        custom_field1: 'custom_field1_value',
        custom_field2: 'custom_field2_value',
        custom_field_forbidden: '*'
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

    it('checks we are able to access templates using {{user.username}}', function(done) {

      var username = 'TEST USER@blah.com' + test_id;

      testClient.on('/gauges/' + username, function(data) {
        expect(data.value).to.be(1);
        expect(data.gauge).to.be('logins');
        done();
      }, function(e) {
        if (e) return done(e);
        testClient.increment('/gauges/' + username, 'logins', 1, function(e) {
          if (e) return done(e);
        });
      });
    });

    it('checks we are able to access templates using {{user.custom_data.custom_field1}}', function(done) {

      testClient.set('/custom/custom_field1_value', {
        test: 'data'
      }, function(e) {
        if (e) return done(e);
        testClient.get('/custom/custom_field1_value', function(e, data){
          if (e) return done(e);
          expect(data.test).to.be('data');
          done();
        });
      });
    });

    it('checks we are able to access templates using {{user.custom_data.custom_field2}}', function(done) {

      testClient.on('/custom/custom_field2_value', function(data) {
        expect(data.test).to.be('data');
        done();
      }, function(e) {
        testClient.set('/custom/custom_field2_value', {
          test: 'data'
        }, function(e) {
          if (e) return done(e);
        });
      });
    });

    it('checks we are able to access an explicit permission', function(done) {

      var username = 'TEST USER@blah.com' + test_id;

      testClient.on('/explicit/test/*', function(data) {
        expect(data.value).to.be(1);
        done();
      }, function(e) {
        if (e) return done(e);
        testClient.set('/explicit/test/' + username, 1, function(e) {
          if (e) return done(e);
        });
      });
    });

    it('checks we are not able to access unspecified paths', function(done) {
      var username = 'TEST USER@blah.com' + test_id;

      testClient.on('/not_allowed/test/*', function(data) {
        done(new Error('unexpected access granted'));
      }, function(e) {
        if (!e) return done(new Error('unexpected access granted'));
        expect(e.toString()).to.be('AccessDenied: unauthorized');
        testClient.set('/not_allowed/test/' + username, 1, function(e) {
          if (!e) return done(new Error('unexpected access granted'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();
        });
      });
    });

    it('checks we are not able to access via a template, due to an illegal promotion exploit (* in a property of the session context)', function(done) {

      testClient.on('/forbidden/*', function(data) {
        done(new Error('unexpected access granted'));
      }, function(e) {
        if (!e) return done(new Error('unexpected access granted'));
        expect(e.toString()).to.be('AccessDenied: unauthorized');
        testClient.set('/forbidden/1', 1, function(e) {
          if (!e) return done(new Error('unexpected access granted'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          expect(warnings[0]).to.be('illegal promotion of permissions via permissions template, permissionPath/forbidden/{{user.custom_data.custom_field_forbidden}}, replaced path: /forbidden/*');
          done();
        });
      });
    });

    xit('removes a templated permission from the group, checks we are no longer able to access the path the permission relates to', function(done) {

    });

    xit('changes a custom property on the user - which should update the session, checks we are no longer able to access the path the permission relates to, but are able to access based on the new property', function(done) {

    });

    xit('removes a custom property from the user - which should update the session, checks we are no longer able to access the path the combination of permission and property value relate to', function(done) {

    });
  });
});
