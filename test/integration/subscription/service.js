describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
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
          error: {
            handleSystem: function() {}
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
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var prepared = instance.prepareSubscribeMessage(subscribeMessage);

        instance.processSubscribe(prepared, function(e, result) {
          expect(result.response._meta.status).to.be('ok');
          expect(
            instance.getRecipients({
              request: {
                action: 'SET',
                path: '/test/path/1'
              }
            }).length
          ).to.be(1);
          done();
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
            path: '/SET@/test/path/*',
            key: '/test/path/*',
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
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var subscribePrepared = instance.prepareSubscribeMessage(subscribeMessage);
        var unsubscribePrepared = instance.prepareSubscribeMessage(unsubscribeMessage);

        instance.processSubscribe = Promise.promisify(instance.processSubscribe);
        instance.processUnsubscribe = Promise.promisify(instance.processUnsubscribe);

        instance
          .processSubscribe(subscribePrepared)
          .then(function(result) {
            expect(result.response._meta.status).to.be('ok');
            return Promise.resolve(
              instance.getRecipients({
                request: {
                  action: 'set',
                  path: '/test/path/1',
                  key: '/test/path/1'
                }
              })
            );
          })
          .then(function(getRecipientsResult) {
            expect(getRecipientsResult.length).to.be(1);
            return instance.processUnsubscribe(unsubscribePrepared);
          })
          .then(function(unsubscribeResult) {
            return Promise.resolve(
              instance.getRecipients({
                request: {
                  action: 'set',
                  path: '/test/path/1',
                  key: '/test/path/1'
                }
              })
            );
          })
          .then(function(getRecipientsResult) {
            expect(getRecipientsResult.length).to.be(0);
            done();
          });
      });
    });

    it('starts up the subscription service, does processSubscribe twice for same path - then get 2 recipients, then unsubscribe a specific reference and get 1 recipients', function(done) {
      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function(e, instance) {
        if (e) return done(e);
        var subscribeMessage = {
          request: {
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };
        var subscribeMessage1 = {
          request: {
            path: '/SET@/test/path/*',
            key: '/test/path/*',
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
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };
        var referenceId = null;

        var subscribeMessagePrepared = instance.prepareSubscribeMessage(subscribeMessage);
        var subscribeMessage1Prepared = instance.prepareSubscribeMessage(subscribeMessage1);
        var unsubscribeMessagePrepared = instance.prepareSubscribeMessage(unsubscribeMessage);

        instance.processSubscribe = Promise.promisify(instance.processSubscribe);
        instance.processUnsubscribe = Promise.promisify(instance.processUnsubscribe);

        instance
          .processSubscribe(subscribeMessagePrepared)
          .then(function(result) {
            expect(result.response._meta.status).to.be('ok');
            return instance.processSubscribe(subscribeMessage1Prepared);
          })
          .then(function(result) {
            referenceId = result.response.data.id;
            expect(result.response._meta.status).to.be('ok');
            return Promise.resolve(
              instance.getRecipients({
                request: {
                  action: 'set',
                  path: '/test/path/1',
                  key: '/test/path/1'
                }
              })
            );
          })
          .then(function(result) {
            expect(result.length).to.be(2);
            unsubscribeMessagePrepared.request.options.referenceId = referenceId;
            return instance.processUnsubscribe(unsubscribeMessagePrepared);
          })
          .then(function(unsubresult) {
            return Promise.resolve(
              instance.getRecipients({
                request: {
                  action: 'set',
                  path: '/test/path/1',
                  key: '/test/path/1'
                }
              })
            );
          })
          .then(function(result) {
            expect(result.length).to.be(1);
            done();
          });
      });
    });

    it('starts up the subscription service, does processSubscribe twice for same path - then get 2 recipients, tests the allListeners function', function(done) {
      var config = {};

      var testItems = [];

      mockSubscriptionService(config, testItems, function(e, instance) {
        if (e) return done(e);
        var subscribeMessage = {
          request: {
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };
        var subscribeMessage1 = {
          request: {
            path: '/SET@/test/path/1',
            key: '/test/path/1',
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
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var referenceId = null;
        var subscribeMessagePrepared = instance.prepareSubscribeMessage(subscribeMessage);
        var subscribeMessage1Prepared = instance.prepareSubscribeMessage(subscribeMessage1);
        var unsubscribeMessagePrepared = instance.prepareSubscribeMessage(unsubscribeMessage);

        instance.processSubscribe = Promise.promisify(instance.processSubscribe);
        instance.processUnsubscribe = Promise.promisify(instance.processUnsubscribe);

        instance
          .processSubscribe(subscribeMessagePrepared)
          .then(function(result) {
            referenceId = result.response.data.id;
            expect(result.response._meta.status).to.be('ok');
            return instance.processSubscribe(subscribeMessage1Prepared);
          })
          .then(function(result) {
            expect(result.response._meta.status).to.be('ok');
            expect(instance.allListeners('1').length).to.be(2);
            expect(instance.allListeners('1')[0].key).to.be('1');
            expect(instance.allListeners('1')[0].data.path).to.be('/test/path/*');
            expect(instance.allListeners('1')[1].key).to.be('1');
            expect(instance.allListeners('1')[1].data.path).to.be('/test/path/1');
            unsubscribeMessagePrepared.request.options.referenceId = referenceId;
            return instance.processUnsubscribe(unsubscribeMessagePrepared);
          })
          .then(function() {
            expect(instance.allListeners('1').length).to.be(1);
            expect(instance.allListeners('1')[0].key).to.be('1');
            expect(instance.allListeners('1')[0].data.path).to.be('/test/path/1');
            done();
          });
      });
    });

    it('starts up the subscription service, does processSubscribe - with initialCallback', function(done) {
      var config = {};

      var testItems = [
        {
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
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data',
              initialCallback: true
            }
          },
          session: {
            id: '1'
          }
        };

        var prepared = instance.prepareSubscribeMessage(subscribeMessage);

        instance.processSubscribe = Promise.promisify(instance.processSubscribe);
        instance.processUnsubscribe = Promise.promisify(instance.processUnsubscribe);

        instance.processSubscribe(prepared).then(function(result) {
          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);

          done();
        });
      });
    });

    it('starts up the subscription service, does processSubscribe - with initialEmit', function(done) {
      var config = {};

      var testItems = [
        {
          path: '/test/path/1',
          data: {}
        },
        {
          path: '/test/path/2',
          data: {}
        }
      ];

      mockSubscriptionService(config, testItems, function(e, instance) {
        if (e) return done(e);

        var subscribeMessage = {
          request: {
            path: '/SET@/test/path/*',
            key: '/test/path/*',
            options: {
              other: 'data',
              initialEmit: true
            }
          },
          session: {
            id: '1'
          }
        };

        var prepared = instance.prepareSubscribeMessage(subscribeMessage);

        instance.processSubscribe = Promise.promisify(instance.processSubscribe);
        instance.processUnsubscribe = Promise.promisify(instance.processUnsubscribe);

        instance.processSubscribe(prepared).then(function(result) {
          expect(result.response._meta.status).to.be('ok');
          expect(result.response.initialValues.length).to.be(2);
          done();
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
            path: '/SET@/test/path/*',
            key: '/test/path/*',
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
            path: '/SET@/test/path/*',
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          }
        };

        var prepared = instance.prepareSubscribeMessage(subscribeMessage);

        instance.processSubscribe = Promise.promisify(instance.processSubscribe);
        instance.processUnsubscribe = Promise.promisify(instance.processUnsubscribe);

        instance
          .processSubscribe(prepared)
          .then(function(result) {
            expect(result.response._meta.status).to.be('ok');
            return Promise.resolve(
              instance.getRecipients({
                request: {
                  action: 'SET',
                  path: '/test/path/1'
                }
              })
            );
          })
          .then(function(result) {
            expect(result.length).to.be(1);
            instance.clearSessionSubscriptions('1');
            return Promise.resolve(
              instance.getRecipients({
                request: {
                  action: 'SET',
                  path: '/test/path/1'
                }
              })
            );
          })
          .then(function(afteClearedResult) {
            expect(afteClearedResult.length).to.be(0);
            done();
          });
      });
    });

    var happnInstance;
    var happnClient;

    after('it kills to client and server', function(done) {
      if (happnClient)
        happnClient.disconnect(function() {
          happnInstance.stop(done);
        });
      else done();
    });

    it('starts up an actual happn-3 instance, does a bunch of ons and sets', function(done) {
      var service = require('../../..').service;

      var setFinished = false;

      this.timeout(10000);

      service
        .create()

        .then(function(happnInst) {
          happnInstance = happnInst;

          return new Promise(function(resolve, reject) {
            happnInstance.services.session.localClient(function(e, instance) {
              if (e) return reject(e);

              resolve(instance);
            });
          });
        })
        .then(function(client) {
          happnClient = client;

          return new Promise(function(resolve, reject) {
            happnClient.on(
              '/something/*/*',
              function(data) {
                if (!setFinished) done(new Error('should not have happened:::'));
              },
              function(e) {
                happnClient.set(
                  '/nothing/like/this',
                  {
                    test: 'data'
                  },
                  function(e) {
                    if (e) return reject(e);

                    setTimeout(function() {
                      setFinished = true;
                      resolve();
                    }, 300);
                  }
                );
              }
            );
          });
        })
        .then(function() {
          return new Promise(function(resolve, reject) {
            happnClient.on(
              '/*/that',
              function(data) {
                resolve();
              },
              function(e) {
                happnClient.set(
                  '/something/that',
                  {
                    test: 'data'
                  },
                  function(e) {
                    if (e) return reject(e);
                  }
                );
              }
            );
          });
        })
        .then(function() {
          return new Promise(function(resolve, reject) {
            happnClient.on(
              '/*/*/that',
              function(data) {
                resolve();
              },
              function(e) {
                happnClient.set(
                  '/something/like/that',
                  {
                    test: 'data'
                  },
                  function(e) {
                    if (e) return reject(e);
                  }
                );
              }
            );
          });
        })
        .then(function() {
          done();
        })
        .catch(function(e) {
          done(e);
        });
    });
  }
);
