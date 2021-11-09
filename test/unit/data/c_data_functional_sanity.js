let test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  this.timeout(20000);
  const Utils = require('../../../lib/services/utils/service');
  const utils = new Utils();
  const service = require('../../../lib/services/data/providers/loki');
  const testId = require('shortid').generate();
  const config = {};
  const serviceInstance = new service(config);

  before('should initialize the service', function(callback) {
    serviceInstance.happn = {
      services: {
        utils: utils,
        system: {
          package: require('../../../package.json')
        }
      }
    };

    serviceInstance.initialize(callback);
  });

  after(function(done) {
    serviceInstance.stop(done);
  });

  it('sets data', function(callback) {
    var beforeCreatedOrModified = Date.now();

    setTimeout(function() {
      serviceInstance.upsert(
        '/set/' + testId,
        {
          data: {
            test: 'data'
          }
        },
        function(e, created, meta) {
          if (e) return callback(e);
          test.expect(created.data.test).to.equal('data');
          test.expect(meta.created > beforeCreatedOrModified).to.equal(true);
          test.expect(meta.modified > beforeCreatedOrModified).to.equal(true);
          callback();
        }
      );
    }, 100);
  });

  it('gets data', async () => {
    const testPath = `/get/${testId}`;
    await serviceInstance.upsert(testPath, {
      data: {
        test: 'data'
      }
    });
    test.expect((await serviceInstance.find(testPath))[0].data.test).to.be('data');
  });

  it('gets no data', function(callback) {
    var random = require('shortid').generate();

    serviceInstance.find('/wontfind/' + random, {}, function(e, response) {
      if (e) return callback(e);

      test.expect(response).to.eql([]);

      callback();
    });
  });

  it('removes data', function(callback) {
    serviceInstance.upsert(
      '/remove/' + testId,
      {
        test: 'data'
      },
      function(e) {
        if (e) return callback(e);

        serviceInstance.remove('/remove/' + testId, function(e, response) {
          if (e) return callback(e);

          test.expect(response._meta.path).to.equal('/remove/' + testId);
          test.expect(response.data.removed).to.equal(1);

          callback();
        });
      }
    );
  });

  it('removes multiple data', async () => {
    let testPath = `${testId}/multiple`;
    await serviceInstance.upsert(`${testPath}/1`, {
      test: 'data'
    });
    await serviceInstance.upsert(`${testPath}/2`, {
      test: 'data'
    });
    await serviceInstance.upsert(`${testPath}/3`, {
      test: 'data'
    });
    test.expect((await serviceInstance.find(`${testPath}/*`)).length).to.be(3);
    const response = await serviceInstance.remove(`${testPath}/*`);
    test.expect(response._meta.path).to.equal(`${testPath}/*`);
    test.expect(response.data.removed).to.equal(3);
    test.expect((await serviceInstance.find(`${testPath}/*`)).length).to.be(0);
  });

  it('gets data with wildcard', function(callback) {
    serviceInstance.upsert(
      '/get/multiple/1/' + testId,
      {
        data: {
          test: 'data'
        }
      },
      function(e) {
        if (e) return callback(e);

        serviceInstance.upsert(
          '/get/multiple/2/' + testId,
          {
            data: {
              test: 'data'
            }
          },
          function(e) {
            if (e) return callback(e);

            serviceInstance.find('/get/multiple/*/' + testId, {}, function(e, response) {
              test.expect(response.length).to.equal(2);

              test.expect(response[0].data.test).to.equal('data');

              test.expect(response[1].data.test).to.equal('data');

              callback();
            });
          }
        );
      }
    );
  });

  it('gets data with complex search', function(callback) {
    var test_path_end = require('shortid').generate();

    var complex_obj = {
      regions: ['North', 'South'],
      towns: ['North.Cape Town'],
      categories: ['Action', 'History'],
      subcategories: ['Action.angling', 'History.art'],
      keywords: ['bass', 'Penny Siopis'],
      field1: 'field1'
    };

    var criteria1 = {
      $or: [
        {
          'data.regions': {
            $containsAny: ['North', 'South', 'East', 'West']
          }
        },
        {
          'data.towns': {
            $containsAny: ['North.Cape Town', 'South.East London']
          }
        },
        {
          'data.categories': {
            $containsAny: ['Action', 'History']
          }
        }
      ],
      'data.keywords': {
        $containsAny: ['bass', 'Penny Siopis']
      }
    };

    var options1 = {
      sort: {
        field1: 1
      },
      limit: 1
    };

    var criteria2 = null;

    var options2 = {
      fields: null,
      sort: {
        field1: 1
      },
      limit: 2
    };

    // serviceInstance.upsert('/get/multiple/1/' + testId, {data:{"test":"data"}}, {}, false, function(e, response){
    serviceInstance.upsert(
      '/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex/' + test_path_end,
      {
        data: complex_obj
      },
      function(e) {
        test.expect(e == null).to.be(true);

        serviceInstance.upsert(
          '/1_eventemitter_embedded_sanity/' +
            testId +
            '/testsubscribe/data/complex/' +
            test_path_end +
            '/1',
          {
            data: complex_obj
          },
          function(e) {
            test.expect(e == null).to.be(true);

            serviceInstance.upsert(
              '/1_eventemitter_embedded_sanity/' +
                testId +
                '/testsubscribe/data/complex/' +
                test_path_end +
                '/2',
              {
                test: 'data'
              },
              function(e) {
                test.expect(e == null).to.be(true);

                serviceInstance.find(
                  '/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex*',
                  {
                    criteria: criteria1,
                    options: options1
                  },
                  function(e, search_result) {
                    test.expect(e == null).to.be(true);
                    test.expect(search_result.length === 1).to.be(true);

                    serviceInstance.find(
                      '/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex*',
                      {
                        criteria: criteria2,
                        options: options2
                      },
                      function(e, search_result) {
                        test.expect(e == null).to.be(true);
                        test.expect(search_result.length === 2).to.be(true);
                        callback(e);
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });

  xit('gets data with $not', async () => {
    let testPath = `${testId}/not`;
    serviceInstance.upsert(`${testPath}/ok`, { ok: 'ok' });
    serviceInstance.upsert(`${testPath}/_notok_`, { ok: 'not' });
    let result = await serviceInstance.find(`${testId}/*`, {
      criteria: {
        path: {
          $not: { $regex: new RegExp('.*_notok_.*') }
        }
      }
    });
    test.expect(result.length === 1).to.be(true);
  });

  it('does a sort and limit', function(done) {
    let itemCount = 100;
    let randomItems = [];
    let test_string = require('shortid').generate();
    let base_path = '/sort_and_limit/' + test_string + '/';
    for (var i = 0; i < itemCount; i++) {
      var item = {
        item_sort_id: i + Math.floor(Math.random() * 1000000)
      };

      randomItems.push(item);
    }

    test.async.eachSeries(
      randomItems,

      function(item, callback) {
        var testPath = base_path + item.item_sort_id;

        serviceInstance.upsert(
          testPath,
          {
            data: item
          },
          {
            noPublish: true
          },
          function(e) {
            if (e) return callback(e);

            callback();
          }
        );
      },

      function(e) {
        if (e) return done(e);

        //ascending
        randomItems.sort(function(a, b) {
          return a.item_sort_id - b.item_sort_id;
        });

        serviceInstance.find(
          base_path + '*',
          {
            options: {
              sort: {
                'data.item_sort_id': 1
              }
            },
            limit: 50
          },
          function(e, items) {
            if (e) return done(e);

            for (var itemIndex in items) {
              if (itemIndex >= 50) break;

              var item_from_mongo = items[itemIndex];

              var item_from_array = randomItems[itemIndex];

              if (item_from_mongo.data.item_sort_id !== item_from_array.item_sort_id)
                return done(new Error('ascending sort failed'));
            }

            //ascending
            randomItems.sort(function(a, b) {
              return b.item_sort_id - a.item_sort_id;
            });

            serviceInstance.find(
              base_path + '/*',
              {
                options: {
                  sort: {
                    'data.item_sort_id': -1
                  }
                },
                limit: 50
              },
              function(e, items) {
                if (e) return done(e);

                for (var itemIndex in items) {
                  if (itemIndex >= 50) break;

                  var item_from_mongo = items[itemIndex];
                  var item_from_array = randomItems[itemIndex];

                  if (item_from_mongo.data.item_sort_id !== item_from_array.item_sort_id)
                    return done(new Error('descending sort failed'));
                }

                done();
              }
            );
          }
        );
      }
    );
  });

  it('increments a value', function(done) {
    var async = require('async');

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/' + testId + '/' + test_string;

    async.timesSeries(
      10,
      function(time, timeCB) {
        //path, counterName, options, callback
        serviceInstance.increment(test_base_url, 'counter', 1, timeCB);
      },
      function(e) {
        if (e) return done(e);

        serviceInstance.find(test_base_url, {}, function(e, result) {
          if (e) return done(e);

          test.expect(result[0].data.counter.value).to.be(10);

          done();
        });
      }
    );
  });
});
