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
  it('sets up lookup rules and tests them - nonAdmin/Least Permissive (0/3) ', async () => {
    const standardGroup = {
      name: 'STANDARD_ABC'
    };

    let standardUserGroup = await serviceInstance.services.security.groups.upsertGroup(
      standardGroup
    );

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      name: 'STANDARD_ABC',
      paths: [
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_1',
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_2'
      ]
    });

    await serviceInstance.services.security.lookupTables.insertPath(
      'STANDARD_ABC',
      '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_3'
    );
    // Enterprise admin
    await serviceInstance.services.security.groups.upsertLookupPermission(standardUserGroup.name, {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on', 'get', 'set'],
      table: 'STANDARD_ABC',
      // maps to an array of paths, companies is an array
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.company}}/{{$1}}'
    });

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');

    await serviceInstance.services.security.users.linkGroup(standardUserGroup, addedTestuser);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be(true);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_4')).to.be('unauthorized');

    await serviceInstance.services.security.lookupTables.removePath(
      'STANDARD_ABC',
      '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_3'
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');
    await serviceInstance.services.security.users.unlinkGroup(standardUserGroup, addedTestuser);
  });

  // this feature only applies to groups
  it('sets up lookup rules and tests them - Enterprise Admin - (1/3) permissivity', async () => {
    const testEnterpriseAdminGroup = {
      name: 'OEM_MANAGER_ABC'
    };

    let enterpriseAdminGroup = await serviceInstance.services.security.groups.upsertGroup(
      testEnterpriseAdminGroup
    );

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      name: 'OEM_MANAGER_ABC_LOOKUP',
      paths: [
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_1',
        '/device/OEM_ABC/COMPANY_DEF/SPECIAL_DEVICE_ID_2'
      ]
    });

    await serviceInstance.services.security.lookupTables.insertPath(
      'OEM_MANAGER_ABC_LOOKUP',
      '/device/OEM_ABC/COMPANY_GHI/SPECIAL_DEVICE_ID_3'
    );
    // Enterprise admin
    await serviceInstance.services.security.groups.upsertLookupPermission(
      enterpriseAdminGroup.name,
      {
        regex: '^/_data/historianStore/(.*)',
        actions: ['on', 'get', 'set'],
        table: 'OEM_MANAGER_ABC_LOOKUP',
        // maps to an array of paths, companies is an array
        path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
      }
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');

    await serviceInstance.services.security.users.linkGroup(enterpriseAdminGroup, addedTestuser);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be(true);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_4')).to.be('unauthorized');

    await serviceInstance.services.security.lookupTables.removePath(
      'OEM_MANAGER_ABC_LOOKUP',
      '/device/OEM_ABC/COMPANY_GHI/SPECIAL_DEVICE_ID_3'
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');
    await serviceInstance.services.security.users.unlinkGroup(enterpriseAdminGroup, addedTestuser);
  });

  it('sets up lookup rules and tests them -  oem admin groups (2/3) permissivity', async () => {
    const testOEMAdminGroup = {
      name: 'SMC_MANAGER_ABC'
    };

    let oemAdminGroup = await serviceInstance.services.security.groups.upsertGroup(
      testOEMAdminGroup
    );

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      name: 'OEM_ABC_LOOKUP',
      paths: [
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_1',
        '/device/OEM_DEF/COMPANY_GHI/SPECIAL_DEVICE_ID_2'
      ]
    });

    await serviceInstance.services.security.lookupTables.insertPath(
      'OEM_ABC_LOOKUP',
      '/device/OEM_DEF/COMPANY_DEF/SPECIAL_DEVICE_ID_3'
    );

    // OEM admin
    await serviceInstance.services.security.groups.upsertLookupPermission(oemAdminGroup.name, {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on', 'get', 'set'],
      table: 'OEM_ABC_LOOKUP',
      // maps to an array of paths, organisations is an array
      path: '/device/{{user.custom_data.organisations}}/*/{{$1}}'
    });

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');

    await serviceInstance.services.security.users.linkGroup(oemAdminGroup, addedTestuser);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be(true);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_4')).to.be('unauthorized');

    await serviceInstance.services.security.lookupTables.removePath(
      'OEM_ABC_LOOKUP',
      '/device/OEM_DEF/COMPANY_DEF/SPECIAL_DEVICE_ID_3'
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');
    await serviceInstance.services.security.users.unlinkGroup(oemAdminGroup, addedTestuser);
  });

  it('sets up lookup rules and tests them - smc Admin groups (3/3) permissivity', async () => {
    const testSMCAdminGroup = {
      name: 'SMC_ADM_ABC'
    };

    let smcAdminGroup = await serviceInstance.services.security.groups.upsertGroup(
      testSMCAdminGroup
    );

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      name: 'SMC_LOOKUP',
      paths: [
        '/device/OEM_XYZ/COMPANY_GHI/SPECIAL_DEVICE_ID_1',
        '/device/OEM_JASDA/COMPANY_BAFTA/SPECIAL_DEVICE_ID_2'
      ]
    });

    // SMC admin
    await serviceInstance.services.security.groups.upsertLookupPermission(smcAdminGroup.name, {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on', 'get', 'set'],
      table: 'SMC_LOOKUP',
      path: '/device/*/*/{{$1}}'
    });

    await serviceInstance.services.security.lookupTables.insertPath(
      'SMC_LOOKUP',
      '/device/OEM_DEF/COMPANY_DEF/SPECIAL_DEVICE_ID_3'
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');

    await serviceInstance.services.security.users.linkGroup(smcAdminGroup, addedTestuser);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be(true);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_4')).to.be('unauthorized');

    await serviceInstance.services.security.lookupTables.removePath(
      'SMC_LOOKUP',
      '/device/OEM_DEF/COMPANY_DEF/SPECIAL_DEVICE_ID_3'
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');
    await serviceInstance.services.security.users.unlinkGroup(smcAdminGroup, addedTestuser);
  });

  it('sets up lookup rules and tests them -  multiple  array values', async () => {
    const testOEMAdminGroupMultiArray = {
      name: 'SMC_MANAGER_ABC-Mulyi'
    };

    let oemAdminMultiGroup = await serviceInstance.services.security.groups.upsertGroup(
      testOEMAdminGroupMultiArray
    );

    await serviceInstance.services.security.lookupTables.upsertLookupTable({
      name: 'OEM_ABC_MULTI_LOOKUP',
      paths: [
        '/device/OEM_ABC/COMPANY_ABC/SPECIAL_DEVICE_ID_1',
        '/device/OEM_DEF/COMPANY_GHI/SPECIAL_DEVICE_ID_2'
      ]
    });

    await serviceInstance.services.security.lookupTables.insertPath(
      'OEM_ABC_MULTI_LOOKUP',
      '/device/OEM_DEF/COMPANY_DEF/SPECIAL_DEVICE_ID_3'
    );

    // OEM admin
    await serviceInstance.services.security.groups.upsertLookupPermission(oemAdminMultiGroup.name, {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on', 'get', 'set'],
      table: 'OEM_ABC_MULTI_LOOKUP',
      // maps to an array of paths, organisations is an array
      path: '/device/{{user.custom_data.organisations}}/{{user.custom_data.companies}}/{{$1}}'
    });

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be('unauthorized');
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');

    await serviceInstance.services.security.users.linkGroup(oemAdminMultiGroup, addedTestuser);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_1')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_2')).to.be(true);
    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be(true);

    test.expect(await trySetData('SPECIAL_DEVICE_ID_4')).to.be('unauthorized');

    await serviceInstance.services.security.lookupTables.removePath(
      'OEM_ABC_MULTI_LOOKUP',
      '/device/OEM_DEF/COMPANY_DEF/SPECIAL_DEVICE_ID_3'
    );

    test.expect(await trySetData('SPECIAL_DEVICE_ID_3')).to.be('unauthorized');
    await serviceInstance.services.security.users.unlinkGroup(oemAdminMultiGroup, addedTestuser);
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
        organisations: ['OEM_ABC', 'OEM_DEF'],
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
