describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var happnInstance = null;

  this.timeout(20000);

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

  before('should initialize the clients', function (callback) {
    try {
      happn_client.create(function (e, instance) {

        if (e) return callback(e);

        publisherclient = instance;
        happn_client.create(function (e, instance) {

          if (e) return callback(e);
          listenerclient = instance;
          callback();

        });
      });
    } catch (e) {
      callback(e);
    }
  });

  it('should unsubscribe from an event', function (callback) {

    var currentListenerId;
    var onRan = false;
    var pathOnRan = false;

    listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {
      event_type: 'set',
      count: 0
    }, function (message) {

      if (pathOnRan) return callback(new Error('subscription was not removed by path'));
      else pathOnRan = true;

      listenerclient.offPath('/e2e_test1/testsubscribe/data/on_off_test', function (e) {

        if (e)
          return callback(new Error(e));

        listenerclient.on('/e2e_test1/testsubscribe/data/on_off_test', {
            event_type: 'set',
            count: 0
          },
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
                  setTimeout(callback, 2000);
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

    var currentListenerId;
    var onRan = false;
    var pathOnRan = false;

    listenerclient.on('/e2e_test1/testsubscribe/data/path_off_test', {
      event_type: 'set',
      count: 0
    }, function (message) {

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
    this.timeout(10000);

    var onHappened = false;

    listenerclient.onAll(function (message) {

      onHappened = true;
      callback(new Error('this wasnt meant to happen'));

    }, function (e) {

      if (e) return callback(e);

      listenerclient.on('/e2e_test1/testsubscribe/data/off_all_test', {
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

            publisherclient.set('/e2e_test1/testsubscribe/data/off_all_test', {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }, null, function (e, put_result) {
              if (e) return callback(e);

              setTimeout(function () {

                if (!onHappened)
                  callback();

              }, 3000);
            });
          });
        }
      );
    });
  });

});
