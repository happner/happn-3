var Happn = require('..')
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  ;

describe('f7_subscription_service', function () {

  before('', function(){

  });

  after('', function(){

  });

  it('tests the subscription bucket adding, allSubscriptions', function (done) {

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

    var sessionId1 = '1';

    var testBucket = new SubscriptionBucket({
      type:1,
      name:'testBucket'
    });

    testBucket.initialize(function(e) {

      if (e) return done(e);

      testBucket.addSubscription('/test/path/*', sessionId1);

      expect(testBucket.allSubscriptions().length).to.be(1);

      testBucket.addSubscription('/test/path/*', sessionId1);

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
      type:1,
      name:'testBucket'
    });

    testBucket.initialize(function(e){

      if (e) return done(e);

      testBucket.addSubscription('/test/path/*', sessionId1);

      testBucket.addSubscription('/test/path/*', sessionId2);

      testBucket.addSubscription('/test/path/*', sessionId3);

      testBucket.addSubscription('/test/path/*', sessionId4);

      testBucket.addSubscription('/test/path/*', sessionId4);

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

  it('tests the subscription bucket adding and removing, with getSubscriptions', function (done) {

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

    var sessionId1 = '1';
    var sessionId2 = '2';
    var sessionId3 = '3';
    var sessionId4 = '4';
    var sessionId5 = '5';

    var testBucket = new SubscriptionBucket({
      type:1,
      name:'testBucket'
    });

    testBucket.initialize(function(e){

      if (e) return done(e);

      testBucket.addSubscription('/test/path/*', sessionId1);

      testBucket.addSubscription('/test/path/*', sessionId2);

      testBucket.addSubscription('/test/path/*', sessionId3);

      testBucket.addSubscription('/test/path/*', sessionId4);

      testBucket.addSubscription('/test/path/*', sessionId4);

      testBucket.addSubscription('/test/other/path/*', sessionId5);

      testBucket.addSubscription('/test/other/path/*', sessionId5);

      testBucket.addSubscription('/test/other/path/*', sessionId5);

      expect(testBucket.allSubscriptions().length).to.be(5);

      testBucket.getSubscriptions('/test/path/1', function(e, subscriptions){

        expect(e).to.be(null);

        expect(subscriptions.length).to.be(4);

        done();

      });
    });
  });

  var RANDOM_COUNT = 1000;

  it('starts up the subscription service, adds ' + RANDOM_COUNT + ' subscriptions, checks we are able to retrieve recipients', function (done) {

    this.timeout();

    var SubscriptionBucket = require('../lib/services/subscription/bucket.js');

    var testBucket = new SubscriptionBucket({
      type:1,
      name:'testBucket'
    });

    var pathCounts = {};

    testBucket.initialize(function(e) {

      if (e) return done(e);

      async.times(RANDOM_COUNT,

        function(time, timeCB){

          var randomPath = Math.floor(Math.random() * 10) + 1;

          if (!pathCounts[randomPath]) pathCounts[randomPath] = 0;

          pathCounts[randomPath]++;

          testBucket.addSubscription('/test/path/' + randomPath, shortid.generate(), {rand:randomPath}, timeCB);
        },

        function(e){

          if (e) return done(e);

          async.eachSeries(Object.keys(pathCounts), function(key, keyCB){

            testBucket.getSubscriptions('/test/path/' + key, function(e, recipients){

              expect(recipients.length).to.be(pathCounts[key]);
              keyCB();

            });

          }, done);
        }
      );
    });
  });

  function mockSubscriptionService(config, testItems, callback){

    var UtilsService = require('../lib/services/utils/service');

    var utilsService = new UtilsService();

    var SubscriptionService = require('../lib/services/subscription/service');

    var subscriptionService = new SubscriptionService({logger:{
      createLogger:function(key){
        return {
          warn:function(message){
            console.log(message);
          },
          info:function(message){
            console.log(message);
          },
          success:function(message){
            console.log(message);
          },
          error:function(message){
            console.log(message);
          },
          $$TRACE:function(message){
            console.log(message);
          }
        }
      }
    }});

    subscriptionService.happn = {
      services:{
        data:{
          get: function(path, criteria, callback){
            return callback(null, testItems);
          }
        },
        utils:utilsService
      }
    };

    subscriptionService.initialize(config, function(e){

      if (e) return callback(e);

      return callback(null, subscriptionService);

    });
  }

  it('starts up the subscription service, does processSubscribe - then getRecipients', function (done) {

    var config = {

    };

    var testItems = [];

    mockSubscriptionService(config, testItems, function(e, instance){

      if (e) return done(e);

      var subscribeMessage = {
        request:{
          path:'/SET@test/path/*',
          options:{
            other:'data'
          }
        },
        session:{
          id:'1'
        }
      };

      instance.processSubscribe(subscribeMessage, function(e, result){

        if (e) return done(e);

        expect(result.response._meta.status).to.be('ok');

        var getRecipientsMessage = {
          request:{
            action:'SET',
            path:'test/path/1'
          }
        };

        instance.processGetRecipients(getRecipientsMessage, function(e, result){

          if (e) return done(e);

          expect(result.recipients.length).to.be(1);

          done();
        });
      });
    });
  });

  it('starts up the subscription service, does processSubscribe - then getRecipients, then unsubscribe and get no recipients', function (done) {

    var config = {

    };

    var testItems = [];

    mockSubscriptionService(config, testItems, function(e, instance){

      if (e) return done(e);

      var subscribeMessage = {
        request:{
          path:'/SET@test/path/*',
          options:{
            other:'data'
          }
        },
        session:{
          id:'1'
        }
      };

      var unsubscribeMessage = {
        request:{
          path:'/SET@test/path/*',
          options:{
            other:'data'
          }
        },
        session:{
          id:'1'
        }
      };

      instance.processSubscribe(subscribeMessage, function(e, result){

        if (e) return done(e);

        expect(result.response._meta.status).to.be('ok');

        var getRecipientsMessage = {
          request:{
            action:'SET',
            path:'test/path/1'
          }
        };

        instance.processGetRecipients(getRecipientsMessage, function(e, result){

          if (e) return done(e);

          expect(result.recipients.length).to.be(1);

          instance.processUnsubscribe(unsubscribeMessage, function(e){

            if (e) return done(e);

            instance.processGetRecipients(getRecipientsMessage, function(e) {

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

    var config = {

    };

    var testItems = [
      {path:'test/path/1', data:{}},
      {path:'test/path/2', data:{}}
    ];

    mockSubscriptionService(config, testItems, function(e, instance){

      if (e) return done(e);

      var subscribeMessage = {
        request:{
          path:'/SET@test/path/*',
          options:{
            other:'data',
            initialCallback:true
          }
        },
        session:{
          id:'1'
        }
      };

      instance.processSubscribe(subscribeMessage, function(e, result){

        if (e) return done(e);

        expect(result.response._meta.status).to.be('ok');
        expect(result.response.initialValues.length).to.be(2);

        done();

      });
    });
  });

  it('starts up the subscription service, does processSubscribe - with initialEmit', function (done) {

    var config = {

    };

    var testItems = [
      {path:'test/path/1', data:{}},
      {path:'test/path/2', data:{}}
    ];

    mockSubscriptionService(config, testItems, function(e, instance){

      if (e) return done(e);

      var subscribeMessage = {
        request:{
          path:'/SET@test/path/*',
          options:{
            other:'data',
            initialEmit:true
          }
        },
        session:{
          id:'1'
        }
      };

      instance.processSubscribe(subscribeMessage, function(e, result){

        if (e) return done(e);

        expect(result.response._meta.status).to.be('ok');
        expect(result.response.initialValues.length).to.be(2);

        done();

      });
    });
  });

  it('does a clearSubscriptions for a specific session', function (done) {

    var config = {

    };

    var testItems = [];

    mockSubscriptionService(config, testItems, function(e, instance){

      if (e) return done(e);

      var subscribeMessage = {
        request:{
          path:'/SET@test/path/*',
          options:{
            other:'data'
          }
        },
        session:{
          id:'1'
        }
      };

      var unsubscribeMessage = {
        request:{
          path:'/SET@test/path/*',
          options:{
            other:'data'
          }
        },
        session:{
          id:'1'
        }
      };

      instance.processSubscribe(subscribeMessage, function(e, result){

        if (e) return done(e);

        expect(result.response._meta.status).to.be('ok');

        var getRecipientsMessage = {
          request:{
            action:'SET',
            path:'test/path/1'
          }
        };

        instance.processGetRecipients(getRecipientsMessage, function(e, result){

          if (e) return done(e);

          expect(result.recipients.length).to.be(1);

          instance.clearSubscriptions('1', function(e){

            if (e) return done(e);

            instance.processGetRecipients(getRecipientsMessage, function(e) {

              if (e) return done(e);

              expect(result.recipients.length).to.be(0);

              done();

            });
          });
        });
      });
    });
  });

});
