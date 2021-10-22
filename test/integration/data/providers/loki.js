const test = require('../../../__fixtures/utils/test_helper').create();
const LokiDataProvider = require('../../../../lib/services/data/providers/loki');
describe(test.testName(__dirname), function() {
  this.timeout(60000);
  const testFileName = test.path.resolve(__dirname, '../../../test-temp/loki-provider.db');
  const mockLogger = {
    info: test.sinon.stub(),
    error: test.sinon.stub(),
    warn: test.sinon.stub(),
    trace: test.sinon.stub()
  };
  beforeEach('delete temp file', async () => {
    try {
      test.fs.unlinkSync(testFileName);
    } catch (e) {
      //do nothing
    }
  });
  it('starts up the provider with a persistence filename, does some inserts, restarts the provider and checks the data is still there', async () => {
    const lokiProvider = new LokiDataProvider(mockLogger);
    const created = 1634804510343;
    const modified = created;
    lokiProvider.settings = {
      filename: testFileName,
      snapshot: {
        rollOverThreshold: 1000
      }
    };
    await lokiProvider.initialize();
    await lokiProvider.insert({ path: 'test/path/1', data: { test: 'test' }, created, modified });
    await lokiProvider.insert({ path: 'test/path/2', data: { test: 'test' }, created, modified });
    await lokiProvider.insert({ path: 'test/path/3', data: { test: 'test' }, created, modified });
    let found = await lokiProvider.find('test/path/*');
    test.expect(found.length).to.be(3);
    found = await lokiProvider.find('test/path/1');
    test.expect(found.length).to.be(1);
    found = await lokiProvider.find('test/path/*', {
      options: {
        sort: { path: -1 },
        limit: 2
      }
    });
    test.expect(found[0].path).to.be('test/path/3');
    test.expect(found[1].path).to.be('test/path/2');
    test.expect(found.length).to.be(2);
    found = await lokiProvider.find('test/path/*', {
      options: {
        sort: { path: -1 },
        limit: 2,
        skip: 2
      }
    });
    test.expect(found[0].path).to.be('test/path/1');
    test.expect(found.length).to.be(1);
    test.expect(lokiProvider.operationCount).to.be(3);
    await lokiProvider.stop();
    await lokiProvider.initialize();
    found = await lokiProvider.find('test/path/*');
    test.expect(found.length).to.be(3);
    test.expect(lokiProvider.operationCount).to.be(0);
  });

  it('starts up the provider with a persistence filename, does some inserts, tests findOne, upsert and the rollover threshold', async () => {
    const lokiProvider = new LokiDataProvider(mockLogger);
    const created = 1634804510343;
    const modified = created;
    const createdAfterUpsert = 1634804510343;
    const modifiedAfterUpsert = created;
    const modifiedBy = 'test@test.com';
    lokiProvider.settings = {
      filename: testFileName,
      snapshotRollOverThreshold: 5
    };
    await lokiProvider.initialize();
    await lokiProvider.insert({ path: 'test/path/1', data: { test: 'test' }, created, modified });
    await lokiProvider.insert({ path: 'test/path/2', data: { test: 'test' }, created, modified });
    await lokiProvider.insert({ path: 'test/path/3', data: { test: 'test' }, created, modified });
    await lokiProvider.upsert('test/path/3', {
      test: 'changed',
      created: createdAfterUpsert,
      modified: modifiedAfterUpsert,
      modifiedBy
    });
    test.expect(await test.lineCount(testFileName)).to.be(5);
    await lokiProvider.upsert('test/path/4', {
      test: 'inserted',
      created,
      modified
    });
    test.expect(await test.lineCount(testFileName)).to.be(1);
    let found = await lokiProvider.find('test/path/*', { sort: { path: 1 } });
    test.expect(found.length).to.be(4);
    test.expect(found[2].data.test).to.be('changed');
    test.expect(found[3].data.test).to.be('inserted');

    await lokiProvider.stop();
    await lokiProvider.initialize();

    found = await lokiProvider.find('test/path/*', { sort: { path: 1 } });
    test.expect(found.length).to.be(4);
    test.expect(await test.lineCount(testFileName)).to.be(1);
    await lokiProvider.insert({ path: 'test/path/5', data: { test: 'test' }, created, modified });
    test.expect(await test.lineCount(testFileName)).to.be(2);
    found = await lokiProvider.find('test/path/*', { sort: { path: 1 } });
    test.expect(found.length).to.be(5);
    await lokiProvider.remove('test/path/5');
    found = await lokiProvider.find('test/path/*', { sort: { path: 1 } });
    test.expect(found.length).to.be(4);
    test.expect(await test.lineCount(testFileName)).to.be(3);
  });
});
