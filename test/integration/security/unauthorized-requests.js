require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  const happn = require('../../../lib/index');
  const service = happn.service;

  function doRequest(path, token, reqOptions, callback) {
    if (!callback) {
      callback = reqOptions;
      reqOptions = {};
    }

    var options = {
      url: 'http://127.0.0.1:55000' + path,
      method: reqOptions.method || 'GET',
      headers: {
        Cookie: ['happn_token=' + token]
      },
      formData: reqOptions.formData
    };

    test.request(options, function(error, response, body) {
      if (error) return callback(error);
      callback(null, response, body);
    });
  }

  context('secure mesh', function() {
    var self = this;
    setup.apply(self, [
      {
        secure: true
      }
    ]);

    it("the server should respond with '200 OK' when test.request has valid token", function(callback) {
      try {
        doRequest('/secure/route/test', self.adminClient.session.token, function(err, response) {
          test.expect(response.statusCode).to.equal(200);
          test.expect(response.headers['content-type']).to.equal('application/json');
          test.expect(response.body).to.equal('{"secure":"value"}');
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it("the server should respond with '401 Unauthorized' when test.request has no token", function(callback) {
      try {
        doRequest('/secure/route/test', null, function(err, response) {
          test.expect(response.statusCode).to.equal(401);
          test.expect(response.headers['content-type']).to.equal('text/plain');
          test.expect(response.headers['www-authenticate']).to.equal('happn-auth');
          test.expect(response.body).to.equal('invalid token format or null token');

          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it("the server should wait for the whole payload before responding with '401 Unauthorized'", async function() {
      const bigBuffer = Buffer.alloc(30 * 1024 * 1024);
      const filename = test.path.join(__dirname, 'tmp', 'uploadFile');
      await test.fs.promises.writeFile(filename, bigBuffer);
      await new Promise((resolve, reject) => {
        doRequest(
          '/secure/route/test',
          null,
          { method: 'POST', formData: { attachments: [test.fs.createReadStream(filename)] } },
          function(error, response) {
            if (error) return reject(error);
            test.expect(response.statusCode).to.equal(401);
            test.expect(response.headers['content-type']).to.equal('text/plain');
            test.expect(response.body).to.equal('invalid token format or null token');
            test.unlinkFiles([filename]);
            resolve();
          }
        );
      });
    });

    it("the server should respond with '403 Forbidden' when test.request has token from client without permission", function(callback) {
      try {
        doRequest('/secure/route/test', self.testClient.session.token, function(err, response) {
          test.expect(response.statusCode).to.equal(403);
          test.expect(response.headers['content-type']).to.equal('text/plain');
          test
            .expect(response.body)
            .to.equal('unauthorized access to path /@HTTP/secure/route/test');
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it("the server should wait for the whole payload before responding with '403 Forbidden'", async function() {
      const bigBuffer = Buffer.alloc(30 * 1024 * 1024);
      const filename = test.path.join(__dirname, 'tmp', 'uploadFile');
      await test.fs.promises.writeFile(filename, bigBuffer);
      await new Promise((resolve, reject) => {
        doRequest(
          '/secure/route/test',
          self.testClient.session.token,
          { method: 'POST', formData: { attachments: [test.fs.createReadStream(filename)] } },
          function(error, response) {
            if (error) return reject(error);
            test.expect(response.statusCode).to.equal(403);
            test.expect(response.headers['content-type']).to.equal('text/plain');
            test
              .expect(response.body)
              .to.equal('unauthorized access to path /@HTTP/secure/route/test');
            test.unlinkFiles([filename]);
            resolve();
          }
        );
      });
    });
  });

  context(
    "secure mesh with configured 'unauthorizedResponsePath' and 'forbiddenResponsePath'",
    function() {
      var self = this;
      setup.apply(self, [
        {
          secure: true,
          services: {
            connect: {
              config: {
                middleware: {
                  security: {
                    unauthorizedResponsePath: test.path.join(__dirname, 'files/unauthorized.html'),
                    forbiddenResponsePath: test.path.join(__dirname, 'files/forbidden.html')
                  }
                }
              }
            }
          }
        }
      ]);

      it("the server should respond with '401 Unauthorized' with custom unauthorized HTML page when test.request has no token", function(callback) {
        try {
          doRequest('/secure/route/test', null, function(err, response) {
            test.expect(response.statusCode).to.equal(401);
            test.expect(response.headers['content-type']).to.equal('text/html');
            test.expect(response.headers['www-authenticate']).to.equal('happn-auth');
            test.expect(response.body).to.equal('<body>\nUnauthorized\n</body>\n');
            callback();
          });
        } catch (e) {
          callback(e);
        }
      });

      it("the server should respond with '403 Forbidden' with custom forbidden HTML page when test.request has token from client without permission", function(callback) {
        try {
          doRequest('/secure/route/test', self.testClient.session.token, function(err, response) {
            test.expect(response.statusCode).to.equal(403);
            test.expect(response.headers['content-type']).to.equal('text/html');
            test.expect(response.body).to.equal('<body>\nForbidden\n</body>\n');
            callback();
          });
        } catch (e) {
          callback(e);
        }
      });
    }
  );

  context(
    "secure mesh with invalid 'unauthorizedResponsePath' and 'forbiddenResponsePath'",
    function() {
      var self = this;
      setup.apply(self, [
        {
          secure: true,
          services: {
            connect: {
              config: {
                middleware: {
                  security: {
                    unauthorizedResponsePath: test.path.join(__dirname, 'invalid/invalid.html'),
                    forbiddenResponsePath: test.path.join(__dirname, 'invalid/invalid.html')
                  }
                }
              }
            }
          }
        }
      ]);

      it("the server should respond with '500 Internal Server Error' for invalid 'unauthorizedResponsePath'", function(callback) {
        try {
          doRequest('/secure/route/test', null, function(err, response) {
            test.expect(response.statusCode).to.equal(500);
            test.expect(response.body.indexOf('ENOENT')).to.not.eql(-1);
            callback();
          });
        } catch (e) {
          callback(e);
        }
      });

      it("the server should respond with '500 Internal Server Error' for invalid 'forbiddenResponsePath'", function(callback) {
        try {
          doRequest('/secure/route/test', self.testClient.session.token, function(err, response) {
            test.expect(response.statusCode).to.equal(500);
            test.expect(response.body.indexOf('ENOENT')).to.not.eql(-1);
            callback();
          });
        } catch (e) {
          callback(e);
        }
      });
    }
  );

  function setup(config) {
    var self = this;

    var happnInstance = null;
    var test_id = Date.now() + '_' + require('shortid').generate();

    before('should initialize the service', function(callback) {
      this.timeout(20000);
      try {
        service.create(config, function(e, happnInst) {
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

          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    after(function(done) {
      this.timeout(15000);

      if (self.adminClient) self.adminClient.disconnect({ reconnect: false });
      if (self.testClient) self.testClient.disconnect({ reconnect: false });

      setTimeout(function() {
        happnInstance.stop({ reconnect: false }, done);
      }, 10000);
    });

    before('should initialize the admin client', function(callback) {
      happn.client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          secure: true
        })

        .then(function(clientInstance) {
          self.adminClient = clientInstance;
          callback();
        })

        .catch(function(e) {
          callback(e);
        });
    });

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

    before(
      'creates a group and a user, adds the group to the user, logs in with test user',
      function(done) {
        happnInstance.services.security.users.upsertGroup(
          testGroup,
          {
            overwrite: false
          },
          function(e, result) {
            if (e) return done(e);
            addedTestGroup = result;

            happnInstance.services.security.users.upsertUser(
              testUser,
              {
                overwrite: false
              },
              function(e, result) {
                if (e) return done(e);
                addedTestuser = result;

                happnInstance.services.security.users.linkGroup(
                  addedTestGroup,
                  addedTestuser,
                  function(e) {
                    if (e) return done(e);

                    happn.client
                      .create({
                        config: {
                          username: testUser.username,
                          password: 'TEST PWD'
                        },
                        secure: true
                      })

                      .then(function(clientInstance) {
                        self.testClient = clientInstance;
                        done();
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
      }
    );
  }
});
