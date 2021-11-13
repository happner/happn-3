const test = require('../../__fixtures/utils/test_helper').create();

test.describe(__filename, 120000, function() {
  let happnInstance = null;
  let publisherclient;
  let listenerclient;
  let originalHandleData;

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

      beforeEach(function() {
        originalHandleData = listenerclient.handle_data;
      });

      afterEach(function() {
        listenerclient.handle_data = originalHandleData;
      });

      it('should unsubscribe from an event', function(callback) {
        var path = '/e2e_test1/testsubscribe/data/on_off_test';

        var currentListenerId;
        var onRan = false;
        var pathOnRan = false;

        listenerclient.on(
          path,
          {
            event_type: 'set',
            count: 0
          },
          function(/*message*/) {
            if (pathOnRan) return callback(new Error('subscription was not removed by path'));
            else pathOnRan = true;

            listenerclient.offPath(path, function(e) {
              if (e) return callback(new Error(e));

              listenerclient.on(
                path,
                {
                  event_type: 'set',
                  count: 0
                },
                function(/*message*/) {
                  if (onRan) return callback(new Error('subscription was not removed'));
                  else {
                    onRan = true;
                    listenerclient.off(currentListenerId, function(e) {
                      if (e) return callback(new Error(e));

                      publisherclient.set(
                        path,
                        {
                          property1: 'property1',
                          property2: 'property2',
                          property3: 'property3'
                        },
                        {},
                        function(e /*, setresult*/) {
                          if (e) return callback(new Error(e));
                          setTimeout(callback, 500);
                        }
                      );
                    });
                  }
                },
                function(e, listenerId) {
                  if (e) return callback(new Error(e));

                  currentListenerId = listenerId;

                  publisherclient.set(
                    path,
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
              path,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              function(e) {
                if (e) return callback(new Error(e));
              }
            );
          }
        );
      });

      it('should unsubscribe from an event path', function(callback) {
        var path = '/e2e_test1/testsubscribe/data/path_off_test';

        var pathOnRan = false;

        listenerclient.on(
          path,
          {
            event_type: 'set',
            count: 0
          },
          function(/*message*/) {
            if (pathOnRan) return callback(new Error('subscription was not removed by path'));
            else pathOnRan = true;

            listenerclient.offPath(path, function(e) {
              if (e) return callback(new Error(e));

              publisherclient.set(
                path,
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                {},
                function(e) {
                  if (e) return callback(new Error(e));
                  setTimeout(callback, 500);
                }
              );
            });
          },
          function(e) {
            if (e) return callback(new Error(e));

            publisherclient.set(
              path,
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              function(e) {
                if (e) return callback(new Error(e));
              }
            );
          }
        );
      });

      it('should unsubscribe from an event path using a wildcard', function(callback) {
        var path = '/e2e_test1/testsubscribe/data/wildcard_path_off_test';
        listenerclient.on(
          path + '/*',
          {
            event_type: 'set',
            count: 0
          },
          function(/*message*/) {
            return callback(new Error('not meant to happen'));
          },
          function(e) {
            if (e) return callback(new Error(e));

            listenerclient.on(
              path + '/data/*',
              function(/*data*/) {
                return callback(new Error('not meant to happen'));
              },
              function(e) {
                if (e) return callback(new Error(e));

                listenerclient.offPath('/e2e_test1/testsubscribe/data/wildcard*', function(e) {
                  if (e) return callback(new Error(e));

                  publisherclient.set(
                    path,
                    {
                      property1: 'property1',
                      property2: 'property2',
                      property3: 'property3'
                    },
                    {},
                    function(e) {
                      if (e) return callback(new Error(e));
                      setTimeout(callback, 500);
                    }
                  );
                });
              }
            );
          }
        );
      });

      it('tests various fail conditions', function(callback) {
        listenerclient.off(null, function(e) {
          test.expect(e.toString()).to.be('Error: handle cannot be null');

          listenerclient.off(undefined, function(e) {
            test.expect(e.toString()).to.be('Error: handle cannot be null');
            //doing off with non-existant path
            listenerclient.offPath('some odd random path', function(e) {
              if (e) return callback(e);
              //doing off with non-existant event handle
              listenerclient.off(187253849567, callback);
            });
          });
        });
      });

      it('should unsubscribe from all events', function(callback) {
        var path = '/e2e_test1/testsubscribe/data/off_all_test';

        var onHappened = false;

        listenerclient.onAll(
          function(/*message*/) {
            onHappened = true;
            callback(new Error('this wasnt meant to happen'));
          },
          function(e) {
            if (e) return callback(e);

            listenerclient.on(
              path,
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
                    path,
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
                      }, 1000);
                    }
                  );
                });
              }
            );
          }
        );
      });

      it('should unsubscribe from only specific events with wildcard', function(callback) {
        var path = '/with/wildcard/unsubscribe/from/only/*';

        var results = {};

        Promise.all([
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[1] = true;
            }
          ),
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[2] = true;
            }
          ),
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[3] = true;
            }
          )
        ])

          .then(function(results) {
            return listenerclient.off(results[1]);
          })

          .then(function() {
            return publisherclient.set('/with/wildcard/unsubscribe/from/only/1', {});
          })

          .then(function() {
            return test.delay(500);
          })

          .then(function() {
            test.expect(results).to.eql({
              1: true,
              3: true
            });
          })

          .then(callback)
          .catch(callback);
      });

      it('should unsubscribe from only specific events without wildcard', function(callback) {
        var path = '/without/wildcard/unsubscribe/from/only';

        var results = {};
        var listenerId1, listenerId2, listenerId3;
        var emittedPath;

        Promise.all([
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[1] = true;
            }
          ),
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[2] = true;
            }
          ),
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[3] = true;
            }
          )
        ])

          .then(function(results) {
            listenerId1 = results[0];
            listenerId2 = results[1];
            listenerId3 = results[2];
            return listenerclient.off(listenerId2);
          })

          .then(function() {
            return publisherclient.set(path, {});
          })

          .then(function() {
            return test.delay(500);
          })

          .then(function() {
            test.expect(results).to.eql({
              1: true,
              3: true
            });
          })

          .then(function() {
            return listenerclient.off(listenerId1);
          })

          .then(function() {
            return listenerclient.off(listenerId3);
          })

          .then(function() {
            listenerclient.handle_data = function(path /*, data*/) {
              emittedPath = path;
              originalHandleData.apply(this, arguments);
            };
          })

          .then(function() {
            results = {};
            return publisherclient.set(path, {});
          })

          .then(function() {
            return test.delay(500);
          })

          .then(function() {
            test.expect(results).to.eql({});
          })

          .then(function() {
            test.expect(emittedPath).to.equal(undefined);
          })

          .then(function() {
            callback();
          })
          .catch(callback);
      });

      it('should remove all subscriptions on offPath without wildcard', function(callback) {
        var path = '/without/wildcard/off/path';

        var results = {};
        var emittedPath;

        Promise.all([
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[1] = true;
            }
          ),
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[2] = true;
            }
          ),
          listenerclient.on(
            path,
            {
              event_type: 'set'
            },
            function(/*data, meta*/) {
              results[3] = true;
            }
          )
        ])

          .then(function() {
            return listenerclient.offPath(path);
          })

          .then(function() {
            listenerclient.handle_data = function(path) {
              emittedPath = path;
              originalHandleData.apply(this, arguments);
            };
          })

          .then(function() {
            results = {};
            return publisherclient.set(path, {});
          })

          .then(function() {
            return test.delay(500);
          })

          .then(function() {
            test.expect(results).to.eql({});
          })

          .then(function() {
            test.expect(emittedPath).to.equal(undefined);
          })

          .then(callback)
          .catch(callback);
      });
    });
  });
});
