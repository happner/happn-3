var Happn = require('../../lib/index')
  , service = Happn.service
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  , Promise = require('bluebird')
  ;

describe('subscriptions', function () {

  var serviceInstance;
  var clientInstancePublisher;
  var clientInstanceListener;

  var testBucketImplementation = require('../../lib/services/subscription/bucket-test');

  var SUBSCRIPTION_COUNT = 17500;
  var EVENT_COUNT = 5000;

  beforeEach('start the service and connect the clients', function (done) {

    var clientListenerConfig = {};
    var clientPublisherConfig = {};

    var config = {
      services:{
        subscription:{
          config:{
            bucketImplementation:testBucketImplementation
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

  it('test the trie lib', function (done) {

    var TrieSearch = require('trie-search');

    var tSearch =  new TrieSearch('path', {indexField: 'path'});

    tSearch.add({path:'test'});

    tSearch.add({path:'test'});

    tSearch.add({path:'test'});

    console.log(tSearch.get('test'));

    done();

  });

  it.only('should create ' + SUBSCRIPTION_COUNT + ' subscriptions and publish ' + EVENT_COUNT + ' times in parallel', function (done) {

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

  it('should create ' + SUBSCRIPTION_COUNT + ' subscriptions and publish ' + EVENT_COUNT + ' times in series', function (done) {

    this.timeout(SUBSCRIPTION_COUNT * 100);

    var testSubs = [];

    var matched = 0;

    var subscreated = 0;

    var started = Date.now();

    async.times(SUBSCRIPTION_COUNT, function(time, timeCB){

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

      async.each(testSubs, function(path, pathCB){

        clientInstancePublisher.set(path, {data:path}, pathCB);

      }, function(e){

        if (e) return done(e);

        //console.log(listenerclient.events);

        console.log('ENDED IN ' + (Date.now() - started) + ' milliseconds');

        console.log('subs created:::', subscreated);

        console.log('events handled:::', matched);

        done();

      });
    });
  });

});
