describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var serviceInstance;
    var expect = require('expect.js');
    var delay = require('await-delay');
    this.timeout(10000);

    var getService = function(config, callback) {
      if (serviceInstance)
        return serviceInstance.stop(function() {
          happn.service.create(config, callback);
        });

      happn.service.create(config, callback);
    };

    async function getClient(config) {
      return happn.client.create({ config, secure: true });
    }

    async function doEventRoundTripClient(client) {
      return new Promise((resolve, reject) => {
        var timeout = this.setTimeout(() => {
          reject(new Error('timed out'));
        }, 3000);
        client.on(
          'client-revoke-session-sanity',
          data => {
            this.clearTimeout(timeout);
            expect(data).to.eql({ test: 'data' });
            resolve();
          },
          e => {
            if (e) return reject(e);
            client.set('client-revoke-session-sanity', { test: 'data' }, e => {
              if (e) return reject(e);
            });
          }
        );
      });
    }

    function doEventRoundTripToken(token, callback) {
      happn.client
        .create({
          config: {
            token
          },
          secure: true
        })
        .then(function(client) {
          var timeout = this.setTimeout(() => {
            callback(new Error('timed out'));
          }, 3000);
          client.on(
            'client-revoke-session-sanity',
            data => {
              this.clearTimeout(timeout);
              expect(data).to.eql({ test: 'data' });
              callback();
            },
            e => {
              if (e) return callback(e);
              client.set('client-revoke-session-sanity', { test: 'data' }, e => {
                if (e) return callback(e);
              });
            }
          );
        })
        .catch(callback);
    }

    function doRequest(path, token, query, callback, excludeToken) {
      var request = require('request');

      var options = {
        url: 'http://127.0.0.1:55000' + path
      };

      if (!excludeToken) {
        if (!query)
          options.headers = {
            Cookie: ['happn_token=' + token]
          };
        else options.url += '?happn_token=' + token;
      }

      request(options, function(error, response, body) {
        callback(response, body);
      });
    }

    before('it starts completely defaulted service', function(done) {
      getService(
        {
          secure: true,
          services: {
            security: {
              config: {
                profiles: [
                  {
                    name: 'test-session',
                    session: {
                      $and: [
                        {
                          user: {
                            username: {
                              $eq: 'TEST_SESSION'
                            }
                          }
                        }
                      ]
                    },
                    policy: {
                      ttl: '2 seconds',
                      inactivity_threshold: '2 seconds'
                    }
                  }
                ]
              }
            }
          }
        },
        function(e, service) {
          if (e) return done(e);

          serviceInstance = service;
          serviceInstance.connect.use('/TEST/WEB/ROUTE', function(req, res) {
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                secure: 'value'
              })
            );
          });
          done();
        }
      );
    });

    after('stop the test service', function(callback) {
      serviceInstance.stop(callback);
    });

    var testGroup = {
      name: 'TEST GROUP',
      permissions: {
        'client-revoke-session-sanity': {
          actions: ['*']
        },
        '/TEST/DATA/*': {
          actions: ['*']
        },
        '/@HTTP/TEST/WEB/ROUTE': {
          actions: ['get']
        }
      }
    };

    var testUser = {
      username: 'TEST_SESSION',
      password: 'TEST PWD'
    };

    var addedTestGroup;
    var addedTestuser;

    var testClient;

    before(
      'creates a group and a user, adds the group to the user, logs in with test user',
      function(done) {
        serviceInstance.services.security.users.upsertGroup(
          testGroup,
          {
            overwrite: false
          },
          function(e, result) {
            if (e) return done(e);
            addedTestGroup = result;

            serviceInstance.services.security.users.upsertUser(
              testUser,
              {
                overwrite: false
              },
              function(e, result) {
                if (e) return done(e);
                addedTestuser = result;

                serviceInstance.services.security.users.linkGroup(
                  addedTestGroup,
                  addedTestuser,
                  done
                );
              }
            );
          }
        );
      }
    );

    it('logs in with the ws user - we then test a call to a web-method, then disconnects with the revokeToken flag set to true, we try and reuse the token and ensure that it fails', function(done) {
      this.timeout(4000);
      happn.client
        .create({
          config: {
            username: testUser.username,
            password: 'TEST PWD'
          },
          secure: true
        })
        .then(function(clientInstance) {
          testClient = clientInstance;
          var sessionToken = testClient.session.token;
          doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
            expect(response.statusCode).to.equal(200);
            testClient.disconnect(
              {
                revokeToken: true
              },
              function(e) {
                if (e) return done(e);
                setTimeout(function() {
                  doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
                    expect(response.statusCode).to.equal(403);
                    doEventRoundTripToken(sessionToken, function(e) {
                      expect(e.message).to.be(`token has been revoked`);
                      done();
                    });
                  });
                }, 1000);
              }
            );
          });
        })
        .catch(function(e) {
          done(e);
        });
    });

    it('logs in with the ws user - we then test a call to a web-method, then disconnects with the revokeToken flag set to false, we try and reuse the token and ensure that it succeeds', function(done) {
      happn.client
        .create({
          config: {
            username: testUser.username,
            password: 'TEST PWD'
          },
          secure: true
        })
        .then(function(clientInstance) {
          testClient = clientInstance;
          var sessionToken = testClient.session.token;
          doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
            expect(response.statusCode).to.equal(200);
            testClient.disconnect(
              {
                revokeToken: false
              },
              function(e) {
                if (e) return done(e);

                doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
                  expect(response.statusCode).to.equal(200);

                  done();
                });
              }
            );
          });
        })
        .catch(function(e) {
          done(e);
        });
    });

    it('logs in with the ws user - we then test a call to a web-method, then disconnects with the revokeToken flag set to true, we try and reuse the token and ensure that it fails, then wait longer and ensure even after the token is times out it still fails', function(done) {
      this.timeout(15000);

      happn.client
        .create({
          config: {
            username: testUser.username,
            password: 'TEST PWD'
          },
          secure: true
        })

        .then(function(clientInstance) {
          testClient = clientInstance;

          var sessionToken = testClient.session.token;

          doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
            expect(response.statusCode).to.equal(200);
            testClient.disconnect(
              {
                revokeToken: true
              },
              function(e) {
                if (e) return done(e);
                setTimeout(function() {
                  serviceInstance.services.security.__cache_revoked_tokens.get(
                    sessionToken,
                    function(e, cachedToken) {
                      expect(cachedToken.reason).to.equal('CLIENT');

                      setTimeout(function() {
                        serviceInstance.services.security.__cache_revoked_tokens.get(
                          sessionToken,
                          function(e, cachedToken) {
                            expect(cachedToken).to.be(null);

                            doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
                              expect(response.statusCode).to.equal(401);

                              done();
                            });
                          }
                        );
                      }, 4010);
                    }
                  );
                }, 1500);
              }
            );
          });
        })

        .catch(function(e) {
          done(e);
        });
    });

    it('logs in with the ws user - we then test a call to a web-method, we revoke the session explicitly via a client call, test it has the desired effect', function(done) {
      this.timeout(10000);

      happn.client
        .create({
          username: testUser.username,
          password: 'TEST PWD',
          secure: true
        })

        .then(function(clientInstance) {
          testClient = clientInstance;

          var sessionToken = testClient.session.token;

          doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
            expect(response.statusCode).to.equal(200);

            testClient.revokeToken(function(e) {
              if (e) return done(e);

              doRequest('/TEST/WEB/ROUTE', sessionToken, false, function(response) {
                expect(response.statusCode).to.equal(403);

                testClient.disconnect({ reconnect: false });

                done();
              });
            });
          });
        })

        .catch(function(e) {
          done(e);
        });
    });

    it('ensures revoking a token on 1 client revokes the token on all clients using the token', async () => {
      let client1 = await getClient({ username: testUser.username, password: 'TEST PWD' });
      let client2 = await getClient({ token: client1.session.token });
      await doEventRoundTripClient(client2);
      await client1.disconnect({ revokeToken: true });
      try {
        await delay(1000);
        await doEventRoundTripClient(client2);
        throw new Error('was not meant to happen');
      } catch (e) {
        expect(e.message).to.be('client is disconnected');
        client2.disconnect();
      }
    });

    it('ensures revoking a session on a child client (login from parent token) revokes the token on the parent as well', async () => {
      let client1 = await getClient({ username: testUser.username, password: 'TEST PWD' });
      let client2 = await getClient({ token: client1.session.token });
      await doEventRoundTripClient(client1);
      await client2.disconnect({ revokeToken: true });
      try {
        await delay(1000);
        await doEventRoundTripClient(client1);
        throw new Error('was not meant to happen');
      } catch (e) {
        expect(e.message).to.be('client is disconnected');
        client1.disconnect();
      }
    });

    it('ensures revoking a session on a child client (login from parent token) revokes the token on the parent as well, 3 levels deep', async () => {
      let client1 = await getClient({ username: testUser.username, password: 'TEST PWD' });
      let client2 = await getClient({ token: client1.session.token });
      let client3 = await getClient({ token: client2.session.token });
      await doEventRoundTripClient(client1);
      await client3.disconnect({ revokeToken: true });
      try {
        await delay(1000);
        await doEventRoundTripClient(client1);
        throw new Error('was not meant to happen');
      } catch (e) {
        expect(e.message).to.be('client is disconnected');
        client1.disconnect();
        client2.disconnect();
      }
    });

    it('ensures revoking a token on 1 client revokes the token on all clients using the token, 3 levels deep', async () => {
      let client1 = await getClient({ username: testUser.username, password: 'TEST PWD' });
      let client2 = await getClient({ token: client1.session.token });
      let client3 = await getClient({ token: client2.session.token });
      await doEventRoundTripClient(client3);
      await client1.disconnect({ revokeToken: true });
      try {
        await delay(1000);
        await doEventRoundTripClient(client3);
        throw new Error('was not meant to happen');
      } catch (e) {
        expect(e.message).to.be('client is disconnected');
        client2.disconnect();
        client3.disconnect();
      }
    });
  }
);
