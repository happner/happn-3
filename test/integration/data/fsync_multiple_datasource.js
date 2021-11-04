const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  const fs = require('fs');

  const sinon = require('sinon');
  const chai = require('chai');
  chai.use(require('sinon-chai'));
  const expect = require('chai').expect;

  const async = require('async');
  const happn = require('../../../lib/index');
  const tempFile1 = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
  const test_id = Date.now() + '_' + require('shortid').generate();

  const services = [];

  let singleClient;
  let multipleClient;

  const getService = function(config, callback) {
    happn.service.create(config, callback);
  };

  const getClient = function(service, callback) {
    service.services.session.localClient(function(e, instance) {
      if (e) return callback(e);
      callback(null, instance);
    });
  };

  /** @type {sinon.SinonSpy} */
  let fsyncSpy;

  before('should initialize the services', function(callback) {
    this.timeout(60000); //travis sometiems takes ages...

    fsyncSpy = sinon.spy(fs, 'fsync');

    const serviceConfigs = [
      {
        port: 55001
      },
      {
        services: {
          data: {
            config: {
              datastores: [
                {
                  name: 'memory',
                  isDefault: true,
                  patterns: [
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/memorytest/*',
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/memorynonwildcard'
                  ]
                },
                {
                  name: 'persisted',
                  settings: {
                    filename: tempFile1,
                    fsync: true
                  },
                  patterns: [
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedtest/*',
                    '/a3_eventemitter_multiple_datasource/' + test_id + '/persistednonwildcard'
                  ]
                }
              ]
            }
          }
        }
      }
    ];

    async.eachSeries(
      serviceConfigs,
      function(serviceConfig, serviceConfigCallback) {
        getService(serviceConfig, function(e, happnService) {
          if (e) return serviceConfigCallback(e);

          services.push(happnService);
          serviceConfigCallback();
        });
      },
      function(e) {
        if (e) return callback(e);

        getClient(services[0], function(e, client) {
          if (e) return callback(e);
          singleClient = client;

          getClient(services[1], function(e, client) {
            if (e) return callback(e);
            multipleClient = client;
            callback();
          });
        });
      }
    );
  });

  after('should delete the temp data files', function(callback) {
    fsyncSpy.restore();

    fs.unlink(tempFile1, function(e) {
      if (e) return callback(e);

      async.each(
        services,
        function(currentService, eachServiceCB) {
          currentService.stop(eachServiceCB);
        },
        callback
      );
    });
  });

  beforeEach(async () => {
    await test.delay(1000);
  });

  afterEach(async () => {
    fsyncSpy.resetHistory();
  });

  it('should push some data into the single datastore service', async function() {
    this.timeout(4000);

    const test_path_end = require('shortid').generate();
    const test_path =
      '/a3_eventemitter_multiple_datasource/' + test_id + '/default/' + test_path_end;

    await singleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    const results = await singleClient.get(test_path, null);
    expect(results.property1 === 'property1').to.be.true;
  });

  it('should push some data into the multiple datastore', async function() {
    this.timeout(4000);

    const test_path_end = require('shortid').generate();
    const test_path =
      '/a3_eventemitter_multiple_datasource/' + test_id + '/default/' + test_path_end;

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.not.been.called;

    const results = await multipleClient.get(test_path, null);

    expect(results.property1 === 'property1').to.be.true;
  });

  const findRecordInDataFile = function(path, filepath) {
    return new Promise((resolve, reject) => {
      try {
        setTimeout(function() {
          const byline = require('byline');
          const stream = byline(
            fs.createReadStream(filepath, {
              encoding: 'utf8'
            })
          );

          let found = false;

          stream.on('data', function(line) {
            if (found) return;

            const record = JSON.parse(line);

            if (record._id === path) {
              found = true;
              stream.end();
              resolve(record);
            }
          });

          stream.on('end', function() {
            if (!found) resolve(null);
          });
        }, 1000);
      } catch (e) {
        reject(e);
      }
    });
  };

  it('should push some data into the multiple datastore, memory datastore, wildcard pattern', async function() {
    this.timeout(4000);

    const test_path_end = require('shortid').generate();
    const test_path =
      '/a3_eventemitter_multiple_datasource/' + test_id + '/memorytest/' + test_path_end;

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.not.been.called;

    const results = await multipleClient.get(test_path, null);
    expect(results.property1 === 'property1').to.be.true;

    const record = await findRecordInDataFile(test_path, tempFile1);
    expect(record, 'record found in persisted file, meant to be in memory').to.be.null;
  });

  it('should push some data into the multiple datastore, persisted datastore, wildcard pattern', async function() {
    this.timeout(4000);

    const test_path_end = require('shortid').generate();
    const test_path =
      '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedtest/' + test_path_end;

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.been.called;

    const results = await multipleClient.get(test_path, null);
    expect(results.property1 === 'property1').to.be.true;

    const record = await findRecordInDataFile(test_path, tempFile1);
    expect(record, 'record not found in persisted file').to.not.be.null;
  });

  it('should push some data into the multiple datastore, memory datastore, exact pattern', async function() {
    this.timeout(4000);

    const test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/memorynonwildcard';

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.not.been.called;

    const results = await multipleClient.get(test_path, null);
    expect(results.property1 === 'property1').to.be.true;

    const record = await findRecordInDataFile(test_path, tempFile1);
    expect(record, 'record found in persisted file, meant to be in memory').to.be.null;
  });

  it('should push some data into the multiple datastore, persisted datastore, exact pattern', async function() {
    this.timeout(4000);

    const test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistednonwildcard';

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.been.called;

    const results = await multipleClient.get(test_path, null);
    expect(results.property1 === 'property1').to.be.true;

    const record = await findRecordInDataFile(test_path, tempFile1);
    expect(record, 'record not found in persisted file').to.not.be.null;
  });

  it('should push some data into the multiple datastore, default pattern', async function() {
    this.timeout(4000);

    const test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/default';

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.not.been.called;

    const results = await multipleClient.get(test_path, null);
    expect(results.property1 === 'property1').to.be.true;

    const record = await findRecordInDataFile(test_path, tempFile1);
    expect(record, 'record found in persisted file, meant to be in memory').to.be.null;
  });

  it('check the same event should be raised, regardless of what data source we are pushing to', function(callback) {
    this.timeout(10000);
    let caughtCount = 0;

    const memoryTestPath = '/a3_eventemitter_multiple_datasource/' + test_id + '/memorytest/event';
    const persistedTestPath =
      '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedtest/event';

    multipleClient.onAll(
      function(eventData, meta) {
        if (
          meta.action === '/SET@' + memoryTestPath ||
          meta.action === '/SET@' + persistedTestPath
        ) {
          caughtCount++;
          if (caughtCount === 2) {
            findRecordInDataFile(persistedTestPath, tempFile1)
              .then(record => {
                if (record !== null) return callback();
                callback(new Error('record not found in persisted file'));
              })
              .catch(callback);
          }
        }
      },
      function(e) {
        if (e) return callback(e);

        multipleClient.set(
          memoryTestPath,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            expect(fsyncSpy).to.have.not.been.called;
            if (e) return callback(e);

            multipleClient.set(
              persistedTestPath,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              null,
              function(e) {
                expect(fsyncSpy).to.have.been.called;
                if (e) return callback(e);
              }
            );
          }
        );
      }
    );
  });

  it('should not find the pattern to be added in the persisted datastore', async function() {
    this.timeout(4000);

    const test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedaddedpattern';

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.not.been.called;

    const results = await multipleClient.get(test_path, null);
    expect(results.property1 === 'property1').to.be.true;

    const record = await findRecordInDataFile(test_path, tempFile1);
    expect(record, 'record found in persisted file, meant to be in memory').to.be.null;
  });

  it('should add a pattern to the persisted datastore, and check it works', async function() {
    this.timeout(4000);

    const test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedaddedpattern';

    services[1].services.data.addDataStoreFilter(test_path, 'persisted');

    await multipleClient.set(
      test_path,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      {}
    );

    expect(fsyncSpy).to.have.been.called;

    const results = await multipleClient.get(test_path, null);
    expect(results.property1).to.equal('property1');

    const record = await findRecordInDataFile(test_path, tempFile1);
    expect(record, 'record not found in persisted file').to.not.be.null;
  });

  it('should remove a pattern from the persisted datastore', function() {
    this.timeout(4000);

    const test_path = '/a3_eventemitter_multiple_datasource/' + test_id + '/persistedaddedpattern';
    let patternExists = false;

    for (const pattern1 in services[1].services.data.dataroutes) {
      if (pattern1 === test_path) {
        patternExists = true;
        break;
      }
    }

    expect(patternExists).to.be.true;

    patternExists = false;

    services[1].services.data.removeDataStoreFilter(test_path);

    for (const pattern2 in services[1].services.data.dataroutes) {
      if (pattern2 === test_path) {
        patternExists = true;
        break;
      }
    }

    expect(patternExists).to.be.false;
  });
});
