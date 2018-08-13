describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js'),
    async = require('async'),
    shortid = require('shortid'),
    Promise = require('bluebird');

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
          };
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
        security:{
          onDataChanged:function(){}
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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

        if (e) return done(e);

        instance.processSubscribe(prepared, function (e, result) {

        if (e) return done(e);

        expect(result.response._meta.status).to.be('ok');

        var getRecipientsMessage = {
          request: {
            action: 'set',
            path: 'test/path/1',
            key: 'test/path/1'
          }
        };

        instance.processGetRecipients(getRecipientsMessage, function (e, result) {

          if (e) return done(e);

          expect(result.recipients.length).to.be(1);

          instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

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

      instance.prepareSubscribeMessage(subscribeMessage, function(e, prepared) {

          if (e) return done(e);

          instance.processSubscribe(prepared, function (e, result) {

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

  it('starts up an actual happn-3 instance, does a bunch of ons and sets', function (done) {

    var happnInstance;

    var happnClient;

    var service = require('../../..').service;

    var setFinished = false;

    this.timeout(10000);

    service.create()

      .then(function (happnInst) {

        happnInstance = happnInst;

        return new Promise(function (resolve, reject) {

          happnInstance.services.session.localClient(function (e, instance) {

            if (e) return reject(e);

            resolve(instance);

          });
        });

      }).then(function (client) {

        happnClient = client;

        return new Promise(function (resolve, reject) {

          happnClient.on('/*/that', function (data) {

            if (!setFinished) done(new Error('should not have happened:::'));

          }, function (e) {

            happnClient.set('/something/like/this', {
              test: 'data'
            }, function (e) {

              if (e) return reject(e);

              setTimeout(function () {
                setFinished = true;
                resolve();
              }, 300);
            });
          });
        });
      }).then(function () {

        return new Promise(function (resolve, reject) {

          happnClient.on('/*/that', function (data) {

            resolve();

          }, function (e) {

            happnClient.set('/something/like/that', {
              test: 'data'
            }, function (e) {

              if (e) return reject(e);
            });
          });
        });
      }).then(function () {

        return new Promise(function (resolve, reject) {

          happnClient.on('/*/*/that', function (data) {

            resolve();

          }, function (e) {

            happnClient.set('/something/like/that', {
              test: 'data'
            }, function (e) {

              if (e) return reject(e);
            });
          });
        });
      }).then(function () {

        happnClient.disconnect(function () {
          happnInstance.stop(done);
        });
      })
      .catch(done);
  });

});
