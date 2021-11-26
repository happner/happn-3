const testHelper = require('../../__fixtures/utils/test_helper').create();

describe(testHelper.testName(__filename, 3), function() {
  const expect = require('expect.js');
  const happn = require('../../../lib/index');
  const service = happn.service;
  const happn_client = happn.client;
  const async = require('async');

  this.timeout(20000);

  var serviceInstance;
  var clientInstance;

  var PORT = 55556;

  var disconnectClient = function(callback) {
    if (clientInstance) clientInstance.disconnect(callback);
    else callback();
  };

  var stopService = function(callback) {
    if (serviceInstance) serviceInstance.stop(callback);
    else callback();
  };

  after('disconnects the client and stops the server', function(callback) {
    disconnectClient(function() {
      stopService(callback);
    });
  });

  //used to check why is node still holding on, leaving in for reference and possible reuse
  //testHelper.showOpenHandles(after);

  var getService = function(
    activateSessionManagement,
    sessionActivityTTL,
    callback,
    sessionActivityLogging,
    port
  ) {
    if (!port) port = PORT;

    if (sessionActivityLogging === undefined) sessionActivityLogging = true;

    if (typeof activateSessionManagement === 'function') {
      callback = activateSessionManagement;
      activateSessionManagement = true;
      sessionActivityTTL = 60000 * 60 * 24 * 30;
    }

    disconnectClient(function(e) {
      if (e) return callback(e);

      stopService(function(e) {
        if (e) return callback(e);

        var serviceConfig = {
          secure: true,
          port: port,
          services: {
            security: {
              config: {
                activateSessionManagement: activateSessionManagement,
                logSessionActivity: sessionActivityLogging,
                sessionActivityTTL: sessionActivityTTL
              }
            }
          }
        };

        service.create(serviceConfig, function(e, happnInst) {
          if (e) return callback(e);

          serviceInstance = happnInst;

          happn_client.create(
            {
              config: {
                port: port,
                username: '_ADMIN',
                password: 'happn'
              },
              info: {
                from: 'startup'
              }
            },
            function(e, instance) {
              if (e) return callback(e);

              clientInstance = instance;

              callback();
            }
          );
        });
      });
    });
  };

  before('starts up happn instance with session management switched on', function(callback) {
    getService(callback);
  });

  it('tests active sessions and session activity logging on a secure instance', function(callback) {
    this.timeout(20000);
    var RandomActivityGenerator = require('happn-random-activity-generator');
    var randomActivity1 = new RandomActivityGenerator(clientInstance);
    randomActivity1.generateActivityStart('test', function() {
      setTimeout(function() {
        randomActivity1.generateActivityEnd('test', function() {
          serviceInstance.services.security.listActiveSessions(function(e, list) {
            if (e) return callback(e);
            expect(list.length).to.be(1);
            serviceInstance.services.security.listSessionActivity(function(e, list) {
              if (e) return callback(e);
              expect(list.length).to.be(1);
              callback();
            });
          });
        });
      }, 3000);
    });
  });

  function gotClientFromToken(token) {
    return new Promise(resolve => {
      happn_client.create(
        {
          config: {
            token,
            port: PORT
          },
          info: {
            from: 'startup'
          }
        },
        async (e, instance) => {
          if (e == null) await instance.disconnect();
          resolve(e == null);
        }
      );
    });
  }

  it('tests token revocation on a secure instance', function(callback) {
    this.timeout(20000);
    var RandomActivityGenerator = require('happn-random-activity-generator');
    var randomActivity1 = new RandomActivityGenerator(clientInstance);
    randomActivity1.generateActivityStart('test', function() {
      setTimeout(function() {
        randomActivity1.generateActivityEnd('test', function() {
          serviceInstance.services.security.listActiveSessions(function(e, list) {
            if (e) return callback(e);
            expect(list.length).to.be(1);
            var session = list[0];
            serviceInstance.services.security.listSessionActivity(function(e, list) {
              if (e) return callback(e);
              expect(list.length).to.be(1);
              serviceInstance.services.security.revokeToken(session.token, 'APP', async e => {
                if (e) return callback(e);
                serviceInstance.services.security.listRevokedTokens(async (e, items) => {
                  if (e) return callback(e);
                  expect(items.length).to.be(1);
                  const wasOk = await gotClientFromToken(session.token);
                  expect(wasOk).to.be(false);
                  serviceInstance.services.security.restoreToken(session.token, async e => {
                    if (e) return callback(e);
                    serviceInstance.services.security.listRevokedTokens(async (e, items) => {
                      if (e) return callback(e);
                      expect(items.length).to.be(0);
                      const wasOk = await gotClientFromToken(session.token);
                      expect(wasOk).to.be(true);
                      callback();
                    });
                  });
                });
              });
            });
          });
        });
      }, 5000);
    });
  });

  it('tests session management, multiple clients', function(callback) {
    var times = 4;

    this.timeout(times * 6000 + 10000);

    var session_results = [];

    getService(function() {
      async.timesSeries(
        times,
        function(timeIndex, timeCB) {
          happn_client.create(
            {
              config: {
                port: 55556,
                username: '_ADMIN',
                password: 'happn'
              }
            },
            function(e, instance) {
              if (e) return callback(e);
              var sessionData = {};
              sessionData.client = instance;
              var RandomActivityGenerator = require('happn-random-activity-generator');
              var randomActivity = new RandomActivityGenerator(instance);
              sessionData.random = randomActivity;
              randomActivity.generateActivityStart('test', function() {
                setTimeout(function() {
                  randomActivity.generateActivityEnd('test', function(aggregatedLog) {
                    sessionData.results = aggregatedLog;
                    sessionData.client = instance;
                    session_results.push(sessionData);
                    timeCB();
                  });
                }, 1000);
              });
            }
          );
        },
        function(e) {
          if (e) return callback(e);
          setTimeout(function() {
            serviceInstance.services.security.listActiveSessions(function(e, list) {
              if (e) return callback(e);
              expect(list.length).to.be(times + 1); //+1 for connected client
              serviceInstance.services.security.listSessionActivity(async (e, list) => {
                if (e) return callback(e);
                expect(list.length).to.be(times);
                for (let session of session_results) {
                  await session.client.disconnect();
                }
                callback();
              });
            });
          }, 5000);
        }
      );
    });
  });

  it('tests session management, switching on session management with activity logging', function(callback) {
    this.timeout(20000);
    getService(
      false,
      10000,
      function() {
        var RandomActivityGenerator = require('happn-random-activity-generator');
        var randomActivity1 = new RandomActivityGenerator(clientInstance);
        randomActivity1.generateActivityStart('test', function() {
          setTimeout(function() {
            randomActivity1.generateActivityEnd('test', function() {
              serviceInstance.services.security.listActiveSessions(function(e) {
                expect(e.toString()).to.be('Error: session management not activated');
                serviceInstance.services.security.listSessionActivity(function(e) {
                  expect(e.toString()).to.be('Error: session activity logging not activated');
                  serviceInstance.services.security.activateSessionManagement(true, function(e) {
                    if (e) return callback(e);
                    var randomActivity2 = new RandomActivityGenerator(clientInstance);
                    randomActivity2.generateActivityStart('test', function() {
                      setTimeout(function() {
                        randomActivity2.generateActivityEnd('test', function() {
                          serviceInstance.services.security.listActiveSessions(function(e, list) {
                            if (e) return callback(e);
                            expect(list.length).to.be(1);
                            serviceInstance.services.security.listSessionActivity(function(
                              e,
                              list
                            ) {
                              if (e) return callback(e);
                              expect(list.length).to.be(1);
                              callback();
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          }, 3000);
        });
      },
      false,
      55559
    );
  });

  it('tests session management, switching on session management without activity logging', function(callback) {
    this.timeout(20000);
    getService(
      false,
      10000,
      function() {
        var RandomActivityGenerator = require('happn-random-activity-generator');
        var randomActivity1 = new RandomActivityGenerator(clientInstance);
        randomActivity1.generateActivityStart('test', function() {
          setTimeout(function() {
            randomActivity1.generateActivityEnd('test', function() {
              serviceInstance.services.security.listActiveSessions(function(e) {
                expect(e.toString()).to.be('Error: session management not activated');
                serviceInstance.services.security.listSessionActivity(function(e) {
                  expect(e.toString()).to.be('Error: session activity logging not activated');
                  serviceInstance.services.security.activateSessionManagement(false, function(e) {
                    if (e) return callback(e);
                    var randomActivity2 = new RandomActivityGenerator(clientInstance);
                    randomActivity2.generateActivityStart('test', function() {
                      setTimeout(function() {
                        randomActivity2.generateActivityEnd('test', function() {
                          serviceInstance.services.security.listActiveSessions(function(e, list) {
                            if (e) return callback(e);
                            expect(list.length).to.be(1);
                            serviceInstance.services.security.listSessionActivity(function(e) {
                              expect(e.toString()).to.be(
                                'Error: session activity logging not activated'
                              );
                              callback();
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          }, 3000);
        });
      },
      false,
      55560
    );
  });

  it('tests session management, switching on session management without activity logging, then starting up activity logging', function(callback) {
    this.timeout(20000);

    getService(
      false,
      10000,
      function() {
        var RandomActivityGenerator = require('happn-random-activity-generator');

        var randomActivity1 = new RandomActivityGenerator(clientInstance);

        randomActivity1.generateActivityStart('test', function() {
          setTimeout(function() {
            randomActivity1.generateActivityEnd('test', function() {
              serviceInstance.services.security.listActiveSessions(function(e) {
                expect(e.toString()).to.be('Error: session management not activated');

                serviceInstance.services.security.listSessionActivity(function(e) {
                  expect(e.toString()).to.be('Error: session activity logging not activated');

                  serviceInstance.services.security.activateSessionManagement(false, function(e) {
                    if (e) return callback(e);

                    var randomActivity2 = new RandomActivityGenerator(clientInstance);

                    randomActivity2.generateActivityStart('test', function() {
                      setTimeout(function() {
                        randomActivity2.generateActivityEnd('test', function() {
                          serviceInstance.services.security.listActiveSessions(function(e, list) {
                            if (e) return callback(e);
                            expect(list.length).to.be(1);

                            serviceInstance.services.security.listSessionActivity(function(e) {
                              expect(e.toString()).to.be(
                                'Error: session activity logging not activated'
                              );

                              serviceInstance.services.security.activateSessionActivity(function(
                                e
                              ) {
                                if (e) return callback(e);

                                serviceInstance.services.security.listActiveSessions(function(
                                  e,
                                  list
                                ) {
                                  if (e) return callback(e);
                                  expect(list.length).to.be(1);

                                  clientInstance.set('/test/data', 50000, function(e) {
                                    if (e) return callback(e);

                                    setTimeout(function() {
                                      serviceInstance.services.security.listSessionActivity(
                                        function(e, list) {
                                          if (e) return callback(e);
                                          expect(list.length).to.be(1);
                                          callback();
                                        }
                                      );
                                    }, 2000);
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          }, 3000);
        });
      },
      false,
      55560
    );
  });
});
