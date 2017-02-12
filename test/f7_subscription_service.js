Happn = require('..');
var expect = require('expect.js');

describe('f7_subscription_service', function () {

  before('', function(){

  });

  after('', function(){

  });

  it('tests the subscription bucket', function (done) {

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

      console.dir(testBucket.__subscribers.array);

      expect(testBucket.allSubscriptions().length).to.be(4);

      testBucket.removeSubscription('/test/path/*', sessionId4);

      expect(testBucket.allSubscriptions().length).to.be(4);

      testBucket.removeSubscription('/test/path/*', sessionId4);

      expect(testBucket.allSubscriptions().length).to.be(3);

      done();

    });

  });

});
