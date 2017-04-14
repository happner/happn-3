describe('c9_unsubscribe_changes_eventemitter', function () {

  //require('benchmarket').start();
  //after(//require('benchmarket').store());

  var expect = require('expect.js');
  var Promise = require('bluebird');
  var happn = require('../lib/index');
  var service = happn.service;
  var async = require('async');
  var test_secret = 'test_secret';
  var default_timeout = 10000;
  var happnInstance = null;

  this.timeout(20000);

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  after(function (done) {
    happnInstance.stop(done);
  });

  before('should initialize the service', function (callback) {

    try {

      service.create(function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });


  var publisherclient;
  var listenerclient;
  var originalHandleData;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the clients', function (callback) {

    this.timeout(default_timeout);

    try {

      happnInstance.services.session.localClient(function (e, instance) {

        if (e) return callback(e);

        publisherclient = instance;

        happnInstance.services.session.localClient(function (e, instance) {

          if (e) return callback(e);
          listenerclient = instance;
          listenerclient.onAsync = Promise.promisify(listenerclient.on);
          callback();

        });
      });

    } catch (e) {
      callback(e);
    }
  });

  beforeEach(function () {
    originalHandleData = listenerclient.handle_data;
  });

  afterEach(function () {
    listenerclient.handle_data = originalHandleData;
  });

  it('should unsubscribe from an event', function (callback) {

    var currentListenerId;
    var onRan = false;
    var pathOnRan = false;

    listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type: 'set', count: 0}, function (message) {

      if (pathOnRan) return callback(new Error('subscription was not removed by path'));
      else pathOnRan = true;

      //off path is deprecated - but should still function
      listenerclient.off('/e2e_test1/testsubscribe/data/on_off_test', function (e) {

        if (e)
          return callback(new Error(e));

        listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {event_type: 'set', count: 0},
          function (message) {
            if (onRan) return callback(new Error('subscription was not removed'));
            else {
              onRan = true;
              listenerclient.off(currentListenerId, function (e) {
                if (e)
                  return callback(new Error(e));

                publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                }, {}, function (e, setresult) {
                  if (e) return callback(new Error(e));
                  setTimeout(callback, 1000);
                });
              });
            }
          },
          function (e, listenerId) {
            if (e) return callback(new Error(e));

            currentListenerId = listenerId;

            publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }, {}, function (e, setresult) {
              if (e) return callback(new Error(e));
            });
          });
      });

    }, function (e, listenerId) {
      if (e) return callback(new Error(e));

      currentListenerId = listenerId;

      publisherclient.set('/e2e_test1/testsubscribe/data/on_off_test', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, function (e) {
        if (e) return callback(new Error(e));
      });

    });
  });

  it('should unsubscribe from an event path', function (callback) {

    var pathOnRan = false;

    listenerclient.on('/e2e_test1/testsubscribe/data/path_off_test', {event_type: 'set', count: 0}, function (message) {

      if (pathOnRan) return callback(new Error('subscription was not removed by path'));
      else pathOnRan = true;

      listenerclient.offPath('/e2e_test1/testsubscribe/data/path_off_test', function (e) {

        if (e) return callback(new Error(e));

        publisherclient.set('/e2e_test1/testsubscribe/data/path_off_test', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        }, {}, function (e) {
          if (e) return callback(new Error(e));
          setTimeout(callback, 1000);
        });

      });

    }, function (e) {
      if (e) return callback(new Error(e));

      publisherclient.set('/e2e_test1/testsubscribe/data/path_off_test', {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, function (e) {
        if (e) return callback(new Error(e));
      });

    });
  });

  it('should unsubscribe from an event path using a wildcard', function (callback) {

    var currentListenerId;
    var onRan = false;
    var pathOnRan = false;

    listenerclient.on('/e2e_test1/testsubscribe/data/wildcard_path_off_test/*', {
      event_type: 'set',
      count: 0
    }, function (message) {
      return callback(new Error('not meant to happen'));
    }, function (e) {
      if (e) return callback(new Error(e));

      listenerclient.on('/e2e_test1/testsubscribe/data/wildcard_path_off_test/data/*', function (data) {
        return callback(new Error('not meant to happen'));
      }, function (e) {

        if (e) return callback(new Error(e));

        listenerclient.offPath('/e2e_test1/testsubscribe/data/wildcard*', function (e) {

          if (e) return callback(new Error(e));

          publisherclient.set('/e2e_test1/testsubscribe/data/wildcard_path_off_test', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, {}, function (e) {
            if (e) return callback(new Error(e));
            setTimeout(callback, 1000);
          });

        });
      });
    });
  });

  it('tests various fail conditions', function (callback) {

    listenerclient.off(null, function (e) {
      expect(e.toString()).to.be('Error: handle or callback cannot be null');

      listenerclient.off(undefined, function (e) {
        expect(e.toString()).to.be('Error: handle or callback cannot be null');
        //doing off with non-existant path
        listenerclient.offPath('some odd random path', function (e) {
          if (e) return callback(e);
          //doing off with non-existant event handle
          listenerclient.off(187253849567, callback);
        });
      });
    });
  });

  it('should unsubscribe from all events', function (callback) {
    this.timeout(10000);

    var onHappened = false;

    listenerclient.onAll(function (message) {

      onHappened = true;
      callback(new Error('this wasnt meant to happen'));

    }, function (e) {

      if (e) return callback(e);

      listenerclient.on('/e2e_test1/testsubscribe/data/off_all_test', {event_type: 'set', count: 0},
        function (message) {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function (e) {
          if (e) return callback(e);

          listenerclient.offAll(function (e) {
            if (e) return callback(e);

            publisherclient.set('/e2e_test1/testsubscribe/data/off_all_test', {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }, null, function (e, put_result) {
              if (e) return callback(e);

              setTimeout(function () {

                if (!onHappened)
                  callback();

              }, 1000);
            });
          });
        }
      );
    });
  });

  it('should unsubscribe from only specific events with wildcard', function (callback) {
    this.timeout(10000);

    var results = {};

    Promise.all([
      listenerclient.onAsync('/with/wildcard/unsubscribe/from/only/*', {event_type: 'set'}, function (data, meta) {
        results[1] = true
      }),
      listenerclient.onAsync('/with/wildcard/unsubscribe/from/only/*', {event_type: 'set'}, function (data, meta) {
        results[2] = true
      }),
      listenerclient.onAsync('/with/wildcard/unsubscribe/from/only/*', {event_type: 'set'}, function (data, meta) {
        results[3] = true
      })
    ])

      .spread(function (result1, result2, result3) {
        // unsubscribe from 2nd subscription only
        return listenerclient.off(result2[0]);
      })

      .then(function () {
        return publisherclient.set('/with/wildcard/unsubscribe/from/only/1', {});
      })

      .then(function () {
        return Promise.delay(500);
      })

      .then(function () {
        expect(results).to.eql({
          1: true,
          3: true
        });
      })

      .then(callback).catch(callback);

  });

  it('should unsubscribe from only specific events without wildcard', function (callback) {
    this.timeout(10000);

    var results = {};
    var listenerId1, listenerId2, litenerId3;
    var emittedPath;

    Promise.all([
      listenerclient.onAsync('/without/wildcard/unsubscribe/from/only', {event_type: 'set'}, function (data, meta) {
        results[1] = true
      }),
      listenerclient.onAsync('/without/wildcard/unsubscribe/from/only', {event_type: 'set'}, function (data, meta) {
        results[2] = true
      }),
      listenerclient.onAsync('/without/wildcard/unsubscribe/from/only', {event_type: 'set'}, function (data, meta) {
        results[3] = true
      })
    ])

      .spread(function (result1, result2, result3) {
        listenerId1 = result1[0];
        listenerId2 = result2[0];
        listenerId3 = result3[0];

        // unsubscribe from 2nd subscription only
        return listenerclient.off(listenerId2);
      })

      .then(function () {
        return publisherclient.set('/without/wildcard/unsubscribe/from/only', {});
      })

      .then(function () {
        return Promise.delay(500);
      })

      .then(function () {
        expect(results).to.eql({
          1: true,
          3: true
        });
      })

      .then(function () {
        return listenerclient.off(listenerId1);
      })

      .then(function () {
        return listenerclient.off(listenerId3);
      })

      .then(function () {
        // no longer subscribed to any, ensure the publication does not erroneously get sent to
        // listenerclient anyway... and be filtered out clientside

        listenerclient.handle_data = function (path) {
          emittedPath = path;
          originalHandleData.apply(this, arguments);
        }
      })

      .then(function () {
        results = {};
        return publisherclient.set('/without/wildcard/unsubscribe/from/only', {});
      })

      .then(function () {
        return Promise.delay(500);
      })

      .then(function () {
        expect(results).to.eql({});
      })

      .then(function () {
        expect(emittedPath).to.equal(undefined);
      })

      .then(callback).catch(callback);

  });

  it('should remove only the correct subscriptionData entry with wildcard', function (callback) {
    this.timeout(10000);

    Promise.all([
      listenerclient.onAsync('/with/wildcard/remove/correct/subscriptionData/*', {
        event_type: 'set',
        meta: {x: 1}
      }, function (data, meta) {
        results[1] = true
      }),
      listenerclient.onAsync('/with/wildcard/remove/correct/subscriptionData/*', {
        event_type: 'set',
        meta: {x: 2}
      }, function (data, meta) {
        results[2] = true
      }),
      listenerclient.onAsync('/with/wildcard/remove/correct/subscriptionData/*', {
        event_type: 'set',
        meta: {x: 3}
      }, function (data, meta) {
        results[3] = true
      })
    ])

      .spread(function (result1, result2, result3) {
        // unsubscribe from 2nd subscription only
        return listenerclient.off(result2[0]);
      })

      .then(function () {
        var bucket = happnInstance.services.subscription.__buckets.filter(function (bucket) {
          return bucket.options.name == '__listeners_SET';
        })[0];

        var segment = bucket.__subscriptions.array.filter(function (segment) {
          return segment.fullPath == '/with/wildcard/remove/correct/subscriptionData/*';
        })[0];

        var metaArray = Object.keys(segment.subscriptionData).map(function (listenerId) {
          return segment.subscriptionData[listenerId].options.meta;
        });

        expect(metaArray).to.eql([
          {x: 1},
          {x: 3}
        ]);
      })

      .then(callback).catch(callback);

  });

  it('should remove only the correct subscriptionData entry without wildcard', function (callback) {
    this.timeout(10000);

    Promise.all([
      listenerclient.onAsync('/without/wildcard/remove/correct/subscriptionData', {
        event_type: 'set',
        meta: {x: 1}
      }, function (data, meta) {
        results[1] = true
      }),
      listenerclient.onAsync('/without/wildcard/remove/correct/subscriptionData', {
        event_type: 'set',
        meta: {x: 2}
      }, function (data, meta) {
        results[2] = true
      }),
      listenerclient.onAsync('/without/wildcard/remove/correct/subscriptionData', {
        event_type: 'set',
        meta: {x: 3}
      }, function (data, meta) {
        results[3] = true
      })
    ])

      .spread(function (result1, result2, result3) {
        // unsubscribe from 2nd subscription only
        return listenerclient.off(result2[0]);
      })

      .then(function () {

        var bucket = happnInstance.services.subscription.__buckets.filter(function (bucket) {
          return bucket.options.name == '__listeners_SET';
        })[0];

        var pathAndSession = '/without/wildcard/remove/correct/subscriptionData' +
          bucket.options.pathSessionDelimiter +
          listenerclient.session.id;

        var subscription = bucket.__explicit_subscriptions.get(pathAndSession)[0];

        var metaArray = Object.keys(subscription.subscriptionData).map(function (listenerId) {
          return subscription.subscriptionData[listenerId].options.meta;
        });

        expect(metaArray).to.eql([
          {x: 1},
          {x: 3}
        ]);

      })

      .then(callback).catch(callback);

  });

  it('should remove all subscriptions on offPath without wildcard', function (callback) {
    this.timeout(10000);

    var results = {};
    var emittedPath;

    Promise.all([
      listenerclient.onAsync('/without/wildcard/off/path', {event_type: 'set'}, function (data, meta) {
        results[1] = true
      }),
      listenerclient.onAsync('/without/wildcard/off/path', {event_type: 'set'}, function (data, meta) {
        results[2] = true
      }),
      listenerclient.onAsync('/without/wildcard/off/path', {event_type: 'set'}, function (data, meta) {
        results[3] = true
      })
    ])

      .then(function () {
        return listenerclient.offPath('/without/wildcard/off/path');
      })

      .then(function () {
        // no longer subscribed to any, ensure the publication does not erroneously get sent to
        // listenerclient anyway... and be filtered out clientside

        listenerclient.handle_data = function (path) {
          emittedPath = path;
          originalHandleData.apply(this, arguments);
        }
      })

      .then(function () {
        results = {};
        return publisherclient.set('/without/wildcard/off/path', {});
      })

      .then(function () {
        return Promise.delay(500);
      })

      .then(function () {
        expect(results).to.eql({});
      })

      .then(function () {
        expect(emittedPath).to.equal(undefined);
      })

      .then(callback).catch(callback);
  });

  //require('benchmarket').stop();

});
