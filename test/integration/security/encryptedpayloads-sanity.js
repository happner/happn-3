describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happn_client = happn.client;
    var mode = 'embedded';
    var default_timeout = 4000;
    var happnInstance = null;

    before('should initialize the service', function(callback) {
      this.timeout(20000);

      try {
        service.create(
          {
            secure: true,
            encryptPayloads: true,
            services: {
              security: {
                config: {
                  keyPair: {
                    privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
                    publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
                  }
                }
              }
            }
          },
          function(e, happnInst) {
            if (e) return callback(e);

            happnInstance = happnInst;
            callback();
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    after(function(done) {
      socketClient
        .disconnect()
        .then(eventEmitterClient.disconnect().then(happnInstance.stop().then(done)))
        .catch(done);
    });

    var socketClient;
    var eventEmitterClient;

    var Crypto = require('happn-util-crypto');
    var crypto = new Crypto();

    var socketClientKeyPair = crypto.createKeyPair();
    var eventEmitterClientKeyPair = crypto.createKeyPair();

    before('should initialize the clients', function(callback) {
      this.timeout(default_timeout);

      happnInstance.services.session
        .localClient({
          username: '_ADMIN',
          password: 'happn',
          keyPair: eventEmitterClientKeyPair
        })

        .then(function(instance) {
          eventEmitterClient = instance;

          happn_client.create(
            {
              config: {
                username: '_ADMIN',
                password: 'happn',
                keyPair: socketClientKeyPair
              }
            },
            function(e, instance) {
              if (e) return callback(e);

              socketClient = instance;
              callback();
            }
          );
        });
    });

    //  We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

    it('the listener should pick up a single published event, eventemitter listening', function(callback) {
      this.timeout(default_timeout);

      try {
        //first listen for the change
        eventEmitterClient.on(
          '/e2e_test1/testsubscribe/data/event',
          {
            event_type: 'set',
            count: 1
          },
          function() {
            expect(
              eventEmitterClient.state.events['/SET@/e2e_test1/testsubscribe/data/event']
            ).to.be(undefined);
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                eventEmitterClient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
              ).to.be(1);
              //then make the change
              socketClient.set(
                '/e2e_test1/testsubscribe/data/event',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function() {
                  //eslint-disable-next-line no-console
                  console.log('put happened - listening for result');
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the listener should pick up a single published event, eventemitter publishing', function(callback) {
      this.timeout(default_timeout);

      try {
        //first listen for the change
        socketClient.on(
          '/e2e_test1/testsubscribe/data/event',
          {
            event_type: 'set',
            count: 1
          },
          function() {
            expect(socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event']).to.be(
              undefined
            );
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
              ).to.be(1);
              //then make the change
              eventEmitterClient.set(
                '/e2e_test1/testsubscribe/data/event',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function() {
                  //do nothing
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the publisher should set new data ', function(callback) {
      this.timeout(default_timeout);

      try {
        var test_path_end = require('shortid').generate();

        socketClient.set(
          'e2e_test1/testsubscribe/data/' + test_path_end,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {
            noPublish: true
          },
          function(e) {
            if (!e) {
              socketClient.get('e2e_test1/testsubscribe/data/' + test_path_end, null, function(
                e,
                results
              ) {
                expect(results.property1 === 'property1').to.be(true);
                if (mode !== 'embedded') expect(results.created === results.modified).to.be(true);
                callback(e);
              });
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('should set data, and then merge a new document into the data without overwriting old fields', function(callback) {
      this.timeout(default_timeout);

      try {
        var test_path_end = require('shortid').generate();

        socketClient.set(
          'e2e_test1/testsubscribe/data/merge/' + test_path_end,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            if (e) return callback(e);
            socketClient.set(
              'e2e_test1/testsubscribe/data/merge/' + test_path_end,
              {
                property4: 'property4'
              },
              {
                merge: true
              },
              function(e) {
                if (e) return callback(e);
                socketClient.get(
                  'e2e_test1/testsubscribe/data/merge/' + test_path_end,
                  null,
                  function(e, results) {
                    if (e) return callback(e);
                    expect(results.property4).to.be('property4');
                    expect(results.property1).to.be('property1');
                    callback();
                  }
                );
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('should search for a complex object', function(callback) {
      var test_path_end = require('shortid').generate();

      var complex_obj = {
        regions: ['North', 'South'],
        towns: ['North.Cape Town'],
        categories: ['Action', 'History'],
        subcategories: ['Action.angling', 'History.art'],
        keywords: ['bass', 'Penny Siopis'],
        field1: 'field1'
      };

      var criteria1 = {
        $or: [
          {
            regions: {
              $in: ['North', 'South', 'East', 'West']
            }
          },
          {
            towns: {
              $in: ['North.Cape Town', 'South.East London']
            }
          },
          {
            categories: {
              $in: ['Action', 'History']
            }
          }
        ],
        keywords: {
          $in: ['bass', 'Penny Siopis']
        }
      };

      var options1 = {
        fields: {
          data: 1
        },
        sort: {
          field1: 1
        },
        limit: 1
      };

      var criteria2 = null;

      var options2 = {
        fields: null,
        sort: {
          field1: 1
        },
        limit: 2
      };

      socketClient.set(
        '/e2e_test1/testsubscribe/data/complex/' + test_path_end,
        complex_obj,
        null,
        function(e) {
          expect(e == null).to.be(true);
          socketClient.set(
            '/e2e_test1/testsubscribe/data/complex/' + test_path_end + '/1',
            complex_obj,
            null,
            function(e) {
              expect(e == null).to.be(true);
              socketClient.get(
                '/e2e_test1/testsubscribe/data/complex*',
                {
                  criteria: criteria1,
                  options: options1
                },
                function(e, search_result) {
                  expect(e == null).to.be(true);
                  expect(search_result.length === 1).to.be(true);
                  socketClient.get(
                    '/e2e_test1/testsubscribe/data/complex*',
                    {
                      criteria: criteria2,
                      options: options2
                    },
                    function(e, search_result) {
                      expect(e == null).to.be(true);
                      expect(search_result.length === 2).to.be(true);
                      callback(e);
                    }
                  );
                }
              );
            }
          );
        }
      );
    });

    it('should delete some test data', function(callback) {
      this.timeout(default_timeout);

      try {
        //We put the data we want to delete into the database
        socketClient.set(
          '/e2e_test1/testsubscribe/data/delete_me',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {
            noPublish: true
          },
          function() {
            //We perform the actual delete
            socketClient.remove(
              '/e2e_test1/testsubscribe/data/delete_me',
              {
                noPublish: true
              },
              function(e, result) {
                expect(e).to.be(null);
                expect(result._meta.status).to.be('ok');
                callback();
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the publisher should set new data then update the data', function(callback) {
      this.timeout(default_timeout);

      try {
        var test_path_end = require('shortid').generate();

        socketClient.set(
          'e2e_test1/testsubscribe/data/' + test_path_end,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {
            noPublish: true
          },
          function(e, insertResult) {
            expect(e).to.be(null);

            socketClient.set(
              'e2e_test1/testsubscribe/data/' + test_path_end,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3',
                property4: 'property4'
              },
              {
                noPublish: true
              },
              function(e, updateResult) {
                expect(e).to.be(null);
                expect(updateResult._id === insertResult._id).to.be(true);
                callback();
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    //We are testing setting data at a specific path

    it('the publisher should set new data ', function(callback) {
      this.timeout(default_timeout);

      try {
        var test_path_end = require('shortid').generate();

        socketClient.set(
          'e2e_test1/testsubscribe/data/' + test_path_end,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            if (!e) {
              socketClient.get('e2e_test1/testsubscribe/data/' + test_path_end, null, function(
                e,
                results
              ) {
                expect(results.property1 === 'property1').to.be(true);
                callback(e);
              });
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the publisher should set new data then update the data', function(callback) {
      this.timeout(default_timeout);

      try {
        var test_path_end = require('shortid').generate();

        socketClient.set(
          'e2e_test1/testsubscribe/data/' + test_path_end,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e, insertResult) {
            expect(e == null).to.be(true);

            socketClient.set(
              'e2e_test1/testsubscribe/data/' + test_path_end,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3',
                property4: 'property4'
              },
              null,
              function(e, updateResult) {
                expect(e == null).to.be(true);
                expect(updateResult._id === insertResult._id).to.be(true);
                callback();
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    //We are testing pushing a specific value to a path which will actually become an array in the database

    it('the publisher should push a sibling and get all siblings', function(callback) {
      this.timeout(default_timeout);

      try {
        var test_path_end = require('shortid').generate();

        socketClient.setSibling(
          'e2e_test1/siblings/' + test_path_end,
          {
            property1: 'sib_post_property1',
            property2: 'sib_post_property2'
          },
          function(e) {
            expect(e == null).to.be(true);

            socketClient.setSibling(
              'e2e_test1/siblings/' + test_path_end,
              {
                property1: 'sib_post_property1',
                property2: 'sib_post_property2'
              },
              function(e) {
                expect(e == null).to.be(true);

                //the child method returns a child in the collection with a specified id
                socketClient.get('e2e_test1/siblings/' + test_path_end + '/*', null, function(
                  e,
                  getresults
                ) {
                  expect(e == null).to.be(true);
                  expect(getresults.length === 2).to.be(true);
                  callback(e);
                });
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    //  We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

    it('the listener should pick up a single published event', function(callback) {
      this.timeout(default_timeout);

      try {
        //first listen for the change
        eventEmitterClient.on(
          '/e2e_test1/testsubscribe/data/event',
          {
            event_type: 'set',
            count: 1
          },
          function() {
            expect(
              eventEmitterClient.state.events['/SET@/e2e_test1/testsubscribe/data/event']
            ).to.be(undefined);
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                eventEmitterClient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
              ).to.be(1);
              //then make the change
              socketClient.set(
                '/e2e_test1/testsubscribe/data/event',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function() {
                  //do nothing
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('should get using a wildcard', function(callback) {
      var test_path_end = require('shortid').generate();

      socketClient.set(
        'e2e_test1/testwildcard/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          expect(e == null).to.be(true);
          socketClient.set(
            'e2e_test1/testwildcard/' + test_path_end + '/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function(e) {
              expect(e == null).to.be(true);

              socketClient.get('e2e_test1/testwildcard/' + test_path_end + '*', null, function(
                e,
                results
              ) {
                expect(results.length === 2).to.be(true);

                socketClient.getPaths('e2e_test1/testwildcard/' + test_path_end + '*', function(
                  e,
                  results
                ) {
                  expect(results.length === 2).to.be(true);
                  callback(e);
                });
              });
            }
          );
        }
      );
    });

    it('the listener should pick up a single delete event', function(callback) {
      this.timeout(default_timeout);

      try {
        //We put the data we want to delete into the database
        socketClient.set(
          '/e2e_test1/testsubscribe/data/delete_me',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function() {
            //path, event_type, count, handler, done
            //We listen for the DELETE event
            eventEmitterClient.on(
              '/e2e_test1/testsubscribe/data/delete_me',
              {
                event_type: 'remove',
                count: 1
              },
              function(eventData) {
                //we are looking at the event internals on the listener to ensure our event management is working - because we are only listening for 1
                //instance of this event - the event listener should have been removed
                expect(
                  eventEmitterClient.state.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me']
                ).to.be(undefined);
                //we needed to have removed a single item
                expect(eventData.removed).to.be(1);
                callback();
              },
              function(e) {
                if (!e) {
                  expect(
                    eventEmitterClient.state.events[
                      '/REMOVE@/e2e_test1/testsubscribe/data/delete_me'
                    ].length
                  ).to.be(1);
                  //We perform the actual delete
                  socketClient.remove('/e2e_test1/testsubscribe/data/delete_me', null, function() {
                    //do nothing
                  });
                } else callback(e);
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('should unsubscribe from an event', function(callback) {
      var currentListenerId;

      eventEmitterClient.on(
        '/e2e_test1/testsubscribe/data/on_off_test',
        {
          event_type: 'set',
          count: 0
        },
        function() {
          //we detach all listeners from the path here
          eventEmitterClient.offPath('/e2e_test1/testsubscribe/data/on_off_test', function(e) {
            if (e) return callback(new Error(e));

            eventEmitterClient.on(
              '/e2e_test1/testsubscribe/data/on_off_test',
              {
                event_type: 'set',
                count: 0
              },
              function() {
                eventEmitterClient.off(currentListenerId, function(e) {
                  if (e) return callback(new Error(e));
                  else return callback();
                });
              },
              function(e, listenerId) {
                if (e) return callback(new Error(e));

                currentListenerId = listenerId;

                socketClient.set(
                  '/e2e_test1/testsubscribe/data/on_off_test',
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  {},
                  function(e) {
                    if (e) return callback(new Error(e));
                  }
                );
              }
            );
          });
        },
        function(e, listenerId) {
          if (e) return callback(new Error(e));

          currentListenerId = listenerId;

          socketClient.set(
            '/e2e_test1/testsubscribe/data/on_off_test',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            {},
            function(e) {
              if (e) return callback(new Error(e));
            }
          );
        }
      );
    });

    var caughtCount = 0;
    it('should subscribe to the catch all notification', function(callback) {
      this.timeout(10000);

      eventEmitterClient.onAll(
        function(eventData, meta) {
          if (
            meta.action === '/REMOVE@/e2e_test1/testsubscribe/data/catch_all' ||
            meta.action === '/SET@/e2e_test1/testsubscribe/data/catch_all'
          )
            caughtCount++;

          if (caughtCount === 2) callback();
        },
        function(e) {
          if (e) return callback(e);

          socketClient.set(
            '/e2e_test1/testsubscribe/data/catch_all',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function() {
              socketClient.remove('/e2e_test1/testsubscribe/data/catch_all', null, function() {
                //do nothing
              });
            }
          );
        }
      );
    });

    it('should unsubscribe from all events', function(callback) {
      this.timeout(10000);

      var onHappened = false;

      eventEmitterClient.onAll(
        function() {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function(e) {
          if (e) return callback(e);

          eventEmitterClient.on(
            '/e2e_test1/testsubscribe/data/off_all_test',
            {
              event_type: 'set',
              count: 0
            },
            function() {
              onHappened = true;
              callback(new Error('this wasnt meant to happen'));
            },
            function(e) {
              if (e) return callback(e);

              eventEmitterClient.offAll(function(e) {
                if (e) return callback(e);

                socketClient.set(
                  '/e2e_test1/testsubscribe/data/off_all_test',
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  null,
                  function(e) {
                    if (e) return callback(e);

                    setTimeout(function() {
                      if (!onHappened) callback();
                    }, 3000);
                  }
                );
              });
            }
          );
        }
      );
    });
  }
);
