describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(20000);

  var async = require('async');

  var expect = require('expect.js');

  var Utils = require('../../../lib/services/utils/service');

  var utils = new Utils();

  var service = require('../../../lib/services/data/service');

  var serviceInstance = new service();

  var testId = require('shortid').generate();

  var empty_config = {};

  before('should initialize the service', function (callback) {

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

  after(function (done) {

    serviceInstance.stop(done);
  });

  it('sets data', function (callback) {

    var beforeCreatedOrModified = Date.now();

    setTimeout(function () {

      serviceInstance.upsert('/set/' + testId, {
        "test": "data"
      }, {}, function (e, response) {

        if (e) return callback(e);

        expect(response.data.test).to.equal("data");

        expect(response._meta.created > beforeCreatedOrModified).to.equal(true);
        expect(response._meta.modified > beforeCreatedOrModified).to.equal(true);

        callback();

      });


    }, 100);

  });

  it('sets data and gets an error from __upsertInternal', function (callback) {

    setTimeout(function () {

      var db = serviceInstance.db('/set/' + testId);

      db.__oldUpsert = db.upsert;

      db.upsert = function (path, setData, options, dataWasMerged, callback) {

        return callback(new Error('test error'));
      };

      serviceInstance.upsert('/set/' + testId, {"test": "data"}, {}, function (e, response) {

        expect(e).to.not.be(null);

        expect(e.toString()).to.be('Error: test error');

        db.upsert = db.__oldUpsert.bind(db);

        callback();

      });

    }, 100);

  });

  it('gets data', function (callback) {

    serviceInstance.upsert('/get/' + testId, {
      "test": "data"
    }, {}, function (e, response) {

      if (e) return callback(e);

      expect(response.data.test).to.equal("data");

      serviceInstance.get('/get/' + testId, {}, function (e, response) {

        if (e) return callback(e);

        expect(response._meta.path).to.equal('/get/' + testId);
        expect(response.data.test).to.equal("data");

        callback();

      });
    });
  });

  it('pass an error back if the provider does not implement a count', function (callback) {
    let oldProviderCount = serviceInstance.defaultProvider.count;
    serviceInstance.defaultProvider.count = undefined;
    serviceInstance.count('/count/**', function (err) {
      expect(err.message).to.eql('Database provider does not support count')
      serviceInstance.defaultProvider.count = oldProviderCount.bind(serviceInstance.defaultProvider);
      callback();
    });
  });

  it('pass provider error back', function (callback) {
    let oldProviderCount = serviceInstance.defaultProvider.count;
    serviceInstance.defaultProvider.count = function (path, options, cb) {
      cb(new Error('Provider error'));
    }.bind(serviceInstance.defaultProvider);
    serviceInstance.count('/count/**', {}, function (err) {
      expect(err.message).to.eql('Provider error')
      serviceInstance.defaultProvider.count = oldProviderCount.bind(serviceInstance.defaultProvider);
      callback();
    });
  });

  it('catches exception in provider', function (callback) {
    let oldProviderCount = serviceInstance.defaultProvider.count;
    serviceInstance.defaultProvider.count = function (path, options, cb) {
      throw new Error('Provider exception');
    }.bind(serviceInstance.defaultProvider);
    serviceInstance.count('/count/**', {}, function (err) {
      expect(err.message).to.eql('Provider exception')
      serviceInstance.defaultProvider.count = oldProviderCount.bind(serviceInstance.defaultProvider);
      callback();
    });
  });

  it('counts data', function (callback) {

    let count = 10;

    async.times(10, function (n, cb) {
      serviceInstance.upsert('/count/' + testId + '/' + n, {
        "test": "data"
      }, {}, function (e, response) {
        if (e) return cb(e);
        expect(response.data.test).to.equal("data");
        cb();
      });
    }, function (err) {
      if (err) return callback(err);
      serviceInstance.count('/count/**', function (err, result) {
        if (err) return callback(err);
        expect(result.data.value).to.eql(count);
        callback();
      })
    });
  });

  it('gets no data', function (callback) {

    var random = require('shortid').generate();

    serviceInstance.get('/wontfind/' + random, {}, function (e, response) {

      if (e) return callback(e);

      expect(response).to.equal(null);
      callback();

    });

  });


  it('merges data', function (callback) {

    this.timeout(10000);

    var initialCreated;

    serviceInstance.upsert('/merge/' + testId, {
      "test": "data"
    }, {}, function (e, response) {

      if (e) return callback(e);

      initialCreated = response._meta.created;

      setTimeout(function () {

        serviceInstance.upsert('/merge/' + testId, {
          "test1": "data1"
        }, {
          merge: true
        }, function (e, response) {

          if (e) return callback(e);

          expect(response._meta.modified >= initialCreated).to.equal(true);

          serviceInstance.get('/merge/' + testId, {}, function (e, response) {

            if (e) return callback(e);

            expect(response.data.test).to.equal("data");
            expect(response.data.test1).to.equal("data1");
            expect(response._meta.created).to.equal(initialCreated);
            expect(response._meta.modified > initialCreated).to.equal(true);

            callback();

          });

        });

      }, 1000);

    });

  });

  it('tags data', function (callback) {

    var tag = require("shortid").generate();

    serviceInstance.upsert('/tag/' + testId, {
      "test": "data"
    }, {}, function (e) {

      if (e) return callback(e);

      serviceInstance.upsert('/tag/' + testId, null, {
        "tag": tag
      }, function (e, response) {

        if (e) return callback(e);

        expect(response.data.data.test).to.equal('data');

        expect(response.data._meta.path).to.equal('/tag/' + testId);

        expect(response._meta.tag).to.equal(tag);

        expect(response._meta.path.indexOf('/_TAGS' + '/tag/' + testId)).to.equal(0);

        callback();

      });
    });
  });

  it('removes data', function (callback) {

    serviceInstance.upsert('/remove/' + testId, {
      "test": "data"
    }, {}, function (e, response) {

      if (e) return callback(e);

      serviceInstance.remove('/remove/' + testId, {}, function (e, response) {

        if (e) return callback(e);

        expect(response._meta.path).to.equal('/remove/' + testId);
        expect(response.data.removed).to.equal(1);

        callback();

      });
    });
  });

  it('removes multiple data', function (callback) {

    serviceInstance.upsert('/remove/multiple/1/' + testId, {
      "test": "data"
    }, {}, function (e, response) {

      if (e) return callback(e);

      serviceInstance.upsert('/remove/multiple/2/' + testId, {
        "test": "data"
      }, {}, function (e, response) {

        if (e) return callback(e);

        serviceInstance.remove('/remove/multiple/*', {}, function (e, response) {

          if (e) return callback(e);

          expect(response._meta.path).to.equal('/remove/multiple/*');
          expect(response.data.removed).to.equal(2);

          callback();

        });
      });
    });
  });

  it('gets data with wildcard', function (callback) {

    serviceInstance.upsert('/get/multiple/1/' + testId, {
      "test": "data"
    }, {}, function (e, response) {

      if (e) return callback(e);

      serviceInstance.upsert('/get/multiple/2/' + testId, {
        "test": "data"
      }, {}, function (e, response) {

        if (e) return callback(e);

        serviceInstance.get('/get/multiple/*/' + testId, {}, function (e, response) {

          expect(response.length).to.equal(2);
          expect(response[0].data.test).to.equal('data');
          expect(response[0]._meta.path).to.equal('/get/multiple/1/' + testId);
          expect(response[1].data.test).to.equal('data');
          expect(response[1]._meta.path).to.equal('/get/multiple/2/' + testId);

          callback();

        });
      });
    });
  });

  it('gets data with complex search', function (callback) {

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
      $or: [{
        "regions": {
          $in: ['North', 'South', 'East', 'West']
        }
      },
        {
          "towns": {
            $in: ['North.Cape Town', 'South.East London']
          }
        },
        {
          "categories": {
            $in: ["Action", "History"]
          }
        }
      ],
      "keywords": {
        $in: ["bass", "Penny Siopis"]
      }
    };

    var options1 = {
      sort: {
        "field1": 1
      },
      limit: 1
    };

    var criteria2 = null;

    var options2 = {
      fields: null,
      sort: {
        "field1": 1
      },
      limit: 2
    };

    serviceInstance.upsert('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex/' + test_path_end, complex_obj, null, function (e, put_result) {

      expect(e == null).to.be(true);
      serviceInstance.upsert('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex/' + test_path_end + '/1', complex_obj, null, function (e, put_result) {
        expect(e == null).to.be(true);

        ////////////console.log('searching');
        serviceInstance.get('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex*', {
          criteria: criteria1,
          options: options1
        }, function (e, search_result) {

          expect(e == null).to.be(true);
          expect(search_result.length == 1).to.be(true);

          serviceInstance.get('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex*', {
            criteria: criteria2,
            options: options2
          }, function (e, search_result) {

            expect(e == null).to.be(true);
            expect(search_result.length == 2).to.be(true);
            callback(e);
          });

        });

      });

    });

  });

  it('gets data with $not', function (done) {

    var test_obj = {
      data: 'ok'
    };

    var test_obj1 = {
      data: 'notok'
    };

    serviceInstance.upsert('/not_get/' + testId + '/ok/1', test_obj, null, function (e) {
      expect(e == null).to.be(true);

      serviceInstance.upsert('/not_get/' + testId + '/_notok_/1', test_obj1, null, function (e) {
        expect(e == null).to.be(true);

        var listCriteria = {
          criteria: {
            $not: {}
          }
        };

        listCriteria.criteria.$not._id = {
          $regex: [".*_notok_.*"]
        };

        serviceInstance.get('/not_get/' + testId + '/*', listCriteria, function (e, search_result) {

          expect(e == null).to.be(true);

          expect(search_result.length == 1).to.be(true);

          done();

        });
      });
    });
  });

  it('sets value data', function (callback) {

    try {

      var test_string = require('shortid').generate();
      var test_base_url = '/a1_eventemitter_embedded_datatypes/' + testId + '/set/string/' + test_string;

      serviceInstance.upsert(test_base_url, test_string, {
        noPublish: true
      }, function (e, result) {

        if (!e) {

          expect(result.data.value).to.be(test_string);

          serviceInstance.get(test_base_url, null, function (e, result) {

            if (e) return callback(e);

            expect(result.data.value).to.be(test_string);

            callback(e);
          });
        } else
          callback(e);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('does a sort and limit', function (done) {

    var itemCount = 100;

    var randomItems = [];

    var test_string = require('shortid').generate();

    var base_path = '/sort_and_limit/' + test_string + '/';

    var async = require('async');

    for (var i = 0; i < itemCount; i++) {

      var item = {
        item_sort_id: i + (Math.floor(Math.random() * 1000000))
      };

      randomItems.push(item);
    }

    async.eachSeries(randomItems,

      function (item, callback) {

        var testPath = base_path + item.item_sort_id;

        serviceInstance.upsert(testPath, item, {
          noPublish: true
        }, function (e, upserted) {

          if (e) return callback(e);

          callback();

        });
      },

      function (e) {

        if (e) return done(e);

        //ascending
        randomItems.sort(function (a, b) {

          return a.item_sort_id - b.item_sort_id;

        });

        serviceInstance.get(base_path + '*', {
          options: {
            sort: {
              item_sort_id: 1
            },
            limit: 50
          }
        }, function (e, items) {

          if (e) return done(e);

          for (var itemIndex in items) {

            if (itemIndex >= 50) break;

            var item_from_mongo = items[itemIndex];

            var item_from_array = randomItems[itemIndex];

            if (item_from_mongo.data.item_sort_id != item_from_array.item_sort_id) return done(new Error('ascending sort failed'));
          }

          //descending
          randomItems.sort(function (a, b) {

            return b.item_sort_id - a.item_sort_id;

          });

          serviceInstance.get(base_path + '/*', {
            options: {
              sort: {
                "item_sort_id": -1
              },
              limit: 50
            }
          }, function (e, items) {

            if (e) return done(e);

            for (var itemIndex in items) {

              if (itemIndex >= 50) break;

              var item_from_mongo = items[itemIndex];
              var item_from_array = randomItems[itemIndex];

              if (item_from_mongo.data.item_sort_id != item_from_array.item_sort_id) return done(new Error('descending sort failed'));
            }

            done();

          });

        });
      }
    );
  });

  it('increments a value', function (done) {

    var async = require('async');

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/' + testId + '/' + test_string;

    async.timesSeries(10, function (time, timeCB) {

      serviceInstance.upsert(test_base_url, 'counter', {increment: 1, noPublish: true}, timeCB);

    }, function (e) {

      if (e) return done(e);

      serviceInstance.get(test_base_url, null, function (e, result) {

        if (e) return done(e);

        expect(result.data.counter.value).to.be(10);

        done();
      });
    });
  });

  it('fails to increment a value, bad provider', function (done) {

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    var provider = serviceInstance.db(test_base_url);

    provider.__oldIncrement = provider.increment;

    provider.increment = undefined;

    serviceInstance.upsert(test_base_url, 'counter', {increment: 1, noPublish: true}, function (e) {

      expect(e.toString()).to.be('Error: db provider does not have an increment function');

      provider.increment = provider.__oldIncrement;

      done();
    });
  });

  it('fails to increment a value, null fieldname', function (done) {

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    var provider = serviceInstance.db(test_base_url);

    serviceInstance.upsert(test_base_url, null, {increment: 1, noPublish: true}, function (e) {

      expect(e.toString()).to.be('Error: invalid increment counter field name, must be a string');

      done();
    });
  });

  it('fails to increment a value, undefined fieldname', function (done) {

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    var provider = serviceInstance.db(test_base_url);

    serviceInstance.upsert(test_base_url, undefined, {increment: 1, noPublish: true}, function (e) {

      expect(e.toString()).to.be('Error: invalid increment counter field name, must be a string');

      done();
    });
  });

  it('fails to increment a value, object fieldname', function (done) {

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    var provider = serviceInstance.db(test_base_url);

    serviceInstance.upsert(test_base_url, {test: 'fieldname'}, {increment: 1, noPublish: true}, function (e) {

      expect(e.toString()).to.be('Error: invalid increment counter field name, must be a string');

      done();
    });
  });

  it('fails to increment a value, bad increment argument in options', function (done) {

    var test_string = require('shortid').generate();
    var test_base_url = '/increment/bad/provider/' + testId + '/' + test_string;

    var provider = serviceInstance.db(test_base_url);

    serviceInstance.upsert(test_base_url, 'counter', {increment: 'blah', noPublish: true}, function (e) {

      expect(e.toString()).to.be('Error: increment option value must be a number');

      done();
    });
  });
});
