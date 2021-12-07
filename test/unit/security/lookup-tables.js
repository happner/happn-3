const sinon = require('sinon');
const DataService = require('../../../lib/services/data/service');
const CacheService = require('../../../lib/services/cache/service');

const LookupTables = require('../../../lib/services/security/lookup-tables');
const test = require('../../__fixtures/utils/test_helper').create();
const wait = require('await-delay');
const path = require('path');
const fs = require('fs');

describe(test.testName(__filename, 3), function() {
  var Logger = require('happn-logger');
  const util = require('util');
  let mockErrorService;
  let dbPath = path.resolve(__dirname, '../../__fixtures/test/test_lookup_db');
  let stripLeadingSlashes;
  let lookupTables;

  before('01. Sets up errorService', done => {
    const ErrorService = require('../../../lib/services/error/service');
    mockErrorService = new ErrorService({
      logger: Logger
    });
    mockErrorService.handleFatal = function(message, e) {
      throw e;
    };
    done();
  });

  let mockHappn = {
    services: {
      error: mockErrorService,
      log: Logger,
      util,
      security: { dataChanged: () => {} }
    }
  };

  before('Sets up cacheService', done => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    var mockCacheService = new CacheService({
      logger: Logger
    });
    mockCacheService.happn = mockHappn;
    mockHappn.services.cache = mockCacheService;

    mockCacheService.initialize(done);
  });

  before('Sets up dataService', done => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    var mockDataService = new DataService({
      logger: Logger
    });
    mockHappn.services.data = mockDataService;
    mockDataService.happn = mockHappn;
    mockDataService.__updateDatabaseVersions = () => {};
    mockDataService.initialize({ filename: dbPath }, done);
  });

  after('deletes test DB', done => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    done();
  });

  it('Can create an instance of LookupTables (new operator)', done => {
    let lookupTables = new LookupTables();
    test.expect(lookupTables).to.be.ok();
    done();
  });

  it('Can create an instance of LookupTables (create Method)', done => {
    let lookupTables = LookupTables.create();
    test.expect(lookupTables).to.be.ok();
    done();
  });

  it('Can initialize an instance of LookupTables', done => {
    let initializedLookupTables = LookupTables.create();
    initializedLookupTables.initialize(mockHappn);
    test.expect(initializedLookupTables).to.be.ok();
    lookupTables = initializedLookupTables;
    stripLeadingSlashes = lookupTables.__stripLeadingSlashes;
    done();
  });

  it('Can insert a path into a lookupTable (creatng table)', async () => {
    await lookupTables.insertPath('newUpsertTable', '/1/2/3');
    let stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newUpsertTable/1/2/3'
    );
    test.expect(stored.data).to.eql({ authorized: true });
  });

  it('Can upsert a lookupTable', async () => {
    let table = {
      name: 'upsertFullTable',
      paths: ['1/2/3', '/4/5/6', '/7/8/9'] //Inconsitency deliberate
    };
    await lookupTables.upsertLookupTable(table);
    for (let lookupPath of table.paths) {
      let testPath = lookupPath.replace(/^\//, '');
      let stored = await mockHappn.services.data.get(
        `/_SYSTEM/_SECURITY/_LOOKUP/upsertFullTable/${testPath}`
      );
      test.expect(stored.data).to.eql({ authorized: true });
    }
  });

  it('Can insert a path into a lookupTable (table already exists)', async () => {
    let table = {
      name: 'upsertNewPath',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    };
    await lookupTables.upsertLookupTable(table);
    let stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/upsertNewPath/1/2/3'
    );
    test.expect(stored.data).to.eql({ authorized: true });
    stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/upsertNewPath/10/11/12');
    test.expect(stored).to.not.be.ok();
    await lookupTables.insertPath('upsertNewPath', '/10/11/12');
    stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/upsertNewPath/10/11/12');
    test.expect(stored.data).to.eql({ authorized: true });
  });

  it('If we upsert a lookupTable with the same name as an already existing one, paths are merged', async () => {
    let table = {
      name: 'upsertOverTable',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    };
    let table2 = {
      name: 'upsertOverTable',
      paths: ['a/b/c', 'd/e/f']
    };
    await lookupTables.upsertLookupTable(table);
    await lookupTables.upsertLookupTable(table2);

    for (let lookupPath of table.paths.concat(table2.paths)) {
      let testPath = lookupPath.replace(/^\//, '');
      let stored = await mockHappn.services.data.get(
        `/_SYSTEM/_SECURITY/_LOOKUP/upsertOverTable/${testPath}`
      );
      test.expect(stored.data).to.eql({ authorized: true });
    }
  });

  it('Can remove a path from a lookupTable', async () => {
    let table = {
      name: 'removeTable',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    };
    await lookupTables.upsertLookupTable(table);
    let stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/removeTable/1/2/3');
    test.expect(stored.data).to.eql({ authorized: true });

    await lookupTables.removePath('removeTable', '/1/2/3');
    await wait(500);
    stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/removeTable/1/2/3');
    test.expect(stored).to.not.be.ok();
  });

  it('Should not error if we try to remove a non-existent path', async () => {
    await lookupTables.removePath('nonExistentTable', '/1/2/3');
  });

  it('Can extract a path (table name not repeated)', done => {
    let path = '/domain/component/tableName/1/2/3/4';
    test.expect(lookupTables.__extractPath(path, 'tableName')).to.eql('1/2/3/4');
    done();
  });

  it('Can extract a path (table name repeated)', done => {
    // This is unlikely, but I guess it could happen??
    let path = '/domain/component/tableName/1/2/3/tableName/5/6/7';
    test.expect(lookupTables.__extractPath(path, 'tableName')).to.be('1/2/3/tableName/5/6/7');
    done();
  });

  it('Can fetch a lookupTable', async () => {
    await lookupTables.upsertLookupTable({
      name: 'fetchTable',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    });

    let table = await lookupTables.fetchLookupTable('fetchTable');
    test.expect(table).to.eql({
      name: 'fetchTable',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    });
    let longtable = {
      name: 'longtable',
      paths: ['1/2/3', '4/5/6', '7/8/9', 'extremely/very/long/path/1/2/3/4/5/6/7/8']
    };
    await lookupTables.upsertLookupTable(longtable);
    table = await lookupTables.fetchLookupTable('longtable');
    test.expect(table).to.eql(longtable);
  });

  it('tests the __storePermissions function', async () => {
    let permissions = [{ table: 'someTable', other: 'details' }];
    await lookupTables.__storePermissions('someGroup', permissions, 'someTable');
    let storedGxT = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/someTable/someGroup`
    );
    let storedTxG = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/someGroup/someTable`
    );
    test.expect(storedGxT).to.be.ok();
    test.expect(storedGxT.data).to.eql({});
    test.expect(storedTxG).to.be.ok();
    test.expect(storedTxG.data).to.eql({ permissions });
  });

  it('Can Fetch Groups by table', async () => {
    let permissions = [
      { table: 'tableGxT1', other: 'details' },
      { table: 'tableGxT2', other: 'details' }
    ];
    await lookupTables.__storePermissions('groupGxT1', permissions, 'tableGxT1');
    await lookupTables.__storePermissions('groupGxT2', permissions, 'tableGxT1');
    await lookupTables.__storePermissions('groupGxT3', permissions, 'tableGxT2');
    test
      .expect(await lookupTables.__getGroupsByTable('tableGxT1'))
      .to.eql(['groupGxT1', 'groupGxT2']);
    test.expect(await lookupTables.__getGroupsByTable('tableGxT2')).to.eql(['groupGxT3']);
    test.expect(await lookupTables.__getGroupsByTable('notATableInDB')).to.eql([]);
  });

  it('Can upsert a group lookup permission', async () => {
    let permission = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on', 'get', 'set'],
      table: 'COMPANY_ABC_LOOKUP',
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    };
    await lookupTables.upsertLookupPermission('testGroup', permission); //Group need not exist to upsert a lookup permission. Is this an issue?
    let stored = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/testGroup/COMPANY_ABC_LOOKUP`
    );
    test.expect(stored.data.permissions).to.eql([permission]);
    let stored2 = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/COMPANY_ABC_LOOKUP/testGroup`
    );
    test
      .expect(stored2._meta.path)
      .to.be(`/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/COMPANY_ABC_LOOKUP/testGroup`);
  });

  it('Can upsert multiple lookup permissions to the same group and table', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'TABLE1',
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    };

    let permission2 = {
      regex: '^/_data/historianStore/device1/(.*)',
      actions: ['get'],
      table: 'TABLE1',
      path: '/device/blah/blah/{{$1}}'
    };
    await lookupTables.upsertLookupPermission('testGroup2', permission1);
    await lookupTables.upsertLookupPermission('testGroup2', permission2);

    let stored = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/testGroup2/TABLE1`
    );
    test.expect(stored.data.permissions).to.eql([permission1, permission2]);
    let stored2 = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/TABLE1/testGroup2`
    );
    test
      .expect(stored2._meta.path)
      .to.be(`/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/TABLE1/testGroup2`);
  });

  it('If we upsert the same permission multiple times we dont store it again (avoid data bloat)', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'TABLE2',
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    };

    let permission2 = JSON.parse(JSON.stringify(permission1));
    await lookupTables.upsertLookupPermission('testGroup3', permission1);
    await lookupTables.upsertLookupPermission('testGroup3', permission2);

    let stored = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/testGroup3/TABLE2`
    );
    test.expect(stored.data.permissions.length).to.be(1);
    test.expect(stored.data.permissions).to.eql([permission2]);
    let stored2 = await mockHappn.services.data.get(
      `/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/TABLE2/testGroup3`
    );
    test
      .expect(stored2._meta.path)
      .to.be(`/_SYSTEM/_SECURITY/_PERMISSIONS/_LOOKUP/TABLE2/testGroup3`);
  });

  it('Can fetch all of a groups lookup permissions', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'testTable1',
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    };

    let permission2 = {
      regex: '^/_data/historianStore/device1/(.*)',
      actions: ['get'],
      table: 'testTable1',
      path: '/device/blah/blah/{{$1}}'
    };

    let permission3 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['get', 'on'],
      table: 'testTable2',
      path: '/device/another/{user.company}/{{$1}}'
    };
    await lookupTables.upsertLookupPermission('testGroup4', permission1);
    await lookupTables.upsertLookupPermission('testGroup4', permission2);
    await lookupTables.upsertLookupPermission('testGroup4', permission3);

    let stored = await lookupTables.__fetchGroupLookupPermissions('testGroup4');
    test.expect(stored).to.eql([permission1, permission2, permission3]);
  });

  it('Can remove a groups lookup permissions', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'removeTable1',
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    };
    let permission2 = {
      regex: '^/_data/historianStore/device1/(.*)',
      actions: ['get'],
      table: 'removeTable2',
      path: '/device/blah/blah/{{$1}}'
    };

    let permission3 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['get', 'on'],
      table: 'removeTable1',
      path: '/device/another/{user.company}/{{$1}}'
    };
    await lookupTables.upsertLookupPermission('testRemoveGroup', permission1);
    await lookupTables.upsertLookupPermission('testRemoveGroup', permission2);
    await lookupTables.upsertLookupPermission('testRemoveGroup', permission3);

    let stored = await lookupTables.__fetchGroupLookupPermissions('testRemoveGroup');
    test
      .expect(sortPermissions(stored))
      .to.eql(sortPermissions([permission1, permission2, permission3]));

    await lookupTables.removeLookupPermission('testRemoveGroup', permission3);
    stored = await lookupTables.__fetchGroupLookupPermissions('testRemoveGroup');
    test.expect(sortPermissions(stored)).to.eql(sortPermissions([permission1, permission2]));
  });

  it('Can remove all permissions on a table from a group', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'tableRemoveTable1',
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    };
    let permission2 = {
      regex: '^/_data/historianStore/device1/(.*)',
      actions: ['get'],
      table: 'tableRemoveTable1',
      path: '/device/blah/blah/{{$1}}'
    };

    let permission3 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['get', 'on'],
      table: 'tableRemoveTable2',
      path: '/device/another/{user.company}/{{$1}}'
    };
    await lookupTables.upsertLookupPermission('tableRemoveGroup', permission1);
    await lookupTables.upsertLookupPermission('tableRemoveGroup', permission2);
    await lookupTables.upsertLookupPermission('tableRemoveGroup', permission3);

    let stored = await lookupTables.__fetchGroupLookupPermissions('tableRemoveGroup');
    test
      .expect(sortPermissions(stored))
      .to.eql(sortPermissions([permission1, permission2, permission3]));

    await lookupTables.removeAllTablePermission('tableRemoveGroup', 'tableRemoveTable1');
    stored = await lookupTables.__fetchGroupLookupPermissions('tableRemoveGroup');
    test.expect(sortPermissions(stored)).to.eql(sortPermissions([permission3]));
  });

  it('Can tests that when we request groups by table, we dont get groups where the permission has been removed.', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'GxTRemoveTable1',
      path: '/device/{{user.custom_data.oem}}/{{user.custom_data.companies}}/{{$1}}'
    };
    let permission2 = {
      regex: '^/_data/historianStore/device1/(.*)',
      actions: ['get'],
      table: 'GxTRemoveTable1',
      path: '/device/blah/blah/{{$1}}'
    };

    let permission3 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['get', 'on'],
      table: 'GxTRemoveTable2',
      path: '/device/another/{user.company}/{{$1}}'
    };

    let permission4 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['get', 'on'],
      table: 'GxTRemoveTable2',
      path: '/device/another/{user.blah}/{{$1}}'
    };
    await lookupTables.upsertLookupPermission('GxTRemoveGroup1', permission1);
    await lookupTables.upsertLookupPermission('GxTRemoveGroup1', permission2);
    await lookupTables.upsertLookupPermission('GxTRemoveGroup2', permission2);
    await lookupTables.upsertLookupPermission('GxTRemoveGroup3', permission3);
    await lookupTables.upsertLookupPermission('GxTRemoveGroup3', permission4);

    //Removing individual permissions
    let stored = await lookupTables.__getGroupsByTable('GxTRemoveTable1');
    test.expect(stored).to.eql(['GxTRemoveGroup1', 'GxTRemoveGroup2']);

    await lookupTables.removeLookupPermission('GxTRemoveGroup1', permission1);
    stored = await lookupTables.__getGroupsByTable('GxTRemoveTable1');
    test.expect(stored).to.eql(['GxTRemoveGroup1', 'GxTRemoveGroup2']);

    await lookupTables.removeLookupPermission('GxTRemoveGroup1', permission2);
    stored = await lookupTables.__getGroupsByTable('GxTRemoveTable1');
    test.expect(stored).to.eql(['GxTRemoveGroup2']);

    await lookupTables.removeLookupPermission('GxTRemoveGroup2', permission2);
    stored = await lookupTables.__getGroupsByTable('GxTRemoveTable1');
    test.expect(stored).to.eql([]);

    //removeAllTablePermissions
    stored = await lookupTables.__getGroupsByTable('GxTRemoveTable2');
    test.expect(stored).to.eql(['GxTRemoveGroup3']);
    await lookupTables.removeAllTablePermission('GxTRemoveGroup3', 'GxTRemoveTable2');
    stored = await lookupTables.__getGroupsByTable('GxTRemoveTable2');
    test.expect(stored).to.eql([]);

  });

  it('can build permissions path from regex matches - tests __buildPermissionsPaths', done => {
    let path = '/{{username}}/{{company}}/3/4/{{$1}}/5/6/{{$2}}';
    let user = { username: 'bob', company: 'bobs_buildings' };
    let matches = ['$EntireMatch..', 'component1', 'method3'];

    let pathsArray = lookupTables.__buildPermissionPaths(user, path, matches);
    test.expect(pathsArray).to.eql(['/bob/bobs_buildings/3/4/component1/5/6/method3']);
    done();
  });

  it('tests that __testLookupPermission will return early if action not included in permission', async () => {
    let path = { match: sinon.stub() };
    let permission = { actions: ['on'] };
    test
      .expect(await lookupTables.__testLookupPermission({}, permission, path, 'get'))
      .to.be(false);
    test.expect(path.match.notCalled).to.be(true);
  });

  it('tests that __testLookupPermission will return early if regEx doesnt match', async () => {
    let path = '1/2/3/4';
    let permission = { actions: ['on'], regex: '^/_data/historianStore/device1/(.*)' };
    let oldBuild = lookupTables.__buildPermissionPaths;
    lookupTables.__buildPermissionPaths = sinon.spy();
    test.expect(await lookupTables.__testLookupPermission({}, permission, path, 'on')).to.be(false);
    test.expect(lookupTables.__buildPermissionPaths.notCalled).to.be(true);
    lookupTables.__buildPermissionPaths = oldBuild;
  });

  it('tests that __testLookupPermission will return false if table doesnt exist', async () => {
    let path = '1/2/3/bob';
    let permission = {
      actions: ['on'],
      regex: '^1/(.*)/3/{{user.name}}',
      table: 'nonExistentTtestTable'
    };
    let identity = { user: { name: 'bob' } };
    test
      .expect(await lookupTables.__testLookupPermission(identity, permission, path, 'on'))
      .to.be(false);
  });

  it('tests that __testLookupPermission will return true if there is a path match.', async () => {
    let path = '1/2/3/4';
    let permission = {
      actions: ['on'],
      regex: '^1/(.*)/3/(.*)',
      table: 'testTable5',
      path: '1/{{$1}}/3/{{user.name}}/{{$2}}'
    };
    let identity = { user: { name: 'bob' } };

    await lookupTables.upsertLookupTable({
      name: 'testTable5',
      paths: ['1/2/3/bob/4', '4/5/6', '7/8/9']
    });
    test
      .expect(await lookupTables.__testLookupPermission(identity, permission, path, 'on'))
      .to.be(true);
  });

  it('tests that __testLookupPermission will return true if there is a wildcard path match.', async () => {
    let path = '1/2/3/4';
    let permission = {
      actions: ['on'],
      regex: '^1/(.*)/3/(.*)',
      table: 'wildcardTable',
      path: '1/{{$1}}/*/{{user.name}}/{{$2}}'
    };
    let identity = { user: { name: 'bob' } };

    await lookupTables.upsertLookupTable({
      name: 'wildcardTable',
      paths: ['1/2/3/bob/4', '4/5/6', '7/8/9']
    });
    test
      .expect(await lookupTables.__testLookupPermission(identity, permission, path, 'on'))
      .to.be(true);
  });

  it('tests that authorizeGroup will return true if there is a path match in any permission.', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'testTable6',
      path: '/device/{{user.name}}/{{user.company}}/{{$1}}'
    };

    let permission2 = {
      regex: '^/_data/otherProvider/(.*)/(.*)',
      actions: ['get'],
      table: 'testTable7',
      path: '/device/blah/blah/{{$1}}'
    };

    let permission3 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['get', 'on'],
      table: 'testTable8',
      path: '/device/another/{user.company}/{{$1}}'
    };
    let identity = { user: { name: 'bob', company: 'tenacious' } };

    await lookupTables.upsertLookupTable({
      name: 'testTable6',
      paths: ['1/2/3/4', '2/3/4/5', '/device/bob/tenacious/deviceA'] //Last should match on deviceA
    });

    await lookupTables.upsertLookupTable({
      name: 'testTable7',
      paths: ['1/56/3/4', '2/34/4/5', '4/5/6/7/8'] //No Match
    });
    await lookupTables.upsertLookupTable({
      name: 'testTable7',
      paths: ['1/567/3/4', '2/345/4/5', '4/5/6/7/8/9/10'] //No Match
    });
    await lookupTables.upsertLookupPermission('testGroup5', permission1);
    await lookupTables.upsertLookupPermission('testGroup5', permission2);
    await lookupTables.upsertLookupPermission('testGroup5', permission3);
    test
      .expect(
        await lookupTables.authorizeGroup(
          identity,
          'testGroup5',
          '/_data/historianStore/notDeviceA',
          'on'
        )
      )
      .to.be(false);
    test
      .expect(
        await lookupTables.authorizeGroup(
          identity,
          'testGroup5',
          '/_data/historianStore/deviceA',
          'on'
        )
      )
      .to.be(true);
  });

  it('tests that authorize will return true if there is a path match in any of the sesssions groups permissions, false otherwise.', async () => {
    let permission1 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['on'],
      table: 'testTable9',
      path: '/device/{{user.name}}/{{user.company}}/{{$1}}'
    };

    let permission2 = {
      regex: '^/_data/otherProvider/(.*)/(.*)',
      actions: ['get'],
      table: 'testTable10',
      path: '/device/blah/blah/{{$1}}'
    };

    let permission3 = {
      regex: '^/_data/historianStore/(.*)',
      actions: ['get', 'on'],
      table: 'testTable11',
      path: '/device/another/{user.company}/{{$1}}'
    };

    await lookupTables.upsertLookupTable({
      name: 'testTable9',
      paths: ['1/2/3/4', '2/3/4/5', '/device/bob/tenacious/deviceA'] //Last should match on deviceA
    });

    await lookupTables.upsertLookupTable({
      name: 'testTable10',
      paths: ['1/56/3/4', '2/34/4/5', '4/5/6/7/8'] //No Match
    });
    await lookupTables.upsertLookupTable({
      name: 'testTable11',
      paths: ['1/567/3/4', '2/345/4/5', '4/5/6/7/8/9/10'] //No Match
    });
    await lookupTables.upsertLookupPermission('testGroup6', permission1);
    await lookupTables.upsertLookupPermission('testGroup7', permission2);
    await lookupTables.upsertLookupPermission('testGroup8', permission3);
    let session = {
      user: {
        name: 'bob',
        company: 'tenacious',
        groups: { testGroup6: {}, testGroup7: {}, testGroup8: {} }
      }
    };
    test
      .expect(await lookupTables.authorize(session, '/_data/historianStore/notDeviceA', 'on'))
      .to.be(false);
    test
      .expect(await lookupTables.authorize(session, '/_data/historianStore/deviceA', 'on'))
      .to.be(true);
  });

  function sortPermissions(perms) {
    return perms.sort((a, b) => (a.path < b.path ? -1 : 1));
  }
});
