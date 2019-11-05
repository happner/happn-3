describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happn_client = happn.client;
    var happnInstance = null;
    var test_id;

    this.timeout(5000);

    var serviceConfig = {
      secure: true
    };

    before('should initialize the service', function(callback) {
      test_id = Date.now() + '_' + require('shortid').generate();

      try {
        service.create(serviceConfig, function(e, happnInst) {
          if (e) return callback(e);

          happnInstance = happnInst;
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    var publisherclient;
    var listenerclient;

    var disconnectClients = function(options, callback) {
      publisherclient.disconnect(
        {
          timeout: 2000
        },
        function(e) {
          if (e) return callback(e);
          listenerclient.disconnect(
            {
              timeout: 2000
            },
            callback
          );
        }
      );
    };

    var connectClients = function(options, callback) {
      happn_client.create(
        {
          config: {
            username: '_ADMIN',
            password: 'happn'
          }
        },
        function(e, instance) {
          if (e) return callback(e);
          publisherclient = instance;

          happn_client.create(
            {
              config: {
                username: '_ADMIN',
                password: 'happn'
              }
            },
            function(e, instance) {
              if (e) return callback(e);
              listenerclient = instance;
              callback();
            }
          );
        }
      );
    };

    var doOperations = function(options, callback) {
      //first listen for the change
      listenerclient.on(
        '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/*',
        {
          event_type: 'set'
        },
        function(/*message*/) {
          listenerclient.on(
            '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/*',
            {
              event_type: 'remove'
            },
            function(/*message*/) {
              callback();
            },
            function(e /*, listenerId*/) {
              if (!e) {
                //then make the change
                publisherclient.remove(
                  '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/1',
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  null,
                  function(e) {
                    if (e) return callback(e);
                  }
                );
              } else callback(e);
            }
          );
        },
        function(e /*, listenerId*/) {
          if (!e) {
            //then make the change
            publisherclient.set(
              '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/1',
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              null,
              function(e /*, result*/) {
                if (e) return callback(e);
              }
            );
          } else callback(e);
        }
      );
    };

    var doOperationsWithAll = function(options, callback) {
      //first listen for the change
      listenerclient.on(
        '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/*',
        {
          event_type: 'set'
        },
        function(/*message*/) {
          listenerclient.on(
            '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/*',
            {
              event_type: 'all'
            },
            function(/*message*/) {
              callback();
            },
            function(e /*, listenerId*/) {
              if (e) return callback(e);
              publisherclient.remove(
                '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/1',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        },
        function(e /*, listenerId*/) {
          if (e) return callback(e);
          publisherclient.set(
            '/memory-leak-protocol-service/' + test_id + '/testsubscribe/data/event/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function(e /*, result*/) {
              if (e) return callback(e);
            }
          );
        }
      );
    };

    it('should do a bunch of operations, then disconnect we ensure that there are no residual subscriptions in the subscription service', function(done) {
      this.timeout(5000);

      connectClients(null, function(e) {
        if (e) return done(e);

        doOperations(null, function(e) {
          if (e) return done(e);

          expect(happnInstance.services.subscription.subscriptions.searchAll().length > 0).to.be(
            true
          );

          disconnectClients(null, function(e) {
            if (e) return done(e);

            setTimeout(function() {
              expect(
                happnInstance.services.subscription.subscriptions.searchAll().length === 0
              ).to.be(true);
              done();
            }, 2000);
          });
        });
      });
    });

    it('should do a bunch of operations with an all subscription, then disconnect we ensure that there are no residual subscriptions in the subscription service', function(done) {
      this.timeout(5000);

      connectClients(null, function(e) {
        if (e) return done(e);

        doOperationsWithAll(null, function(e) {
          if (e) return done(e);

          expect(happnInstance.services.subscription.subscriptions.searchAll().length > 0).to.be(
            true
          );

          disconnectClients(null, function(e) {
            if (e) return done(e);

            setTimeout(function() {
              expect(
                happnInstance.services.subscription.subscriptions.searchAll().length === 0
              ).to.be(true);
              done();
            }, 2000);
          });
        });
      });
    });

    after(function(done) {
      this.timeout(20000);

      disconnectClients(null, function() {
        happnInstance.stop(done);
      });
    });
  }
);
