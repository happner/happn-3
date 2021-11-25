require('../../__fixtures/utils/test_helper').describe(__filename, 120000, function(test) {
  let mode = 'embedded';
  let happnInstance = null;
  let test_id = test.shortid();

  before('should initialize the service', async () => {
    happnInstance = await test.createInstance();
  });

  after(async () => {
    await test.destroyInstance(happnInstance);
  });

  var publisherclient;
  var listenerclient;

  before('should initialize the clients', async () => {
    publisherclient = await test.createAdminSession(happnInstance);
    listenerclient = await test.createAdminSession(happnInstance);
  });

  it('the listener should pick up a single wildcard event', function(callback) {
    listenerclient.on(
      '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/*',
      {
        event_type: 'set',
        count: 1
      },
      function() {
        test
          .expect(
            listenerclient.state.events[
              '/SET@/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/*'
            ]
          )
          .to.be(undefined);
        callback();
      },
      function(e) {
        if (e) return callback(e);

        test
          .expect(
            listenerclient.state.events[
              '/SET@/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/*'
            ].length
          )
          .to.be(1);
        publisherclient.set(
          '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event/blah',
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
      }
    );
  });

  it('the publisher should set new data', function(callback) {
    var test_path_end = test.shortid();
    publisherclient.set(
      'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
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
          publisherclient.get(
            'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
            null,
            function(e, results) {
              if (e) return callback(e);
              test.expect(results.property1 === 'property1').to.be(true);

              if (mode !== 'embedded')
                test.expect(results.payload[0].created === results.payload[0].modified).to.be(true);

              callback(e);
            }
          );
        } else callback(e);
      }
    );
  });

  it('should search for data with more than one wildcard', function(callback) {
    var test_path_end = test.shortid();

    publisherclient.set(
      'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/wildcards/' + test_path_end,
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
          publisherclient.get('*/' + test_id + '/testsubscribe/wildcards/*', null, function(
            e,
            results
          ) {
            if (e) return callback(e);
            test.expect(results.length > 0).to.be(true);
            callback(e);
          });
        } else callback(e);
      }
    );
  });

  it('set_multiple, the publisher should set multiple data items, then do a wildcard get to return them', function(callback) {
    var timesCount = 10;

    var testBasePath = '/a2_eventemitter_embedded_paths/' + test_id + '/set_multiple';
    test.async.times(
      timesCount,
      function(n, timesCallback) {
        var test_random_path2 = test.shortid();

        publisherclient.set(
          testBasePath + '/' + test_random_path2,
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          {
            noPublish: true
          },
          timesCallback
        );
      },
      function(e) {
        if (e) return callback(e);

        listenerclient.get(testBasePath + '/' + '*', null, function(e, results) {
          if (e) return callback(e);

          test.expect(results.length).to.be(timesCount);

          results.every(function(result) {
            test.expect(result._meta.path.indexOf(testBasePath) === 0).to.be(true);
            return true;
          });

          callback();
        });
      }
    );
  });

  it('should set data, and then merge a new document into the data without overwriting old fields', function(callback) {
    try {
      var test_path_end = test.shortid();

      publisherclient.set(
        '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/merge/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          if (e) return callback(e);
          publisherclient.set(
            '/a2_eventemitter_embedded_paths/' +
              test_id +
              '/testsubscribe/data/merge/' +
              test_path_end,
            {
              property4: 'property4'
            },
            {
              merge: true
            },
            function(e) {
              if (e) return callback(e);
              publisherclient.get(
                '/a2_eventemitter_embedded_paths/' +
                  test_id +
                  '/testsubscribe/data/merge/' +
                  test_path_end,
                null,
                function(e, results) {
                  if (e) return callback(e);
                  test.expect(results.property4).to.be('property4');
                  test.expect(results.property1).to.be('property1');
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

  it('should contain the same payload between 2 non-merging consecutive stores', function(done) {
    var object = {
      param1: 10,
      param2: 20
    };
    var firstTime;

    listenerclient.on(
      'setTest/object',
      {
        event_type: 'set',
        count: 2
      },
      function(message) {
        if (firstTime === undefined) {
          firstTime = message;
        } else {
          test.expect(message).to.eql(firstTime);
          done();
        }
      },
      function(err) {
        test.expect(err).to.not.be.ok();
        publisherclient.set('setTest/object', object, {}, function(err) {
          test.expect(err).to.not.be.ok();
          publisherclient.set('setTest/object', object, {}, function(err) {
            test.expect(err).to.not.be.ok();
          });
        });
      }
    );
  });

  it('should contain the same payload between a merge and a normal store for first store', function(done) {
    var object = {
      param1: 10,
      param2: 20
    };
    var firstTime = true;

    listenerclient.on(
      'mergeTest/object',
      {
        event_type: 'set',
        count: 2
      },
      function(message) {
        test.expect(message).to.eql(object);
        if (firstTime) {
          firstTime = false;
          return;
        }
        done();
      },
      function(err) {
        test.expect(err).to.not.be.ok();
        publisherclient.set(
          'mergeTest/object',
          object,
          {
            merge: true
          },
          function(err) {
            test.expect(err).to.not.be.ok();
            publisherclient.set(
              'mergeTest/object',
              object,
              {
                merge: true
              },
              function(err) {
                test.expect(err).to.not.be.ok();
              }
            );
          }
        );
      }
    );
  });

  it('should search for a complex object', function(callback) {
    var test_path_end = test.shortid();

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
            $containsAny: ['North', 'South', 'East', 'West']
          }
        },
        {
          towns: {
            $containsAny: ['North.Cape Town', 'South.East London']
          }
        },
        {
          categories: {
            $containsAny: ['Action', 'History']
          }
        }
      ],
      keywords: {
        $containsAny: ['bass', 'Penny Siopis']
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

    publisherclient.set(
      '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/complex/' + test_path_end,
      complex_obj,
      null,
      function(e) {
        test.expect(e == null).to.be(true);
        publisherclient.set(
          '/a2_eventemitter_embedded_paths/' +
            test_id +
            '/testsubscribe/data/complex/' +
            test_path_end +
            '/1',
          complex_obj,
          null,
          function(e) {
            test.expect(e == null).to.be(true);
            publisherclient.get(
              '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/complex*',
              {
                criteria: criteria1,
                options: options1
              },
              function(e, search_result) {
                test.expect(e == null).to.be(true);
                test.expect(search_result.length === 1).to.be(true);

                publisherclient.get(
                  '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/complex*',
                  {
                    criteria: criteria2,
                    options: options2
                  },
                  function(e, search_result) {
                    test.expect(e == null).to.be(true);
                    test.expect(search_result.length === 2).to.be(true);

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
    try {
      //We put the data we want to delete into the database
      publisherclient.set(
        '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me',
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
          publisherclient.remove(
            '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me',
            {
              noPublish: true
            },
            function(e, result) {
              test.expect(e).to.be(null);
              test.expect(result._meta.status).to.be('ok');
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
    try {
      var test_path_end = test.shortid();

      publisherclient.set(
        'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        {
          noPublish: true
        },
        function(e, insertResult) {
          test.expect(e).to.be(null);

          publisherclient.set(
            'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
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
              test.expect(e).to.be(null);
              test.expect(updateResult._meta.id === insertResult._meta.id).to.be(true);
              callback();
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
    try {
      //first listen for the change
      listenerclient.on(
        '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          test
            .expect(
              listenerclient.state.events[
                '/SET@/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'
              ]
            )
            .to.be(undefined);
          callback();
        },
        function(e) {
          if (!e) {
            test
              .expect(
                listenerclient.state.events[
                  '/SET@/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'
                ].length
              )
              .to.be(1);
            publisherclient.set(
              '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event',
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

  //We are testing setting data at a specific path

  it('the publisher should set new data ', function(callback) {
    try {
      var test_path_end = test.shortid();

      publisherclient.set(
        'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          if (!e) {
            publisherclient.get(
              'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
              null,
              function(e, results) {
                test.expect(results.property1 === 'property1').to.be(true);

                if (mode !== 'embedded')
                  test
                    .expect(results.payload[0].created === results.payload[0].modified)
                    .to.be(true);

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
      var test_path_end = test.shortid();

      publisherclient.set(
        'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e, insertResult) {
          test.expect(e == null).to.be(true);

          publisherclient.set(
            'a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/' + test_path_end,
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
        '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event',
        {
          event_type: 'set',
          count: 1
        },
        function() {
          test
            .expect(
              listenerclient.state.events[
                '/SET@/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'
              ]
            )
            .to.be(undefined);
          callback();
        },
        function(e) {
          if (!e) {
            test
              .expect(
                listenerclient.state.events[
                  '/SET@/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event'
                ].length
              )
              .to.be(1);
            //then make the change
            publisherclient.set(
              '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/event',
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
    var test_path_end = test.shortid();

    publisherclient.set(
      'a2_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function(e) {
        test.expect(e == null).to.be(true);
        publisherclient.set(
          'a2_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '/1',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            test.expect(e == null).to.be(true);

            publisherclient.get(
              'a2_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '*',
              null,
              function(e, results) {
                if (e) return callback();

                test.expect(results.length === 2).to.be(true);
                callback(e);
              }
            );
          }
        );
      }
    );
  });

  it('should get paths', function(callback) {
    var test_path_end = test.shortid();

    publisherclient.set(
      'a2_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end,
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function(e) {
        test.expect(e == null).to.be(true);
        publisherclient.set(
          'a2_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '/1',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function(e) {
            test.expect(e == null).to.be(true);

            publisherclient.getPaths(
              'a2_eventemitter_embedded_paths/' + test_id + '/testwildcard/' + test_path_end + '*',
              function(e, results) {
                test.expect(results.length === 2).to.be(true);
                callback(e);
              }
            );
          }
        );
      }
    );
  });

  it('the listener should pick up a single delete event', function(callback) {
    //We put the data we want to delete into the database
    publisherclient.set(
      '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      null,
      function() {
        listenerclient.on(
          '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me',
          {
            event_type: 'remove',
            count: 1
          },
          function(eventData) {
            test
              .expect(
                listenerclient.state.events[
                  '/REMOVE@/a2_eventemitter_embedded_paths/' +
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
                listenerclient.state.events[
                  '/REMOVE@/a2_eventemitter_embedded_paths/' +
                    test_id +
                    '/testsubscribe/data/delete_me'
                ].length
              )
              .to.be(1);
            //We perform the actual delete
            publisherclient.remove(
              '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/delete_me',
              null,
              function() {
                //do nothing
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
      '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test',
      {
        event_type: 'set',
        count: 0
      },
      function() {
        //we detach all listeners from the path here
        listenerclient.offPath(
          '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test',
          function(e) {
            if (e) return callback(new Error(e));

            listenerclient.on(
              '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test',
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
                  '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test',
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
          '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/on_off_test',
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

  it('should subscribe to the catch all notification', function(callback) {
    this.timeout(10000);
    var caughtCount = 0;

    listenerclient.onAll(
      function(eventData, meta) {
        if (
          meta.action ===
            '/REMOVE@/a2_eventemitter_embedded_paths/' +
              test_id +
              '/testsubscribe/data/catch_all' ||
          meta.action ===
            '/SET@/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/catch_all'
        )
          caughtCount++;

        if (caughtCount === 2) callback();
      },
      function(e) {
        if (e) return callback(e);

        publisherclient.set(
          '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/catch_all',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          null,
          function() {
            publisherclient.remove(
              '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/catch_all',
              null,
              function() {
                //do nothing
              }
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
          '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/off_all_test',
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
                '/a2_eventemitter_embedded_paths/' + test_id + '/testsubscribe/data/off_all_test',
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
});
