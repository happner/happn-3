const sinon = require('sinon');
const DataService = require('../../../lib/services/data/service');
const LookupTables = require('../../../lib/services/security/lookup-tables');
const test = require('../../__fixtures/utils/test_helper').create();
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

    const DataService = require('../../../lib/services/data/service');
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

  it('Can upsert a path into a lookupTable (creatng table here)', async () => {
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
});
