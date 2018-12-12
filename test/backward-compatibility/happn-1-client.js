describe(
  require('../__fixtures/utils/test_helper')
    .create()
    .testName(__filename),
  function() {
    var expect = require('expect.js');
    var happn = require('../../lib/index');
    var old_happn = require('happn');
    var service = happn.service;
    var happn_client = old_happn.client;
    var async = require('async');

    var happnInstance = null;

    this.timeout(5000);

    before('should initialize the service', function(callback) {
      test_id = Date.now() + '_' + require('shortid').generate();

      try {
        service.create(function(e, happnInst) {
          if (e) return callback(e);

          happnInstance = happnInst;
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    after(function(done) {
      this.timeout(20000);

      publisherclient.disconnect(
        {
          timeout: 2000
        },
        function(e) {
          if (e) console.warn('failed disconnecting publisher client');
          listenerclient.disconnect(
            {
              timeout: 2000
            },
            function(e) {
              if (e) console.warn('failed disconnecting listener client');
              happnInstance.stop(done);
            }
          );
        }
      );
    });

    var publisherclient;
    var listenerclient;
    var disconnectclient;

    before('should initialize the clients', function(callback) {
      try {
        happn_client.create(function(e, instance) {
          if (e) return callback(e);
          publisherclient = instance;

          happn_client.create(function(e, instance) {
            if (e) return callback(e);
            listenerclient = instance;

            happn_client.create(function(e, instance) {
              if (e) return callback(e);
              disconnectclient = instance;
              callback();
            });
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('should disconnect the disconnect client', function(callback) {
      disconnectclient.disconnect().then(callback);
    });

    it('the listener should pick up a single wildcard event', function(callback) {
      try {
        //first listen for the change
        listenerclient.on(
          '/2_websockets_embedded_sanity/' +
            test_id +
            '/testsubscribe/data/event/*',
          {
            event_type: 'set',
            count: 1
          },
          function(message) {
            expect(
              listenerclient.events[
                '/SET@/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/event/*'
              ].length
            ).to.be(0);
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                listenerclient.events[
                  '/SET@/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/event/*'
                ].length
              ).to.be(1);

              //then make the change
              publisherclient.set(
                '/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/event/blah',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(e, result) {
                  if (e) return callback(e);
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    //	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

    it('the listener should pick up a single published event', function(callback) {
      try {
        //first listen for the change
        listenerclient.on(
          '/2_websockets_embedded_sanity/' +
            test_id +
            '/testsubscribe/data/event',
          {
            event_type: 'set',
            count: 1
          },
          function(message) {
            expect(
              listenerclient.events[
                '/SET@/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/event'
              ].length
            ).to.be(0);
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                listenerclient.events[
                  '/SET@/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/event'
                ].length
              ).to.be(1);

              //then make the change
              publisherclient.set(
                '/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/event',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(e, result) {
                  ////////////////////////////console.log('put happened - listening for result');
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    //We are testing setting data at a specific path

    it('the publisher should set new data ', function(callback) {
      try {
        var test_path_end = require('shortid').generate();

        publisherclient.set(
          '2_websockets_embedded_sanity/' +
            test_id +
            '/testsubscribe/data/' +
            test_path_end,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e, result) {
            if (!e) {
              publisherclient.get(
                '2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/' +
                  test_path_end,
                null,
                function(e, results) {
                  expect(results.property1 == 'property1').to.be(true);
                  callback(e);
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the publisher should set new data then update the data', function(callback) {
      try {
        var test_path_end = require('shortid').generate();

        publisherclient.set(
          '2_websockets_embedded_sanity/' +
            test_id +
            '/testsubscribe/data/' +
            test_path_end,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e, insertResult) {
            expect(e == null).to.be(true);

            publisherclient.set(
              '2_websockets_embedded_sanity/' +
                test_id +
                '/testsubscribe/data/' +
                test_path_end,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3',
                property4: 'property4'
              },
              null,
              function(e, updateResult) {
                expect(e == null).to.be(true);
                expect(updateResult._meta._id == insertResult._meta._id).to.be(
                  true
                );
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
      try {
        var test_path_end = require('shortid').generate();

        publisherclient.setSibling(
          '2_websockets_embedded_sanity/' +
            test_id +
            '/siblings/' +
            test_path_end,
          {
            property1: 'sib_post_property1',
            property2: 'sib_post_property2'
          },
          function(e, results) {
            expect(e == null).to.be(true);

            publisherclient.setSibling(
              '2_websockets_embedded_sanity/' +
                test_id +
                '/siblings/' +
                test_path_end,
              {
                property1: 'sib_post_property1',
                property2: 'sib_post_property2'
              },
              function(e, results) {
                expect(e == null).to.be(true);

                //the child method returns a child in the collection with a specified id
                publisherclient.get(
                  '2_websockets_embedded_sanity/' +
                    test_id +
                    '/siblings/' +
                    test_path_end +
                    '/*',
                  null,
                  function(e, getresults) {
                    expect(e == null).to.be(true);
                    expect(getresults.length == 2).to.be(true);
                    callback(e);
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

    //	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

    it('the listener should pick up a single published event', function(callback) {
      try {
        //first listen for the change
        listenerclient.on(
          '/2_websockets_embedded_sanity/' +
            test_id +
            '/testsubscribe/data/event',
          {
            event_type: 'set',
            count: 1
          },
          function(message) {
            expect(
              listenerclient.events[
                '/SET@/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/event'
              ].length
            ).to.be(0);
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                listenerclient.events[
                  '/SET@/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/event'
                ].length
              ).to.be(1);

              ////////////////////////////console.log('on subscribed, about to publish');

              //then make the change
              publisherclient.set(
                '/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/event',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(e, result) {
                  ////////////////////////////console.log('put happened - listening for result');
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the listener should pick up a single delete event', function(callback) {
      //We put the data we want to delete into the database
      publisherclient.set(
        '/2_websockets_embedded_sanity/' +
          test_id +
          '/testsubscribe/data/delete_me',
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e, result) {
          //////////////////console.log('did delete set');
          //path, event_type, count, handler, done
          //We listen for the DELETE event
          listenerclient.on(
            '/2_websockets_embedded_sanity/' +
              test_id +
              '/testsubscribe/data/delete_me',
            {
              event_type: 'remove',
              count: 1
            },
            function(eventData) {
              ////console.log('on count 1 delete ');
              //////////////////console.log(message);

              //we are looking at the event internals on the listener to ensure our event management is working - because we are only listening for 1
              //instance of this event - the event listener should have been removed
              ////console.log('listenerclient.events');
              ////console.log(listenerclient.events);
              expect(
                listenerclient.events[
                  '/REMOVE@/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/delete_me'
                ].length
              ).to.be(0);

              ////console.log(eventData);

              //we needed to have removed a single item
              expect(eventData.payload.removed).to.be(1);

              ////////////////////////////console.log(message);

              callback();
            },
            function(e) {
              if (!e) return callback(e);

              expect(
                listenerclient.events[
                  '/REMOVE@/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/delete_me'
                ].length
              ).to.be(1);

              //We perform the actual delete
              publisherclient.remove(
                '/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/delete_me',
                null,
                function(e, result) {}
              );
            }
          );
        }
      );
    });

    it('the listener should pick up wildcard remove events', function(callback) {
      //We put the data we want to delete into the database
      publisherclient.set(
        '/2_websockets_embedded_sanity/' +
          test_id +
          '/testsubscribe/data/wildcard_delete_me/1',
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e, result) {
          publisherclient.set(
            '/2_websockets_embedded_sanity/' +
              test_id +
              '/testsubscribe/data/wildcard_delete_me/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function(e, result) {
              listenerclient.on(
                '/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/wildcard_delete_me/*',
                {
                  event_type: 'remove',
                  count: 1
                },
                function(eventData) {
                  expect(
                    listenerclient.events[
                      '/REMOVE@/2_websockets_embedded_sanity/' +
                        test_id +
                        '/testsubscribe/data/wildcard_delete_me/*'
                    ].length
                  ).to.be(0);
                  expect(eventData.payload.removed).to.be(2);

                  callback();
                },
                function(e) {
                  if (!e) return callback(e);

                  expect(
                    listenerclient.events[
                      '/REMOVE@/2_websockets_embedded_sanity/' +
                        test_id +
                        '/testsubscribe/data/wildcard_delete_me/*'
                    ].length
                  ).to.be(1);

                  //We perform the actual delete
                  publisherclient.remove(
                    '/2_websockets_embedded_sanity/' +
                      test_id +
                      '/testsubscribe/*/wildcard_delete_me/*',
                    null,
                    function(e, result) {}
                  );
                }
              );
            }
          );
        }
      );
    });

    it('should unsubscribe from an event', function(callback) {
      var currentListenerId;

      listenerclient.on(
        '/2_websockets_embedded_sanity/' +
          test_id +
          '/testsubscribe/data/on_off_test',
        {
          event_type: 'set',
          count: 0
        },
        function(message) {
          //we detach all listeners from the path here
          ////console.log('ABOUT OFF PATH');
          listenerclient.offPath(
            '/2_websockets_embedded_sanity/' +
              test_id +
              '/testsubscribe/data/on_off_test',
            function(e) {
              if (e) return callback(new Error(e));

              listenerclient.on(
                '/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/on_off_test',
                {
                  event_type: 'set',
                  count: 0
                },
                function(message) {
                  ////console.log('ON RAN');
                  ////console.log(message);

                  listenerclient.off(currentListenerId, function(e) {
                    if (e) return callback(new Error(e));
                    else return callback();
                  });
                },
                function(e, listenerId) {
                  if (e) return callback(new Error(e));

                  currentListenerId = listenerId;

                  publisherclient.set(
                    '/2_websockets_embedded_sanity/' +
                      test_id +
                      '/testsubscribe/data/on_off_test',
                    {
                      property1: 'property1',
                      property2: 'property2',
                      property3: 'property3'
                    },
                    {},
                    function(e, setresult) {
                      if (e) return callback(new Error(e));

                      ////console.log('DID ON SET');
                      ////console.log(setresult);
                    }
                  );
                }
              );
            }
          );
        },
        function(e, listenerId) {
          if (e) return callback(new Error(e));

          currentListenerId = listenerId;

          publisherclient.set(
            '/2_websockets_embedded_sanity/' +
              test_id +
              '/testsubscribe/data/on_off_test',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            {},
            function(e, setresult) {
              if (e) return callback(new Error(e));
            }
          );
        }
      );
    });

    it('should unsubscribe from a specific event', function(done) {
      this.timeout(10000);

      var emitted = {};

      var reference1;
      var reference2;

      var response1;
      var response2;

      var path =
        '/2_websockets_embedded_sanity/' +
        test_id +
        '/testsubscribe/data/on_off_specific_test';

      listenerclient.on(
        path,
        {
          event_type: 'set',
          count: 0
        },
        function(message) {
          if (!emitted[reference1]) emitted[reference1] = [];
          emitted[reference1].push(message);
        },
        function(e, eventReference1) {
          reference1 = eventReference1;

          return listenerclient.on(
            path,
            {
              event_type: 'set',
              count: 0
            },
            function(message) {
              if (!emitted[reference2]) emitted[reference2] = [];
              emitted[reference2].push(message);
            },
            function(e, eventReference2) {
              reference2 = eventReference2;

              listenerclient
                .set(path, { test: 'data1' })
                .then(function(response) {
                  response1 = response;
                  return listenerclient.set(path, { test: 'data2' });
                })
                .then(function(response) {
                  response2 = response;
                  return listenerclient.off(reference2);
                })
                .then(function() {
                  return listenerclient.set(path, { test: 'data3' });
                })
                .then(function(result) {
                  setTimeout(function() {
                    expect(emitted[reference1].length).to.be(3);
                    expect(emitted[reference2].length).to.be(2);
                    done();
                  }, 2000);
                })
                .catch(done);
            }
          );
        }
      );
    });

    it('should subscribe to the catch all notification', function(callback) {
      var caught = {};

      this.timeout(10000);
      var caughtCount = 0;

      listenerclient.onAll(
        function(eventData, meta) {
          if (
            meta.action ==
              '/REMOVE@/2_websockets_embedded_sanity/' +
                test_id +
                '/testsubscribe/data/catch_all' ||
            meta.action ==
              '/SET@/2_websockets_embedded_sanity/' +
                test_id +
                '/testsubscribe/data/catch_all'
          )
            caughtCount++;

          if (caughtCount == 2) callback();
        },
        function(e) {
          if (e) return callback(e);

          publisherclient.set(
            '/2_websockets_embedded_sanity/' +
              test_id +
              '/testsubscribe/data/catch_all',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function(e, put_result) {
              publisherclient.remove(
                '/2_websockets_embedded_sanity/' +
                  test_id +
                  '/testsubscribe/data/catch_all',
                null,
                function(e, del_result) {}
              );
            }
          );
        }
      );
    });

    it('should unsubscribe from all events', function(callback) {
      this.timeout(10000);

      var onHappened = false;

      listenerclient.onAll(
        function(message) {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function(e) {
          if (e) return callback(e);

          listenerclient.on(
            '/2_websockets_embedded_sanity/' +
              test_id +
              '/testsubscribe/data/off_all_test',
            {
              event_type: 'set',
              count: 0
            },
            function(message) {
              onHappened = true;
              callback(new Error('this wasnt meant to happen'));
            },
            function(e) {
              if (e) return callback(e);

              listenerclient.offAll(function(e) {
                if (e) return callback(e);

                publisherclient.set(
                  '/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/off_all_test',
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  null,
                  function(e, put_result) {
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

    it('will do events in the order they are passed', function(done) {
      publisherclient.set(
        '/test_event_order',
        {
          property1: 'property1Value'
        },
        {},
        function() {
          publisherclient.log.info('Done setting');
        }
      );
      publisherclient.remove('/test_event_order', function(err) {
        publisherclient.log.info('Done removing');
        setTimeout(function() {
          publisherclient.get('/test_event_order', null, function(e, result) {
            expect(result).to.be(null);
            done();
          });
        }, 1000);
      });
    });

    it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts - negative test', function(callback) {
      var hits = 0;
      //first listen for the change
      listenerclient.on(
        '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/*',
        {
          event_type: 'set',
          count: 3
        },
        function(message) {
          hits++;
        },
        function(e) {
          if (e) return callback(e);

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          setTimeout(function() {
            if (hits != 3)
              return callback(new Error('hits were over the agreed on 2'));

            callback();
          }, 1500);
        }
      );
    });

    it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts', function(callback) {
      var hits = 0;
      //first listen for the change
      listenerclient.on(
        '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/*',
        {
          event_type: 'set',
          count: 2
        },
        function(message) {
          hits++;
        },
        function(e) {
          if (e) return callback(e);

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          setTimeout(function() {
            if (hits != 2)
              return callback(new Error('hits were over the agreed on 2'));

            callback();
          }, 1500);
        }
      );
    });

    it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts', function(callback) {
      var hits = 0;
      //first listen for the change
      listenerclient.on(
        '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/*',
        {
          event_type: 'set',
          count: 2
        },
        function(message) {
          hits++;
        },
        function(e) {
          if (e) return callback(e);

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          setTimeout(function() {
            if (hits != 2)
              return callback(new Error('hits were over the agreed on 2'));

            callback();
          }, 1500);
        }
      );
    });

    it('subscribe, then does an off with a bad handle', function(done) {
      var hits = 0;
      var currentEventId;
      //first listen for the change
      listenerclient.on(
        '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/*',
        {
          event_type: 'set'
        },
        function(message) {
          hits++;
        },
        function(e, eventId) {
          if (e) return callback(e);

          currentEventId = eventId;

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          publisherclient.set(
            '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            }
          );

          setTimeout(function() {
            publisherclient.off(null, function(e) {
              expect(e.toString()).to.be(
                'Error: handle or callback cannot be null'
              );
              publisherclient.off(currentEventId, done);
            });
          }, 1500);
        }
      );
    });

    it('should subscribe and get initial values on the callback', function(callback) {
      listenerclient.set(
        '/e2e_test1/testsubscribe/data/values_on_callback_test/1',
        {
          test: 'data'
        },
        function(e) {
          if (e) return callback(e);

          listenerclient.set(
            '/e2e_test1/testsubscribe/data/values_on_callback_test/2',
            {
              test: 'data1'
            },
            function(e) {
              if (e) return callback(e);

              listenerclient.on(
                '/e2e_test1/testsubscribe/data/values_on_callback_test/*',
                {
                  event_type: 'set',
                  initialCallback: true
                },
                function(message) {
                  expect(message.updated).to.be(true);
                  callback();
                },
                function(e, reference, response) {
                  if (e) return callback(e);
                  try {
                    expect(response.length).to.be(2);
                    expect(response[0].test).to.be('data');
                    expect(response[1].test).to.be('data1');

                    listenerclient.set(
                      '/e2e_test1/testsubscribe/data/values_on_callback_test/1',
                      {
                        test: 'data',
                        updated: true
                      },
                      function(e) {
                        if (e) return callback(e);
                      }
                    );
                  } catch (err) {
                    return callback(err);
                  }
                }
              );
            }
          );
        }
      );
    });

    it('should subscribe and get initial values emitted immediately', function(callback) {
      var caughtEmitted = 0;

      listenerclient.set(
        '/e2e_test1/testsubscribe/data/values_emitted_test/1',
        {
          test: 'data'
        },
        function(e) {
          if (e) return callback(e);

          listenerclient.set(
            '/e2e_test1/testsubscribe/data/values_emitted_test/2',
            {
              test: 'data1'
            },
            function(e) {
              if (e) return callback(e);

              listenerclient.on(
                '/e2e_test1/testsubscribe/data/values_emitted_test/*',
                {
                  event_type: 'set',
                  initialEmit: true
                },
                function(message, meta) {
                  caughtEmitted++;

                  if (caughtEmitted == 2) {
                    expect(message.test).to.be('data1');
                    callback();
                  }
                },
                function(e) {
                  if (e) return callback(e);
                }
              );
            }
          );
        }
      );
    });
  }
);
