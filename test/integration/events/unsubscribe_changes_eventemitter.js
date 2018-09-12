describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var Promise = require('bluebird');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var async = require('async');
  var test_secret = 'test_secret';
  var default_timeout = 4000;
  var happnInstance = null;

  this.timeout(default_timeout);

  after(function (done) {
    happnInstance.stop(done);
  });

  before('should initialize the service', function (callback) {

    var config = {};

    try {

      service.create(config, function (e, happnInst) {
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

  before('should initialize the clients', function (callback) {

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

  // if (bucketType == 'strict_bucket') {
  //   return; // dont test strict bucket, unsubscribing there does not seem to work at all...
  //
  //   // TODO: move all this (testing) into c9_unsubscribe_changes_websocket too...
  // }

  it('should unsubscribe from an event', function (callback) {

    var path = '/e2e_test1/testsubscribe/data/on_off_test';

    var currentListenerId;
    var onRan = false;
    var pathOnRan = false;

    listenerclient.on(path, {
      event_type: 'set',
      count: 0
    }, function (message) {

      if (pathOnRan) return callback(new Error('subscription was not removed by path'));
      else pathOnRan = true;

      listenerclient.offPath(path, function (e) {

        if (e) return callback(new Error(e));

        listenerclient.on(path, {
            event_type: 'set',
            count: 0
          },
          function (message) {
            if (onRan) return callback(new Error('subscription was not removed'));
            else {

              onRan = true;
              listenerclient.off(currentListenerId, function (e) {

                if (e) return callback(new Error(e));

                publisherclient.set(path, {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                }, {}, function (e, setresult) {
                  if (e) return callback(new Error(e));
                  setTimeout(callback, 500);
                });
              });
            }
          },
          function (e, listenerId) {
            if (e) return callback(new Error(e));

            currentListenerId = listenerId;

            publisherclient.set(path, {
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

      publisherclient.set(path, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, function (e) {
        if (e) return callback(new Error(e));
      });

    });
  });

  it('should unsubscribe from an event path', function (callback) {

    var path = '/e2e_test1/testsubscribe/data/path_off_test';

    var pathOnRan = false;

    listenerclient.on(path, {
      event_type: 'set',
      count: 0
    }, function (message) {

      if (pathOnRan) return callback(new Error('subscription was not removed by path'));
      else pathOnRan = true;

      listenerclient.offPath(path, function (e) {

        if (e) return callback(new Error(e));

        publisherclient.set(path, {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        }, {}, function (e) {
          if (e) return callback(new Error(e));
          setTimeout(callback, 500);
        });

      });

    }, function (e) {
      if (e) return callback(new Error(e));

      publisherclient.set(path, {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      }, function (e) {
        if (e) return callback(new Error(e));
      });

    });
  });

  it('should unsubscribe from an event path using a wildcard', function (callback) {

    var path = '/e2e_test1/testsubscribe/data/wildcard_path_off_test';

    var currentListenerId;
    var onRan = false;
    var pathOnRan = false;

    listenerclient.on(path + '/*', {
      event_type: 'set',
      count: 0
    }, function (message) {
      return callback(new Error('not meant to happen'));
    }, function (e) {
      if (e) return callback(new Error(e));

      listenerclient.on(path + '/data/*', function (data) {
        return callback(new Error('not meant to happen'));
      }, function (e) {

        if (e) return callback(new Error(e));

        listenerclient.offPath('/e2e_test1/testsubscribe/data/wildcard*', function (e) {

          if (e) return callback(new Error(e));

          publisherclient.set(path, {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, {}, function (e) {
            if (e) return callback(new Error(e));
            setTimeout(callback, 500);
          });

        });
      });
    });
  });

  it('tests various fail conditions', function (callback) {

    listenerclient.off(null, function (e) {
      expect(e.toString()).to.be('Error: handle cannot be null');

      listenerclient.off(undefined, function (e) {
        expect(e.toString()).to.be('Error: handle cannot be null');
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

    var path = '/e2e_test1/testsubscribe/data/off_all_test';

    var onHappened = false;

    listenerclient.onAll(function (message) {

      onHappened = true;
      callback(new Error('this wasnt meant to happen'));

    }, function (e) {

      if (e) return callback(e);

      listenerclient.on(path, {
          event_type: 'set',
          count: 0
        },
        function (message) {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function (e) {
          if (e) return callback(e);

          listenerclient.offAll(function (e) {
            if (e) return callback(e);

            publisherclient.set(path, {
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

    var path = '/with/wildcard/unsubscribe/from/only/*';

    var results = {};

    Promise.all([
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[1] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[2] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[3] = true;
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

    var path = '/without/wildcard/unsubscribe/from/only';

    var results = {};
    var listenerId1, listenerId2, listenerId3;
    var emittedPath;

    Promise.all([
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[1] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[2] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[3] = true;
        })
      ])

      .spread(function (result1, result2, result3) {

        //console.log('1,2,3',result1[0], result2[0], result3[0]);

        listenerId1 = result1[0];
        listenerId2 = result2[0];
        listenerId3 = result3[0];

        // unsubscribe from 2nd subscription only
        return listenerclient.off(listenerId2);
      })

      .then(function () {
        return publisherclient.set(path, {});
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

        listenerclient.handle_data = function (path, data) {
          emittedPath = path;
          originalHandleData.apply(this, arguments);
        };
      })

      .then(function () {
        results = {};
        return publisherclient.set(path, {});
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

      .then(function(){
        callback();
      }).catch(callback);

  });

  xit('should remove only the correct subscriptionData entry with wildcard', function (callback) {

    var path = '/with/wildcard/remove/correct/subscriptionData/*';

    Promise.all([
        listenerclient.onAsync(path, {
          event_type: 'set',
          meta: {
            x: 1
          }
        }, function (data, meta) {
          results[1] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set',
          meta: {
            x: 2
          }
        }, function (data, meta) {
          results[2] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set',
          meta: {
            x: 3
          }
        }, function (data, meta) {
          results[3] = true;
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
          return segment.fullPath == path;
        })[0];

        var metaArray = Object.keys(segment.subscriptionData).map(function (listenerId) {
          return segment.subscriptionData[listenerId].options.meta;
        });

        expect(metaArray).to.eql([{
            x: 1
          },
          {
            x: 3
          }
        ]);
      })

      .then(callback).catch(callback);

  });

  xit('should remove only the correct subscriptionData entry without wildcard', function (callback) {

    var path = '/without/wildcard/remove/correct/subscriptionData';

    Promise.all([
        listenerclient.onAsync(path, {
          event_type: 'set',
          meta: {
            x: 1
          }
        }, function (data, meta) {
          results[1] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set',
          meta: {
            x: 2
          }
        }, function (data, meta) {
          results[2] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set',
          meta: {
            x: 3
          }
        }, function (data, meta) {
          results[3] = true;
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

        var pathAndSession = path +
          bucket.options.pathSessionDelimiter +
          listenerclient.session.id;

        var subscription = bucket.__explicit_subscriptions.get(pathAndSession)[0];

        var metaArray = Object.keys(subscription.subscriptionData).map(function (listenerId) {
          return subscription.subscriptionData[listenerId].options.meta;
        });

        expect(metaArray).to.eql([{
            x: 1
          },
          {
            x: 3
          }
        ]);

      })

      .then(callback).catch(callback);

  });

  it('should remove all subscriptions on offPath without wildcard', function (callback) {

    var path = '/without/wildcard/off/path';

    var results = {};
    var emittedPath;

    Promise.all([
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[1] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[2] = true;
        }),
        listenerclient.onAsync(path, {
          event_type: 'set'
        }, function (data, meta) {
          results[3] = true;
        })
      ])

      .then(function () {
        return listenerclient.offPath(path);
      })

      .then(function () {
        // no longer subscribed to any, ensure the publication does not erroneously get sent to
        // listenerclient anyway... and be filtered out clientside

        listenerclient.handle_data = function (path) {
          emittedPath = path;
          originalHandleData.apply(this, arguments);
        };
      })

      .then(function () {
        results = {};
        return publisherclient.set(path, {});
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
});
