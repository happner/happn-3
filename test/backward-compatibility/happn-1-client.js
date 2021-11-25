require('../../__fixtures/utils/test_helper').describe(__filename, 120000, function(test) {
  var happn = require('../../lib/index');
  var old_happn = require('happn');
  var service = happn.service;
  var happn_client = old_happn.client;
  const test_id = Date.now() + '_' + require('shortid').generate();
  var happnInstance = null;
  this.timeout(5000);

  before('should initialize the service', function(callback) {
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
        //eslint-disable-next-line no-console
        if (e) console.warn('failed disconnecting publisher client');
        listenerclient.disconnect(
          {
            timeout: 2000
          },
          function(e) {
            //eslint-disable-next-line no-console
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
        '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/*',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          test
            .expect(
              listenerclient.events[
                '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/*'
              ]
            )
            .to.be(undefined);
          callback();
        },
        function(e) {
          if (!e) {
            test
              .expect(
                listenerclient.events[
                  '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/*'
                ].length
              )
              .to.be(1);

            //then make the change
            publisherclient.set(
              '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event/blah',
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
    } catch (e) {
      callback(e);
    }
  });

  //	We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('the listener should pick up a single published event', function(callback) {
    try {
      //first listen for the change
      listenerclient.on(
        '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          test
            .expect(
              listenerclient.events[
                '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'
              ]
            )
            .to.be(undefined);
          callback();
        },
        function(e) {
          if (!e) {
            test
              .expect(
                listenerclient.events[
                  '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'
                ].length
              )
              .to.be(1);

            //then make the change
            publisherclient.set(
              '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event',
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              null,
              function() {}
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
        '2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          if (!e) {
            publisherclient.get(
              '2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
              null,
              function(e, results) {
                test.expect(results.property1 === 'property1').to.be(true);
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
        '2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e, insertResult) {
          test.expect(e == null).to.be(true);

          publisherclient.set(
            '2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/' + test_path_end,
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3',
              property4: 'property4'
            },
            null,
            function(e, updateResult) {
              test.expect(e == null).to.be(true);
              test.expect(updateResult._meta._id === insertResult._meta._id).to.be(true);
              callback();
            }
          );
        }
      );
    } catch (e) {
      callback(e);
    }
  });

  it('the listener should pick up a single published event', function(callback) {
    try {
      //first listen for the change
      listenerclient.on(
        '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          test
            .expect(
              listenerclient.events[
                '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'
              ]
            )
            .to.be(undefined);
          callback();
        },
        function(e) {
          if (!e) {
            test
              .expect(
                listenerclient.events[
                  '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event'
                ].length
              )
              .to.be(1);
            //then make the change
            publisherclient.set(
              '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/event',
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              null,
              function() {}
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
      '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function() {
        listenerclient.on(
          '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me',
          {
            event_type: 'remove',
            count: 1
          },
          function(eventData) {
            test
              .expect(
                listenerclient.events[
                  '/REMOVE@/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/delete_me'
                ]
              )
              .to.be(undefined);
            test.expect(eventData.payload.removed).to.be(1);
            callback();
          },
          function(e) {
            if (!e) return callback(e);

            test
              .expect(
                listenerclient.events[
                  '/REMOVE@/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/data/delete_me'
                ].length
              )
              .to.be(1);

            //We perform the actual delete
            publisherclient.remove(
              '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/delete_me',
              null,
              function() {}
            );
          }
        );
      }
    );
  });

  it('the listener should pick up wildcard remove events', function(callback) {
    //We put the data we want to delete into the database
    publisherclient.set(
      '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/wildcard_delete_me/1',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function() {
        publisherclient.set(
          '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/wildcard_delete_me/2',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function() {
            listenerclient.on(
              '/2_websockets_embedded_sanity/' +
                test_id +
                '/testsubscribe/data/wildcard_delete_me/*',
              {
                event_type: 'remove',
                count: 1
              },
              function(eventData) {
                test
                  .expect(
                    listenerclient.events[
                      '/REMOVE@/2_websockets_embedded_sanity/' +
                        test_id +
                        '/testsubscribe/data/wildcard_delete_me/*'
                    ]
                  )
                  .to.be(undefined);
                test.expect(eventData.payload.removed).to.be(2);

                callback();
              },
              function(e) {
                if (!e) return callback(e);

                test
                  .expect(
                    listenerclient.events[
                      '/REMOVE@/2_websockets_embedded_sanity/' +
                        test_id +
                        '/testsubscribe/data/wildcard_delete_me/*'
                    ].length
                  )
                  .to.be(1);

                //We perform the actual delete
                publisherclient.remove(
                  '/2_websockets_embedded_sanity/' +
                    test_id +
                    '/testsubscribe/*/wildcard_delete_me/*',
                  null,
                  function() {}
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
      '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
      {
        event_type: 'set',
        count: 0
      },
      function() {
        listenerclient.offPath(
          '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
          function(e) {
            if (e) return callback(new Error(e));

            listenerclient.on(
              '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
              {
                event_type: 'set',
                count: 0
              },
              function() {
                listenerclient.off(currentListenerId, function(e) {
                  if (e) return callback(new Error(e));
                  else return callback();
                });
              },
              function(e, listenerId) {
                if (e) return callback(new Error(e));
                currentListenerId = listenerId;
                publisherclient.set(
                  '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
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
          }
        );
      },
      function(e, listenerId) {
        if (e) return callback(new Error(e));

        currentListenerId = listenerId;

        publisherclient.set(
          '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_test',
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

  it('should unsubscribe from a specific event', function(done) {
    this.timeout(10000);

    var emitted = {};

    var reference1;
    var reference2;

    var path =
      '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/on_off_specific_test';

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
              .then(function() {
                return listenerclient.set(path, { test: 'data2' });
              })
              .then(function() {
                return listenerclient.off(reference2);
              })
              .then(function() {
                return listenerclient.set(path, { test: 'data3' });
              })
              .then(function() {
                setTimeout(function() {
                  test.expect(emitted[reference1].length).to.be(3);
                  test.expect(emitted[reference2].length).to.be(2);
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
    this.timeout(10000);
    var caughtCount = 0;

    listenerclient.onAll(
      function(eventData, meta) {
        if (
          meta.action ===
            '/REMOVE@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all' ||
          meta.action ===
            '/SET@/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all'
        )
          caughtCount++;

        if (caughtCount === 2) callback();
      },
      function(e) {
        if (e) return callback(e);

        publisherclient.set(
          '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function() {
            publisherclient.remove(
              '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/catch_all',
              null,
              function() {}
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
      function() {
        onHappened = true;
        callback(new Error('this wasnt meant to happen'));
      },
      function(e) {
        if (e) return callback(e);

        listenerclient.on(
          '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/off_all_test',
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

            listenerclient.offAll(function(e) {
              if (e) return callback(e);

              publisherclient.set(
                '/2_websockets_embedded_sanity/' + test_id + '/testsubscribe/data/off_all_test',
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
    publisherclient.remove('/test_event_order', function() {
      publisherclient.log.info('Done removing');
      setTimeout(function() {
        publisherclient.get('/test_event_order', null, function(e, result) {
          test.expect(result).to.be(null);
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
      function() {
        hits++;
      },
      function(e) {
        if (e) return callback(e);

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/1', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/count/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        setTimeout(function() {
          if (hits !== 3) return callback(new Error('hits were over the agreed on 2'));
          callback();
        }, 1500);
      }
    );
  });

  it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts (2)', function(callback) {
    var hits = 0;
    //first listen for the change
    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/count/2/*',
      {
        event_type: 'set',
        count: 2
      },
      function() {
        hits++;
      },
      function(e) {
        if (e) return callback(e);

        test.async.timesSeries(
          10,
          (time, cb) => {
            let path = '/1_eventemitter_embedded_sanity/' + test_id + `/count/2/${time}`;
            test.log(`setting path: ${path}`);
            publisherclient.set(
              '/1_eventemitter_embedded_sanity/' + test_id + `/count/2/${time}`,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              e => {
                if (e) return cb(e);
                setTimeout(cb, 100);
              }
            );
          },
          e => {
            if (e) return callback(e);
            if (hits !== 2) return callback(new Error('hits should be 2'));
            callback();
          }
        );
      }
    );
  });

  it('subscribes with a count - we ensure the event only gets kicked off for the correct amounts (3)', function(callback) {
    var hits = 0;
    //first listen for the change
    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/count/3/*',
      {
        event_type: 'set',
        count: 3
      },
      function() {
        hits++;
      },
      function(e) {
        if (e) return callback(e);

        test.async.timesSeries(
          10,
          (time, cb) => {
            let path = '/1_eventemitter_embedded_sanity/' + test_id + `/count/2/${time}`;
            test.log(`setting path: ${path}`);
            publisherclient.set(
              '/1_eventemitter_embedded_sanity/' + test_id + `/count/3/${time}`,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              e => {
                if (e) return cb(e);
                setTimeout(cb, 100);
              }
            );
          },
          e => {
            if (e) return callback(e);
            if (hits !== 3) return callback(new Error('hits should be 3'));
            callback();
          }
        );
      }
    );
  });

  it('subscribe, then does an off with a bad handle', function(done) {
    var currentEventId;
    //first listen for the change
    listenerclient.on(
      '/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/*',
      {
        event_type: 'set'
      },
      function() {},
      function(e, eventId) {
        if (e) return done(e);

        currentEventId = eventId;

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/1', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        publisherclient.set('/1_eventemitter_embedded_sanity/' + test_id + '/off-handle/2/2', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        setTimeout(function() {
          publisherclient.off(null, function(e) {
            test.expect(e.toString()).to.be('Error: handle or callback cannot be null');
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
                test.expect(message.updated).to.be(true);
                callback();
              },
              function(e, reference, response) {
                if (e) return callback(e);
                try {
                  test.expect(response.length).to.be(2);
                  test.expect(response[0].test).to.be('data');
                  test.expect(response[1].test).to.be('data1');

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
              function(message) {
                caughtEmitted++;

                if (caughtEmitted === 2) {
                  test.expect(message.test).to.be('data1');
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
});
