describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(5000);

    const expect = require('expect.js');
    const path = require('path');
    const DataService = require('../../../lib/services/data/service');

    function mockDataService() {}

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
