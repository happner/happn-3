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
  let addedTestGroup2;
  let addedTestGroup3;

  let addedTestuser;

  before(
    'creates a group and a user, adds the group to the user, logs in with test user',
    async () => {
      let testGroup = {
        name: 'TEST GROUP',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          },
          '/TEST/2/3/*': {
            actions: ['on', 'get']
          },
          '/TEST/2/3/4/5': {
            prohibit: ['on', 'get']
          },
          '/TEST/5/6': {
            actions: ['on', 'get']
          },
          '/TEST/5/6/*': {
            prohibit: ['on', 'get']
          },
          '/TEST/5/6/7/9': {
            actions: ['on', 'get']
          },
          '/TEST/7/8': {
            actions: ['on', 'get']
          },
          '/ALLOWED/*': {
            actions: ['on', 'get']
          },
          '/TEMPLATED/{{user.username}}/1/2': {
            actions: ['on', 'get']
          }
        }
      };
      let testGroup2 = {
        name: 'TEST GROUP2',
        permissions: {
          '/TEST/2/3/5/6': {
            prohibit: ['on', 'get']
          }
        }
      };

      let testGroup3 = {
        name: 'TEST GROUP3',
        permissions: {
          '/TEST/1/2/3/4': {
            actions: ['on', 'get']
          }
        }
      };

      addedTestGroup = await serviceInstance.services.security.users.upsertGroup(testGroup, {
        overwrite: false
      });

      addedTestGroup2 = await serviceInstance.services.security.users.upsertGroup(testGroup2, {
        overwrite: false
      });

      addedTestGroup3 = await serviceInstance.services.security.users.upsertGroup(testGroup3, {
        overwrite: false
      });

      const testUser = {
        username: 'TEST',
        password: 'TEST PWD',
        permissions: {}
      };

      testUser.permissions['/TEMPLATED_ALLOWED/{{user.username}}/8'] = {
        actions: ['on', 'get']
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
      await adminClient.set('/TEST/4/5/6', { test: 3 });
      await adminClient.set('/TEMPLATED/TEST/1/2', { test: 4 });
      await adminClient.set('/TEST/5/6', { test: 5 });
      await adminClient.set('/TEST/5/6/7', { test: 7 });
      await adminClient.set('/TEST/5/6/7/9', { test: 9 });

      //allowed templated user permission
      await adminClient.set('/TEMPLATED_ALLOWED/TEST/8', { test: 8 });

      let results = await testClient.get('/ALLOWED/**');
      test.expect(results[0].test).to.be(0);

      results = await testClient.get('/TEMPLATED_ALLOWED/TEST/8');
      test.expect(results.test).to.be(8);

      results = await testClient.get('/TEST/**');
      test.expect(results[0].test).to.be(1);
      test.expect(results[1].test).to.be(2);
      test.expect(results[2].test).to.be(5);
      test.expect(results.length).to.be(3);

      try {
        results = await testClient.get('/TEST/5/6/*');
        throw new Error('Should not be authorized');
      } catch (e) {
        test.expect(e instanceof Error).to.be(true);
        test.expect(e.message).to.eql('unauthorized');
      }

      try {
        results = await testClient.get('/TEST/5/6/7/9');
        throw new Error('Should not be authorized');
      } catch (e) {
        test.expect(e instanceof Error).to.be(true);
        test.expect(e.message).to.eql('unauthorized');
      }

      results = await testClient.get('/TEMPLATED/TEST/**');
      test.expect(results[0].test).to.be(4);
    });
  }).timeout(5000);

  context('events', function() {
    it('recieves events from an allowed set of nested permissions', async () => {
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

      await adminClient.set('/TEST/4/5/6', { test: 'not-subscribed' });
      await test.delay(4000);

      test.expect(events[1].test).to.be(1);
      test.expect(events[2].test).to.be(2);
      test.expect(events.length).to.be(3);
      await testClient.offAll();
    }).timeout(10000);

    it("further recieves events from an allowed set of nested permissions - checking that we don't recieve prohibited events", async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/**', handler);
      await test.delay(2000);
      await adminClient.set('/TEST/1/2/3', { test: 1 });
      await adminClient.set('/TEST/2/3/4/5', { test: 'PROHIBITED' });

      await adminClient.set('/TEST/2/3/4/5/6', { test: 2 });
      await adminClient.set('/TEST/5/6/7', { test: 'PROHIBITED' });
      await test.delay(4000);

      test.expect(events[0].test).to.be(1);
      test.expect(events[1].test).to.be(2);
      test.expect(events.length).to.be(2);
      await testClient.offAll();
    }).timeout(10000);
  });

  context('events - changing permissions', function() {
    it('Links and unlinks a group with prohibitions, and checks that events are recieved correctly', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }

      await testClient.on('/TEST/2/3/**', handler);

      await adminClient.set('/TEST/2/3/7/7', { test: 1 });

      await adminClient.set('/TEST/2/3/5/6', { test: 'not-prohibited' });

      await test.delay(1000);

      test.expect(events[0].test).to.be(1);
      test.expect(events[1].test).to.be('not-prohibited');
      test.expect(events.length).to.be(2);
      await serviceInstance.services.security.users.linkGroup(addedTestGroup2, addedTestuser);
      await test.delay(1000);
      await adminClient.set('/TEST/2/3/5/6', { test: 'PROHIBITED' });

      await test.delay(1000);
      test.expect(events.length).to.be(2);
      await serviceInstance.services.security.users.unlinkGroup(addedTestGroup2, addedTestuser);
      await test.delay(1000);

      await adminClient.set('/TEST/2/3/5/6', { test: 'not prohibited anymore' });
      await test.delay(1000);

      test.expect(events.length).to.be(3);
      test.expect(events[2].test).to.be('not prohibited anymore');

      await testClient.offAll();
    }).timeout(10000);

    it('Links and unlinks a group with permissions to a subpath of a wild path we have subscribed to (1/2/3/4 after subscribing to 1/2/**), and checks that events are recieved correctly', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);

      await adminClient.set('/TEST/1/2/3', { test: 1 });
      await adminClient.set('/TEST/1/2/3/4', { test: 'not-allowed' });
      await test.delay(1000);
      test.expect(events[0].test).to.be(1);
      test.expect(events.length).to.be(1);
      await serviceInstance.services.security.users.linkGroup(addedTestGroup3, addedTestuser);
      await test.delay(1000);
      await adminClient.set('/TEST/1/2/3/4', { test: 'now allowed' });
      await test.delay(1000);

      test.expect(events[1].test).to.be('now allowed');
      test.expect(events.length).to.be(2);
      await serviceInstance.services.security.users.unlinkGroup(addedTestGroup3, addedTestuser);
      await test.delay(1000);
      await adminClient.set('/TEST/2/3/5/6', { test: 'not allowed anymore' });
      await test.delay(1000);
      test.expect(events.length).to.be(2);

      await testClient.offAll();
    }).timeout(10000);

    it('upserts and removes prohibitions to a group, and checks that events are recieved correctly', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }

      await testClient.on('/TEST/2/3/**', handler);

      await adminClient.set('/TEST/2/3/7/7', { test: 1 });

      await adminClient.set('/TEST/2/3/5/6', { test: 'not-prohibited' });

      await test.delay(1000);

      test.expect(events[0].test).to.be(1);

      test.expect(events[1].test).to.be('not-prohibited');
      test.expect(events.length).to.be(2);
      await serviceInstance.services.security.groups.upsertPermission(
        addedTestGroup.name,
        '/TEST/2/3/5/6',
        'on',
        false
      );
      await test.delay(1000);
      await adminClient.set('/TEST/2/3/5/6', { test: 'PROHIBITED' });
      await test.delay(1000);
      test.expect(events.length).to.be(2);

      await serviceInstance.services.security.groups.upsertPermission(
        addedTestGroup.name,
        '/TEST/2/3/5/6',
        'on',
        true
      );

      await test.delay(1000);
      await adminClient.set('/TEST/2/3/5/6', { test: 'not prohibited anymore' });
      await test.delay(1000);

      test.expect(events.length).to.be(3);
      test.expect(events[2].test).to.be('not prohibited anymore');
      await testClient.offAll();
    }).timeout(10000);

    it('upserts and removes group permissions to a subpath of a wild path we have subscribed to (1/2/3/4 after subscribing to 1/2/**), and checks that events are recieved correctly', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }

      await testClient.on('/TEST/1/2/**', handler);

      await adminClient.set('/TEST/1/2/3', { test: 1 });
      await adminClient.set('/TEST/1/2/3/4', { test: 'not-allowed' });
      await test.delay(1000);
      test.expect(events[0].test).to.be(1);
      test.expect(events.length).to.be(1);
      await serviceInstance.services.security.groups.upsertPermission(
        addedTestGroup.name,
        '/TEST/1/2/3/4',
        'on',
        true
      );
      await test.delay(1000);
      await adminClient.set('/TEST/1/2/3/4', { test: 'now allowed' });
      await test.delay(1000);
      test.expect(events[1].test).to.be('now allowed');
      test.expect(events.length).to.be(2);
      await serviceInstance.services.security.groups.removePermission(
        addedTestGroup.name,
        '/TEST/1/2/3/4',
        'on'
      );
      await test.delay(1000);
      await adminClient.set('/TEST/1/2/3/4', { test: 'not allowed anymore' });
      await test.delay(1000);
      test.expect(events.length).to.be(2);

      await testClient.offAll();
    }).timeout(10000);

    it('upserts and removes prohibitions to a user, and checks that events are recieved correctly', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }

      await testClient.on('/TEST/2/3/**', handler);

      await adminClient.set('/TEST/2/3/7/7', { test: 1 });

      await adminClient.set('/TEST/2/3/5/6', { test: 'not-prohibited' });

      await test.delay(1000);

      test.expect(events[0].test).to.be(1);

      test.expect(events[1].test).to.be('not-prohibited');
      test.expect(events.length).to.be(2);
      await serviceInstance.services.security.users.upsertPermission(
        'TEST',
        '/TEST/2/3/5/6',
        'on',
        false
      );
      await test.delay(1000);
      await adminClient.set('/TEST/2/3/5/6', { test: 'PROHIBITED' });
      await test.delay(1000);
      test.expect(events.length).to.be(2);

      await serviceInstance.services.security.users.upsertPermission(
        'TEST',
        '/TEST/2/3/5/6',
        'on',
        true
      );
      await test.delay(1000);
      await adminClient.set('/TEST/2/3/5/6', { test: 'not prohibited anymore' });
      await test.delay(1000);

      test.expect(events.length).to.be(3);
      test.expect(events[2].test).to.be('not prohibited anymore');
      await testClient.offAll();
    }).timeout(10000);

    it('upserts and removes user permissions to a subpath of a wild path we have subscribed to (1/2/3/4 after subscribing to 1/2/**), and checks that events are recieved correctly', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);

      await adminClient.set('/TEST/1/2/3', { test: 1 });
      await adminClient.set('/TEST/1/2/3/4', { test: 'not-allowed' });
      await test.delay(1000);
      test.expect(events[0].test).to.be(1);
      test.expect(events.length).to.be(1);
      await serviceInstance.services.security.users.upsertPermission(
        'TEST',
        '/TEST/1/2/3/4',
        'on',
        true
      );
      await test.delay(1000);
      await adminClient.set('/TEST/1/2/3/4', { test: 'now allowed' });
      await test.delay(1000);
      test.expect(events[1].test).to.be('now allowed');
      test.expect(events.length).to.be(2);
      await serviceInstance.services.security.users.removePermission('TEST', '/TEST/1/2/3/4', 'on');
      await test.delay(1000);
      await adminClient.set('/TEST/1/2/3/4', { test: 'not allowed anymore' });
      await test.delay(1000);
      test.expect(events.length).to.be(2);

      await testClient.offAll();
    }).timeout(10000);

    it('checks there are no collisions between a/b and a/b/*', async () => {
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/7/**', handler);
      await adminClient.set('/TEST/7/8', { test: 1 });
      await adminClient.set('/TEST/7/8/9', { test: 'not listening' });
      await test.delay(1000);

      test.expect(events[0].test).to.be(1);
      test.expect(events.length).to.be(1);

      await serviceInstance.services.security.groups.upsertPermission(
        addedTestGroup.name,
        '/TEST/7/8/*',
        'on',
        false
      );
      await adminClient.set('/TEST/7/8', { test: 'should still be allowed' });
      await test.delay(1000);
      test.expect(events.length).to.be(2);
      test.expect(events[1].test).to.be('should still be allowed');
      await testClient.offAll();
    }).timeout(10000);
  });
});
