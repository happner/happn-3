describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var happn = require('../../../lib/index');
  var serviceInstance;
  var expect = require('expect.js');

  var getService = function (config, callback) {

    if (serviceInstance) return serviceInstance.stop(function(){
      happn.service.create(config,
        callback
      );
    });

    happn.service.create(config,
      callback
    );
  };

  var http = require('http');

  function doRequest(path, token, query, callback, excludeToken) {

    var request = require('request');

    var options = {
      url: 'http://127.0.0.1:55000' + path,
    };

    if (!excludeToken) {
      if (!query)
        options.headers = {
          'Cookie': ['happn_token=' + token]
        }
      else
        options.url += '?happn_token=' + token;
    }

    request(options, function (error, response, body) {
      callback(response, body);
    });

  }

  before('it starts completely defaulted service', function (done) {

    getService({
      secure: true,
      services: {
        security: {
          config: {
            profiles: [{
              name: "test-session",
              session: {
                $and: [{
                  user: {
                    username: {
                      $eq: 'TEST_SESSION'
                    }
                  }
                }]
              },
              policy: {
                ttl: '2 seconds',
                inactivity_threshold: '2 seconds'
              }
            }]
          }
        }
      }
    }, function (e, service) {

      if (e) return done(e);

      serviceInstance = service;

      serviceInstance.connect.use('/TEST/WEB/ROUTE', function (req, res, next) {

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          "secure": "value"
        }));
      });

      done();
    });
  });

  after('stop the test service', function (callback) {
    serviceInstance.stop(callback);
  });

  var testGroup = {
    name: 'TEST GROUP',
    permissions: {
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

  before('creates a group and a user, adds the group to the user, logs in with test user', function (done) {

    serviceInstance.services.security.users.upsertGroup(testGroup, {
      overwrite: false
    }, function (e, result) {

      if (e) return done(e);
      addedTestGroup = result;

      serviceInstance.services.security.users.upsertUser(testUser, {
        overwrite: false
      }, function (e, result) {

        if (e) return done(e);
        addedTestuser = result;

        serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, done);
      });
    });
  });

  it('logs in with the ws user - we then test a call to a web-method, then disconnects with the revokeToken flag set to true, we try and reuse the token and ensure that it fails', function (done) {

    this.timeout(4000);

    happn.client.create({
        config: {
          username: testUser.username,
          password: 'TEST PWD'
        },
        secure: true
      })

      .then(function (clientInstance) {

        testClient = clientInstance;

        var sessionToken = testClient.session.token;

        doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

          expect(response.statusCode).to.equal(200);

          testClient.disconnect({
            revokeSession: true
          }, function (e) {

            if (e) return done(e);

            setTimeout(function () {

              doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

                expect(response.statusCode).to.equal(403);

                done();
              });
            }, 2000);
          });
        });
      })

      .catch(function (e) {
        done(e);
      });

  });

  it('logs in with the ws user - we then test a call to a web-method, then disconnects with the revokeToken flag set to false, we try and reuse the token and ensure that it succeeds', function (done) {

    happn.client.create({
        config: {
          username: testUser.username,
          password: 'TEST PWD'
        },
        secure: true
      })

      .then(function (clientInstance) {

        testClient = clientInstance;

        var sessionToken = testClient.session.token;

        doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

          expect(response.statusCode).to.equal(200);

          testClient.disconnect({
            revokeSession: false
          }, function (e) {

            if (e) return done(e);

            doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

              expect(response.statusCode).to.equal(200);

              done();
            });
          });
        });
      })

      .catch(function (e) {
        done(e);
      });
  });

  it('logs in with the ws user - we then test a call to a web-method, then disconnects with the revokeToken flag set to true, we try and reuse the token and ensure that it fails, then wait longer and ensure even after the token is times out it still fails', function (done) {

    this.timeout(10000);

    happn.client.create({
        config: {
          username: testUser.username,
          password: 'TEST PWD'
        },
        secure: true
      })

      .then(function (clientInstance) {

        testClient = clientInstance;

        var sessionToken = testClient.session.token;
        var sessionId = testClient.session.id;

        doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

          expect(response.statusCode).to.equal(200);

          testClient.disconnect({
            revokeSession: true
          }, function (e) {

            if (e) return done(e);

            setTimeout(function () {

              serviceInstance.services.security.__cache_revoked_sessions.get(sessionId, function (e, cachedToken) {

                expect(cachedToken.reason).to.equal('CLIENT');

                setTimeout(function () {

                  serviceInstance.services.security.__cache_revoked_sessions.get(sessionId, function (e, cachedToken) {

                    expect(cachedToken).to.be(null);

                    doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

                      expect(response.statusCode).to.equal(403);

                      done();
                    });
                  });
                }, 4010);
              });
            }, 2000);
          });
        });
      })

      .catch(function (e) {
        done(e);
      });
  });

  it('logs in with the ws user - we then test a call to a web-method, we revoke the session explicitly via a client call, test it has the desired effect', function (done) {

    this.timeout(10000);

    happn.client.create({
        username: testUser.username,
        password: 'TEST PWD',
        secure: true
      })

      .then(function (clientInstance) {

        testClient = clientInstance;

        var sessionToken = testClient.session.token;

        doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

          expect(response.statusCode).to.equal(200);

          testClient.revokeSession(function (e) {

            if (e) return done(e);

            doRequest('/TEST/WEB/ROUTE', sessionToken, false, function (response) {

              expect(response.statusCode).to.equal(403);

              testClient.disconnect({reconnect:false});

              done();
            });
          });
        });
      })

      .catch(function (e) {
        done(e);
      });
  });
});
