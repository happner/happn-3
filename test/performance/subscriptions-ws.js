

describe(require('../__fixtures/utils/test_helper').create().testName(__filename, 3),  function () {

  var expect = require('expect.js');
  var happn = require('../../lib/index');
  var service = happn.service;
  var async = require('async');
  var happnInstance = null;
  var test_id;
  var shortid = require('shortid');
  var random = require('../__fixtures/utils/random');

  var SUBSCRIPTION_COUNT = 1000;
  var SEARCH_COUNT = 10000;

  this.timeout(SUBSCRIPTION_COUNT * 100);

  beforeEach('should initialize the service', function (callback) {
    service.create({
      services:{
        // queue:{
        //   config:{mode:'direct'}
        // }
      }
    },
      function (e, happnInst) {
        if (e) return callback(e);
        happnInstance = happnInst;
        callback();
      });
  });

  var client;
  beforeEach('should initialize the client', function (callback) {
    happn.client.create(function (e, instance) {
      if (e) return callback(e);
      client = instance;
      callback();
    });
  });

  afterEach('disconnect client', function (done) {
    client.disconnect(done);
  });

  afterEach('disconnect server', function (done) {
    happnInstance.stop(done);
  });

  it('creates ' + SUBSCRIPTION_COUNT + ' random paths, and randomly selects a wildcard option for each path, subscribes, then loops through the paths and searches ' + SEARCH_COUNT + ' times in parallel', function (done) {

    var subscriptions = [];

    console.log('building subscriptions...');

    var randomPaths = random.randomPaths({count:SUBSCRIPTION_COUNT});

    randomPaths.forEach(function(path){

      var possibleSubscriptions = random.getWildcardPermutations(path);

      var subscriptionPath = possibleSubscriptions[random.integer(0, possibleSubscriptions.length - 1)];

      subscriptions.push(subscriptionPath);
    });

    var searchPaths = [];

    for (var i = 0; i < SEARCH_COUNT; i++) searchPaths.push(randomPaths[random.integer(0, randomPaths.length - 1)]);

    console.log('built subscriptions...');

    var startedSubscribing = Date.now();
    var setResults = {counters:{}};

    var eventsCount = 0;
    var startedSearching;

    var handleOn = function(data, meta){
      if (!setResults[meta.path]) setResults[meta.path] = [];
      setResults[meta.path].push(data);
      setResults.counters[data.counter] = true;
      eventsCount++;
      if (eventsCount == SEARCH_COUNT){
        // console.log(JSON.stringify(setResults, null, 2));
        // console.log(JSON.stringify(subscriptions, null, 2));
        console.log('handled ' + SEARCH_COUNT + ' events in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
      }
    };

    async.each(subscriptions, function(subscription, subscriptionCB){
      client.on(subscription, handleOn, subscriptionCB);
    }, function(e){
      console.log('did ' + SUBSCRIPTION_COUNT + ' subscriptions in ' + ((Date.now() - startedSubscribing) / 1000).toString() + ' seconds');
      startedSearching = Date.now();
      var counter = 0;
      async.each(searchPaths, function(randomPath, randomPathCB){
        client.set(randomPath, {
          counter:counter++
        }, {noStore:false}, randomPathCB);
      }, function(e){
        if (e) return done(e);
        console.log('handled ' + SEARCH_COUNT + ' parallel sets in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
        done();
      });
    });
  });

  it('creates ' + SUBSCRIPTION_COUNT + ' random paths, and randomly selects a wildcard option for each path, subscribes, then loops through the paths and searches ' + SEARCH_COUNT + ' times in series', function (done) {

    var subscriptions = [];

    console.log('building subscriptions...');

    var randomPaths = random.randomPaths({count:SUBSCRIPTION_COUNT});

    randomPaths.forEach(function(path){

      var possibleSubscriptions = random.getWildcardPermutations(path);

      var subscriptionPath = possibleSubscriptions[random.integer(0, possibleSubscriptions.length - 1)];

      subscriptions.push(subscriptionPath);
    });

    var searchPaths = [];

    for (var i = 0; i < SEARCH_COUNT; i++) searchPaths.push(randomPaths[random.integer(0, randomPaths.length - 1)]);

    console.log('built subscriptions...');

    var startedSubscribing = Date.now();
    var setResults = {counters:{}};

    var eventsCount = 0;
    var startedSearching;

    var handleOn = function(data, meta){
      if (!setResults[meta.path]) setResults[meta.path] = [];
      setResults[meta.path].push(data);
      setResults.counters[data.counter] = true;
      eventsCount++;
      if (eventsCount == SEARCH_COUNT){
        // console.log(JSON.stringify(setResults, null, 2));
        // console.log(JSON.stringify(subscriptions, null, 2));
        console.log('handled ' + SEARCH_COUNT + ' events in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
      }
    };

    async.eachSeries(subscriptions, function(subscription, subscriptionCB){
      client.on(subscription, handleOn, subscriptionCB);
    }, function(e){
      console.log('did ' + SUBSCRIPTION_COUNT + ' subscriptions in ' + ((Date.now() - startedSubscribing) / 1000).toString() + ' seconds');
      startedSearching = Date.now();
      var counter = 0;
      async.each(searchPaths, function(randomPath, randomPathCB){
        client.set(randomPath, {
          counter:counter++
        }, {noStore:false}, randomPathCB);
      }, function(e){
        if (e) return done(e);
        console.log('handled ' + SEARCH_COUNT + ' consecutive sets in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
        done();
      });
    });
  });

  it('creates ' + SUBSCRIPTION_COUNT + ' random paths, subscribes to each path, then loops through the paths and searches ' + SEARCH_COUNT + ' times in parallel', function (done) {

    var subscriptions = [];

    console.log('building subscriptions...');

    var randomPaths = random.randomPaths({count:SUBSCRIPTION_COUNT});

    randomPaths.forEach(function(path){
      subscriptions.push(path);
    });

    var searchPaths = [];

    for (var i = 0; i < SEARCH_COUNT; i++) searchPaths.push(randomPaths[random.integer(0, randomPaths.length - 1)]);

    console.log('built subscriptions...');

    var startedSubscribing = Date.now();
    var setResults = {counters:{}};

    var eventsCount = 0;
    var startedSearching;

    var handleOn = function(data, meta){
      if (!setResults[meta.path]) setResults[meta.path] = [];
      setResults[meta.path].push(data);
      setResults.counters[data.counter] = true;
      eventsCount++;
      if (eventsCount == SEARCH_COUNT){
        // console.log(JSON.stringify(setResults, null, 2));
        // console.log(JSON.stringify(subscriptions, null, 2));
        console.log('handled ' + SEARCH_COUNT + ' events in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
        done();
      }
    };

    async.each(subscriptions, function(subscription, subscriptionCB){
      client.on(subscription, handleOn, subscriptionCB);
    }, function(e){
      console.log('did ' + SUBSCRIPTION_COUNT + ' subscriptions in ' + ((Date.now() - startedSubscribing) / 1000).toString() + ' seconds');
      startedSearching = Date.now();
      var counter = 0;
      async.each(searchPaths, function(randomPath, randomPathCB){
        client.set(randomPath, {
          counter:counter++
        }, {noStore:false}, randomPathCB);
      }, function(e){
        if (e) return done(e);
        console.log('handled ' + SEARCH_COUNT + ' parallel sets in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
      });
    });
  });

  it('creates ' + SUBSCRIPTION_COUNT + ' random paths, subscribes to each path, then loops through the paths and searches ' + SEARCH_COUNT + ' times in series', function (done) {

    var subscriptions = [];

    console.log('building subscriptions...');

    var randomPaths = random.randomPaths({count:SUBSCRIPTION_COUNT});

    randomPaths.forEach(function(path){
      subscriptions.push(path);
    });

    var searchPaths = [];

    for (var i = 0; i < SEARCH_COUNT; i++) searchPaths.push(randomPaths[random.integer(0, randomPaths.length - 1)]);

    console.log('built subscriptions...');

    var startedSubscribing = Date.now();
    var setResults = {counters:{}};

    var eventsCount = 0;
    var startedSearching;

    var handleOn = function(data, meta){
      if (!setResults[meta.path]) setResults[meta.path] = [];
      setResults[meta.path].push(data);
      setResults.counters[data.counter] = true;
      eventsCount++;
      if (eventsCount == SEARCH_COUNT){
        // console.log(JSON.stringify(setResults, null, 2));
        // console.log(JSON.stringify(subscriptions, null, 2));
        console.log('handled ' + SEARCH_COUNT + ' events in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
        done();
      }
    };

    async.eachSeries(subscriptions, function(subscription, subscriptionCB){
      client.on(subscription, handleOn, subscriptionCB);
    }, function(e){
      console.log('did ' + SUBSCRIPTION_COUNT + ' subscriptions in ' + ((Date.now() - startedSubscribing) / 1000).toString() + ' seconds');
      startedSearching = Date.now();
      var counter = 0;
      async.each(searchPaths, function(randomPath, randomPathCB){
        client.set(randomPath, {
          counter:counter++
        }, {noStore:false}, randomPathCB);
      }, function(e){
        if (e) return done(e);
        console.log('handled ' + SEARCH_COUNT + ' consecutive sets in ' + ((Date.now() - startedSearching) / 1000).toString() + ' seconds');
      });
    });
  });
});
