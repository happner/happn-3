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

    this.timeout(20000);
    /*
    ./lib/services/security/service.js:  this.cacheService.get(
    ./lib/services/security/users.js:  this.__cache_passwords.get(username, (e, hash) => {
    ./lib/services/security/checkpoint.js:  this.__checkpoint_inactivity_threshold.get(session.id, (e, value) => {
    ./lib/services/security/checkpoint.js:  this.__checkpoint_usage_limit.get(
    ./lib/services/security/permissions.js:          .get(name)
    ./lib/services/utils/service.js:  const regex = cache.get(preparedOrMatched);
    */
    before('should initialize the service', startService);
    before('should initialize the admin client', initializeAdminClient);
    before(
      'creates a group and a user, adds the group to the user, logs in with test user',
      createTestUser
    );
    after(stopService);

    it('updates the group associated with the test user to allow gets to the path, the user should succeed in connecting to the url, we then change the token secret on the server and test using the stale token', function(callback) {
      this.timeout(10000);

      try {
        testGroup.permissions = {
          '/@HTTP/secure/route/test': {
            actions: ['get']
          }
        };
        happnInstance.services.security.users.upsertGroup(testGroup, {}, function(e) {
          if (e) return callback(e);
          doRequest('/secure/route/test', testClient.session.token, false, function(response) {
            expect(response.statusCode).to.equal(200);
            happnInstance.services.security.config.sessionTokenSecret = 'blahblah';
            doRequest('/secure/route/test', testClient.session.token, false, function(response) {
              expect(response.statusCode).to.equal(401);
              userLogin(
                {
                  token: testClient.session.token
                },
                function(e) {
                  expect(e.message).to.equal('Invalid credentials: invalid session token');
                  callback();
                }
              );
            });
          });
        });
      } catch (e) {
        callback(e);
      }
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
            }
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
                  userLogin(
                    {
                      config: {
                        username: testUser.username,
                        password: 'TEST PWD'
                      },
                      secure: true
                    },
                    (e, client) => {
                      if (e) return callback(e);
                      testClient = client;
                      callback();
                    }
                  );
                }
              );
            }
          );
        }
      );
    }

    function userLogin(credentials, callback) {
      happn.client
        .create(credentials)

        .then(function(clientInstance) {
          testClient = clientInstance;
          callback(null, clientInstance);
        })

        .catch(function(e) {
          callback(e);
        });
    }
  }
);
