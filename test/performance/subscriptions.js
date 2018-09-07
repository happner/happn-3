

describe(require('../__fixtures/utils/test_helper').create().testName(__filename, 3),  function () {

  var expect = require('expect.js');
  var happn = require('../../lib/index');
  var service = happn.service;
  var async = require('async');
  var happnInstance = null;
  var test_id;
  var shortid = require('shortid');
  var random = require('../__fixtures/utils/random');

  this.timeout(5000);

  before('should initialize the service', function (callback) {
    service.create({},
      function (e, happnInst) {
        if (e) return callback(e);
        happnInstance = happnInst;
        callback();
      });
  });

  after(function (done) {
    happnInstance.stop({}, done);
  });

  var client;
  before('should initialize the client', function (callback) {
    happnInstance.services.session.localClient(function (e, instance) {
      if (e) return callback(e);
      client = instance;
      callback();
    });
  });

  var SUBSCRIPTION_COUNT = 10000;
  var SEARCH_COUNT = 10000;

  this.timeout(SUBSCRIPTION_COUNT * 10);

  function verifyResults(searchResults, randomPaths){

    console.log('verifying...');

    var ok = true;

    randomPaths.every(function(path){

      if (searchResults[path] == 0) ok = false;

      return ok;
    });

    console.log('verified...');
  }

  it('creates ' + SUBSCRIPTION_COUNT + ' random paths, and randomly selects a wildcard option for each path, subscribes, then loops through the paths and searches ' + SEARCH_COUNT + ' times', function (done) {

    var subscriptions = [];

    console.log('building subscriptions...');

    var randomPaths = random.randomPaths({count:SUBSCRIPTION_COUNT});

    randomPaths.forEach(function(path){

      var possibleSubscriptions = random.getWildcardPermutations(path);

      var subscriptionPath = possibleSubscriptions[random.integer(0, possibleSubscriptions.length - 1)];

      subscriptions.push(subscriptionPath);
    });

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
      async.each(randomPaths, function(randomPath, randomPathCB){
        client.set(randomPath, {
          counter:counter++
        }, randomPathCB);
      }, function(e){
        if (e) return done(e);
      });
    });
  });
});
