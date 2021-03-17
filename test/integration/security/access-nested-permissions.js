const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  const happn = require('../../../lib/index');
  let serviceInstance;
  let adminClient;
  let testClient;

  function getService(config, callback) {
    happn.service.create(config, callback);
  }

  before('it starts secure service, with lockTokenToUserId switched on', function(done) {
    this.timeout(5000);
    getService(
      {
        secure: true,
        services: {
          security: {
            config: {}
          }
        }
      },
      function(e, service) {
        if (e) return done(e);
        serviceInstance = service;
        done();
      }
    );
  });

  let addedTestGroup;
  let addedTestuser;

  before(
    'creates a group and a user, adds the group to the user, logs in with test user',
    async () => {
      let testGroup2 = {
        name: 'TEST GROUP'
      };
      testGroup2.permissions = {};

      testGroup2.permissions['/TEST/1/2/3'] = {
        actions: ['on', 'get']
      };

      testGroup2.permissions['/TEST/2/3/*'] = {
        actions: ['on', 'get']
      };

      testGroup2.permissions['/ALLOWED/*'] = {
        actions: ['on', 'get']
      };

      addedTestGroup = await serviceInstance.services.security.users.upsertGroup(testGroup2, {
        overwrite: false
      });

      const testUser = {
        username: 'TEST',
        password: 'TEST PWD'
      };

      addedTestuser = await serviceInstance.services.security.users.upsertUser(testUser, {
        overwrite: false
      });

      await serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser);

      testClient = await serviceInstance.services.session.localClient({
        username: testUser.username,
        password: 'TEST PWD'
      });

      adminClient = await serviceInstance.services.session.localClient({
        username: '_ADMIN',
        password: 'happn'
      });
    }
  );

  after('should disconnect', function(callback) {
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

  context('get', function() {
    it('gets data from an allowed set of nested permissions', async () => {
      await adminClient.set('/ALLOWED/0', { test: 0 });
      await adminClient.set('/TEST/1/2/3', { test: 1 });
      await adminClient.set('/TEST/2/3/4/5/6', { test: 2 });

      let results = await testClient.get('/ALLOWED/**');
      test.expect(results[0].test).to.be(0);

      results = await testClient.get('/TEST/**');
      test.expect(results[0].test).to.be(1);
      test.expect(results[1].test).to.be(2);
    });
  });

  context('events', function() {
    it('gets data from an allowed set of nested permissions', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }

      await testClient.on('/ALLOWED/**', handler);

      await adminClient.set('/ALLOWED/0', { test: 0 });

      await test.delay(2000);

      test.expect(events[0].test).to.be(0);

      await testClient.on('/TEST/**', handler);

      await adminClient.set('/TEST/1/2/3', { test: 1 });
      await adminClient.set('/TEST/2/3/4/5/6', { test: 2 });

      await test.delay(2000);

      test.expect(events[1].test).to.be(1);
      test.expect(events[2].test).to.be(2);

      await testClient.offAll();
    }).timeout(10000);
  });
});
