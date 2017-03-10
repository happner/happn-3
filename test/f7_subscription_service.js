var Happn = require('..')
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  , Promise = require('bluebird')
  ;

describe('f7_subscription_service', function () {

  before('', function () {

  });

  after('', function () {

  });

  it('tests the subscription bucket adding, allSubscriptions', function (done) {

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

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

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

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

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

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

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

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

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

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

          testBucket.addSubscription('/test/path/' + randomPath, shortid.generate(), {
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

  it('starts up an actual happn-3 instance, does a bunch of ons and sets', function (done) {

    var happnInstance;

    var happnClient;

    var service = require('../').service;

    var setFinished = false;

    this.timeout(10000);

    service.create()

      .then(function(happnInst){

        happnInstance = happnInst;

        return new Promise(function(resolve, reject){

          happnInstance.services.session.localClient(function(e, instance) {

            if (e) return reject(e);

            resolve(instance);

          });
        });

    }).then(function(client){

      happnClient = client;

      return new Promise(function(resolve, reject){

        happnClient.on('/*/that', function(data){

          if (!setFinished) done(new Error('should not have happened:::'));

        }, function(e){

          happnClient.set('/something/like/this', {test:'data'}, function(e){

            if (e) return reject(e);

            setTimeout(function(){
              setFinished = true;
              resolve();
            }, 300);
          });
        });
      });
    }).then(function(){

      return new Promise(function(resolve, reject){

        happnClient.on('/*/that', function(data){

          resolve();

        }, function(e){

          happnClient.set('/something/like/that', {test:'data'}, function(e){

            if (e) return reject(e);
          });
        });
      });
    }).then(function(){

      return new Promise(function(resolve, reject){

        happnClient.on('/*/*/that', function(data){

          resolve();

        }, function(e){

          happnClient.set('/something/like/that', {test:'data'}, function(e){

            if (e) return reject(e);
          });
        });
      });
    }).then(function(){

      return new Promise(function(resolve, reject){

        happnClient.on('*that', function(data){

          resolve();

        }, function(e){

          happnClient.set('/something/like/that', {test:'data'}, function(e){

            if (e) return reject(e);
          });
        });
      });
    }).then(function(){

      return new Promise(function(resolve, reject){

        happnClient.on('*something*', function(data){

          resolve();

        }, function(e){

          happnClient.set('/something/like/that', {test:'data'}, function(e){

            if (e) return reject(e);
          });
        });
      });
    }).then(done)
      .catch(done);
  });

});
