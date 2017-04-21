var Happn = require('..')
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  ;

describe(require('path').basename(__filename), function () {

  context('functional subscription tree', function () {

    it('subscription tree, wildcardMatching', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      expect(subscriptionTree.wildcardMatch('','')).to.be(true);

      expect(subscriptionTree.wildcardMatch('/**/blah','/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.wildcardMatch('/*/blah','/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.wildcardMatch('/*/bleh','/test/pattern/blah')).to.be(false);

      expect(subscriptionTree.wildcardMatch('/*/*/*','/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.wildcardMatch('/**','/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.wildcardMatch('**','/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.wildcardMatch('*','/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.wildcardMatch('/not/matching','/test/pattern/blah')).to.be(false);

      expect(subscriptionTree.wildcardMatch('/test/pattern/blah','/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.wildcardMatch('/test/pattern/bleh','/test/pattern/*')).to.be(false);

      done();

    });

    it('subscription tree, single record subscribe', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.addSubscription('/test/path/1', 1, 1, {test:1});

      var subscribers = subscriptionTree.search('/test/path/1');

      expect(subscribers.length).to.be(1);

      done();
    });

    it('subscription tree, multiple record subscribe, with wildcards', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.addSubscription('/test/path/1', 1, 1, {test:1});
      subscriptionTree.addSubscription('/test/path/1', 1, 2, {test:2});

      subscriptionTree.addSubscription('/test/path/2', 2, 1, {test:1});
      subscriptionTree.addSubscription('/test/path/2', 2, 2, {test:2});

      subscriptionTree.addSubscription('/test/path/3', 3, 1, {test:1});
      subscriptionTree.addSubscription('/test/path/3', 3, 2, {test:2});

      subscriptionTree.addSubscription('/test/path/*', 4, 1, {test:1});
      subscriptionTree.addSubscription('/test/path/*', 4, 2, {test:2});

      var subscribers = subscriptionTree.search('/test/path/1');

      expect(subscribers.length).to.be(2);

      done();

    });

    it('subscription tree, multiple record subscribe, multiple wildcards', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.addSubscription('/2/test/path/1', 1, 1, {test:1});
      subscriptionTree.addSubscription('/2/test/path/1', 1, 2, {test:2});

      subscriptionTree.addSubscription('/2/test/path/2', 2, 1, {test:1});
      subscriptionTree.addSubscription('/2/test/path/2', 2, 2, {test:2});

      subscriptionTree.addSubscription('/2/test/path/3', 3, 1, {test:1});
      subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});

      subscriptionTree.addSubscription('/2/test/path/*', 4, 1, {test:1});
      subscriptionTree.addSubscription('/2/test/path/*', 4, 2, {test:2});

      subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(3);

      done();
    });

    it('subscription tree, remove functionality', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});
      subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      subscriptionTree.removeSubscription('/2/*/*/3', 3, {dataId:3});

      subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(1);

      done();
    });

    it('subscription tree, remove non-existing', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});
      subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      subscriptionTree.removeSubscription('/4/1/1/3', 3, 1);

      subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      done();
    });

    it('subscription tree, multiple wildcard **', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.addSubscription('/2/test/**', 1, 1, {test:1});
      subscriptionTree.addSubscription('/2/**', 1, 2, {test:2});

      subscriptionTree.addSubscription('/2/**/2', 2, 1, {test:1});
      subscriptionTree.addSubscription('**/test/path/2', 2, 2, {test:2});
      subscriptionTree.addSubscription('/2/**/3', 2, 1, {test:1});

      var subscriptions = subscriptionTree.search('/2/test/path/2');

      expect(subscriptions.length).to.be(4);

      subscriptionTree.removeSubscription('/2/**/2', 2, 1);

      subscriptions = subscriptionTree.search('/2/test/path/2');

      expect(subscriptions.length).to.be(3);

      done();
    });

    it('subscription tree, cache', function (done) {

      var SubscriptionTree = require('../lib/services/subscription/subscription-tree');

      var subscriptionTree = new SubscriptionTree();

      subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});

      subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

      subscriptionTree.addSubscription('/2/test/*/4', 3, 1, {test:3});

      var subscribers1 = subscriptionTree.search('/2/test/path/3');

      var subscribers2 = subscriptionTree.search('/2/test/path/4');

      var subscribers3 = subscriptionTree.search('/2/test/path/3');

      expect(subscribers1.length).to.be(2);
      expect(subscribers2.length).to.be(1);
      expect(subscribers3.length).to.be(2);

      expect(subscriptionTree.__cache.values().length).to.be(2);

      var cachedSubs = subscriptionTree.__cache.get('/2/test/path/3>>>');

      cachedSubs[0].specialValue = 'test';

      subscriptionTree.__cache.set('/2/test/path/3>>>', cachedSubs);

      var subscribers1 = subscriptionTree.search('/2/test/path/3');

      expect(subscribers1[0].specialValue).to.be('test');

      done();
    });
  });

  context('functional strict bucket', function () {

    var SubscriptionBucket = Happn.bucketStrict;

    it('tests the subscription bucket adding, allSubscriptions', function (done) {

      var sessionId1 = '1';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('/test/path/*', sessionId1, {options: {refCount: 1}});

        expect(testBucket.allSubscriptions().length).to.be(1);

        testBucket.addSubscription('/test/path/*', sessionId1, {options: {refCount: 1}});

        expect(testBucket.allSubscriptions().length).to.be(1);

        done();
      })
    });

    it('tests the subscription bucket adding and removing, allSubscriptions', function (done) {

      var sessionId1 = '1';
      var sessionId2 = '2';
      var sessionId3 = '3';
      var sessionId4 = '4';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var data = {options: {refCount: 1}};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('/test/path/*', sessionId1, data);

        testBucket.addSubscription('/test/path/*', sessionId2, data);

        testBucket.addSubscription('/test/path/*', sessionId3, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        expect(testBucket.allSubscriptions().length).to.be(4);

        testBucket.removeSubscription('/test/path/*', sessionId4);

        expect(testBucket.allSubscriptions().length).to.be(4);

        testBucket.removeSubscription('/test/path/*', sessionId4);

        expect(testBucket.allSubscriptions().length).to.be(3);

        done();
      });
    });

    it('tests the catchall segment, allSubscriptions', function (done) {

      var sessionId1 = '1';
      var sessionId2 = '2';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var data = {options: {refCount: 1}};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('*', sessionId1, data);

        testBucket.addSubscription('*', sessionId2, data);

        expect(testBucket.allSubscriptions().length).to.be(2);

        testBucket.getSubscriptions('/test/path/1', function (e, subscriptions) {

          expect(subscriptions.length).to.be(2);

          testBucket.removeSubscription('*', sessionId2, function (e) {

            if (e) return done(e);

            expect(testBucket.allSubscriptions().length).to.be(1);

            done();

          });
        });
      });
    });

    it('tests the subscription bucket adding and removing, with getSubscriptions', function (done) {

      var sessionId1 = '1';
      var sessionId2 = '2';
      var sessionId3 = '3';
      var sessionId4 = '4';
      var sessionId5 = '5';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var data = {options: {refCount: 1}};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('/test/path/*', sessionId1, data);

        testBucket.addSubscription('/test/path/*', sessionId2, data);

        testBucket.addSubscription('/test/path/*', sessionId3, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        testBucket.addSubscription('/test/other/path/*', sessionId5, data);

        testBucket.addSubscription('/test/other/path/*', sessionId5, data);

        testBucket.addSubscription('/test/other/path/*', sessionId5, data);

        expect(testBucket.allSubscriptions().length).to.be(5);

        testBucket.getSubscriptions('/test/path/1', function (e, subscriptions) {

          expect(e).to.be(null);

          expect(subscriptions.length).to.be(4);

          done();

        });
      });
    });

    var RANDOM_COUNT = 100;

    it('starts up the subscription service, adds ' + RANDOM_COUNT + ' subscriptions, checks we are able to retrieve recipients', function (done) {

      this.timeout(10000);

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var pathCounts = {};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        async.times(RANDOM_COUNT,

          function (time, timeCB) {

            var randomPath = Math.floor(Math.random() * 10) + 1;

            if (!pathCounts[randomPath]) pathCounts[randomPath] = 0;

            pathCounts[randomPath]++;

            var subId =  shortid.generate();

            testBucket.addSubscription('/test/path/' + randomPath, subId, {
              rand: randomPath,
              options: {refCount: 1}
            }, function(e){

              if (e) return timeCB(e);

              else timeCB();

            });
          },

          function (e) {

            if (e) return done(e);

            async.eachSeries(Object.keys(pathCounts), function (key, keyCB) {

              testBucket.getSubscriptions('/test/path/' + key, function (e, recipients) {

                expect(recipients.length).to.be(pathCounts[key]);

                keyCB();
              });

            }, done);
          }
        );
      });
    });

    function mockSubscriptionService(config, testItems, callback) {

      var UtilsService = require('../lib/services/utils/service');

      var utilsService = new UtilsService();

      var SubscriptionService = require('../lib/services/subscription/service');

      var subscriptionService = new SubscriptionService({
        logger: {
          createLogger: function (key) {
            return {
              warn: function (message) {
                console.log(message);
              },
              info: function (message) {
                console.log(message);
              },
              success: function (message) {
                console.log(message);
              },
              error: function (message) {
                console.log(message);
              },
              $$TRACE: function (message) {
                console.log(message);
              }
            }
          }
        }
      });

      subscriptionService.happn = {
        services: {
          data: {
            get: function (path, criteria, callback) {
              return callback(null, testItems);
            }
          },
          utils: utilsService
        }
      };

      subscriptionService.initialize(config, function (e) {

        if (e) return callback(e);

        return callback(null, subscriptionService);

      });
    }

    it('starts up the subscription service, does processSubscribe - then getRecipients', function (done) {

      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function (e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            done();
          });
        });
      });
    });

    it('starts up the subscription service, does processSubscribe - then getRecipients, then unsubscribe and get no recipients', function (done) {

      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var unsubscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1',
              key: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function (e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            instance.processUnsubscribe(unsubscribeMessage, function (e) {

              if (e) return done(e);

              instance.processGetRecipients(getRecipientsMessage, function (e) {

                if (e) return done(e);

                expect(result.recipients.length).to.be(0);

                done();

              });
            });
          });
        });
      });
    });

    it('starts up the subscription service, does processSubscribe - with initialCallback', function (done) {

      var config = {};

      var testItems = [
        {path: 'test/path/1', data: {}},
        {path: 'test/path/2', data: {}}
      ];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data',
              initialCallback: true
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();

        });
      });
    });

    it('starts up the subscription service, does processSubscribe - with initialEmit', function (done) {

      var config = {};

      var testItems = [
        {path: 'test/path/1', data: {}},
        {path: 'test/path/2', data: {}}
      ];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data',
              initialEmit: true
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();

        });
      });
    });

    it('does a clearSubscriptions for a specific session', function (done) {

      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var unsubscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function (e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            instance.clearSubscriptions('1', function (e) {

              if (e) return done(e);

              instance.processGetRecipients(getRecipientsMessage, function (e, afteClearedResult) {

                if (e) return done(e);

                expect(afteClearedResult.recipients.length).to.be(0);

                done();

              });
            });
          });
        });
      });
    });
  });

  context('functional bucket', function () {

    var SubscriptionBucket = Happn.bucket;

    it('test the trie lib, remove functionality', function (done) {

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var tSearch =  testBucket.__removableNodeTrie('path');

      tSearch.add({path:'test1'});

      tSearch.add({path:'test2'});

      tSearch.add({path:'test3'});

      expect(tSearch.get('test').length).to.be(3);

      tSearch.remove('test2');

      expect(tSearch.get('test').length).to.be(2);

      tSearch.add({path:'test'});

      tSearch.add({path:'test'});

      tSearch.add({path:'test'});

      expect(tSearch.get('test').length).to.be(5);

      tSearch.remove('test');

      expect(tSearch.get('test').length).to.be(0);

      done();

    });

    it('tests the subscription bucket adding, allSubscriptions', function (done) {

      var sessionId1 = '1';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('/test/path/*', sessionId1, {options: {refCount: 1}});

        expect(testBucket.allSubscriptions().length).to.be(1);

        testBucket.addSubscription('/test/path/*', sessionId1, {options: {refCount: 1}});

        expect(testBucket.allSubscriptions().length).to.be(1);

        done();
      })
    });

    it('tests the subscription bucket adding and removing, allSubscriptions', function (done) {

      var sessionId1 = '1';
      var sessionId2 = '2';
      var sessionId3 = '3';
      var sessionId4 = '4';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var data = {options: {refCount: 1}};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('/test/path/*', sessionId1, data);

        testBucket.addSubscription('/test/path/*', sessionId2, data);

        testBucket.addSubscription('/test/path/*', sessionId3, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        expect(testBucket.allSubscriptions().length).to.be(4);

        testBucket.removeSubscription('/test/path/*', sessionId4);

        expect(testBucket.allSubscriptions().length).to.be(4);

        testBucket.removeSubscription('/test/path/*', sessionId4);

        expect(testBucket.allSubscriptions().length).to.be(3);

        expect(testBucket.__segments.array.length).to.be(1);

        expect(testBucket.__segments.array[0].refCount).to.be(3);

        done();

      });

    });

    it('tests the catchall segment, allSubscriptions', function (done) {

      var sessionId1 = '1';
      var sessionId2 = '2';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var data = {options: {refCount: 1}};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('*', sessionId1, data);

        testBucket.addSubscription('*', sessionId2, data);

        expect(testBucket.allSubscriptions().length).to.be(2);

        testBucket.getSubscriptions('/test/path/1', function (e, subscriptions) {

          expect(subscriptions.length).to.be(2);

          testBucket.removeSubscription('*', sessionId2, function (e) {

            if (e) return done(e);

            expect(testBucket.allSubscriptions().length).to.be(1);

            expect(testBucket.__segments.array.length).to.be(0);//all subscriptions do not have segments

            done();

          });
        });
      });
    });

    it('tests the subscription bucket adding and removing, with getSubscriptions', function (done) {

      var sessionId1 = '1';
      var sessionId2 = '2';
      var sessionId3 = '3';
      var sessionId4 = '4';
      var sessionId5 = '5';

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var data = {options: {refCount: 1}};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        testBucket.addSubscription('/test/path/*', sessionId1, data);

        testBucket.addSubscription('/test/path/*', sessionId2, data);

        testBucket.addSubscription('/test/path/*', sessionId3, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        testBucket.addSubscription('/test/path/*', sessionId4, data);

        testBucket.addSubscription('/test/other/path/*', sessionId5, data);

        testBucket.addSubscription('/test/other/path/*', sessionId5, data);

        testBucket.addSubscription('/test/other/path/*', sessionId5, data);

        expect(testBucket.allSubscriptions().length).to.be(5);

        testBucket.getSubscriptions('/test/path/1', function (e, subscriptions) {

          expect(e).to.be(null);

          expect(subscriptions.length).to.be(4);

          done();

        });
      });
    });

    var RANDOM_COUNT = 100;

    it('starts up the subscription service, adds ' + RANDOM_COUNT + ' subscriptions, checks we are able to retrieve recipients', function (done) {

      this.timeout(10000);

      var testBucket = new SubscriptionBucket({
        type: 1,
        name: 'testBucket',
        channel: 'SET'
      });

      var pathCounts = {};

      testBucket.initialize(function (e) {

        if (e) return done(e);

        async.times(RANDOM_COUNT,

          function (time, timeCB) {

            var randomPath = Math.floor(Math.random() * 10) + 1;

            if (!pathCounts[randomPath]) pathCounts[randomPath] = 0;

            pathCounts[randomPath]++;

            var subId =  shortid.generate();

            testBucket.addSubscription('/test/path/' + randomPath, subId, {
              rand: randomPath,
              options: {refCount: 1}
            }, timeCB);
          },

          function (e) {

            if (e) return done(e);

            async.eachSeries(Object.keys(pathCounts), function (key, keyCB) {

              testBucket.getSubscriptions('/test/path/' + key, function (e, recipients) {

                expect(recipients.length).to.be(pathCounts[key]);

                keyCB();
              });

            }, done);
          }
        );
      });
    });

    function mockSubscriptionService(config, testItems, callback) {

      var UtilsService = require('../lib/services/utils/service');

      var utilsService = new UtilsService();

      var SubscriptionService = require('../lib/services/subscription/service');

      var subscriptionService = new SubscriptionService({
        logger: {
          createLogger: function (key) {
            return {
              warn: function (message) {
                console.log(message);
              },
              info: function (message) {
                console.log(message);
              },
              success: function (message) {
                console.log(message);
              },
              error: function (message) {
                console.log(message);
              },
              $$TRACE: function (message) {
                console.log(message);
              }
            }
          }
        }
      });

      subscriptionService.happn = {
        services: {
          data: {
            get: function (path, criteria, callback) {
              return callback(null, testItems);
            }
          },
          utils: utilsService
        }
      };

      subscriptionService.initialize(config, function (e) {

        if (e) return callback(e);

        return callback(null, subscriptionService);

      });
    }

    it('starts up the subscription service, does processSubscribe - then getRecipients', function (done) {

      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function (e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            done();
          });
        });
      });
    });

    it('starts up the subscription service, does processSubscribe - then getRecipients, then unsubscribe and get no recipients', function (done) {

      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var unsubscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1',
              key: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function (e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            instance.processUnsubscribe(unsubscribeMessage, function (e) {

              if (e) return done(e);

              instance.processGetRecipients(getRecipientsMessage, function (e) {

                if (e) return done(e);

                expect(result.recipients.length).to.be(0);

                done();

              });
            });
          });
        });
      });
    });

    it('starts up the subscription service, does processSubscribe - with initialCallback', function (done) {

      var config = {};

      var testItems = [
        {path: 'test/path/1', data: {}},
        {path: 'test/path/2', data: {}}
      ];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data',
              initialCallback: true
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();

        });
      });
    });

    it('starts up the subscription service, does processSubscribe - with initialEmit', function (done) {

      var config = {};

      var testItems = [
        {path: 'test/path/1', data: {}},
        {path: 'test/path/2', data: {}}
      ];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data',
              initialEmit: true
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();

        });
      });
    });

    it('does a clearSubscriptions for a specific session', function (done) {

      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function (e, instance) {

        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            key: 'test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var unsubscribeMessage = {
          request: {
            path: '/SET@test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        instance.processSubscribe(subscribeMessage, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function (e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            instance.clearSubscriptions('1', function (e) {

              if (e) return done(e);

              instance.processGetRecipients(getRecipientsMessage, function (e, afteClearedResult) {

                if (e) return done(e);

                expect(afteClearedResult.recipients.length).to.be(0);

                done();

              });
            });
          });
        });
      });
    });
  });

});
