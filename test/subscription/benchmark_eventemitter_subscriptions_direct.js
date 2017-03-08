var Happn = require('../../lib/index')
  , service = Happn.service
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  , Promise = require('bluebird')
  ;

describe('subscriptions direct', function () {

  var serviceInstance;
  var clientInstancePublisher;
  var clientInstanceListener;

  var SUBSCRIPTION_COUNT = 17500;
  var EVENT_COUNT = 5000;

  beforeEach('start the service and connect the clients', function (done) {

    var clientListenerConfig = {};
    var clientPublisherConfig = {};

    var config = {
      services:{
        queue:{
          config:{
            mode:'direct'
          }
        }
      }
    };

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

    this.timeout(SUBSCRIPTION_COUNT * 100);

    if (clientInstanceListener) clientInstanceListener.disconnect();
    if (clientInstancePublisher) clientInstancePublisher.disconnect();

    setTimeout(done, 500);

  });

  afterEach('stop the server', function (done) {

    this.timeout(SUBSCRIPTION_COUNT * 100);

    if (serviceInstance) serviceInstance.stop(done);

    else done();

  });

  it('should create ' + SUBSCRIPTION_COUNT + ' subscriptions and publish ' + EVENT_COUNT + ' times in parallel', function (done) {

    this.timeout(SUBSCRIPTION_COUNT * 100);

    var testSubs = [];

    var matched = 0;

    var subscreated = 0;

    var started = Date.now();

    async.times(SUBSCRIPTION_COUNT, function(time, timeCB){

      var sub = require('shortid').generate();

      if (testSubs.length < EVENT_COUNT) testSubs.push(sub + '/test');

      clientInstanceListener.on(sub + '/*', function(data){

        matched++;

        if (matched % 500 == 0) console.log('events handled', matched);

      }, function(e){

        if (e) return timeCB(e);

        subscreated++;

        if (subscreated % 500 == 0) console.log('subscriptions created', subscreated);

        timeCB();
      });

    }, function(e){

      if (e) return done(e);

      var subscriptionsTime = (Date.now() - started);

      var subscriptionsPerSecond = (SUBSCRIPTION_COUNT / subscriptionsTime) * 1000;

      console.log('SUBSCRIPTIONS ENDED IN ' + subscriptionsTime + ' milliseconds');

      console.log('SUBSCRIPTIONS PER SECOND ' + subscriptionsPerSecond);

      var eventsStarted = Date.now();

      async.each(testSubs, function(path, pathCB){

        clientInstancePublisher.set(path, {data:path}, pathCB);

      }, function(e){

        if (e) return done(e);

        var eventsTime = (Date.now() - eventsStarted);

        var eventsPerSecond = (matched / eventsTime) * 1000;

        console.log('EVENTS ENDED IN ' + eventsTime + ' milliseconds');

        console.log('EVENTS PER SECOND ' + eventsPerSecond);

        console.log('TEST ENDED IN ' + (Date.now() - started) + ' milliseconds');

        console.log('subs created:::', subscreated);

        console.log('events handled:::', matched);

        //console.log(listenerclient.events);

        done();

      });
    });
  });

  it.only('should create ' + SUBSCRIPTION_COUNT + ' subscriptions and publish ' + EVENT_COUNT + ' times in series', function (done) {

    this.timeout(SUBSCRIPTION_COUNT * 100);

    var testSubs = [];

    var matched = 0;

    var subscreated = 0;

    var started = Date.now();

    async.timesSeries(SUBSCRIPTION_COUNT, function(time, timeCB){

      var sub = require('shortid').generate();

      if (testSubs.length < EVENT_COUNT) testSubs.push(sub + '/test');

      clientInstanceListener.on(sub + '*', function(data){

        matched++;

        if (matched % 500 == 0) console.log('events handled', matched);

      }, function(e){

        if (e) return timeCB(e);

        subscreated++;

        if (subscreated % 500 == 0) console.log('subscriptions created', subscreated);

        timeCB();
      });

    }, function(e){

      if (e) return done(e);

      var subscriptionsTime = (Date.now() - started);

      var subscriptionsPerSecond = (SUBSCRIPTION_COUNT / subscriptionsTime) * 1000;

      console.log('SUBSCRIPTIONS ENDED IN ' + subscriptionsTime + ' milliseconds');

      console.log('SUBSCRIPTIONS PER SECOND ' + subscriptionsPerSecond);

      var eventsStarted = Date.now();

      async.each(testSubs, function(path, pathCB){

        clientInstancePublisher.set(path, {data:path}, pathCB);

      }, function(e){

        if (e) return done(e);

        var eventsTime = (Date.now() - eventsStarted);

        var eventsPerSecond = (matched / eventsTime) * 1000;

        console.log('EVENTS ENDED IN ' + eventsTime + ' milliseconds');

        console.log('EVENTS PER SECOND ' + eventsPerSecond);

        console.log('TEST ENDED IN ' + (Date.now() - started) + ' milliseconds');

        console.log('subs created:::', subscreated);

        console.log('events handled:::', matched);

        done();

      });
    });
  });

});
