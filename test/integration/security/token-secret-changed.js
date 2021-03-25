const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  const happn = require('../../../lib/index'),
    utils = require('../../../lib/services/utils/shared');
  let happnInstance, testClient;
  this.timeout(20000);
  before('should initialize the service', startService);
  before(
    'creates a group and a user, adds the group to the user, logs in with test user',
    createTestUser
  );
  after(stopService);

  it('updates the group associated with the test user to allow gets to the path, the user should succeed in connecting to the url, we then change the token secret on the server and test using the stale token', async () => {
    testGroup.permissions = {
      '/@HTTP/secure/route/test': {
        actions: ['get']
      }
    };
    await happnInstance.services.security.users.upsertGroup(testGroup);
    let response = await doRequest('/secure/route/test', testClient.session.token, false);
    test.expect(response.statusCode).to.equal(200);
    happnInstance.services.security.config.sessionTokenSecret = 'blahblah';
    response = await doRequest('/secure/route/test', testClient.session.token, false);
    test.expect(response.statusCode).to.equal(401);
    let errorMessage;
    try {
      await userLogin({
        token: testClient.session.token
      });
    } catch (e) {
      errorMessage = e.message;
    }
    test.expect(errorMessage).to.equal('Invalid credentials: invalid session token');
  });

  var doRequest = utils.maybePromisify(function(path, token, query, callback) {
    var request = require('request');

    var options = {
      url: 'http://127.0.0.1:55000' + path
    };

    if (!query)
      options.headers = {
        Cookie: ['happn_token=' + token]
      };
    else options.url += '?happn_token=' + token;

    request(options, function(error, response) {
      if (error) return callback(error);
      callback(null, response);
    });
  });

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
      }
    }
  };

  function startService(callback) {
    happn.service.create(testConfig, function(e, happnInst) {
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
    if (testClient) testClient.disconnect({ reconnect: false });
    setTimeout(function() {
      happnInstance.stop({ reconnect: false }, callback);
    }, 5000);
  }

  var testGroup = {
    name: 'TEST GROUP',
    custom_data: {
      customString: 'custom1',
      customNumber: 0
    }
  };

  var testUser = {
    username: 'TEST USER@blah.com',
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

            happnInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function(
              e
            ) {
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
            });
          }
        );
      }
    );
  }

  var userLogin = utils.maybePromisify(function(credentials, callback) {
    happn.client
      .create(credentials)

      .then(function(clientInstance) {
        testClient = clientInstance;
        callback(null, clientInstance);
      })

      .catch(function(e) {
        callback(e);
      });
  });
});
