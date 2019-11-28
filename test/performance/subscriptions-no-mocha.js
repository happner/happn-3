var happn = require('../../lib/index');
var service = happn.service;
var async = require('async');
var happnInstance = null;
var random = require('../__fixtures/utils/random');
var CONSTANTS = require('../../lib/constants');

var SUBSCRIPTION_COUNT = 1000;
var SEARCH_COUNT = 10000;

var NOSTORE = true;
var CONSISTENCY = CONSTANTS.CONSISTENCY.TRANSACTIONAL;

var client;

service.create({}, function(e, happnInst) {
  if (e) throw e;
  happnInstance = happnInst;
  happnInstance.services.session.localClient(function(e, instance) {
    if (e) throw e;
    client = instance;

    var subscriptions = [];

    //eslint-disable-next-line no-console
    console.log('building subscriptions...');

    var randomPaths = random.randomPaths({
      count: SUBSCRIPTION_COUNT
    });

    randomPaths.forEach(function(path) {
      var possibleSubscriptions = random.getWildcardPermutations(path);
      var subscriptionPath =
        possibleSubscriptions[random.integer(0, possibleSubscriptions.length - 1)];
      subscriptions.push(subscriptionPath);
    });

    var searchPaths = [];

    for (var i = 0; i < SEARCH_COUNT; i++)
      searchPaths.push(randomPaths[random.integer(0, randomPaths.length - 1)]);

    //eslint-disable-next-line no-console
    console.log('built subscriptions...');

    var startedSubscribing = Date.now();
    var setResults = {
      counters: {}
    };

    var eventsCount = 0;
    var startedSearching;

    var handleOn = function(data, meta) {
      if (!setResults[meta.path]) setResults[meta.path] = [];
      setResults[meta.path].push(data);
      setResults.counters[data.counter] = true;
      eventsCount++;

      //eslint-disable-next-line no-console
      console.log('event path: ' + meta.path);
      //eslint-disable-next-line no-console
      console.log('match path: ' + this.path);

      if (eventsCount === SEARCH_COUNT) {
        //eslint-disable-next-line no-console
        console.log(JSON.stringify(setResults, null, 2));
        //eslint-disable-next-line no-console
        console.log(JSON.stringify(subscriptions, null, 2));
        //eslint-disable-next-line no-console
        console.log(
          'handled ' +
            SEARCH_COUNT +
            ' events in ' +
            ((Date.now() - startedSearching) / 1000).toString() +
            ' seconds'
        );
      }
    };

    async.each(
      subscriptions,
      function(subscription, subscriptionCB) {
        //eslint-disable-next-line no-console
        console.log('subscribed:::', subscription);
        client.on(
          subscription,
          handleOn.bind({
            path: subscription
          }),
          subscriptionCB
        );
      },
      function() {
        //eslint-disable-next-line no-console
        console.log(
          'did ' +
            SUBSCRIPTION_COUNT +
            ' subscriptions in ' +
            ((Date.now() - startedSubscribing) / 1000).toString() +
            ' seconds'
        );
        startedSearching = Date.now();
        var counter = 0;
        async.each(
          searchPaths,
          function(randomPath, randomPathCB) {
            client.set(
              randomPath,
              {
                counter: counter++
              },
              {
                noStore: NOSTORE,
                consistency: CONSISTENCY,
                onPublished: function() {}
              },
              randomPathCB
            );
          },
          function() {
            //eslint-disable-next-line no-console
            console.log(
              'handled ' +
                SEARCH_COUNT +
                ' parallel sets in ' +
                ((Date.now() - startedSearching) / 1000).toString() +
                ' seconds'
            );
            process.exit(0);
          }
        );
      }
    );
  });
});
