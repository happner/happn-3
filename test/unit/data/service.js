describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(5000);

    const expect = require('expect.js');
    const DataService = require('../../../lib/services/data/service');

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
          expect(Object.keys(dataService.datastores).length).to.be(1);
          expect(Object.keys(dataService.dataroutes)).to.eql([
            '/TEST/PATTERN/*',
            '/_TAGS/TEST/PATTERN/*'
          ]);
          expect(dataService.defaultDatastore).to.be('test_store');
          done();
        }
      );
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
              expect(Object.keys(dataService.datastores).length).to.be(2);
              expect(Object.keys(dataService.dataroutes)).to.eql([
                '/TEST/PATTERN/*',
                '/_TAGS/TEST/PATTERN/*',
                '/TEST/PATTERN/1/*',
                '/_TAGS/TEST/PATTERN/1/*'
              ]);
              //esnure the original data provider is still the default
              expect(dataService.defaultDatastore).to.be('test_store');
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

      expect(parsedResult).to.eql({
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

      expect(parsedResult).to.eql({
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
  }
);
