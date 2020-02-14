var expect = require('expect.js');
const Happn = require('../../../');
const delay = require('await-delay');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(10000);
    var server;
    var startServer = function(config) {
      return new Promise((resolve, reject) => {
        Happn.service
          .create(config)
          .then(function(_server) {
            server = _server;
          })
          .then(resolve)
          .catch(reject);
      });
    };

    var stopServer = function() {
      return new Promise((resolve, reject) => {
        if (!server) return resolve();
        server.stop(
          {
            reconnect: false
          },
          function(e) {
            if (e) return reject(e);
            server = undefined; // ?? perhaps also on e, messy
            resolve();
          }
        );
      });
    };

    it('emits session/ended/token-expired', async () => {
      let serverConfig = {
        secure: true,
        services: {
          security: {
            config: {
              profiles: [
                {
                  name: 'short-session',
                  session: {
                    $and: [
                      {
                        user: {
                          username: {
                            $eq: '_ADMIN'
                          }
                        }
                      }
                    ]
                  },
                  policy: {
                    ttl: '3 seconds'
                  }
                }
              ]
            }
          }
        }
      };
      let clientConfig = {
        username: '_ADMIN',
        password: 'happn'
      };
      await startServer(serverConfig);
      let client = await Happn.client.create(clientConfig);
      var reason = false;
      expect(server.services.session.__sessionExpiryWatchers[client.session.id] != null).to.be(
        true
      );
      client.onEvent('session-ended', function(evt) {
        reason = evt.reason;
      });
      await delay(4000);
      expect(server.services.session.__sessionExpiryWatchers[client.session.id] == null).to.be(
        true
      );
      await client.disconnect();
      await stopServer();
      expect(reason).to.be('token-expired');
    });

    it('ensures the session timeout is cleared if session ends before session/ended/token-expired', async () => {
      let serverConfig = {
        secure: true,
        services: {
          security: {
            config: {
              profiles: [
                {
                  name: 'short-session',
                  session: {
                    $and: [
                      {
                        user: {
                          username: {
                            $eq: '_ADMIN'
                          }
                        }
                      }
                    ]
                  },
                  policy: {
                    ttl: '3 seconds'
                  }
                }
              ]
            }
          }
        }
      };
      let clientConfig = {
        username: '_ADMIN',
        password: 'happn'
      };
      await startServer(serverConfig);
      let client = await Happn.client.create(clientConfig);

      var reason = false;
      client.onEvent('session-ended', function(evt) {
        reason = evt.reason;
      });
      await delay(500);
      expect(server.services.session.__sessionExpiryWatchers[client.session.id] != null).to.be(
        true
      );
      server.services.session.endSession(client.session.id, 'test-reason');
      await delay(500);
      expect(server.services.session.__sessionExpiryWatchers[client.session.id] == null).to.be(
        true
      );

      await client.disconnect();
      await stopServer();
      expect(reason).to.be('test-reason');
    });

    it('ensures the session timeout is cleared if client disconnects before session/ended/token-expired', async () => {
      let serverConfig = {
        secure: true,
        services: {
          security: {
            config: {
              profiles: [
                {
                  name: 'short-session',
                  session: {
                    $and: [
                      {
                        user: {
                          username: {
                            $eq: '_ADMIN'
                          }
                        }
                      }
                    ]
                  },
                  policy: {
                    ttl: '3 seconds'
                  }
                }
              ]
            }
          }
        }
      };
      let clientConfig = {
        username: '_ADMIN',
        password: 'happn'
      };
      await startServer(serverConfig);
      let client = await Happn.client.create(clientConfig);
      await delay(500);
      expect(server.services.session.__sessionExpiryWatchers[client.session.id] != null).to.be(
        true
      );
      await client.disconnect();
      await delay(500);
      expect(server.services.session.__sessionExpiryWatchers[client.session.id] == null).to.be(
        true
      );

      await stopServer();
    });

    it('emits session/ended/activity-timeout', async () => {
      let serverConfig = {
        secure: true,
        services: {
          security: {
            config: {
              profiles: [
                {
                  name: 'short-activity-ttl',
                  session: {
                    $and: [
                      {
                        user: {
                          username: {
                            $eq: '_ADMIN'
                          }
                        }
                      }
                    ]
                  },
                  policy: {
                    ttl: '10 seconds',
                    inactivity_threshold: '3 seconds'
                  }
                }
              ]
            }
          }
        }
      };
      let clientConfig = {
        username: '_ADMIN',
        password: 'happn'
      };
      await startServer(serverConfig);
      let client = await Happn.client.create(clientConfig);
      var reason = false;
      client.onEvent('session-ended', function(evt) {
        reason = evt.reason;
      });
      await delay(4000);
      try {
        await client.set('test/data', {
          test: 'data'
        });
      } catch (e) {
        // do nothing
      }
      await delay(1000);
      await client.disconnect();
      await stopServer();
      expect(reason).to.be('inactivity-threshold');
    });

    it('emits session/ended/session-revoked', async () => {
      let serverConfig = {
        secure: true
      };
      let clientConfig = {
        username: '_ADMIN',
        password: 'happn'
      };
      await startServer(serverConfig);
      let client = await Happn.client.create(clientConfig);
      var reason = false;
      client.onEvent('session-ended', function(evt) {
        reason = evt.reason;
      });
      server.services.security.revokeSession(client.session, 'test', () => {
        //do nothing
      });
      await delay(1000);
      await stopServer();
      expect(reason).to.be('session-revoked');
    });
  }
);
