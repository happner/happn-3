var Happn = require('../../lib/index')
  , service = Happn.service
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  , Promise = require('bluebird')
  ;

describe('a1_multiple_subscriptions_events', function () {

  var serviceInstance;
  var clientInstancePublisher;
  var clientInstanceListener;

  beforeEach('start the service and connect the clients', function (done) {

    var clientListenerConfig = {};
    var clientPublisherConfig = {};

    var config = {};

    service.create(config)

      .then(function (instance) {

        serviceInstance = instance;

        return Happn.client.create(clientListenerConfig);
      })
      .then(function (client) {

        clientInstanceListener = client;

        return Happn.client.create(clientPublisherConfig);
      })
      .then(function (client) {

        clientInstancePublisher = client;

        done();
      })
      .catch(done);
  });

  afterEach('stop the clients', function (done) {

    if (clientInstanceListener) clientInstanceListener.disconnect();
    if (clientInstancePublisher) clientInstancePublisher.disconnect();

    setTimeout(done, 500);

  });

  afterEach('stop the server', function (done) {

    if (serviceInstance) serviceInstance.stop(done);

    else done();
  });

  var SUBSCRIPTION_COUNT = 1000;
  var EVENT_COUNT = 1000;

  it('should create ' + SUBSCRIPTION_COUNT + ' subscriptions and publish ' + EVENT_COUNT + ' times', function (done) {

    this.timeout(SUBSCRIPTION_COUNT * 100);

    var testSubs = [];

    var matched = 0;

    var subscreated = 0;

    var started = Date.now();

    async.timesSeries(SUBSCRIPTION_COUNT, function(time, timeCB){

      var sub = require('shortid').generate();

      if (testSubs.length < EVENT_COUNT) testSubs.push(sub + '/test');

      clientInstanceListener.on(sub.substring(0, 10) + '*', function(data){

        matched++;

        if (matched % 500 == 0) console.log('events handled', subscreated);

      }, function(e){

        if (e) return timeCB(e);

        subscreated++;

        if (subscreated % 500 == 0) console.log('subscriptions created', subscreated);

        timeCB();
      });

    }, function(e){

      if (e) return done(e);

      async.each(testSubs, function(path, pathCB){

        clientInstancePublisher.set(path, {data:path}, pathCB);

      }, function(e){

        if (e) return done(e);

        console.log('ENDED IN ' + (Date.now() - started) + ' milliseconds');

        console.log('subs created:::', subscreated);

        console.log('events handled:::', matched);

        //console.log(listenerclient.events);

        done();

      });
    });
  });

  var SUBSCRIPTION_COUNT1 = 1000;

  var EVENT_COUNT1 = 1000;

  it('should create ' + SUBSCRIPTION_COUNT1 + ' subscriptions and publish ' + EVENT_COUNT + ' times', function (done) {

    this.timeout(SUBSCRIPTION_COUNT1 * 100);

    var testSubs = [];

    var matched = 0;

    var subscreated = 0;

    var started = Date.now();

    async.times(SUBSCRIPTION_COUNT1, function(time, timeCB){

      var sub = require('shortid').generate();

      if (testSubs.length < EVENT_COUNT1) testSubs.push(sub + '/test');

      clientInstanceListener.on(sub.substring(0, 10) + '*', function(data){

        matched++;

        if (matched % 500 == 0) console.log('events handled', subscreated);

      }, function(e){

        if (e) return timeCB(e);

        subscreated++;

        if (subscreated % 500 == 0) console.log('subscriptions created', subscreated);

        timeCB();
      });

    }, function(e){

      if (e) return done(e);

      async.each(testSubs, function(path, pathCB){

        clientInstancePublisher.set(path, {data:path}, pathCB);

      }, function(e){

        if (e) return done(e);

        console.log('ENDED IN ' + (Date.now() - started) + ' milliseconds');

        console.log('subs created:::', subscreated);

        console.log('events handled:::', matched);

        //console.log(listenerclient.events);

        done();

      });
    });
  });

});
