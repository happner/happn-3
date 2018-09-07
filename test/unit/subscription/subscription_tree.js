var expect = require('expect.js'),
  async = require('async'),
  shortid = require('shortid');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function() {

  context('functional subscription tree', function() {

    it('subscription tree, single record subscribe', function(done) {

      var subscriptionTree = require('tame-search').create();

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.subscribe('/test/path/1', {
        key: '1',
        data: {
          test: 1
        }
      });

      var subscribers = subscriptionTree.search('/test/path/1');

      expect(subscribers.length).to.be(1);

      done();
    });

    it('subscription tree, multiple record subscribe, with wildcards', function(done) {

      var subscriptionTree = require('tame-search').create();

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.subscribe('/test/path/1', {
        key: '1',
        data: {
          test: 1
        }
      });
      subscriptionTree.subscribe('/test/path/1', {
        key: '1',
        data: {
          test: 2
        }
      });
      subscriptionTree.subscribe('/test/path/2', {
        key: '1',
        data: {
          test: 3
        }
      });
      subscriptionTree.subscribe('/test/path/2', {
        key: '1',
        data: {
          test: 4
        }
      });

      subscriptionTree.subscribe('/test/path/3', {
        key: '1',
        data: {
          test: 5
        }
      });
      subscriptionTree.subscribe('/test/path/3', {
        key: '1',
        data: {
          test: 6
        }
      });

      subscriptionTree.subscribe('/test/path/*', {
        key: '1',
        data: {
          test: 7
        }
      });
      subscriptionTree.subscribe('/test/path/*', {
        key: '1',
        data: {
          test: 8
        }
      });

      var subscribers = subscriptionTree.search('/test/path/1');

      expect(subscribers.length).to.be(4);

      done();

    });

    it('subscription tree, multiple record subscribe, multiple wildcards', function(done) {

      var subscriptionTree = require('tame-search').create();

      //path, id, dataId, data, depth, originalPath
      subscriptionTree.subscribe('/2/test/path/1', {
        key: '1',
        data: {
          test: 1
        }
      });
      subscriptionTree.subscribe('/2/test/path/1', {
        key: '1',
        data: {
          test: 2
        }
      });

      subscriptionTree.subscribe('/2/test/path/2', {
        key: '1',
        data: {
          test: 1
        }
      });
      subscriptionTree.subscribe('/2/test/path/2', {
        key: '1',
        data: {
          test: 2
        }
      });

      subscriptionTree.subscribe('/2/test/path/3', {
        key: '1',
        data: {
          test: 1
        }
      });
      subscriptionTree.subscribe('/2/test/path/3', {
        key: '1',
        data: {
          test: 2
        }
      });

      subscriptionTree.subscribe('/2/test/path/*', {
        key: '1',
        data: {
          test: 1
        }
      });
      subscriptionTree.subscribe('/2/test/path/*', {
        key: '1',
        data: {
          test: 2
        }
      });

      subscriptionTree.subscribe('/2/*/*/3', {
        key: '1',
        data: {
          test: 3
        }
      });

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(5);

      done();
    });

    it('subscription tree, remove functionality', function(done) {

      var subscriptionTree = require('tame-search').create();

      subscriptionTree.subscribe('/2/test/path/3', {
        key: '1',
        data: {
          test: 3
        }
      });
      subscriptionTree.subscribe('/2/*/*/3', {
        key: '1',
        data: {
          test: 3
        }
      });

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      subscriptionTree.unsubscribe('/2/*/*/3');

      subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(1);

      done();
    });

    it('subscription tree, remove non-existing', function(done) {

      var subscriptionTree = require('tame-search').create();

      subscriptionTree.subscribe('/2/test/path/3', {
        key: '1',
        data: {
          test: 3
        }
      });
      subscriptionTree.subscribe('/2/*/*/3', {
        key: '1',
        data: {
          test: 3
        }
      });

      var subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

      subscriptionTree.unsubscribe('/4/1/1/3');

      subscribers = subscriptionTree.search('/2/test/path/3');

      expect(subscribers.length).to.be(2);

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
        createLogger: function(key) {
          return {
            warn: function(message) {
              console.log(message);
            },
            info: function(message) {
              console.log(message);
            },
            success: function(message) {
              console.log(message);
            },
            error: function(message) {
              console.log(message);
            },
            $$TRACE: function(message) {
              console.log(message);
            }
          };
        }
      }
    });

    subscriptionService.happn = {
      services: {
        data: {
          get: function(path, criteria, callback) {
            return callback(null, testItems);
          }
        },
        security: {
          onDataChanged: function() {}
        },
        utils: utilsService
      }
    };

    subscriptionService.initialize(config, function(e) {

      if (e) return callback(e);

      return callback(null, subscriptionService);

    });
  }

  it('starts up the subscription service, does processSubscribe - then getRecipients', function(done) {

    var config = {};

    var testItems = [];

    mockSubscriptionService(config, testItems, function(e, instance) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function(e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function(e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            done();
          });
        });
      });
    });
  });

  it('starts up the subscription service, does processSubscribe - then getRecipients, then unsubscribe and get no recipients', function(done) {

    var config = {};

    var testItems = [];

    mockSubscriptionService(config, testItems, function(e, instance) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function(e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1',
              key: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function(e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            instance.prepareSubscribeMessage(unsubscribeMessage, function(e, prepared) {

              if (e) return done(e);

              instance.processUnsubscribe(prepared, function(e) {

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
  });

  it('starts up the subscription service, does processSubscribe - with initialCallback', function(done) {

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

    mockSubscriptionService(config, testItems, function(e, instance) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function(e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();

        });
      });
    });
  });

  it('starts up the subscription service, does processSubscribe - with initialEmit', function(done) {

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

    mockSubscriptionService(config, testItems, function(e, instance) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function(e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();
        });
      });
    });
  });

  it('does a clearSubscriptions for a specific session', function(done) {

    var config = {};

    var testItems = [];

    mockSubscriptionService(config, testItems, function(e, instance) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function(e, result) {

          if (e) return done(e);

          expect(result.response._meta.status).to.be('ok');

          var getRecipientsMessage = {
            request: {
              action: 'SET',
              path: 'test/path/1'
            }
          };

          instance.processGetRecipients(getRecipientsMessage, function(e, result) {

            if (e) return done(e);

            expect(result.recipients.length).to.be(1);

            instance.clearSessionSubscriptions('1');

            instance.processGetRecipients(getRecipientsMessage, function(e, afteClearedResult) {

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
