const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  this.timeout(20000);
  const Utils = require('../../../lib/services/utils/service');
  const utils = new Utils();
  const service = require('../../../lib/services/data/service');
  const serviceInstance = new service();
  const testId = require('shortid').generate();
  const empty_config = {};

  beforeEach('resets sinon', () => {
    test.sinon.restore();
  });

  before('should initialize the service', function(callback) {
    serviceInstance.happn = {
      services: {
        utils: utils,
        system: {
          package: require('../../../package.json')
        }
      }
    };

    serviceInstance.initialize(empty_config, callback);
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
          test: 'data'
        },
        {},
        function(e, response) {
          if (e) return callback(e);

          test.expect(response.data.test).to.equal('data');

          test.expect(response._meta.created > beforeCreatedOrModified).to.equal(true);
          test.expect(response._meta.modified > beforeCreatedOrModified).to.equal(true);

          callback();
        }
      );
    }, 100);
  });

  it('sets data and gets an error from __upsertInternal', function(callback) {
    const db = serviceInstance.db('/set/' + testId);
    test.sinon.stub(db, 'upsert').callsFake((path, setData, options, cb) => {
      return cb(new Error('test error'));
    });

    serviceInstance.upsert('/set/' + testId, { test: 'data' }, {}, function(e) {
      test.expect(e).to.not.be(null);
      test.expect(e.toString()).to.be('Error: test error');
      callback();
    });
  });

  it('gets data', function(callback) {
    serviceInstance.upsert(
      '/get/' + testId,
      {
        test: 'data'
      },
      {},
      function(e, response) {
        if (e) return callback(e);

        test.expect(response.data.test).to.equal('data');

        serviceInstance.get('/get/' + testId, {}, function(e, response) {
          if (e) return callback(e);

          test.expect(response._meta.path).to.equal('/get/' + testId);
          test.expect(response.data.test).to.equal('data');

          callback();
        });
      }
    );
  });

  it('pass an error back if the provider does not implement a count', function(callback) {
    let oldProviderCount = serviceInstance.defaultProvider.count;
    serviceInstance.defaultProvider.count = undefined;
    serviceInstance.count('/count/**', function(err) {
      test.expect(err.message).to.eql('Database provider does not support count');
      serviceInstance.defaultProvider.count = oldProviderCount.bind(
        serviceInstance.defaultProvider
      );
      callback();
    });
  });

  it('pass provider error back', function(callback) {
    let oldProviderCount = serviceInstance.defaultProvider.count;
    serviceInstance.defaultProvider.count = function(path, options, cb) {
      cb(new Error('Provider error'));
    }.bind(serviceInstance.defaultProvider);
    serviceInstance.count('/count/**', {}, function(err) {
      test.expect(err.message).to.eql('Provider error');
      serviceInstance.defaultProvider.count = oldProviderCount.bind(
        serviceInstance.defaultProvider
      );
      callback();
    });
  });

  it('catches exception in provider', function(callback) {
    let oldProviderCount = serviceInstance.defaultProvider.count;
    serviceInstance.defaultProvider.count = function() {
      throw new Error('Provider exception');
    }.bind(serviceInstance.defaultProvider);
    serviceInstance.count('/count/**', {}, function(err) {
      test.expect(err.message).to.eql('Provider exception');
      serviceInstance.defaultProvider.count = oldProviderCount.bind(
        serviceInstance.defaultProvider
      );
      callback();
    });
  });

  it('counts data', function(callback) {
    let count = 10;

    test.async.times(
      10,
      function(n, cb) {
        serviceInstance.upsert(
          '/count/' + testId + '/' + n,
          {
            test: 'data'
          },
          {},
          function(e, response) {
            if (e) return cb(e);
            test.expect(response.data.test).to.equal('data');
            cb();
          }
        );
      },
      function(err) {
        if (err) return callback(err);
        serviceInstance.count('/count/**', function(err, result) {
          if (err) return callback(err);
          test.expect(result.data.value).to.eql(count);
          callback();
        });
      }
    );
  });

  it('gets no data', function(callback) {
    var random = require('shortid').generate();

    serviceInstance.get('/wontfind/' + random, {}, function(e, response) {
      if (e) return callback(e);

      test.expect(response).to.equal(null);
      callback();
    });
  });

  it('merges data', function(callback) {
    this.timeout(10000);

    var initialCreated;

    serviceInstance.upsert(
      '/merge/' + testId,
      {
        test: 'data'
      },
      {},
      function(e, response) {
        if (e) return callback(e);

        initialCreated = response._meta.created;

        setTimeout(function() {
          serviceInstance.upsert(
            '/merge/' + testId,
            {
              test1: 'data1'
            },
            {
              merge: true
            },
            function(e, response) {
              if (e) return callback(e);

              test.expect(response._meta.modified >= initialCreated).to.equal(true);

              serviceInstance.get('/merge/' + testId, {}, function(e, response) {
                if (e) return callback(e);

                test.expect(response.data.test).to.equal('data');
                test.expect(response.data.test1).to.equal('data1');
                test.expect(response._meta.created).to.equal(initialCreated);
                test.expect(response._meta.modified > initialCreated).to.equal(true);

                callback();
              });
            }
          );
        }, 1000);
      }
    );
  });

  it('removes data', function(callback) {
    serviceInstance.upsert(
      '/remove/' + testId,
      {
        test: 'data'
      },
      {},
      function(e) {
        if (e) return callback(e);

        serviceInstance.remove('/remove/' + testId, {}, function(e, response) {
          if (e) return callback(e);

          test.expect(response._meta.path).to.equal('/remove/' + testId);
          test.expect(response.data.removed).to.equal(1);

          callback();
        });
      }
    );
  });

  it('removes multiple data', function(callback) {
    serviceInstance.upsert(
      '/remove/multiple/1/' + testId,
      {
        test: 'data'
      },
      {},
      function(e) {
        if (e) return callback(e);

        serviceInstance.upsert(
          '/remove/multiple/2/' + testId,
          {
            test: 'data'
          },
          {},
          function(e) {
            if (e) return callback(e);

            serviceInstance.remove('/remove/multiple/*', {}, function(e, response) {
              if (e) return callback(e);

              test.expect(response._meta.path).to.equal('/remove/multiple/*');
              test.expect(response.data.removed).to.equal(2);

              callback();
            });
          }
        );
      }
    );
  });

  it('gets data with wildcard', function(callback) {
    serviceInstance.upsert(
      '/get/multiple/1/' + testId,
      {
        test: 'data'
      },
      {},
      function(e) {
        if (e) return callback(e);

        serviceInstance.upsert(
          '/get/multiple/2/' + testId,
          {
            test: 'data'
          },
          {},
          function(e) {
            if (e) return callback(e);

            serviceInstance.get('/get/multiple/*/' + testId, {}, function(e, response) {
              test.expect(response.length).to.equal(2);
              test.expect(response[0].data.test).to.equal('data');
              test.expect(response[0]._meta.path).to.equal('/get/multiple/1/' + testId);
              test.expect(response[1].data.test).to.equal('data');
              test.expect(response[1]._meta.path).to.equal('/get/multiple/2/' + testId);

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
          regions: {
            $containsAny: ['North', 'South', 'East', 'West']
          }
        },
        {
          towns: {
            $containsAny: ['North.Cape Town', 'South.East London']
          }
        },
        {
          categories: {
            $containsAny: ['Action', 'History']
          }
        }
      ],
      keywords: {
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

    serviceInstance.upsert(
      '/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex/' + test_path_end,
      complex_obj,
      null,
      function(e) {
        test.expect(e == null).to.be(true);
        serviceInstance.upsert(
          '/1_eventemitter_embedded_sanity/' +
            testId +
            '/testsubscribe/data/complex/' +
            test_path_end +
            '/1',
          complex_obj,
          null,
          function(e) {
            test.expect(e == null).to.be(true);
            serviceInstance.get(
              '/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex*',
              {
                criteria: criteria1,
                options: options1
              },
              function(e, search_result) {
                test.expect(e == null).to.be(true);
                test.expect(search_result.length === 1).to.be(true);

                serviceInstance.get(
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
  });

  it('sets value data', function(callback) {
    try {
      var test_string = require('shortid').generate();
      var test_base_url =
        '/a1_eventemitter_embedded_datatypes/' + testId + '/set/string/' + test_string;

      serviceInstance.upsert(
        test_base_url,
        test_string,
        {
          noPublish: true
        },
        function(e, result) {
          if (!e) {
            test.expect(result.data.value).to.be(test_string);

            serviceInstance.get(test_base_url, null, function(e, result) {
              if (e) return callback(e);

              test.expect(result.data.value).to.be(test_string);

              callback(e);
            });
          } else callback(e);
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('does a sort and limit', function(done) {
    var itemCount = 100;
    var randomItems = [];
    var test_string = require('shortid').generate();
    var base_path = '/sort_and_limit/' + test_string + '/';

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
          item,
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

        serviceInstance.get(
          base_path + '*',
          {
            options: {
              sort: {
                item_sort_id: 1
              },
              limit: 50
            }
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

            //descending
            randomItems.sort(function(a, b) {
              return b.item_sort_id - a.item_sort_id;
            });

            serviceInstance.get(
              base_path + '/*',
              {
                options: {
                  sort: {
                    item_sort_id: -1
                  },
                  limit: 50
                }
              },
              function(e, items) {
                if (e) return done(e);

                for (var itemIndex in items) {
                  if (itemIndex >= 50) break;

                  var item_from_mongo = items[itemIndex];
                  var item_from_array = randomItems[itemIndex];

                  if (item_from_mongo.data.item_sort_id !== item_from_array.item_sort_id) {
                    // this is an intermittent failure, adding some logging
                    // so we are able to diagnose from travis.
                    // thus the following console.log is intentional
                    // eslint-disable-next-line
                      console.log(
                      `error on sort and limit: checked ${itemIndex}
                        compare: ${item_from_mongo.data.item_sort_id} (db)
                        to ${item_from_array.item_sort_id} (mock)`
                    );

                    return done(new Error('descending sort failed'));
                  }
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
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/' + testId + '/' + test_string;

    test.async.timesSeries(
      10,
      function(time, timeCB) {
        serviceInstance.upsert(test_base_url, 'counter', { increment: 1, noPublish: true }, timeCB);
      },
      function(e) {
        if (e) return done(e);

        serviceInstance.get(test_base_url, null, function(e, result) {
          if (e) return done(e);

          test.expect(result.data.counter.value).to.be(10);

          done();
        });
      }
    );
  });

  it('fails to increment a value, bad provider', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    var provider = serviceInstance.db(test_base_url);

    provider.__oldIncrement = provider.increment;

    provider.increment = undefined;

    serviceInstance.upsert(test_base_url, 'counter', { increment: 1, noPublish: true }, function(
      e
    ) {
      test.expect(e.toString()).to.be('Error: db provider does not have an increment function');

      provider.increment = provider.__oldIncrement;

      done();
    });
  });

  it('fails to increment a value, null fieldname', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    serviceInstance.upsert(test_base_url, null, { increment: 1, noPublish: true }, function(e) {
      test
        .expect(e.toString())
        .to.be('Error: invalid increment counter field name, must be a string');

      done();
    });
  });

  it('fails to increment a value, undefined fieldname', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    serviceInstance.upsert(test_base_url, undefined, { increment: 1, noPublish: true }, function(
      e
    ) {
      test
        .expect(e.toString())
        .to.be('Error: invalid increment counter field name, must be a string');

      done();
    });
  });

  it('fails to increment a value, object fieldname', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    serviceInstance.upsert(
      test_base_url,
      { test: 'fieldname' },
      { increment: 1, noPublish: true },
      function(e) {
        test
          .expect(e.toString())
          .to.be('Error: invalid increment counter field name, must be a string');

        done();
      }
    );
  });

  it('fails to increment a value, bad increment argument in options', function(done) {
    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    serviceInstance.upsert(
      test_base_url,
      'counter',
      { increment: 'blah', noPublish: true },
      function(e) {
        test.expect(e.toString()).to.be('Error: increment option value must be a number');

        done();
      }
    );
  });
});
