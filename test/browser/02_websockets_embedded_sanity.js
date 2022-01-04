describe('02_websockets_embedded_sanity', function() {
  var expect, happn_client;

  if (typeof window === 'undefined') {
    var chai = require('chai');
    var happn = require('../../lib/index');
    expect = chai.expect;
    happn_client = happn.client;
  } else {
    expect = window.expect;
    happn_client = window.HappnClient;
  }

  after(function(done) {
    if (socketClient) {
      socketClient.disconnect(done);
    } else done();
  });

  var socketClient;
  var default_timeout = 10000;

  beforeEach('should initialize the client', function(callback) {
    this.timeout(default_timeout);

    var createClient = function(e) {
      if (e) return callback(e);
      try {
        happn_client.create(
          {
            config: {
              username: '_ADMIN',
              password: 'happn'
            }
          },
          function(e, instance) {
            if (e) return callback(e);

            socketClient = instance;

            callback();
          }
        );
      } catch (e) {
        callback(e);
      }
    };

    if (socketClient) return socketClient.disconnect(createClient);
    createClient();
  });

  it('the listener should pick up a single published event, eventemitter listening', function(callback) {
    this.timeout(default_timeout);
    try {
      socketClient.on(
        '/e2e_test1/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          expect(socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event']).to.equal(
            undefined
          );
          callback();
        },
        function(e) {
          if (!e) {
            expect(
              socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
            ).to.equal(1);
            socketClient.set(
              '/e2e_test1/testsubscribe/data/event',
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

  it('the listener should pick up a single published event, eventemitter publishing', function(callback) {
    this.timeout(default_timeout);

    try {
      socketClient.on(
        '/e2e_test1/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          expect(socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event']).to.equal(
            undefined
          );
          callback();
        },
        function(e) {
          if (!e) {
            expect(
              socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
            ).to.equal(1);
            socketClient.set(
              '/e2e_test1/testsubscribe/data/event',
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

  it('the publisher should set new data ', function(callback) {
    this.timeout(default_timeout);

    try {
      var test_path_end = '1';

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
              expect(results.property1 === 'property1').to.equal(true);
              expect(results.created === results.modified).to.equal(true);
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
      var test_path_end = '2';

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
                  expect(results.property4).to.equal('property4');
                  expect(results.property1).to.equal('property1');
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
    var test_path_end = '3';
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
        expect(e == null).to.equal(true);
        socketClient.set(
          '/e2e_test1/testsubscribe/data/complex/' + test_path_end + '/1',
          complex_obj,
          null,
          function(e) {
            expect(e == null).to.equal(true);
            socketClient.get(
              '/e2e_test1/testsubscribe/data/complex*',
              {
                criteria: criteria1,
                options: options1
              },
              function(e, search_result) {
                expect(e == null).to.equal(true);
                expect(search_result.length === 1).to.equal(true);
                socketClient.get(
                  '/e2e_test1/testsubscribe/data/complex*',
                  {
                    criteria: criteria2,
                    options: options2
                  },
                  function(e, search_result) {
                    expect(e == null).to.equal(true);
                    expect(search_result.length === 2).to.equal(true);
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
      function(e) {
        if (e) return callback(e);
        socketClient.remove(
          '/e2e_test1/testsubscribe/data/delete_me',
          {
            noPublish: true
          },
          function(e, result) {
            expect(e).to.equal(null);
            expect(result._meta.status).to.equal('ok');
            callback();
          }
        );
      }
    );
  });

  it('the publisher should set new data then update the data', function(callback) {
    this.timeout(default_timeout);

    var test_path_end = '4';
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
        expect(e).to.equal(null);

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
            expect(e).to.equal(null);
            expect(updateResult._id === insertResult._id).to.equal(true);
            callback();
          }
        );
      }
    );
  });

  it('the publisher should set new data ', function(callback) {
    this.timeout(default_timeout);
    var test_path_end = '5';
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
            expect(results.property1).to.equal('property1');
            callback(e);
          });
        } else callback(e);
      }
    );
  });

  it('the publisher should set new data then update the data', function(callback) {
    this.timeout(default_timeout);

    try {
      var test_path_end = '6';

      socketClient.set(
        'e2e_test1/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e, insertResult) {
          expect(e == null).to.equal(true);
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
              expect(e == null).to.equal(true);
              expect(updateResult._id === insertResult._id).to.equal(true);
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
    var test_path_end = '7';
    socketClient.setSibling(
      'e2e_test1/siblings/' + test_path_end,
      {
        property1: 'sib_post_property1',
        property2: 'sib_post_property2'
      },
      function(e) {
        expect(e == null).to.equal(true);

        socketClient.setSibling(
          'e2e_test1/siblings/' + test_path_end,
          {
            property1: 'sib_post_property1',
            property2: 'sib_post_property2'
          },
          function(e) {
            expect(e == null).to.equal(true);

            //the child method returns a child in the collection with a specified id
            socketClient.get('e2e_test1/siblings/' + test_path_end + '/*', null, function(
              e,
              getresults
            ) {
              expect(e == null).to.equal(true);
              expect(getresults.length === 2).to.equal(true);
              callback(e);
            });
          }
        );
      }
    );
  });

  //  We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('the listener should pick up a single published event', function(callback) {
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
          expect(socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event']).to.equal(
            undefined
          );
          callback();
        },
        function(e) {
          if (!e) {
            expect(
              socketClient.state.events['/SET@/e2e_test1/testsubscribe/data/event'].length
            ).to.equal(1);
            socketClient.set(
              '/e2e_test1/testsubscribe/data/event',
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

  it('should get using a wildcard', function(callback) {
    var test_path_end = '8';

    socketClient.set(
      'e2e_test1/testwildcard/' + test_path_end,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function(e) {
        expect(e == null).to.equal(true);
        socketClient.set(
          'e2e_test1/testwildcard/' + test_path_end + '/1',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            expect(e == null).to.equal(true);

            socketClient.get('e2e_test1/testwildcard/' + test_path_end + '*', null, function(
              e,
              results
            ) {
              expect(results.length).to.equal(2);

              socketClient.getPaths('e2e_test1/testwildcard/' + test_path_end + '*', function(
                e,
                results
              ) {
                expect(results.length).to.equal(2);
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
    socketClient.set(
      '/e2e_test1/testsubscribe/data/delete_me',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function() {
        socketClient.on(
          '/e2e_test1/testsubscribe/data/delete_me',
          {
            event_type: 'remove',
            count: 1
          },
          function(eventData) {
            expect(
              socketClient.state.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me']
            ).to.equal(undefined);
            expect(eventData.removed).to.equal(1);
            callback();
          },
          function(e) {
            if (e) return callback(e);
            expect(
              socketClient.state.events['/REMOVE@/e2e_test1/testsubscribe/data/delete_me'].length
            ).to.equal(1);
            socketClient.remove('/e2e_test1/testsubscribe/data/delete_me', null, function() {});
          }
        );
      }
    );
  });

  it('should unsubscribe from an event', function(callback) {
    var currentListenerId;

    socketClient.on(
      '/e2e_test1/testsubscribe/data/on_off_test',
      {
        event_type: 'set',
        count: 0
      },
      function() {
        socketClient.offPath('/e2e_test1/testsubscribe/data/on_off_test', function(e) {
          if (e) return callback(new Error(e));

          socketClient.on(
            '/e2e_test1/testsubscribe/data/on_off_test',
            {
              event_type: 'set',
              count: 0
            },
            function() {
              socketClient.off(currentListenerId, function(e) {
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
    socketClient.onAll(
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
            socketClient.remove('/e2e_test1/testsubscribe/data/catch_all', null, function() {});
          }
        );
      }
    );
  });

  it('should unsubscribe from all events', function(callback) {
    this.timeout(10000);

    var onHappened = false;

    socketClient.onAll(
      function() {
        onHappened = true;
        callback(new Error('this wasnt meant to happen'));
      },
      function(e) {
        if (e) return callback(e);

        socketClient.on(
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

            socketClient.offAll(function(e) {
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

  it('does a variable depth on, ensure the client state items are correct', function(done) {
    var variableDepthHandle;

    socketClient.on(
      '/test/path/**',
      { depth: 4 },
      function(data) {
        expect(data).to.eql({ set: 'data' });

        socketClient.off(variableDepthHandle, function(e) {
          if (e) return done(e);

          expect(socketClient.state.listenerRefs[variableDepthHandle]).to.eql(undefined);
          expect(socketClient.state.listenerRefs).to.eql({});

          done();
        });
      },
      function(e, handle) {
        if (e) return done(e);

        expect(handle).to.equal(0);

        expect(Object.keys(socketClient.state.listenerRefs).length).to.eql(1);

        variableDepthHandle = handle;

        socketClient.set('/test/path/1', { set: 'data' }, function(e) {
          if (e) return done(e);
        });
      }
    );
  });

  it('does a variable depth on, ensure the client state items are correct, deeper path', function(done) {
    var variableDepthHandle;

    socketClient.on(
      '/test/path/**',
      { depth: 4 },
      function(data) {
        expect(data).to.eql({ set: 'data' });

        socketClient.off(variableDepthHandle, function(e) {
          if (e) return done(e);

          expect(socketClient.state.listenerRefs[variableDepthHandle]).to.eql(undefined);
          expect(socketClient.state.listenerRefs).to.eql({});

          done();
        });
      },
      function(e, handle) {
        if (e) return done(e);

        expect(handle).to.equal(0);

        expect(Object.keys(socketClient.state.listenerRefs).length).to.eql(1);

        variableDepthHandle = handle;

        socketClient.set('/test/path/1/3', { set: 'data' }, function(e) {
          if (e) return done(e);
        });
      }
    );
  });

  it('does a couple of variable depth ons, we disconnect the client and ensure the state is cleaned up', function(done) {
    socketClient.on(
      '/test/path/**',
      { depth: 4 },
      function() {},
      function() {
        socketClient.on(
          '/test/path/1/**',
          { depth: 5 },
          function() {},
          function() {
            expect(Object.keys(socketClient.state.listenerRefs).length).to.eql(2);
            socketClient.disconnect(function(e) {
              if (e) return done(e);
              expect(Object.keys(socketClient.state.listenerRefs).length).to.eql(0);
              done();
            });
          }
        );
      }
    );
  });

  it('does a variable depth on which eclipses another .on, do off and ensure the correct handlers are called', function(done) {
    var results = [];

    socketClient.on(
      '/test/path/**',
      { depth: 4 },
      function(data, meta) {
        results.push({ data: data, channel: meta.channel, path: meta.path });
      },
      function(e, handle1) {
        if (e) return done(e);
        socketClient.on(
          '/test/path/1/**',
          { depth: 4 },
          function(data, meta) {
            results.push({ data: data, channel: meta.channel, path: meta.path });
          },
          function(e) {
            if (e) return done(e);
            socketClient.set('/test/path/1/1', { set: 1 }, function(e) {
              if (e) return done(e);
              socketClient.off(handle1, function(e) {
                if (e) return done(e);
                socketClient.set('/test/path/1/1', { set: 2 }, function(e) {
                  if (e) return done(e);
                  expect(results).to.eql([
                    { data: { set: 1 }, channel: '/ALL@/test/path/1/**', path: '/test/path/1/1' },
                    { data: { set: 1 }, channel: '/ALL@/test/path/**', path: '/test/path/1/1' },
                    { data: { set: 2 }, channel: '/ALL@/test/path/1/**', path: '/test/path/1/1' }
                  ]);
                  done();
                });
              });
            });
          }
        );
      }
    );
  });

  it('should subscribe and get initial values on the callback', function(callback) {
    socketClient.set(
      '/initialCallback/testsubscribe/data/values_on_callback_test/1',
      {
        test: 'data'
      },
      function(e) {
        if (e) return callback(e);

        socketClient.set(
          '/initialCallback/testsubscribe/data/values_on_callback_test/2',
          {
            test: 'data1'
          },
          function(e) {
            if (e) return callback(e);

            socketClient.on(
              '/initialCallback/**',
              {
                event_type: 'set',
                initialCallback: true
              },
              function(message) {
                expect(message.updated).to.equal(true);
                callback();
              },
              function(e, reference, response) {
                if (e) return callback(e);
                try {
                  expect(response.length).to.equal(2);
                  expect(response[0].test).to.equal('data');
                  expect(response[1].test).to.equal('data1');

                  socketClient.set(
                    '/initialCallback/testsubscribe/data/values_on_callback_test/1',
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

    socketClient.set(
      '/initialEmitSpecific/testsubscribe/data/values_emitted_test/1',
      {
        test: 'data'
      },
      function(e) {
        if (e) return callback(e);

        socketClient.set(
          '/initialEmitSpecific/testsubscribe/data/values_emitted_test/2',
          {
            test: 'data1'
          },
          function(e) {
            if (e) return callback(e);

            socketClient.on(
              '/initialEmitSpecific/**',
              {
                event_type: 'set',
                initialEmit: true
              },
              function(message) {
                caughtEmitted++;
                if (caughtEmitted === 2) {
                  expect(message.test).to.equal('data1');
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
