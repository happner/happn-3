const test = require('../../__fixtures/utils/test_helper').create();

describe(test.testName(__filename), function() {
  this.timeout(120000);
  const happn = require('../../../lib/index');
  let serviceInstance;
  let adminClient;
  let testUser;
  let addedTestuser;
  let testClient;

  // this feature only applies to groups
  it('sets up lookup rules and tests them - groups', async () => {
    const testEnterpriseAdminGroup = {
      name: 'ENTERPRISE_ADM_ABC'
    };
    const testOEMAdminGroup = {
      name: 'OEM_ADM_ABC'
    };
    const testSMCAdminGroup = {
      name: 'SMC_ADM_ABC'
    };

    let enterpriseAdminGroup = await serviceInstance.services.security.groups.upsertGroup(
      testEnterpriseAdminGroup
    );
    let oemAdminGroup = await serviceInstance.services.security.groups.upsertGroup(
      testOEMAdminGroup
    );
    let smcAdminGroup = await serviceInstance.services.security.groups.upsertGroup(
      testSMCAdminGroup
    );

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      // /_SYSTEM/_SECURITY/LOOKUP TABLES/{LOOKUP TABLE}/{LOOKUP  PATH}
      name: 'OEM_ABC_LOOKUP',
      // /_SYSTEM/_SECURITY/LOOKUP PATHS/{LOOKUP TABLE}/{LOOKUP  PATH}
      paths: [
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_1',
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_2'
      ]
    });

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      // /_SYSTEM/_SECURITY/LOOKUP TABLES/{LOOKUP TABLE}/{LOOKUP  PATH}
      name: 'SMC_LOOKUP',
      // /_SYSTEM/_SECURITY/LOOKUP PATHS/{LOOKUP TABLE}/{LOOKUP  PATH}
      paths: [
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_1',
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_2'
      ]
    });

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      // /_SYSTEM/_SECURITY/LOOKUP TABLES/{LOOKUP TABLE}/{LOOKUP  PATH}
      name: 'COMPANY_ABC_LOOKUP',
      // /_SYSTEM/_SECURITY/LOOKUP PATHS/{LOOKUP TABLE}/{LOOKUP  PATH}
      paths: [
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_1',
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_2'
      ]
    });

    await serviceInstance.services.security.lookupTables.insertPath(
      'COMPANY_ABC_LOOKUP',
      '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_3'
    );
    // Enterprise admin
    await serviceInstance.services.security.groups.upsertLookupPermission(
      enterpriseAdminGroup.name,
      {
        regex: '^/_data/historianStore/(.*)',
        actions: ['on', 'get', 'set'],
        table: 'COMPANY_ABC_LOOKUP',
        // maps to an array of paths, companies is an array
        path: '/device/{{user.custom_data.oem}}/{{user.custom_data.company}}/{{$1}}'
      }
    );

    // await serviceInstance.services.security.groups.upsertLookupPermission(
    //   enterpriseAdminGroup.name,
    //   {
    //     regex: '^/_data/historianStore/(.*)',
    //     actions: ['on', 'get', 'set'],
    //     table: 'COMPANY_ABC_LOOKUP',
    //     // maps to an array of paths, companies is an array
    //     path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    //   }
    // );

    // OEM admin
    await serviceInstance.services.security.groups.upsertLookupPermission(oemAdminGroup.name, {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on', 'get', 'set'],
      table: 'OEM_ABC_LOOKUP',
      // maps to an array of paths, organisations is an array
      path: '/device/{{user.custom_data.organisations}}/*/{{$1}}'
    });

    // SMC admin
    await serviceInstance.services.security.groups.upsertLookupPermission(smcAdminGroup.name, {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on', 'get', 'set'],
      table: 'OEM_ABC_LOOKUP',
      path: '/device/*/*/{{$1}}'
    });

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');

    await serviceInstance.services.security.users.linkGroup(enterpriseAdminGroup, addedTestuser);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be(true);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_4')).to.be('unauthorized');

    await serviceInstance.services.security.lookupTables.removePath(
      'COMPANY_ABC_LOOKUP',
      '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_3'
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');
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
        oem: 'OEM_ABC',
        company: 'COMPANY_ABC',
        companies: ['COMPANY_ABC', 'COMPANY_DEF', 'COMPANY_GHI']
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
