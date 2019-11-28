module.exports = function(serviceConfig1, serviceConfig2) {
  return function() {
    this.timeout(20000);
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happnInstance1 = null;
    var happnInstance2 = null;
    const delay = require('await-delay');

    before('should initialize the service', function(callback) {
      this.timeout(20000);

      try {
        service.create(serviceConfig1, function(e, happnInst1) {
          if (e) return callback(e);

          happnInstance1 = happnInst1;

          service.create(serviceConfig2, function(e, happnInst2) {
            if (e) return callback(e);

            happnInstance2 = happnInst2;

            callback();
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('logs in with the test client, supplying a public key, we perform a bunch of operations - we remember the token and logout - then login with the token, and test operations', function(done) {
      this.timeout(20000);

      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(function(e) {
              if (e) return done(e);

              getClient(
                {
                  token: token,
                  port: 10000
                },
                function(e, tokenInstance) {
                  if (e) return done(e);

                  testOperations(tokenInstance, function(e) {
                    tryDisconnect(tokenInstance, function() {
                      done(e);
                    });
                  });
                }
              );
            });
          });
        }
      );
    });

    it('logs in with the test client, supplying a public key, we perform a bunch of operations - we wait for the short session to time out, then try and reuse the token for login, it should not be allowed', function(done) {
      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            },
            info: {
              shortSession: true
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(function(e) {
              if (e) return done(e);

              setTimeout(function() {
                getClient(
                  {
                    token: token,
                    port: 10000
                  },
                  function(e) {
                    expect(e.toString()).to.be('AccessDenied: expired session token');
                    done();
                  }
                );
              }, 2010);
            });
          });
        }
      );
    });

    it('testing inverse of preceding test, so no timed out session', function(done) {
      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(function(e) {
              if (e) return done(e);

              setTimeout(function() {
                getClient(
                  {
                    token: token,
                    port: 10000
                  },
                  function(e, instance) {
                    if (instance)
                      instance.disconnect({
                        reconnect: false
                      });
                    done(e);
                  }
                );
              }, 2010);
            });
          });
        }
      );
    });

    it('logs in with the test client, supplying a public key, we perform a bunch of operations - we remember the token and logout with revokeSession true - we then ensure we are unable to login with the revoked token', function(done) {
      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(
              {
                revokeSession: true
              },
              function(e) {
                if (e) return done(e);

                setTimeout(function() {
                  getClient(
                    {
                      token: token,
                      port: 10000
                    },
                    function(e) {
                      expect(e.message).to.be('token has been revoked');
                      done();
                    }
                  );
                }, 2010);
              }
            );
          });
        }
      );
    });

    it('logs in with the test client, supplying a public key, we perform a bunch of operations - we remember the token and logout revoking the token - we then ensure we are unable to login with the revoked token', function(done) {
      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(
              {
                revokeToken: true
              },
              function(e) {
                if (e) return done(e);

                setTimeout(function() {
                  getClient(
                    {
                      token: token,
                      port: 10000
                    },
                    function(e) {
                      expect(e.message).to.be('token has been revoked');
                      done();
                    }
                  );
                }, 2010);
              }
            );
          });
        }
      );
    });

    it('we log in to a test service, supplying a public key, we perform a bunch of operations - the token is remembered and matches the locked profile, we then ensure we are able to login to the same server with the token but are unable to log in to a different server using the locked token', function(done) {
      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            },
            info: {
              tokenOriginLocked: true
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(function(e) {
              if (e) return done(e);

              getClient(
                {
                  token: token,
                  port: 10001
                },
                function(e) {
                  expect(e.toString()).to.be(
                    'AccessDenied: this token is locked to a different origin by policy'
                  );
                  done();
                }
              );
            });
          });
        }
      );
    });

    it('inverse of preceding test, we check we are able to log in to another instance with the same token.', function(done) {
      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(function(e) {
              if (e) return done(e);

              setTimeout(function() {
                getClient(
                  {
                    token: token,
                    port: 10001
                  },
                  function(e, instance) {
                    if (instance)
                      instance.disconnect({
                        reconnect: false
                      });
                    done(e);
                  }
                );
              }, 2010);
            });
          });
        }
      );
    });

    it('we log in to a test service, supplying a public key, we perform a bunch of operations - the token is remembered and matches the disallow profile, we then ensure we are unable to login with the login disallowed token', function(done) {
      getClient(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 10000,
            keyPair: {
              publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
              privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
            },
            info: {
              tokenNotAllowedForLogin: true
            }
          }
        },
        function(e, instance) {
          if (e) return done(e);

          testOperations(instance, function(e) {
            if (e) return done(e);

            var token = instance.session.token;

            instance.disconnect(function(e) {
              if (e) return done(e);

              getClient(
                {
                  token: token,
                  port: 10000
                },
                function(e) {
                  expect(e.toString()).to.be(
                    'AccessDenied: logins with this token are disallowed by policy'
                  );
                  done();
                }
              );
            });
          });
        }
      );
    });

    it('logs in with a stateful request, then does a series of logins with with the original token, we disconnect the original client with disconnectChildSessions:true, and check the child sessions have been disconnected', async () => {
      const client1 = await getClientSync({
        username: '_ADMIN',
        password: 'happn',
        port: 10000
      });
      const clientsSessionEvents = {};

      const client2 = await getClientSync({
        username: '_ADMIN',
        token: client1.session.token,
        port: 10000
      });
      client2.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-2'] = evt;
      });
      const client3 = await getClientSync({
        username: '_ADMIN',
        token: client1.session.token,
        port: 10000
      });
      client3.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-3'] = evt;
      });
      const client4 = await getClientSync({
        username: '_ADMIN',
        token: client1.session.token,
        port: 10000
      });
      client4.onEvent('session-ended', evt => {
        clientsSessionEvents['session-ended-4'] = evt;
      });

      await tryDisconnectSync(client1, { disconnectChildSessions: true });
      await delay(2000);

      expect(clientsSessionEvents).to.eql({
        'session-ended-2': {
          reason: 'token-revoked'
        },
        'session-ended-3': {
          reason: 'token-revoked'
        },
        'session-ended-4': {
          reason: 'token-revoked'
        }
      });
    });

    after(async () => {
      if (happnInstance1) await happnInstance1.stop();
      if (happnInstance2) await happnInstance2.stop();
    });

    //check to see what is hanging on to the process, leaving for future reference and use
    //helper.showOpenHandles(after, 5000);

    function getClientSync(config) {
      return new Promise((resolve, reject) => {
        getClient(config, (e, instance) => {
          if (e) return reject(e);
          resolve(instance);
        });
      });
    }

    function getClient(config, callback) {
      happn.client
        .create(config)

        .then(function(clientInstance) {
          callback(null, clientInstance);
        })

        .catch(function(e) {
          callback(e);
        });
    }

    function tryDisconnectSync(clientInstance, options) {
      return new Promise((resolve, reject) => {
        tryDisconnect(clientInstance, options, e => {
          if (e) return reject(e);
          resolve();
        });
      });
    }

    function tryDisconnect(clientInstance, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = null;
      }
      if (!clientInstance) return callback();
      try {
        clientInstance.disconnect(options, callback);
      } catch (e) {
        callback();
      }
    }

    function testOperations(clientInstance, callback) {
      var calledBack = false;

      var timeout = setTimeout(function() {
        raiseError('operations timed out');
      }, 2000);

      var raiseError = function(message) {
        if (!calledBack) {
          calledBack = true;
          return callback(new Error(message));
        }
      };

      var operations = '';

      clientInstance.on(
        '/test/operations',

        function(data, meta) {
          operations += meta.action
            .toUpperCase()
            .split('@')[0]
            .replace(/\//g, '');

          if (operations === 'SETREMOVE') {
            clearTimeout(timeout);

            callback();
          }
        },
        function(e) {
          if (e) return raiseError(e.toString());

          clientInstance.set(
            '/test/operations',
            {
              test: 'data'
            },
            function(e) {
              if (e) return raiseError(e.toString());
              clientInstance.remove('/test/operations', function(e) {
                if (e) return raiseError(e.toString());
              });
            }
          );
        }
      );
    }
  };
};
