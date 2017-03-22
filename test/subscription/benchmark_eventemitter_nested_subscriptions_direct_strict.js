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
  var EVENT_COUNT = 10000;

  var DEPTH = 4;

  var PARTSPERSEGMENT = 100;

  var subParts = {};

  for (var i = 0;i < PARTSPERSEGMENT;i++){

    for (var ii = 0;ii < DEPTH;ii++){

      if (!subParts[ii]) subParts[ii] = [];

      subParts[ii].push(require('shortid').generate());
    }
  }

  var getRandomPath = function(){

    var parts = [];

    for (var i = 0;i < DEPTH;i++){
      parts.push(subParts[i][Math.floor(Math.random() * PARTSPERSEGMENT) + 1]);
    }

    return parts.join('/');
  };

  beforeEach('start the service and connect the clients', function (done) {

    var clientListenerConfig = {};
    var clientPublisherConfig = {};

    var config = {
      services:{
        queue:{
          config:{
            mode:'direct'
          }
        },
        subscription:{
          config:{
            bucketImplementation:require('../../lib/services/subscription/bucket-strict')
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

      var sub = getRandomPath();

      if (testSubs.length < EVENT_COUNT) testSubs.push(sub);

      clientInstanceListener.on(sub, function(data){

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

        clientInstancePublisher.set(path, {data:path}, function(e, response){

          if (e) return pathCB(e);

          pathCB();
        });

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

  it('should create ' + SUBSCRIPTION_COUNT + ' subscriptions and publish ' + EVENT_COUNT + ' times in series', function (done) {

    this.timeout(SUBSCRIPTION_COUNT * 100);

    var testSubs = [];

    var matched = 0;

    var subscreated = 0;

    var started = Date.now();

    async.timesSeries(SUBSCRIPTION_COUNT, function(time, timeCB){

      var sub = getRandomPath();

      if (testSubs.length < EVENT_COUNT) testSubs.push(sub);

      clientInstanceListener.on(sub, function(data){

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
