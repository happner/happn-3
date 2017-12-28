describe(require('./__fixtures/utils/test_helper').create().testName(__filename), function () {

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var happnInstance = null;
  var test_id;

  this.timeout(5000);
  
  var serviceConfig = {
    secure:true,
    services: {
      security: {
        config: {
          profiles: [ //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
            {
              name: "test",
              session: {
                $and: [{
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  type: {
                    $eq: 0
                  }
                }]
              },
              policy: {
                ttl: '4 seconds',
                inactivity_threshold: '20 seconds' //this is costly, as we need to store state on the server side
              }
            }
          ]
        }
      }
    }
  };

  before('should initialize the service', function (callback) {

    test_id = Date.now() + '_' + require('shortid').generate();

    try {
      service.create(serviceConfig, function (e, happnInst) {

        if (e) return callback(e);

        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  var publisherclient;
  var listenerclient;

  var disconnectClients = function (options, callback) {
    publisherclient.disconnect({
      timeout: 2000
    }, function (e) {
      if (e) return callback(e);
      listenerclient.disconnect({
        timeout: 2000
      }, callback);
    });
  };

  var connectClients = function (options, callback) {

    happn_client.create({
      config: {
        username: '_ADMIN',
        password: 'happn'
      }
    }, function (e, instance) {

      if (e) return callback(e);
      publisherclient = instance;

      happn_client.create({
        config: {
          username: '_ADMIN',
          password: 'happn'
        }
      }, function (e, instance) {

        if (e) return callback(e);
        listenerclient = instance;
        callback();
      });
    });
  };

  var doOperations = function (options, callback) {

    var listenerId1;
    var listenerId2;

    //first listen for the change
    listenerclient.on('/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/*', {
      event_type: 'set',
      count: 1
    }, function (message) {

      listenerclient.on('/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/*', {
        event_type: 'remove',
        count: 1
      }, function (message) {

        listenerclient.off(listenerId1, function (e) {

          if (e) return callback(e);

          listenerclient.off(listenerId2, function (e) {

            if (e) return callback(e);

            listenerclient.offPath('/memory-leak-protocol-service/*', callback);
          });
        });

      }, function (e, listenerId) {

        if (!e) {
          listenerId2 = listenerId;
          //then make the change
          publisherclient.remove('/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/1', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e) {

            if (e) return callback(e);
          });
        } else callback(e);
      });

    }, function (e, listenerId) {

      if (!e) {
        listenerId1 = listenerId;
        //then make the change
        publisherclient.set('/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/1', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        }, null, function (e, result) {

          if (e) return callback(e);
        });
      } else callback(e);
    });
  };

  it('should do a bunch of operations, then disconnect we ensure that there are no residual sessionIds in the __checkpoint_usage_limit cache', function (done) {

    this.timeout(5000);

    connectClients(null, function (e) {

      if (e) return done(e);

      doOperations(null, function (e) {

        if (e) return done(e);

        happnInstance.services.security.checkpoint.__checkpoint_usage_limit.all(function (e, items) {

          expect(items.length > 0).to.be(true);

          disconnectClients(null, function (e) {

            if (e) return done(e);

            setTimeout(function(){

              happnInstance.services.security.checkpoint.__checkpoint_usage_limit.all(function (e, items) {

                expect(items.length == 0).to.be(true);

                done();
              });
            }, 2000);
          });
        });
      });
    });
  });

  it('should do a bunch of operations, then disconnect we ensure that there are no residual sessionIds in the checkpoint_inactivity_threshold', function (done) {

    this.timeout(5000);

    connectClients(null, function (e) {

      if (e) return done(e);

      doOperations(null, function (e) {

        if (e) return done(e);

        happnInstance.services.security.checkpoint.__checkpoint_usage_limit.all(function (e, items) {

          expect(items.length > 0).to.be(true);

          disconnectClients(null, function (e) {

            if (e) return done(e);

            setTimeout(function(){

              happnInstance.services.security.checkpoint.__checkpoint_usage_limit.all(function (e, items) {

                expect(items.length == 0).to.be(true);

                done();
              });
            }, 2000);
          });
        });
      });
    });
  });

  after(function (done) {

    this.timeout(20000);

    disconnectClients(null, function () {
      happnInstance.stop(done);
    });
  });
});
