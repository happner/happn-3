describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var mode = "embedded";
  var happnInstance = null;
  var test_id;

  this.timeout(5000);

  before('should initialize the service', function (callback) {


    test_id = Date.now() + '_' + require('shortid').generate();

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

  after(function (done) {
    happnInstance.stop(done);
  });

  var publisherclient;
  var listenerclient;
  var disconnectclient;

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

  var doOperations = function(options, callback){

    try {

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

          listenerclient.off(listenerId1, function(e){

            if (e) return callback(e);

            listenerclient.off(listenerId2, function(e){

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

    } catch (e) {
      callback(e);
    }
  };

  it('should do a bunch of operations twice and measure the protocol stack size', function (done) {

    doOperations(null, function(e){

      if (e) return done(e);

      var protocolStackSize = happnInstance.services.protocol.stats().stackCacheSize;

      doOperations(null, function(e){

        if (e) return done(e);

        var compareProtocolStackSize = happnInstance.services.protocol.stats().stackCacheSize;

        expect(protocolStackSize > 0).to.be(true);
        expect(compareProtocolStackSize > 0).to.be(true);

        if (protocolStackSize != compareProtocolStackSize) {
          return done(new Error('protocol stack sizes differ for same set of logical operations, possible memory leak: ' + Object.keys(happnInstance.services.protocol.__stackCache).join(',')));
        }
        done();

      });
    });
  });


  it('disconnects the clients (2 disconnects), and ensures our protocol stack is the same size', function (done) {

    publisherclient.disconnect({
      timeout: 2000
    }, function (e) {
      if (e) return done(e);

      var protocolStackSize = happnInstance.services.protocol.stats().stackCacheSize;

      listenerclient.disconnect({
        timeout: 2000
      }, function (e) {
        if (e) return done(e);

        var compareProtocolStackSize = happnInstance.services.protocol.stats().stackCacheSize;

        expect(protocolStackSize > 0).to.be(true);
        expect(compareProtocolStackSize > 0).to.be(true);

        if (protocolStackSize != compareProtocolStackSize) return done(new Error('protocol stack sizes differ for same set of logical operations, possible memory leak'));

        done();
      });
    });
  });
});
