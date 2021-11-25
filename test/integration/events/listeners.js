require('../../__fixtures/utils/test_helper').describe(__filename, 120000, function(test) {
  let happnInstance = null;
  let publisherclient;
  let listenerclient;

  ['websockets', 'eventemitter'].forEach(clientType => {
    context(`client type: ${clientType}`, () => {
      before('should initialize the service', async () => {
        happnInstance = await test.createInstance();
        if (clientType === 'eventemitter') {
          publisherclient = await test.createAdminSession(happnInstance);
          listenerclient = await test.createAdminSession(happnInstance);
        } else {
          publisherclient = await test.createAdminWSSession(happnInstance);
          listenerclient = await test.createAdminWSSession(happnInstance);
        }
      });

      after(async () => {
        await publisherclient.disconnect();
        await listenerclient.disconnect();
        await test.destroyInstance(happnInstance);
      });

      it('the listener should pick up a single wildcard event', function(callback) {
        try {
          //first listen for the change
          listenerclient.on(
            '/e2e_test1/testsubscribe/data/event/*',
            {
              event_type: 'set',
              count: 1
            },
            function() {
              test
                .expect(listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event/*'])
                .to.be(undefined);
              callback();
            },
            function(e) {
              if (!e) {
                test
                  .expect(
                    listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event/*'].length
                  )
                  .to.be(1);

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
        try {
          //first listen for the change
          listenerclient.on(
            '/e2e_test1/testsubscribe/data/event',
            {
              event_type: 'set',
              count: 1
            },
            function() {
              test
                .expect(listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event'])
                .to.be(undefined);
              callback();
            },
            function(e) {
              if (!e) {
                test
                  .expect(
                    listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
                  )
                  .to.be(1);
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
        try {
          listenerclient.on(
            '/e2e_test1/testsubscribe/data/event',
            {
              event_type: 'set',
              count: 1
            },
            function(/*message*/) {
              test
                .expect(listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event'])
                .to.be(undefined);
              callback();
            },
            function(e) {
              if (!e) {
                test
                  .expect(
                    listenerclient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
                  )
                  .to.be(1);
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
                  test
                    .expect(
                      listenerclient.state.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me']
                    )
                    .to.be(undefined);
                  //we needed to have removed a single item
                  test.expect(eventData.removed).to.be(1);
                  callback();
                },
                function(e) {
                  if (!e) {
                    test
                      .expect(
                        listenerclient.state.events[
                          '/REMOVE@/e2e_test1/testsubscribe/data/delete_me'
                        ].length
                      )
                      .to.be(1);
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
                test.expect(message.updated).to.be(true);
                callback();
              },
              function(e, reference, response) {
                if (e) return callback(e);
                try {
                  test.expect(response.length).to.be(1);
                  test.expect(response[0].test).to.be('data');

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

      it('should subscribe and get initial values on the callback', async () => {
        await listenerclient.set('/e2e_test1/testsubscribe/data/values_on_callback_test/1', {
          test: 'data'
        });

        await listenerclient.set('/e2e_test1/testsubscribe/data/values_on_callback_test/2', {
          test: 'data1'
        });

        let onResponse = await new Promise((resolve, reject) => {
          listenerclient.on(
            '/e2e_test1/testsubscribe/data/values_on_callback_test/*',
            {
              event_type: 'set',
              initialCallback: true
            },
            function() {
              //do nothing
            },
            function(e, _reference, response) {
              if (e) return reject(e);
              resolve(response);
            }
          );
        });

        test.expect(onResponse.length).to.be(2);
        test.expect(onResponse[0].test).to.be('data');
        test.expect(onResponse[1].test).to.be('data1');
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

      it('should subscribe to the catch all notification', function(callback) {
        var caughtCount = 0;

        listenerclient.onAll(
          function(eventData, meta) {
            if (
              meta.action === '/REMOVE@/e2e_test1/testsubscribe/data/catch_all' ||
              meta.action === '/SET@/e2e_test1/testsubscribe/data/catch_all'
            )
              caughtCount++;

            if (caughtCount === 2) {
              listenerclient.offAll(callback);
            }
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

      it('should unsubscribe from all events', async () => {
        const onAllHandler = test.sinon.stub();
        const onHandler = test.sinon.stub();

        await listenerclient.onAll(onAllHandler);
        await listenerclient.on(
          '/e2e_test1/testsubscribe/data/off_all_test',
          {
            event_type: 'set',
            count: 0
          },
          onHandler
        );

        await publisherclient.set('/e2e_test1/testsubscribe/data/off_all_test', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        await listenerclient.offAll();

        await publisherclient.set('/e2e_test1/testsubscribe/data/off_all_test', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        test.expect(onAllHandler.callCount).to.be(1);
        test.expect(onHandler.callCount).to.be(1);
      });

      it('should unsubscribe from all events. negative test', async () => {
        const onAllHandler = test.sinon.stub();
        const onHandler = test.sinon.stub();

        await listenerclient.onAll(onAllHandler);
        await listenerclient.on(
          '/e2e_test1/testsubscribe/data/off_all_test_negative',
          {
            event_type: 'set',
            count: 0
          },
          onHandler
        );

        await publisherclient.set('/e2e_test1/testsubscribe/data/off_all_test_negative', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        await publisherclient.set('/e2e_test1/testsubscribe/data/off_all_test_negative', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        });

        test.expect(onAllHandler.callCount).to.be(2);
        test.expect(onHandler.callCount).to.be(2);
      });
    });
  });
});
