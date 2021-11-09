const test = require('../../__fixtures/utils/test_helper').create();

describe(test.testName(__filename), function() {
  this.timeout(120000);
  const happn = require('../../../lib/index');
  let serviceInstance;
  let adminClient;
  let testUser;
  let addedTestuser;
  let testClient;

  it('sets up lookup rules and tests them', async () => {
    const testGroup = {
      name: 'OEM_ABC'
    };

    let upsertedGroup = await serviceInstance.services.security.groups.upsertGroup(testGroup);

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      name: 'OEM_ABC_LOOKUP',
      paths: ['/device/OEM_ABC/*/SPECIAL_DEVICE_ID_1', '/device/OEM_ABC/*/SPECIAL_DEVICE_ID_2']
    });

    await serviceInstance.services.security.lookupTables.insertPath(
      'OEM_ABC_LOOKUP',
      '/device/OEM_ABC/*/SPECIAL_DEVICE_ID_3'
    );

    await serviceInstance.services.security.groups.upsertPermission(
      testGroup.name,
      '^/_data/historianStore/(.*)',
      {
        lookup: {
          actions: ['on', 'get', 'set'],
          table: 'OEM_ABC_LOOKUP',
          path: '/device/{{user.custom_data.oem}/*/{{$1}}'
        }
      },
      true
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be('unauthorised');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be('unauthorised');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorised');
    await serviceInstance.services.security.users.linkGroup(upsertedGroup, addedTestuser);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_4')).to.be('unauthorised');
  });

  async function trySetData(deviceId) {
    try {
      await testClient.set(`/_data/historianStore/${deviceId}`, { test: 'data' });
    } catch (e) {
      return e.message;
    }
    return true;
  }

  before('it starts secure service', function(done) {
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
  });

  before('sets up the test user', async () => {
    testUser = {
      username: 'TEST',
      password: 'TEST PWD',
      custom_data: {
        oem: 'OEM_ABC'
      },
      permissions: {}
    };

    testUser.permissions['/TEMPLATED_ALLOWED/{{user.username}}/8'] = {
      actions: ['on', 'get']
    };

    addedTestuser = await serviceInstance.services.security.users.upsertUser(testUser, {
      overwrite: false
    });

    testClient = await serviceInstance.services.session.localClient({
      username: testUser.username,
      password: 'TEST PWD'
    });
  });

  before('authenticates with the _ADMIN user, using the default password', async () => {
    adminClient = await serviceInstance.services.session.localClient({
      username: '_ADMIN',
      password: 'happn'
    });
  });

  after('should delete the temp data file', function(callback) {
    this.timeout(15000);

    if (adminClient) adminClient.disconnect({ reconnect: false });

    setTimeout(function() {
      serviceInstance.stop(function() {
        callback();
      });
    }, 3000);
  });

  function getService(config, callback) {
    happn.service.create(config, callback);
  }
});
