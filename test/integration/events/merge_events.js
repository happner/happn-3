describe(require('../../__fixtures/utils/test_helper').create().testName(__filename), function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  var test_secret = 'test_secret';
  var default_timeout = 10000;
  var happnInstance = null;

  var publisherclient;
  var listenerclient;

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  after(function (done) {
    this.timeout(10000);

    publisherclient.disconnect({
        timeout: 2000
      })
      .then(listenerclient.disconnect({
        timeout: 2000
      }))
      .then(happnInstance.stop())
      .then(done)
      .catch(done);
  });

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {
      service.create({secure: true},
        function (e, happnInst) {
          if (e)
            return callback(e);
          happnInstance = happnInst;
          callback();
        });
    } catch (e) {
      callback(e);
    }
  });

  before('should initialize the clients', function (callback) {

    try {

      happn_client.create({
        config: {
          username: '_ADMIN',
          password: 'happn'
        },
        secure: true
      }, function (e, instance) {

        if (e) return callback(e);

        publisherclient = instance;

        happn_client.create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          secure: true
        }, function (e, instance) {

          if (e) return callback(e);

          listenerclient = instance;

          callback();
        });
      });
    } catch (e) {
      callback(e);
    }
  });

  it('the listener should pick up a single wildcard event, merge only', function (done) {

    this.timeout(default_timeout);

    publisherclient.set('/e2e_test1/testsubscribe/data/event/merge2', {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e) {

      if (e) return done(e);

      //first listen for the change
      listenerclient.on('/e2e_test1/testsubscribe/data/event/*', {
        event_type: 'set',
        merge: true,
        count: 1
      }, function (message) {

        expect(listenerclient.events['/SET@/e2e_test1/testsubscribe/data/event/*'].length).to.be(0);

        expect(message).to.eql({
          property4: 'property4'
        });

        done();

      }, function (e) {

        if (e) return done(e);

        //then make the change
        publisherclient.set('/e2e_test1/testsubscribe/data/event/merge1', {
          property4: 'property4'
        }, {merge:true}, function (e) {
          if (e) return done(e);
        });
      });
    });
  });

  it('the listener should pick up a single wildcard event, merge only, negative test', function (done) {

    this.timeout(default_timeout);

    publisherclient.set('/e2e_test1/testsubscribe/data/neg/merge1', {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, null, function (e) {

      if (e) return done(e);

      //first listen for the change
      listenerclient.on('/e2e_test1/testsubscribe/data/neg/*', {
        event_type: 'set',
        count: 1
      }, function (message) {

        expect(message).to.eql({
          property1: 'property1',
          property2: 'property2',
          property3: 'property3',
          property4: 'property4'
        });

        done();

      }, function (e) {

        if (e) return done(e);

        //then make the change
        publisherclient.set('/e2e_test1/testsubscribe/data/neg/merge1', {
          property4: 'property4'
        }, {merge:true}, function (e) {
          if (e) return done(e);
        });
      });
    });
  });

});
