const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  const happn = require('../../../lib/index');
  const wait = require('await-delay');
  let serviceInstance;
  let adminClient;
  let testClient;
  let user;
  function getService(config, callback) {
    happn.service.create(config, callback);
  }

  before('it starts secure service, with lockTokenToUserId switched on', function(done) {
    this.timeout(5000);
    getService(
      {
        secure: true,
        allowNestedPermissions: true,
        services: {
          security: {
            config: {}
          },
          protocol: {
            config: { allowNestedPermissions: true }
          },
          subscription: {
            config: { allowNestedPermissions: true }
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

  before('creates an admin client', async () => {
    adminClient = await serviceInstance.services.session.localClient({
      username: '_ADMIN',
      password: 'happn'
    });
  });

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

  async function initializeSecutiy(groups, userSeq, userPermissions = {}) {
    let testUser = {
      username: 'TEST' + userSeq.toString(),
      password: 'TEST PWD',
      permissions: userPermissions
    };
    let addedTestuser = await serviceInstance.services.security.users.upsertUser(testUser, {
      overwrite: true
    });
    for (let group of groups) {
      let addedGroup = await serviceInstance.services.security.users.upsertGroup(group, {
        overwrite: true
      });
      await serviceInstance.services.security.users.linkGroup(addedGroup, addedTestuser);
    }
    return addedTestuser;
  }

  async function getTestClient(groups, userSeq, userPermissions) {
    let user = await initializeSecutiy(groups, userSeq, userPermissions);
    let testClient = await serviceInstance.services.session.localClient({
      username: user.username,
      password: 'TEST PWD'
    });
    return [testClient, user];
  }

  context('on, groups', () => {
    it('we remove a duplicated permisison from one of the users groups, check user still has access', async () => {
      let testGroup = {
        name: 'TEST GROUP',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      let testGroup2 = {
        name: 'TEST GROUP2',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };
      [testClient] = await getTestClient([testGroup, testGroup2], 1);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup.name,
          '/TEST/1/2/3',
          action
        )
      );
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/3', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' });
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we remove a duplicated permisison from the users groups, check user still has access, with an allow on /* and subscription on /**', async () => {
      let testGroup3 = {
        name: 'TEST GROUP3',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          },
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };
      let testGroup4 = {
        name: 'TEST GROUP4',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup3, testGroup4], 2);

      const events = [];
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup3.name,
          '/TEST/1/2/3',
          action
        )
      );
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup4.name,
          '/TEST/1/2/3',
          action
        )
      );
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' }); // We have permission on 1/2/*
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we try to remove a permisison  which is a prohibit, should not clear prohibition', async () => {
      // tbd - possible corner cases, but we should not really neded to remove prohibitions - we can just upsert authorized: true
      let testGroup5 = {
        name: 'TEST GROUP5',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          }
        }
      };
      let testGroup6 = {
        name: 'TEST GROUP6',
        permissions: {
          '/TEST/1/2/3': {
            prohibit: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup5, testGroup6], 3);

      const events = [];

      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should not be allowed' });
      test.expect(Array.isArray(events) && events.length === 0).to.be(true);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup6.name,
          '/TEST/1/2/3',
          action
        )
      );
      await adminClient.set('/TEST/1/2/3', { test: 'should still not be allowed' });
      test.expect(Array.isArray(events) && events.length === 0).to.be(true);
    });
  });

  context('on, group and user permissions, removing group permissions', () => {
    it('we remove a duplicated permisison from one of the users groups, check user still has access', async () => {
      let testGroup = {
        name: 'TEST GROUP7',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      let userPermissions = {
        '/TEST/1/2/3': {
          actions: ['on', 'get']
        }
      };

      [testClient] = await getTestClient([testGroup], 4, userPermissions);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup.name,
          '/TEST/1/2/3',
          action
        )
      );
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/3', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' });
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we remove a duplicated permisison from one of the users groups, check user still has access, subscription on /**', async () => {
      let userPermissions = {
        '/TEST/1/2/*': {
          actions: ['on', 'get']
        }
      };

      let testGroup2 = {
        name: 'TEST GROUP8',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup2], 5, userPermissions);

      const events = [];
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup2.name,
          '/TEST/1/2/3',
          action
        )
      );
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' }); // We have permission on 1/2/*
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we try to remove a permisison  which is a prohibit, should not clear prohibition', async () => {
      // tbd - possible corner cases, but we should not really neded to remove prohibitions - we can just upsert authorized: true
      let userPermissions = {
        '/TEST/1/2/*': {
          actions: ['on', 'get']
        }
      };
      let testGroup3 = {
        name: 'TEST GROUP9',
        permissions: {
          '/TEST/1/2/3': {
            prohibit: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup3], 6, userPermissions);

      const events = [];

      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should not be allowed' });
      test.expect(Array.isArray(events) && events.length === 0).to.be(true);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup3.name,
          '/TEST/1/2/3',
          action
        )
      );
      await adminClient.set('/TEST/1/2/3', { test: 'should still not be allowed' });
      test.expect(Array.isArray(events) && events.length === 0).to.be(true);
    });
  });

  context('on, group and user permissions, removing user permissions', () => {
    it('we remove a duplicated permisison from the user, check user still has access', async () => {
      let testGroup = {
        name: 'TEST GROUP',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      let userPermissions = {
        '/TEST/1/2/3': {
          actions: ['on', 'get']
        }
      };

      [testClient, user] = await getTestClient([testGroup], 7, userPermissions);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.users.removePermission(
          user.username,
          '/TEST/1/2/3',
          action
        )
      );
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/3', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' });
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we remove a duplicated permisison the users, check user still has access, subscription on /**', async () => {
      let userPermissions = {
        '/TEST/1/2/3': {
          actions: ['on', 'get']
        }
      };

      let testGroup2 = {
        name: 'TEST GROUP2',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient, user] = await getTestClient([testGroup2], 8, userPermissions);

      const events = [];
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.users.removePermission('TEST', '/TEST/1/2/3', action)
      );
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' }); // We have permission on 1/2/*
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we try to remove a permisison  which is a prohibit, should not clear prohibition', async () => {
      // tbd - possible corner cases, but we should not really neded to remove prohibitions - we can just upsert authorized: true
      let userPermissions = {
        '/TEST/1/2/3': {
          prohibit: ['on', 'get']
        }
      };
      let testGroup3 = {
        name: 'TEST GROUP6',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient, user] = await getTestClient([testGroup3], 9, userPermissions);

      const events = [];

      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should not be allowed' });
      test.expect(Array.isArray(events) && events.length === 0).to.be(true);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.users.removePermission(
          user.username,
          '/TEST/1/2/3',
          action
        )
      );
      await adminClient.set('/TEST/1/2/3', { test: 'should still not be allowed' });
      test.expect(Array.isArray(events) && events.length === 0).to.be(true);
    });
  });

  context('get, groups', () => {
    it('we remove a duplicated permisison from one of the users groups, check user still has access', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 1 });
      let testGroup = {
        name: 'TEST GROUP',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      let testGroup2 = {
        name: 'TEST GROUP2',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };
      [testClient] = await getTestClient([testGroup, testGroup2], 10);
      let result = await testClient.get('/TEST/1/2/3');
      test.expect(result.test).to.be(1);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup.name,
          '/TEST/1/2/3',
          action
        )
      );

      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' });
      result = await testClient.get('/TEST/1/2/3');
      test.expect(result.test).to.be('should still be allowed');
    });

    it('we remove a duplicated permisison from the users groups, check user still has access, with an allow on /* and getting on /**', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 2 });
      let testGroup3 = {
        name: 'TEST GROUP3',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          },
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };
      let testGroup4 = {
        name: 'TEST GROUP4',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup3, testGroup4], 11);

      let result = await testClient.get('/TEST/1/2/*');
      test.expect(result[0].test).to.be(2);

      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup3.name,
          '/TEST/1/2/3',
          action
        )
      );
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup4.name,
          '/TEST/1/2/3',
          action
        )
      );

      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' }); // We have permission on 1/2/*
      result = await testClient.get('/TEST/1/2/**');
      test.expect(result[0].test).to.be('should still be allowed');
    });

    it('we try to remove a permisison  which is a prohibit, should not clear prohibition', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 'not allowed' });

      // tbd - possible corner cases, but we should not really neded to remove prohibitions - we can just upsert authorized: true
      let testGroup5 = {
        name: 'TEST GROUP5',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          }
        }
      };
      let testGroup6 = {
        name: 'TEST GROUP6',
        permissions: {
          '/TEST/1/2/3': {
            prohibit: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup5, testGroup6], 12);
      let errored = 0;
      await wait(1000);
      try {
        await testClient.get('/TEST/1/2/3');
      } catch (e) {
        test.expect(e.toString()).to.be('AccessDenied: unauthorized');
        errored++;
      }
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup6.name,
          '/TEST/1/2/3',
          action
        )
      );

      await adminClient.set('/TEST/1/2/3', { test: 'should still not be allowed' });

      try {
        await testClient.get('/TEST/1/2/3');
      } catch (e) {
        test.expect(e.toString()).to.be('AccessDenied: unauthorized');
        errored++;
      }
      test.expect(errored).to.be(2);
    });
  });

  context('get, group and user permissions, removing group permissions', () => {
    it('we remove a duplicated permisison from one of the users groups, check user still has access', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 1 });
      let testGroup = {
        name: 'TEST GROUP7',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      let userPermissions = {
        '/TEST/1/2/3': {
          actions: ['on', 'get']
        }
      };

      [testClient] = await getTestClient([testGroup], 13, userPermissions);

      let result = await testClient.get('/TEST/1/2/3');
      test.expect(result.test).to.be(1);

      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup.name,
          '/TEST/1/2/3',
          action
        )
      );
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' });
      result = await testClient.get('/TEST/1/2/3');
      test.expect(result.test).to.be('should still be allowed');
    });

    it('we remove a duplicated permisison from one of the users groups, check user still has access, getting on /**', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 2 });
      let userPermissions = {
        '/TEST/1/2/*': {
          actions: ['on', 'get']
        }
      };

      let testGroup2 = {
        name: 'TEST GROUP2',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup2], 14, userPermissions);
      let result = await testClient.get('/TEST/1/2/**');
      test.expect(result[0].test).to.be(2);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup2.name,
          '/TEST/1/2/3',
          action
        )
      );

      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' }); // We have permission on 1/2/*
      result = await testClient.get('/TEST/1/2/**');
      test.expect(result[0].test).to.be('should still be allowed');
    });

    it('we try to remove a permisison  which is a prohibit, should not clear prohibition', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 'not allowed' });
      let errored = 0;
      // tbd - possible corner cases, but we should not really neded to remove prohibitions - we can just upsert authorized: true
      let userPermissions = {
        '/TEST/1/2/*': {
          actions: ['on', 'get']
        }
      };
      let testGroup3 = {
        name: 'TEST GROUP6',
        permissions: {
          '/TEST/1/2/3': {
            prohibit: ['on', 'get']
          }
        }
      };

      [testClient] = await getTestClient([testGroup3], 15, userPermissions);
      await wait(1000);
      try {
        await testClient.get('/TEST/1/2/3');
      } catch (e) {
        test.expect(e.toString()).to.be('AccessDenied: unauthorized');
        errored++;
      }
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.groups.removePermission(
          testGroup3.name,
          '/TEST/1/2/3',
          action
        )
      );

      await adminClient.set('/TEST/1/2/3', { test: 'should still not be allowed' });
      let result;
      try {
        result = await testClient.get('/TEST/1/2/3');
      } catch (e) {
        test.expect(e.toString()).to.be('AccessDenied: unauthorized');
        errored++;
      }
      console.log(result);

      console.log(errored);
      test.expect(errored).to.be(2);
    });
  });

  context('get, group and user permissions, removing user permissions', () => {
    it('we remove a duplicated permisison from the user, check user still has access', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 1 });
      let testGroup = {
        name: 'TEST GROUP',
        permissions: {
          '/TEST/1/2/3': {
            actions: ['on', 'get']
          }
        }
      };

      let userPermissions = {
        '/TEST/1/2/3': {
          actions: ['on', 'get']
        }
      };

      [testClient, user] = await getTestClient([testGroup], 16, userPermissions);
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.users.removePermission(
          user.username,
          '/TEST/1/2/3',
          action
        )
      );
      const events = [];
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/3', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' });
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we remove a duplicated permisison the users, check user still has access, subscription on /**', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 2 });
      let userPermissions = {
        '/TEST/1/2/3': {
          actions: ['on', 'get']
        }
      };

      let testGroup2 = {
        name: 'TEST GROUP2',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient, user] = await getTestClient([testGroup2], 17, userPermissions);

      const events = [];
      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.users.removePermission(
          user.username,
          '/TEST/1/2/3',
          action
        )
      );
      function handler(data) {
        events.push(data);
      }
      await testClient.on('/TEST/1/2/**', handler);
      await wait(1000);
      await adminClient.set('/TEST/1/2/3', { test: 'should still be allowed' }); // We have permission on 1/2/*
      test.expect(events[0].test).to.be('should still be allowed');
    });

    it('we try to remove a permisison  which is a prohibit, should not clear prohibition', async () => {
      await adminClient.set('/TEST/1/2/3', { test: 'not allowed' });
      let errored = 0;
      // tbd - possible corner cases, but we should not really neded to remove prohibitions - we can just upsert authorized: true
      let userPermissions = {
        '/TEST/1/2/3': {
          prohibit: ['on', 'get']
        }
      };
      let testGroup3 = {
        name: 'TEST GROUP6',
        permissions: {
          '/TEST/1/2/*': {
            actions: ['on', 'get']
          }
        }
      };

      [testClient, user] = await getTestClient([testGroup3], 18, userPermissions);
      await wait(1000);
      try {
        await testClient.get('/TEST/1/2/3');
      } catch (e) {
        test.expect(e.toString()).to.be('AccessDenied: unauthorized');
        errored++;
      }

      ['on', 'get'].forEach(action =>
        serviceInstance.services.security.users.removePermission(
          user.username,
          '/TEST/1/2/3',
          action
        )
      );

      await adminClient.set('/TEST/1/2/3', { test: 'should still not be allowed' });
      let result;
      try {
        result = await testClient.get('/TEST/1/2/3');
      } catch (e) {
        test.expect(e.toString()).to.be('AccessDenied: unauthorized');
        errored++;
      }
      test.expect(errored).to.be(2);
    });
  });
});
