describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    const happn = require('../../../lib/index');
    const service = happn.service;
    const Crypto = require('happn-util-crypto');
    const crypto = new Crypto();
    const keyPair = crypto.createKeyPair();
    const test_id = Date.now() + '_' + require('shortid').generate();

    var happnInstance = null;
    var adminClient;
    var testClient;
    var testClient1;
    var testClient2;
    var testClientShortSession;
    var testTokenShortSession;
    var testClientInactivity;
    var testTokenInactivity;

    this.timeout(20000);

    before('should initialize the service', startService);
    before('should initialize the admin client', initializeAdminClient);
    before(
      'creates a group and a user, adds the group to the user, logs in with test user',
      createTestUser
    );
    before('creates a group and a user for session expiry tests', createShortSessionUserAndGroup);
    before('creates a group and a user for session expiry tests', createInactivityUserAndGroup);
    after(stopService);

    it('the server should set up a secure route, the admin client should connect ok', function(callback) {
      try {
        doRequest('/secure/route', adminClient.session.token, false, function(response) {
          expect(response.statusCode).to.equal(200);
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it('the server should set up a secure route, the admin client should connect ok passing the token on the querystring', function(callback) {
      try {
        doRequest('/secure/route/qs', adminClient.session.token, true, function(response) {
          expect(response.statusCode).to.equal(200);
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it('the server should set up another secure route, the test client should fail to connect', function(callback) {
      try {
        doRequest('/secure/route/test', testClient.session.token, false, function(response) {
          expect(response.statusCode).to.equal(403);
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it('updates the group associated with the test user to allow gets to the path, the user should succeed in connecting to the url', function(callback) {
      this.timeout(10000);

      try {
        testGroup.permissions = {
          '/@HTTP/secure/route/test': {
            actions: ['get']
          }
        };

        happnInstance.services.security.users.upsertGroup(testGroup, {}, function(e, group) {
          if (e) return callback(e);

          expect(group.permissions['/@HTTP/secure/route/test']).to.eql({
            actions: ['get']
          });

          doRequest('/secure/route/test', testClient.session.token, false, function(response) {
            expect(response.statusCode).to.equal(200);
            callback();
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('updates the group associated with the test user to allow gets to the path, the user should succeed in connecting to the url with the query string', function(callback) {
      try {
        testGroup.permissions = {
          '/@HTTP/secure/route/test': {
            actions: ['get']
          }
        };

        happnInstance.services.security.users.upsertGroup(testGroup, {}, function(e, group) {
          if (e) return callback(e);
          expect(group.permissions['/@HTTP/secure/route/test']).to.eql({
            actions: ['get']
          });

          doRequest('/secure/route/test', testClient.session.token, true, function(response) {
            expect(response.statusCode).to.equal(200);
            callback();
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('updates the group associated with the test user to allow posts to the a post path, the user should succeed in connecting to the url with the query string', function(callback) {
      try {
        doPost('/secure/route/post', testClient.session.token, true, function(response) {
          expect(response.statusCode).to.equal(403);

          testGroup.permissions = {
            '/@HTTP/secure/route/post': {
              actions: ['post'],
              prohibit: ['get']
            }
          };

          happnInstance.services.security.users.upsertGroup(testGroup, {}, function(e) {
            if (e) return callback(e);

            doPost('/secure/route/post', testClient.session.token, true, function(response) {
              expect(response.statusCode).to.equal(200);

              doRequest('/secure/route/post', testClient.session.token, true, function(response) {
                expect(response.statusCode).to.equal(403);

                callback();
              });
            });
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('tests the excluded wildcard route to ensure anyone can access it', function(callback) {
      doRequest('/test/excluded/wildcard/blah', null, false, function(response) {
        expect(response.statusCode).to.equal(200);
        callback();
      });
    });

    it('tests the excluded specific route to ensure anyone can access it', function(callback) {
      this.timeout(20000);

      doRequest('/test/excluded/specific', null, true, function(response) {
        expect(response.statusCode).to.equal(200);
        callback();
      });
    });

    it('tests doing a request for a token using a GET with a username and password', function(callback) {
      doRequest(
        '/auth/login?username=_ADMIN&password=happn',
        null,
        true,
        function(response, body) {
          expect(response.statusCode).to.equal(200);

          var token = JSON.parse(body).data;

          doRequest('/secure/route/qs', token, true, function(response) {
            expect(response.statusCode).to.equal(200);
            callback();
          });
        },
        true
      );
    });

    it('tests doing a request for a nonce using a GET with a username and password, nonce is encrypted for a login', function(callback) {
      var encodedPublicKey = encodeURIComponent(keyPair.publicKey);

      doRequest(
        '/auth/request-nonce?publicKey=' + encodedPublicKey + '&user=_ADMIN',
        null,
        true,
        function(response, body) {
          expect(response.statusCode).to.equal(200);

          var nonce = JSON.parse(body).data;

          var digest = crypto.sign(nonce, keyPair.privateKey);

          var encodedDigest = encodeURIComponent(digest);

          doRequest(
            '/auth/login?username=_ADMIN&digest=' +
              encodedDigest +
              '&publicKey=' +
              encodedPublicKey,
            null,
            true,
            function(response) {
              expect(response.statusCode).to.equal(200);
              callback();
            },
            true
          );
        },
        true
      );
    });

    it('removes the permission from the test group - we ensure we can not access the resource with the token', function(callback) {
      var testGroup1 = {
        name: 'TEST GROUP1' + test_id,
        custom_data: {
          customString: 'custom1',
          customNumber: 0
        }
      };

      testGroup1.permissions = {
        '/@HTTP/secure/test/removed/group': {
          actions: ['get']
        },
        '/@HTTP/secure/test/not_removed/group': {
          actions: ['get']
        }
      };

      var testUser1 = {
        username: 'TEST USER1@blah.com' + test_id,
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        }
      };

      var addedTestGroup1;
      var addedTestuser1;

      happnInstance.services.security.users.upsertGroup(
        testGroup1,
        {
          overwrite: false
        },
        function(e, result) {
          if (e) return callback(e);
          addedTestGroup1 = result;

          happnInstance.services.security.users.upsertUser(
            testUser1,
            {
              overwrite: false
            },
            function(e, result) {
              if (e) return callback(e);
              addedTestuser1 = result;

              happnInstance.services.security.users.linkGroup(
                addedTestGroup1,
                addedTestuser1,
                function(e) {
                  if (e) return callback(e);

                  happn.client
                    .create({
                      config: {
                        username: testUser1.username,
                        password: 'TEST PWD'
                      },
                      secure: true
                    })

                    .then(function(clientInstance) {
                      testClient1 = clientInstance;

                      doRequest(
                        '/secure/test/removed/group',
                        testClient1.session.token,
                        false,
                        function(response) {
                          expect(response.statusCode).to.equal(200);

                          happnInstance.services.security.groups
                            .removePermission(
                              testGroup1.name,
                              '/@HTTP/secure/test/removed/group',
                              'get'
                            )
                            .then(function() {
                              doRequest(
                                '/secure/test/removed/group',
                                testClient1.session.token,
                                false,
                                function(response) {
                                  expect(response.statusCode).to.equal(403);
                                  callback();
                                }
                              );
                            })
                            .catch(callback);
                        }
                      );
                    })

                    .catch(function(e) {
                      callback(e);
                    });
                }
              );
            }
          );
        }
      );
    });

    it('removes the user associated with the token - we ensure we can not access the resource with the token', function(done) {
      var testGroup2 = {
        name: 'TEST GROUP2' + test_id,
        custom_data: {
          customString: 'custom2',
          customNumber: 0
        }
      };

      testGroup2.permissions = {
        '/@HTTP/secure/test/removed/user': {
          actions: ['get']
        },
        '/@HTTP/secure/test/not_removed/user': {
          actions: ['get']
        }
      };

      var testUser2 = {
        username: 'TEST USER2@blah.com' + test_id,
        password: 'TEST PWD',
        custom_data: {
          something: 'usefull'
        }
      };

      var addedTestGroup2;
      var addedTestuser2;

      happnInstance.services.security.users.upsertGroup(
        testGroup2,
        {
          overwrite: false
        },
        function(e, result) {
          if (e) return done(e);
          addedTestGroup2 = result;

          happnInstance.services.security.users.upsertUser(
            testUser2,
            {
              overwrite: false
            },
            function(e, result) {
              if (e) return done(e);
              addedTestuser2 = result;

              happnInstance.services.security.users.linkGroup(
                addedTestGroup2,
                addedTestuser2,
                function(e) {
                  if (e) return done(e);

                  happn.client
                    .create({
                      config: {
                        username: testUser2.username,
                        password: 'TEST PWD'
                      },
                      secure: true
                    })

                    .then(function(clientInstance) {
                      testClient2 = clientInstance;

                      doRequest(
                        '/secure/test/removed/user',
                        testClient2.session.token,
                        false,
                        function(response) {
                          expect(response.statusCode).to.equal(200);

                          happnInstance.services.security.users.deleteUser(addedTestuser2, function(
                            e
                          ) {
                            if (e) return done(e);

                            doRequest(
                              '/secure/test/removed/user',
                              testClient2.session.token,
                              false,
                              function(response) {
                                expect(response.statusCode).to.equal(403);
                                done();
                              }
                            );
                          });
                        }
                      );
                    })

                    .catch(function(e) {
                      done(e);
                    });
                }
              );
            }
          );
        }
      );
    });

    it('the server should set up a secure route, the admin client should connect ok using a bearer token', function(callback) {
      try {
        doBearerTokenRequest('/secure/route', adminClient.session.token, function(response) {
          expect(response.statusCode).to.equal(200);
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it('the server should set up another secure route, the test client should fail to connect using a bad bearer token', function(callback) {
      try {
        doBearerTokenRequest('/secure/route/test', 'crap token', function(response) {
          expect(response.statusCode).to.equal(401);
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it('ensures a token expiry causes a 401 error', function(callback) {
      setTimeout(() => {
        doBearerTokenRequest('/short/permissions/allowed', testTokenShortSession, function(
          response
        ) {
          expect(response.statusCode).to.equal(401);
          callback();
        });
      }, 3000);
    });

    it('ensures session inactivity causes a 401 error', function(callback) {
      setTimeout(() => {
        doBearerTokenRequest('/inactivity/permissions/allowed', testTokenInactivity, function(
          response
        ) {
          expect(response.statusCode).to.equal(401);
          callback();
        });
      }, 5000);
    });

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

    function doPost(path, token, query, callback, excludeToken) {
      var request = require('request');

      var options = {
        url: 'http://127.0.0.1:55000' + path,
        method: 'POST',
        data: { post: 'data' }
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

    function doBearerTokenRequest(path, token, callback, excludeToken) {
      var request = require('request');

      var options = {
        url: 'http://127.0.0.1:55000' + path
      };

      if (!excludeToken)
        options.headers = {
          Authorization: ['Bearer ' + token]
        };

      request(options, function(error, response, body) {
        callback(response, body);
      });
    }

    var testConfig = {
      secure: true,
      services: {
        connect: {
          config: {
            middleware: {
              security: {
                exclusions: ['/test/excluded/specific', '/test/excluded/wildcard/*']
              }
            }
          }
        },
        security: {
          config: {
            adminUser: {
              publicKey: keyPair.publicKey
            },
            profiles: [
              //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
              {
                name: 'short-session',
                session: {
                  $and: [
                    {
                      user: {
                        username: {
                          $eq: 'TEST USER SHORT'
                        }
                      }
                    }
                  ]
                },
                policy: {
                  ttl: '2 seconds'
                }
              },
              {
                name: 'usage-limit',
                session: {
                  $and: [
                    {
                      user: {
                        username: {
                          $eq: 'TEST USER INACTIVE'
                        }
                      }
                    }
                  ]
                },
                policy: {
                  inactivity_threshold: '1 seconds'
                }
              }
            ]
          }
        }
      }
    };

    function startService(callback) {
      service.create(testConfig, function(e, happnInst) {
        if (e) return callback(e);

        happnInstance = happnInst;

        happnInstance.connect.use('/secure/route/test', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        happnInstance.connect.use('/secure/route', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        happnInstance.connect.use('/secure/route/qs', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        happnInstance.connect.use('/test/excluded/wildcard/blah', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        happnInstance.connect.use('/test/excluded/specific', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        happnInstance.connect.use('/secure/test/removed/group', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        happnInstance.connect.use('/secure/test/removed/user', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        happnInstance.connect.use('/secure/route/post', function(req, res) {
          res.setHeader('Content-Type', 'application/json');

          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });

        callback();
      });
    }

    function stopService(callback) {
      this.timeout(15000);

      if (adminClient) adminClient.disconnect({ reconnect: false });
      if (testClient) testClient.disconnect({ reconnect: false });
      if (testClient1) testClient1.disconnect({ reconnect: false });
      if (testClient2) testClient2.disconnect({ reconnect: false });
      if (testClientShortSession) testClientShortSession.disconnect({ reconnect: false });
      if (testClientInactivity) testClientInactivity.disconnect({ reconnect: false });

      setTimeout(function() {
        happnInstance.stop({ reconnect: false }, callback);
      }, 5000);
    }

    function initializeAdminClient(callback) {
      happn.client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          secure: true
        })

        .then(function(clientInstance) {
          adminClient = clientInstance;
          callback();
        })

        .catch(function(e) {
          callback(e);
        });
    }

    var testGroup = {
      name: 'TEST GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    var testUser = {
      username: 'TEST USER@blah.com' + test_id,
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    var addedTestGroup;
    var addedTestuser;

    function createTestUser(callback) {
      happnInstance.services.security.users.upsertGroup(
        testGroup,
        {
          overwrite: false
        },
        function(e, result) {
          if (e) return callback(e);
          addedTestGroup = result;

          happnInstance.services.security.users.upsertUser(
            testUser,
            {
              overwrite: false
            },
            function(e, result) {
              if (e) return callback(e);
              addedTestuser = result;

              happnInstance.services.security.users.linkGroup(
                addedTestGroup,
                addedTestuser,
                function(e) {
                  if (e) return callback(e);

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
                      callback();
                    })

                    .catch(function(e) {
                      callback(e);
                    });
                }
              );
            }
          );
        }
      );
    }

    var testGroupShortSession = {
      name: 'TEST GROUP SHORT',
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroupShortSession.permissions = {
      '/@HTTP/short/permissions/allowed': {
        actions: ['get']
      }
    };

    var testUserShortSession = {
      username: 'TEST USER SHORT',
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    function createShortSessionUserAndGroup(callback) {
      createTestUserAndGroup(testGroupShortSession, testUserShortSession, (e, client, token) => {
        if (e) return callback(e);
        testClientShortSession = client;
        testTokenShortSession = token;
        callback();
      });
    }

    var testGroupInactivity = {
      name: 'TEST GROUP INACTIVE',
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroupInactivity.permissions = {
      '/@HTTP/inactivity/permissions/allowed': {
        actions: ['get']
      }
    };

    var testUserInactivity = {
      username: 'TEST USER INACTIVE',
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    function createInactivityUserAndGroup(callback) {
      createTestUserAndGroup(testGroupInactivity, testUserInactivity, (e, client, token) => {
        if (e) return callback(e);
        testClientInactivity = client;
        testTokenInactivity = token;
        callback();
      });
    }

    function createTestUserAndGroup(group, user, callback) {
      var addedGroup, addedUser;
      happnInstance.services.security.users.upsertGroup(
        group,
        {
          overwrite: false
        },
        function(e, result) {
          if (e) return callback(e);
          addedGroup = result;

          happnInstance.services.security.users.upsertUser(
            user,
            {
              overwrite: false
            },
            function(e, result) {
              if (e) return callback(e);
              addedUser = result;

              happnInstance.services.security.users.linkGroup(addedGroup, addedUser, function(e) {
                if (e) return callback(e);

                happn.client
                  .create({
                    config: {
                      username: user.username,
                      password: user.password
                    },
                    secure: true
                  })

                  .then(function(clientInstance) {
                    callback(null, clientInstance, clientInstance.session.token);
                  })

                  .catch(function(e) {
                    callback(e);
                  });
              });
            }
          );
        }
      );
    }
  }
);
