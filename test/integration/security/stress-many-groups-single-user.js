const tests = require('../../__fixtures/utils/test_helper').create();

describe(tests.testName(__filename, 3), function() {
  const happn = require('../../../lib/index');
  let serviceInstance;
  let adminClient;
  let testClients = [];

  this.timeout(120000);

  const USER_COUNT = 1;
  const CLIENT_COUNT = 10;
  const GROUP_COUNT = 1000;
  const PERMISSION_COUNT = 10;

  let groups;
  let users;

  let addedgroups = [];

  function getService(config, callback) {
    happn.service.create(config, callback);
  }

  before('it starts secure service', startSecureService);
  before('it creates groups', createGroups);
  before('it creates users', createUsers);
  before('it logs in users', loginUsers);

  it('deletes groups', deleteGroups);

  after('disconnects the clients and stops the service', stopAndDisconnect);

  async function deleteGroups() {
    // eslint-disable-next-line no-console
    console.log('deleting group...');
    await serviceInstance.services.security.users.deleteGroup(addedgroups[0]);
    // eslint-disable-next-line no-console
    console.log('deleted group...');
    tests.delay(5000);
  }

  async function loginUsers() {
    for (let clientCount = 0; clientCount < CLIENT_COUNT; clientCount++) {
      await loginUser(clientCount);
    }
  }

  function randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  function randomUser() {
    if (users.length === 1) return users[0];
    return users[randomIntFromInterval(0, users.length - 1)];
  }

  function loginUser() {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const client = await happn.client.create(randomUser());
      client.on(
        `/GROUP_1/1`,
        () => {
          //do nothing
        },
        e => {
          if (e) {
            // eslint-disable-next-line no-console
            console.log('failed attaching to event' + e.message);
            return reject(e);
          }
          // eslint-disable-next-line no-console
          console.log('attached to event...');
          testClients.push(client);
          resolve();
        }
      );
    });
  }

  async function createGroups() {
    groups = [...Array(GROUP_COUNT)].map((_item, groupIndex) => getGroup(groupIndex));
    for (let group of groups) {
      var addedgroup = await serviceInstance.services.security.users.upsertGroup(group);
      addedgroups.push(addedgroup);
      // eslint-disable-next-line no-console
      if (addedgroups.length % 100 === 0) console.log(`added ${addedgroups.length} groups`);
    }
  }

  async function createUsers() {
    users = [...Array(USER_COUNT)].map((_item, userIndex) => getUser(userIndex));
    for (let user of users) {
      let addeduser = await serviceInstance.services.security.users.upsertUser(user);
      let linkedCount = 0;
      for (let addedgroup of addedgroups) {
        linkedCount++;
        // eslint-disable-next-line no-console
        if (linkedCount % 100 === 0) console.log(`linked ${linkedCount} groups`);
        await serviceInstance.services.security.users.linkGroup(addedgroup, addeduser);
      }

      // eslint-disable-next-line no-console
      console.log('linked user...');
    }
  }

  function getGroup(groupIndex) {
    return {
      name: `GROUP_${groupIndex}`,
      permissions: [...Array(PERMISSION_COUNT)]
        .map((_item, permissionIndex) => {
          return `/GROUP_${groupIndex}/${permissionIndex}`;
        })
        .reduce((permissions, permissionPath) => {
          permissions[permissionPath] = { actions: ['*'] };
          return permissions;
        }, {})
    };
  }

  function getUser(groupIndex) {
    return {
      username: `USER_${groupIndex}`,
      password: 'TEST-PWD'
    };
  }

  function startSecureService(done) {
    getService(
      {
        secure: true
      },
      function(e, service) {
        if (e) return done(e);
        serviceInstance = service;
        done();
      }
    );
  }

  function stopAndDisconnect(done) {
    this.timeout(15000);
    testClients.forEach(client => client.disconnect());
    if (adminClient) adminClient.disconnect();
    if (!serviceInstance) return done();
    setTimeout(function() {
      serviceInstance.stop(function() {
        done();
      });
    }, 3000);
  }
});
