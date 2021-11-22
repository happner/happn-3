const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  this.timeout(5000);
  const DataService = require('../../../lib/services/data/service');
  const UtilsService = require('../../../lib/services/utils/service');

  it('tests the _insertDataProvider method', function(done) {
    let dataService = new DataService();
    dataService.config = {};
    dataService.datastores = {};
    dataService.dataroutes = {};
    dataService._insertDataProvider(
      0,
      {
        name: 'test_store',
        provider: 'memory',
        isDefault: true,
        settings: {},
        patterns: ['/TEST/PATTERN/*']
      },
      function(e) {
        if (e) return done(e);
        test.expect(Object.keys(dataService.datastores).length).to.be(1);
        test
          .expect(Object.keys(dataService.dataroutes))
          .to.eql(['/TEST/PATTERN/*', '/_TAGS/TEST/PATTERN/*']);
        test.expect(dataService.defaultDatastore).to.be('test_store');
        done();
      }
    );
  });

  it('tests the upsert method', async () => {
    let dataService = new DataService();
    dataService.config = {};
    dataService.datastores = {};
    dataService.dataroutes = {};
    const internalCalls = [];
    const callback = () => {};
    dataService.__upsertInternal = (...args) => {
      args.pop(); // get rid of callback
      delete args[1].modified;
      internalCalls.push(args);
    };
    dataService.getOneByPath = (_path, _options, cb) => {
      cb(null, { data: { test: 4, test1: 4 } });
    };
    dataService.upsert('/path/1', { test: 1 }, {}, callback);
    dataService.upsert('/path/1', { test: 2 }, { merge: true }, callback);
    dataService.upsert('/path/1', { test: 3 }, callback);
    dataService.getOneByPath = (_path, _options, cb) => {
      cb(null, null);
    };
    dataService.upsert('/path/1', { test: 5 }, { merge: true }, callback);
    await test.delay(2000);
    test.expect(internalCalls).to.eql([
      [
        '/path/1',
        {
          data: {
            test: 1
          },
          _meta: {
            path: '/path/1'
          }
        },
        {},
        false
      ],
      [
        '/path/1',
        {
          data: {
            test: 2,
            test1: 4
          }
        },
        {
          merge: true,
          upsertType: 0
        },
        true
      ],
      [
        '/path/1',
        {
          data: {
            test: 3
          },
          _meta: {
            path: '/path/1'
          }
        },
        {},
        false
      ],
      [
        '/path/1',
        {
          _meta: {
            path: '/path/1'
          },
          data: {
            test: 5
          }
        },
        {
          merge: true,
          upsertType: 0
        },
        true
      ]
    ]);
  });

  it('tests the _insertDataProvider method insert after default', function(done) {
    let dataService = new DataService();
    dataService.config = {};
    dataService.datastores = {};
    dataService.dataroutes = {};
    dataService._insertDataProvider(
      0,
      {
        name: 'test_store',
        provider: 'memory',
        settings: {},
        patterns: ['/TEST/PATTERN/*']
      },
      function(e) {
        if (e) return done(e);
        dataService._insertDataProvider(
          0,
          {
            name: 'test_store_1',
            provider: 'memory',
            settings: {},
            patterns: ['/TEST/PATTERN/1/*']
          },
          function(e) {
            if (e) return done(e);
            test.expect(Object.keys(dataService.datastores).length).to.be(2);
            test
              .expect(Object.keys(dataService.dataroutes))
              .to.eql([
                '/TEST/PATTERN/*',
                '/_TAGS/TEST/PATTERN/*',
                '/TEST/PATTERN/1/*',
                '/_TAGS/TEST/PATTERN/1/*'
              ]);
            //esnure the original data provider is still the default
            test.expect(dataService.defaultDatastore).to.be('test_store');
            done();
          }
        );
      }
    );
  });

  it('tests the parseFields method', function() {
    let dataService = new DataService();

    var parsedResult = dataService.parseFields({
      $and: [
        {
          _id: 'test-id',
          $or: [
            {
              time: 10
            },
            {
              time: 20
            },
            {
              time: 30
            },
            {
              time: 40
            }
          ]
        }
      ]
    });

    test.expect(parsedResult).to.eql({
      $and: [
        {
          _id: 'test-id',
          $or: [
            {
              'data.time': 10
            },
            {
              'data.time': 20
            },
            {
              'data.time': 30
            },
            {
              'data.time': 40
            }
          ]
        }
      ]
    });

    parsedResult = dataService.parseFields({
      $and: [
        {
          _id: 'test-id',
          $or: [
            {
              '_meta.path': {
                $regex: '.*detail-or/10/.*'
              }
            },
            {
              '_meta.path': {
                $regex: '.*detail-or/20/.*'
              }
            },
            {
              '_meta.path': {
                $regex: '.*detail-or/30/.*'
              }
            },
            {
              '_meta.path': {
                $regex: '.*detail-or/40/.*'
              }
            }
          ]
        }
      ]
    });

    test.expect(parsedResult).to.eql({
      $and: [
        {
          _id: 'test-id',
          $or: [
            {
              path: {
                $regex: {}
              }
            },
            {
              path: {
                $regex: {}
              }
            },
            {
              path: {
                $regex: {}
              }
            },
            {
              path: {
                $regex: {}
              }
            }
          ]
        }
      ]
    });
  });

  it('tests the addDataStoreFilter and removeDataStoreFilter methods', function(done) {
    const dataService = new DataService();
    const utilsService = new UtilsService();
    dataService.happn = {
      services: {
        error: {},
        utils: utilsService
      }
    };
    dataService.initialize({}, () => {
      const mockDataStore1 = { test: 1 };
      const mockDataStore2 = { test: 2 };
      const mockDataStore3 = { test: 3 };

      dataService.datastores = {
        test1: {
          name: 'test1',
          patterns: ['/test/1/*'],
          provider: mockDataStore1
        },
        test2: {
          name: 'test2',
          patterns: ['/test/1/2/*'],
          provider: mockDataStore2
        },
        test3: {
          name: 'test3',
          patterns: ['/test/1/2/3/*'],
          provider: mockDataStore3
        }
      };

      dataService.addDataStoreFilter('/test/1/*', 'test1');
      dataService.addDataStoreFilter('/test/1/2/*', 'test2');
      dataService.addDataStoreFilter('/test/1/2/3/*', 'test3');

      test
        .expect(dataService.dataroutessorted)
        .to.eql([
          '/_TAGS/test/1/2/3/*',
          '/_TAGS/test/1/2/*',
          '/_TAGS/test/1/*',
          '/test/1/2/3/*',
          '/test/1/2/*',
          '/test/1/*'
        ]);

      test.expect(dataService.db('/test/1/2/3/*')).to.be(mockDataStore3);
      test
        .expect(Object.keys(dataService.dataroutes))
        .to.eql([
          '/test/1/*',
          '/_TAGS/test/1/*',
          '/test/1/2/*',
          '/_TAGS/test/1/2/*',
          '/test/1/2/3/*',
          '/_TAGS/test/1/2/3/*'
        ]);

      dataService.removeDataStoreFilter('/test/1/2/3/*');

      test
        .expect(Object.keys(dataService.dataroutes))
        .to.eql(['/test/1/*', '/_TAGS/test/1/*', '/test/1/2/*', '/_TAGS/test/1/2/*']);
      test
        .expect(dataService.dataroutessorted)
        .to.eql(['/_TAGS/test/1/2/*', '/_TAGS/test/1/*', '/test/1/2/*', '/test/1/*']);
      test.expect(dataService.db('/test/1/2/3/*')).to.be(mockDataStore2);
      done();
    });
  });
});
