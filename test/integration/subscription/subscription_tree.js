var expect = require('expect.js'),
  async = require('async'),
  shortid = require('shortid');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  context('functional subscription tree', function () {

    it('subscription tree, wildcardMatching', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '/**/blah')).to.be(true);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '/*/blah')).to.be(true);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '/*/bleh')).to.be(false);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '/*/*/*')).to.be(true);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '/**')).to.be(true);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '**')).to.be(true);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '*')).to.be(true);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '/not/matching')).to.be(false);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/blah', '/test/pattern/blah')).to.be(true);

      expect(subscriptionTree.__wildcardMatch('/test/pattern/bleh', '/test/pattern/*')).to.be(true);

      done();

    });

    it('subscription tree, single record subscribe', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.add('/test/path/1', {
        key: '1',
        data: {test: 1}
      });

      var subscribers = subscriptionTree.search('/test/path/1');

      expect(subscribers.length).to.be(1);

      done();
    });

    it('subscription tree, multiple record subscribe, with wildcards', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.add('/test/path/1', {
        key: '1',
        data: {test: 1}
      });
      subscriptionTree.add('/test/path/1', {
        key: '1',
        data: {test: 2}
      });
      subscriptionTree.add('/test/path/2', {
        key: '1',
        data: {test: 3}
      });
      subscriptionTree.add('/test/path/2', {
        key: '1',
        data: {test: 4}
      });

      subscriptionTree.add('/test/path/3', {
        key: '1',
        data: {test: 5}
      });
      subscriptionTree.add('/test/path/3', {
        key: '1',
        data: {test: 6}
      });

      subscriptionTree.add('/test/path/*', {
        key: '1',
        data: {test: 7}
      });
      subscriptionTree.add('/test/path/*', {
        key: '1',
        data: {test: 8}
      });

      var subscribers = subscriptionTree.search('/test/path/1');

      expect(subscribers.length).to.be(4);

      done();

    });

    it('tests the subscription bucket adding and removing, bad edge case', function (done) {

      var sessionId1 = '1';
      var sessionId2 = '2';
      var sessionId3 = '3';

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      var data = {
        options: {
          refCount: 1
        }
      };

      subscriptionTree.add('/_events/field-pop/server/deviceRegistered/*', {key:sessionId1, data:data});

      subscriptionTree.add('/_events/field-pop/server/deviceRegistered/A corp/*', {key:sessionId2, data:data});

      subscriptionTree.add('/_events/field-pop/server/deviceStatus/*', {key:sessionId3, data:data});

      expect(subscriptionTree.__allRecipients.length).to.be(3);

      subscriptionTree.remove('/_events/field-pop/server/deviceRegistered/A corp/*', sessionId2);

      expect(subscriptionTree.__allRecipients.length).to.be(2);

      done();

    });

    it('subscription tree, multiple record subscribe, multiple wildcards', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.add('/2/test/path/1', {
        key: '1',
        data: {test: 1}
      });
      subscriptionTree.add('/2/test/path/1', {
        key: '1',
        data: {test: 2}
      });

      subscriptionTree.add('/2/test/path/2', {
        key: '1',
        data: {test: 1}
      });
      subscriptionTree.add('/2/test/path/2', {
        key: '1',
        data: {test: 2}
      });

      subscriptionTree.add('/2/test/path/3', {
        key: '1',
        data: {test: 1}
      });
      subscriptionTree.add('/2/test/path/3', {
        key: '1',
        data: {test: 2}
      });

      subscriptionTree.add('/2/test/path/*', {
        key: '1',
        data: {test: 1}
      });
      subscriptionTree.add('/2/test/path/*', {
        key: '1',
        data: {test: 2}
      });

      subscriptionTree.add('/2/*/*/3', {
        key: '1',
        data: {test: 3}
      });

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(5);

      done();
    });

    it('subscription tree, remove functionality', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      subscriptionTree.add('/2/test/path/3', {
        key: '1',
        data: {test: 3}
      });
      subscriptionTree.add('/2/*/*/3', {
        key: '1',
        data: {test: 3}
      });

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      subscriptionTree.remove({path: '/2/*/*/3'});

      subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(1);

      done();
    });

    it('subscription tree, remove non-existing', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      subscriptionTree.add('/2/test/path/3', {
        key: '1',
        data: {test: 3}
      });
      subscriptionTree.add('/2/*/*/3', {
        key: '1',
        data: {test: 3}
      });

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      subscriptionTree.remove({path: '/4/1/1/3'});

      subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      done();
    });

    it('subscription tree, multiple wildcard **', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.add('/2/test/**', {
        key: '1',
        data: {test: 1}
      });

      subscriptionTree.add('/2/**', {
        key: '2',
        data: {test: 2}
      });

      subscriptionTree.add('/2/**/2', {
        key: '3',
        data: {test: 3}
      });

      subscriptionTree.add('/2/**/2', {
        key: '5',
        data: {test: 5}
      });

      var subscriptions = subscriptionTree.search('/2/test/path/2');

      expect(subscriptions.length).to.be(4);

      subscriptionTree.remove({path: '/2/**/2', key: '5'});

      subscriptions = subscriptionTree.search('/2/test/path/2');

      expect(subscriptions.length).to.be(3);

      done();
    });

    it('subscription tree, cache', function (done) {

      var subscriptionTree = require('wild-pare').create({mode: 'wildstring'});

      subscriptionTree.add('/2/test/path/3', {
        key: '2',
        data: {test: 2}
      });

      subscriptionTree.add('/2/*/*/3', {
        key: '3',
        data: {test: 3}
      });

      subscriptionTree.add('/2/test/*/4', {
        key: '2',
        data: {test: 2}
      });

      var subscribers1 = subscriptionTree.search('/2/test/path/3');

      var subscribers2 = subscriptionTree.search('/2/test/path/4');

      var subscribers3 = subscriptionTree.search('/2/test/path/3');

      expect(subscribers1.length).to.be(2);
      expect(subscribers2.length).to.be(1);
      expect(subscribers3.length).to.be(2);

      expect(subscriptionTree.__cache.values().length).to.be(2);

      var cachedSubs = subscriptionTree.__cache.get('/2/test/path/3{}');

      cachedSubs[0].specialValue = 'test';

      subscriptionTree.__cache.set('/2/test/path/3{}', cachedSubs);

      var subscribers1 = subscriptionTree.search('/2/test/path/3');

      expect(subscribers1[0].specialValue).to.be('test');

      done();
    });
  });

  var RANDOM_COUNT = 100;

  function mockSubscriptionService(config, testItems, callback) {

    var UtilsService = require('../../../lib/services/utils/service');

    var utilsService = new UtilsService();

    var SubscriptionService = require('../../../lib/services/subscription/service');

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

      instance.prepareSubscribeMessage(subscribeMessage, function (e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function (e, result) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function (e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function (e, result) {

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

            instance.prepareSubscribeMessage(unsubscribeMessage, function (e, prepared) {

              if (e) return done(e);

              instance.processUnsubscribe(prepared, function (e) {

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
    });
  });

  it('starts up the subscription service, does processSubscribe - with initialCallback', function (done) {

    var config = {};

    var testItems = [{
      path: 'test/path/1',
      data: {}
    },
      {
        path: 'test/path/2',
        data: {}
      }
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

      instance.prepareSubscribeMessage(subscribeMessage, function (e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();

        });
      });
    });
  });

  it('starts up the subscription service, does processSubscribe - with initialEmit', function (done) {

    var config = {};

    var testItems = [{
      path: 'test/path/1',
      data: {}
    },
      {
        path: 'test/path/2',
        data: {}
      }
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

      instance.prepareSubscribeMessage(subscribeMessage, function (e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function (e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();
        });
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

      instance.prepareSubscribeMessage(subscribeMessage, function (e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function (e, result) {

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

            instance.clearSessionSubscriptions('1', function (e) {

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
