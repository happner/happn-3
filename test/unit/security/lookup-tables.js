const sinon = require('sinon');
const DataService = require('../../../lib/services/data/service');
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

  before('Sets up errorService', done => {
    const ErrorService = require('../../../lib/services/error/service');
    mockErrorService = new ErrorService({
      logger: Logger
    });
    mockErrorService.handleFatal = function(message, e) {
      throw e;
    };
    done();
  });

  let mockHappn = { services: { error: mockErrorService, log: Logger, util } };

  before('Sets up dataService', done => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

    var mockDataService = new DataService({
      logger: Logger
    });
    mockHappn.services.data = mockDataService;
    mockDataService.happn = mockHappn;
    mockDataService.__updateDatabaseVersions = async () => {};
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
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    test.expect(lookupTables).to.be.ok();
    done();
  });

  it('Can upsert a path into a lookupTable (creatng table)', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    await lookupTables.insertPath('newUpsertTable', '/1/2/3');
    let stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newUpsertTable/1/2/3'
    );
    test.expect(stored.data).to.eql({ authorized: true });
  });

  it('Can upsert a lookupTable', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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

  it('Can upsert a path into a lookupTable (table already exists)', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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
    test
      .expect(lookupTables.tables.search('/10/11/12', { subscriberKey: 'upsertNewPath' }).length)
      .to.be(0);
    await lookupTables.insertPath('upsertNewPath', '/10/11/12');
    stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/upsertNewPath/10/11/12');
    test.expect(stored.data).to.eql({ authorized: true });
    test
      .expect(lookupTables.tables.search('/10/11/12', { subscriberKey: 'upsertNewPath' })[0])
      .to.eql({ subscriberKey: 'upsertNewPath', path: '10/11/12', authorized: true });
  });

  it('Can remove a path from a lookupTable', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    let table = {
      name: 'removeTable',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    };
    await lookupTables.upsertLookupTable(table);
    let stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/removeTable/1/2/3');
    test.expect(stored.data).to.eql({ authorized: true });

    await lookupTables.removePath('/1/2/3', 'removeTable');
    await wait(500);
    stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable4/1/2/3');
    test.expect(stored).to.not.be.ok();
  });

  it('Shouldnt error if we try to remove a non-existent path', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    await lookupTables.removePath('/1/2/3', 'nonExistentTable');
  });

  it('Can extract a path (table name not repeated)', done => {
    let lookupTables = LookupTables.create();
    let tableName = 'tableName';
    let path = '/domain/component/tableName/1/2/3/4';
    test.expect(lookupTables.__extractPath(path, tableName)).to.eql('1/2/3/4');
    done();
  });

  it('Can extract a path (table name repeated)', done => {
    // This is unlikely, but I guess it could happen??
    let lookupTables = LookupTables.create();
    let tableName = 'tableName';
    let path = '/domain/component/tableName/1/2/3/tableName/5/6/7';
    test.expect(lookupTables.__extractPath(path, tableName)).to.be('1/2/3/tableName/5/6/7');
    done();
  });

  it('Can fetch a lookupTable', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    await lookupTables.upsertLookupTable({
      name: 'fetchTable',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    });

    let table = await lookupTables.fetchLookupTable('fetchTable');
    test.expect(table).to.eql({
      name: 'fetchTable',
      paths: ['1/2/3', '4/5/6', '7/8/9'] //Do we want leading slashes or not?
    });
    let longtable = {
      name: 'longtable',
      paths: ['1/2/3', '4/5/6', '7/8/9', 'extremely/very/long/path/1/2/3/4/5/6/7/8']
    };
    await lookupTables.upsertLookupTable(longtable);
    table = await lookupTables.fetchLookupTable('longtable');
    test.expect(table).to.eql(longtable);
  });

  it('Can upsert a group lookup permission', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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
    test.expect(stored.data.permissions[0]).to.eql(permission);
  });

  it('Can upsert multiple lookup permissions to the same group and table', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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
    test.expect(stored.data.permissions[0]).to.eql(permission1);
    test.expect(stored.data.permissions[1]).to.eql(permission2);
  });

  it('If we upsert the same permission multiple times we dont store it again (avoid data bloat)', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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
    test.expect(stored.data.permissions[0]).to.eql(permission2);
  });

  it('Can fetch all of a groups lookup permissions', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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

  it('can build permissions path from regex matches - tests __buildPermissionsPaths', done => {
    let path = '/{{username}}/{{company}}/3/4/{{$1}}/5/6/{{$2}}';
    let user = { username: 'bob', company: 'bobs_buildings' };
    let matches = ['$EntireMatch..', 'component1', 'method3'];
    let lookupTables = LookupTables.create();
    let pathsArray = lookupTables.__buildPermissionPaths(user, path, matches);
    test.expect(pathsArray).to.eql(['/bob/bobs_buildings/3/4/component1/5/6/method3']);
    done();
  });

  it('tests that __testLookupPermission will return early if action not included in permission', async () => {
    let path = { match: sinon.stub() };
    let permission = { actions: ['on'] };
    let lookupTables = LookupTables.create();
    test
      .expect(await lookupTables.__testLookupPermission({}, permission, path, 'get'))
      .to.be(false);
    test.expect(path.match.notCalled).to.be(true);
  });

  it('tests that __testLookupPermission will return early if regEx doesnt match', async () => {
    let path = '1/2/3/4';
    let permission = { actions: ['on'], regex: '^/_data/historianStore/device1/(.*)' };
    let lookupTables = LookupTables.create();
    lookupTables.__buildPermissionPaths = sinon.stub();
    test.expect(await lookupTables.__testLookupPermission({}, permission, path, 'on')).to.be(false);
    test.expect(lookupTables.__buildPermissionPaths.notCalled).to.be(true);
  });

  it('tests that __testLookupPermission will return false if table doesnt exist', async () => {
    let path = '1/2/3/bob';
    let permission = { actions: ['on'], regex: '^1/(.*)/3/{{user.name}}', table: 'testTable5' };
    let identity = { user: { name: 'bob' } };
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    await lookupTables.upsertLookupTable({
      name: 'testTable5',
      paths: ['1/2/3/bob/4', '4/5/6', '7/8/9']
    });
    test
      .expect(await lookupTables.__testLookupPermission(identity, permission, path, 'on'))
      .to.be(true);
  });

  it.only('tests that __testLookupPermission will return true if there is a wildcard path match.', async () => {
    let path = '1/2/3/4';
    let permission = {
      actions: ['on'],
      regex: '^1/(.*)/3/(.*)',
      table: 'testTable5',
      path: '1/{{$1}}/*/{{user.name}}/{{$2}}'
    };
    let identity = { user: { name: 'bob' } };
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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

    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
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
});
