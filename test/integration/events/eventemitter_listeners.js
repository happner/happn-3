describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var default_timeout = 10000;
    var happnInstance = null;

    var publisherclient;
    var listenerclient;

    after(function(done) {
      this.timeout(10000);

      publisherclient
        .disconnect({
          timeout: 2000
        })
        .then(
          listenerclient.disconnect({
            timeout: 2000
          })
        )
        .then(happnInstance.stop())
        .then(done)
        .catch(done);
    });

    before('should initialize the service', function(callback) {
      this.timeout(20000);

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

    before('should initialize the clients', function(callback) {
      this.timeout(default_timeout);

      try {
        happnInstance.services.session.localClient(function(e, instance) {
          if (e) return callback(e);
          publisherclient = instance;

          happnInstance.services.session.localClient(function(e, instance) {
            if (e) return callback(e);
            listenerclient = instance;

            callback();
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('the listener should pick up a single wildcard event', function(callback) {
      this.timeout(default_timeout);

      try {
        //first listen for the change
        listenerclient.on(
          '/e2e_test1/testsubscribe/data/event/*',
          {
            event_type: 'set',
            count: 1
          },
          function() {
            expect(listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event/*']).to.be(
              undefined
            );
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event/*'].length
              ).to.be(1);

              //then make the change
              publisherclient.set(
                '/e2e_test1/testsubscribe/data/event/blah',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function() {
                  // do nothing
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the listener should pick up a single published event', function(callback) {
      this.timeout(default_timeout);

      try {
        //first listen for the change
        listenerclient.on(
          '/e2e_test1/testsubscribe/data/event',
          {
            event_type: 'set',
            count: 1
          },
          function() {
            expect(listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event']).to.be(
              undefined
            );
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
              ).to.be(1);
              publisherclient.set(
                '/e2e_test1/testsubscribe/data/event',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(/*e, result*/) {
                  // do nothing
                }
              );
            } else callback(e);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('the listener should pick up a single published event', function(callback) {
      this.timeout(default_timeout);

      try {
        listenerclient.on(
          '/e2e_test1/testsubscribe/data/event',
          {
            event_type: 'set',
            count: 1
          },
          function(/*message*/) {
            expect(listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event']).to.be(
              undefined
            );
            callback();
          },
          function(e) {
            if (!e) {
              expect(
                listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
              ).to.be(1);
              publisherclient.set(
                '/e2e_test1/testsubscribe/data/event',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(/*e, result*/) {
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

    it('the listener should pick up a single delete event', function(callback) {
      this.timeout(default_timeout);

      try {
        //We put the data we want to delete into the database
        publisherclient.set(
          '/e2e_test1/testsubscribe/data/delete_me',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(/*e, result*/) {
            listenerclient.on(
              '/e2e_test1/testsubscribe/data/delete_me',
              {
                event_type: 'remove',
                count: 1
              },
              function(eventData) {
                expect(
                  listenerclient.state.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me']
                ).to.be(undefined);
                //we needed to have removed a single item
                expect(eventData.removed).to.be(1);
                callback();
              },
              function(e) {
                if (!e) {
                  expect(
                    listenerclient.state.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me']
                      .length
                  ).to.be(1);
                  publisherclient.remove(
                    '/e2e_test1/testsubscribe/data/delete_me',
                    null,
                    function() /*
                    e,
                    result
                    */
                    {
                      //do nothing
                    }
                  );
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

      listenerclient.on(
        '/e2e_test1/testsubscribe/data/on_off_test',
        {
          event_type: 'set',
          count: 0
        },
        function(/*message*/) {
          listenerclient.offPath('/e2e_test1/testsubscribe/data/on_off_test', function(e) {
            if (e) return callback(new Error(e));

            listenerclient.on(
              '/e2e_test1/testsubscribe/data/on_off_test',
              {
                event_type: 'set',
                count: 0
              },
              function(/*message*/) {
                listenerclient.off(currentListenerId, function(e) {
                  if (e) return callback(new Error(e));
                  else return callback();
                });
              },
              function(e, listenerId) {
                if (e) return callback(new Error(e));

                currentListenerId = listenerId;

                publisherclient.set(
                  '/e2e_test1/testsubscribe/data/on_off_test',
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  {},
                  function(e /*, setresult*/) {
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
          publisherclient.set(
            '/e2e_test1/testsubscribe/data/on_off_test',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            {},
            function(e /*, setresult*/) {
              if (e) return callback(new Error(e));
            }
          );
        }
      );
    });

    it('should subscribe and get an initial value on the callback', function(callback) {
      listenerclient.set(
        '/e2e_test1/testsubscribe/data/value_on_callback_test',
        {
          test: 'data'
        },
        function(e) {
          if (e) return callback(e);

          listenerclient.on(
            '/e2e_test1/testsubscribe/data/value_on_callback_test',
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
                expect(response.length).to.be(1);
                expect(response[0].test).to.be('data');

                listenerclient.set(
                  '/e2e_test1/testsubscribe/data/value_on_callback_test',
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
                function(message /*, meta*/) {
                  caughtEmitted++;

                  if (caughtEmitted === 2) {
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

    it('should subscribe to the catch all notification', function(callback) {
      this.timeout(10000);
      var caughtCount = 0;

      listenerclient.onAll(
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

          publisherclient.set(
            '/e2e_test1/testsubscribe/data/catch_all',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function(/*e, put_result*/) {
              publisherclient.remove(
                '/e2e_test1/testsubscribe/data/catch_all',
                null,
                function() /*
                e,
                del_result
                */
                {}
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
        function(/*message*/) {
          onHappened = true;
          callback(new Error('this wasnt meant to happen'));
        },
        function(e) {
          if (e) return callback(e);

          listenerclient.on(
            '/e2e_test1/testsubscribe/data/off_all_test',
            {
              event_type: 'set',
              count: 0
            },
            function(/*message*/) {
              onHappened = true;
              callback(new Error('this wasnt meant to happen'));
            },
            function(e) {
              if (e) return callback(e);

              listenerclient.offAll(function(e) {
                if (e) return callback(e);

                publisherclient.set(
                  '/e2e_test1/testsubscribe/data/off_all_test',
                  {
                    property1: 'property1',
                    property2: 'property2',
                    property3: 'property3'
                  },
                  null,
                  function(e /*, put_result*/) {
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
