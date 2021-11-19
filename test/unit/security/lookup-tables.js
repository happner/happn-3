const sinon = require('sinon');
const DataService = require('../../../lib/services/data/service');
const LookupTables = require('../../../lib/services/security/lookup-tables');
const test = require('../../__fixtures/utils/test_helper').create();

describe(test.testName(__filename, 3), function() {
  var async = require('async');
  var Logger = require('happn-logger');
  const util = require('util');
  let mockErrorService;
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
    const DataService = require('../../../lib/services/data/service');
    var mockDataService = new DataService({
      logger: Logger
    });
    mockHappn.services.data = mockDataService;
    mockDataService.happn = mockHappn;
    mockDataService.__updateDatabaseVersions = async () => {};
    mockDataService.initialize({ filename: 'test_lookup_db' }, done);
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
      name: 'newlookuptable'
      paths: ['1/2/3', '/4/5/6', '/7/8/9'] //Inconsitency deliberate
    };
    
    await lookupTables.upsertLookupTable(table);
    let stored = await mockHappn.services.data.get(
      '/_SYSTEM/_SECURITY/_LOOKUP/newlookuptable/1/2/3'
    );
    test.expect(stored.data).to.eql({ authorized: true });
  });
});
