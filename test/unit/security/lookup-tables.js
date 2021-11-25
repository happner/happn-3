const sinon = require('sinon');
const DataService = require('../../../lib/services/data/service');
const LookupTables = require('../../../lib/services/security/lookup-tables');
const test = require('../../__fixtures/utils/test_helper').create();
const wait = require('await-delay');
const path = require('path');
const fs = require('fs');

describe(test.testName(__filename, 3), function() {
  var async = require('async');
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
    fs.unlinkSync(dbPath);
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
    await lookupTables.insertPath('/1/2/3', 'newlookuptable');
    let stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable/1/2/3'
    );
    test.expect(stored.data).to.eql({ authorized: true });
  });

  it('Can upsert a lookupTable', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    let table = {
      name: 'newlookuptable2',
      paths: ['1/2/3', '/4/5/6', '/7/8/9'] //Inconsitency deliberate
    };
    await lookupTables.upsertLookupTable(table);
    for (let lookupPath of table.paths) {
      let testPath = lookupPath.replace(/^\//, '');
      let stored = await mockHappn.services.data.get(
        `/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable2/${testPath}`
      );
      test.expect(stored.data).to.eql({ authorized: true });
    }
  });

  it('Can upsert a path into a lookupTable (table already exists)', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    let table = {
      name: 'newlookuptable3',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    };
    await lookupTables.upsertLookupTable(table);
    let stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable3/1/2/3'
    );
    test.expect(stored.data).to.eql({ authorized: true });
    stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable3/10/11/12'
    );
    test.expect(stored).to.not.be.ok();
    await lookupTables.insertPath('/10/11/12', 'newlookuptable3');
    stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable3/10/11/12'
    );
    test.expect(stored.data).to.eql({ authorized: true });
  });

  it('Can remove a path from a lookupTable', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    let table = {
      name: 'newlookuptable4',
      paths: ['1/2/3', '4/5/6', '7/8/9']
    };
    await lookupTables.upsertLookupTable(table);
    let stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable4/1/2/3'
    );
    test.expect(stored.data).to.eql({ authorized: true });

    await lookupTables.removePath('/1/2/3', 'newlookuptable4');
    await wait(500);
    stored = await mockHappn.services.data.get('/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable4/1/2/3');
    test.expect(stored).to.not.be.ok();
  });

  it('Shouldnt error if we try to remove a non-existent path', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);
    await lookupTables.removePath('/1/2/3', 'nonExistentTables');
  });

  it('Can extract a path (table name not repeated)', done => {
    let lookupTables = LookupTables.create();
    let tableName = 'tableName';
    let path = '/domain/component/tableName/1/2/3/4';
    test.expect(lookupTables.extractPath(path, tableName)).to.eql('1/2/3/4');
    done();
  });

  it('Can extract a path (table name repeated)', done => {
    // This is unlikely, but I guess it could happen??
    let lookupTables = LookupTables.create();
    let tableName = 'tableName';
    let path = '/domain/component/tableName/1/2/3/tableName/5/6/7';
    test.expect(lookupTables.extractPath(path, tableName)).to.be('1/2/3/tableName/5/6/7');
    done();
  });

  it('Can fetch a lookupTable', async () => {
    let lookupTables = LookupTables.create();
    lookupTables.initialize(mockHappn);

    let table = await lookupTables.fetchLookupTable('newlookuptable2');
    test.expect(table).to.eql({
      name: 'newlookuptable2',
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

  it('can build permissions path from regex matches', done => {
    let path = '/{{username}}//{{company}}/3/4/{{$1}}/5/6/{{$2}}';
    let user = { username: 'bob', company: 'bobs buildings' };
    let matches = ['$EntireMatch..', 'component1', 'method3'];
    let lookupTables = LookupTables.create();
    let pathsArray = lookupTables.__buildPermissionPaths(user, path, matches);
    test.expect(pathsArray).to.eql(['/bob//bobs buildings/3/4/component1/5/6/method3']);
    done();
  });
});
