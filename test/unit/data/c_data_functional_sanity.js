describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(20000);

  var expect = require('expect.js');

  var Utils = require('../../../lib/services/utils/service');

  var utils = new Utils();

  var service = require('../../../lib/services/data/providers/nedb');

  var testId = require('shortid').generate();

  var config = {};

  var serviceInstance = new service(config);

  before('should initialize the service', function (callback) {

    serviceInstance.happn = {
      services: {
        utils: utils,
        system:{
          package:require('../../../package.json')
        }
      }
    };

    serviceInstance.initialize(callback);
  });

  after(function (done) {

    serviceInstance.stop(done);
  });

  it('sets data', function (callback) {

    var beforeCreatedOrModified = Date.now();

    setTimeout(function () {

      serviceInstance.upsert('/set/' + testId, {
        "data": {
          "test": "data"
        }
      }, {}, false, function (e, response, created, upsert, meta) {

        if (e) return callback(e);

        expect(created.data.test).to.equal("data");

        expect(meta.created > beforeCreatedOrModified).to.equal(true);

        expect(meta.modified > beforeCreatedOrModified).to.equal(true);

        callback();

      });
    }, 100);

  });

  it('gets data', function (callback) {

    serviceInstance.upsert('/get/' + testId, {
      data: {
        "test": "data"
      }
    }, {}, false, function (e, response, created) {

      if (e) return callback(e);

      expect(created.data.test).to.equal("data");

      serviceInstance.find('/get/' + testId, {}, function (e, items) {

        if (e) return callback(e);

        expect(items[0].data.test).to.be("data");

        callback();

      });
    });
  });

  it('gets no data', function (callback) {

    var random = require('shortid').generate();

    serviceInstance.find('/wontfind/' + random, {}, function (e, response) {

      if (e) return callback(e);

      expect(response).to.eql([]);

      callback();

    });
  });

  it('removes data', function (callback) {

    serviceInstance.upsert('/remove/' + testId, {
      "test": "data"
    }, {}, false, function (e, response) {

      if (e) return callback(e);

      serviceInstance.remove('/remove/' + testId, function (e, response) {

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
    }, {}, false, function (e, response) {

      if (e) return callback(e);

      serviceInstance.upsert('/remove/multiple/2/' + testId, {
        "test": "data"
      }, {}, false, function (e, response) {

        if (e) return callback(e);

        serviceInstance.remove('/remove/multiple/*', function (e, response) {

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
      data: {
        "test": "data"
      }
    }, {}, false, function (e, response) {

      if (e) return callback(e);

      serviceInstance.upsert('/get/multiple/2/' + testId, {
        data: {
          "test": "data"
        }
      }, {}, false, function (e, response) {

        if (e) return callback(e);

        serviceInstance.find('/get/multiple/*/' + testId, {}, function (e, response) {

          expect(response.length).to.equal(2);

          expect(response[0].data.test).to.equal('data');

          expect(response[1].data.test).to.equal('data');

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
          "data.regions": {
            $in: ['North', 'South', 'East', 'West']
          }
        },
        {
          "data.towns": {
            $in: ['North.Cape Town', 'South.East London']
          }
        },
        {
          "data.categories": {
            $in: ["Action", "History"]
          }
        }
      ],
      "data.keywords": {
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

    // serviceInstance.upsert('/get/multiple/1/' + testId, {data:{"test":"data"}}, {}, false, function(e, response){
    serviceInstance.upsert('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex/' + test_path_end, {
      data: complex_obj
    }, {}, false, function (e, put_result) {

      expect(e == null).to.be(true);

      serviceInstance.upsert('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex/' + test_path_end + '/1', {
        data: complex_obj
      }, {}, false, function (e, put_result) {

        expect(e == null).to.be(true);

        serviceInstance.upsert('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex/' + test_path_end + '/2', {
          "test": "data"
        }, {}, false, function (e, put_result) {

          expect(e == null).to.be(true);

          serviceInstance.find('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex*', {
            criteria: criteria1,
            options: options1
          }, function (e, search_result) {

            expect(e == null).to.be(true);
            expect(search_result.length == 1).to.be(true);

            serviceInstance.find('/1_eventemitter_embedded_sanity/' + testId + '/testsubscribe/data/complex*', {
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
  });

  it('gets data with $not', function (done) {

    var test_obj = {
      data: 'ok'
    };

    var test_obj1 = {
      data: 'notok'
    };

    serviceInstance.upsert('/not_get/' + testId + '/ok/1', test_obj, {}, false, function (e) {

      expect(e == null).to.be(true);

      serviceInstance.upsert('/not_get/' + testId + '/_notok_/1', test_obj1, {}, false, function (e) {

        expect(e == null).to.be(true);

        var listCriteria = {
          criteria: {
            $not: {}
          }
        };

        listCriteria.criteria.$not['path'] = {
          $regex: new RegExp(".*_notok_.*")
        };

        serviceInstance.find('/not_get/' + testId + '/*', listCriteria, function (e, search_result) {

          expect(e == null).to.be(true);

          expect(search_result.length == 1).to.be(true);

          done();

        });
      });
    });
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

        serviceInstance.upsert(testPath, {
          data: item
        }, {
          noPublish: true
        }, false, function (e) {

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

        serviceInstance.find(base_path + '*', {
          options: {
            sort: {
              'data.item_sort_id': 1
            }
          },
          limit: 50
        }, function (e, items) {

          if (e) return done(e);

          for (var itemIndex in items) {

            if (itemIndex >= 50) break;

            var item_from_mongo = items[itemIndex];

            var item_from_array = randomItems[itemIndex];

            if (item_from_mongo.data.item_sort_id != item_from_array.item_sort_id) return done(new Error('ascending sort failed'));
          }

          //ascending
          randomItems.sort(function (a, b) {

            return b.item_sort_id - a.item_sort_id;

          });

          serviceInstance.find(base_path + '/*', {
            options: {
              sort: {
                "data.item_sort_id": -1
              }
            },
            limit: 50
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

      //path, counterName, options, callback
      serviceInstance.increment(test_base_url, 'counter', 1, timeCB);

    }, function (e) {

      if (e) return done(e);

      serviceInstance.find(test_base_url, {}, function (e, result) {

        if (e) return done(e);

        expect(result[0].data.counter.value).to.be(10);

        done();
      });
    });
  });
});
