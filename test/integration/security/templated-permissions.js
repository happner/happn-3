require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  let serviceInstance;
  let adminClient, testClient;
  let test_id = Date.now() + '_' + require('shortid').generate();
  const filename = test.newTestFile();
  const warnings = [];

  before('it starts completely defaulted service', async () => {
    serviceInstance = await test.createInstance({
      secure: true,
      services: {
        data: {
          config: {
            datastores: [
              {
                name: 'persisted',
                settings: {
                  filename
                }
              }
            ]
          }
        }
      }
    });
    serviceInstance.services.security.checkpoint.log.warn = function(message) {
      warnings.push(message);
    };
  });

  after('should stop the service', async () => {
    await test.destroySession(testClient);
    await test.destroySession(adminClient);
    await test.destroyInstance(serviceInstance);
    test.deleteFiles();
  });

  context('resources access testing', function() {
    var testGroup = {
      name: 'TEST GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup.permissions = {
      '/explicit/test/*': {
        actions: ['*']
      },
      '/gauges/{{user.username}}': {
        actions: ['*']
      },
      '/gauges/{{user.username}}/*': {
        actions: ['*']
      },
      '/custom/{{user.custom_data.custom_field1}}': {
        actions: ['get', 'set']
      },
      '/custom/{{user.custom_data.custom_field2}}': {
        actions: ['on', 'set']
      },
      '/custom/{{user.custom_data.custom_field3}}': {
        actions: ['on', 'set']
      },
      '/custom/{{user.custom_data.custom_field4}}': {
        actions: ['on', 'set']
      },
      '/custom/{{user.custom_data.custom_field5}}': {
        actions: ['on', 'set']
      },
      '/forbidden/{{user.custom_data.custom_field_forbidden}}': {
        actions: ['*']
      }
    };

    var testUser = {
      username: 'TEST USER@blah.com' + test_id,
      password: 'TEST PWD',
      custom_data: {
        custom_field1: 'custom_field1_value',
        custom_field2: 'custom_field2_value',
        custom_field3: 'custom_field3_value',
        custom_field4: 'custom_field4_value',
        custom_field5: 'custom_field5_value',
        custom_field_forbidden: '*'
      }
    };

    var addedTestGroup;
    var addedTestuser;

    before('logs in adminClient', function(done) {
      serviceInstance.services.session
        .localClient({
          username: '_ADMIN',
          password: 'happn'
        })

        .then(function(clientInstance) {
          adminClient = clientInstance;
          done();
        })

        .catch(function(e) {
          done(e);
        });
    });

    before(
      'creates a group and a user, adds the group to the user, logs in with test user',
      function(done) {
        serviceInstance.services.security.groups
          .upsertGroup(testGroup)
          .then(function(result) {
            addedTestGroup = result;
            return serviceInstance.services.security.users.upsertUser(testUser);
          })
          .then(function(result) {
            addedTestuser = result;
            return serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser);
          })
          .then(function() {
            return serviceInstance.services.session.localClient({
              username: testUser.username,
              password: 'TEST PWD'
            });
          })
          .then(function(clientInstance) {
            testClient = clientInstance;
            done();
          })
          .catch(done);
      }
    );

    it('checks we are able to access templates using {{user.username}}', function(done) {
      var username = 'TEST USER@blah.com' + test_id;

      testClient.on(
        '/gauges/' + username,
        function(data) {
          test.expect(data.value).to.be(1);
          test.expect(data.gauge).to.be('logins');
          done();
        },
        function(e) {
          if (e) return done(e);
          testClient.increment('/gauges/' + username, 'logins', 1, function(e) {
            if (e) return done(e);
          });
        }
      );
    });

    it('checks we are able to access templates using {{user.custom_data.custom_field1}}', function(done) {
      testClient.set(
        '/custom/custom_field1_value',
        {
          test: 'data'
        },
        function(e) {
          if (e) return done(e);
          testClient.get('/custom/custom_field1_value', function(e, data) {
            if (e) return done(e);
            test.expect(data.test).to.be('data');
            done();
          });
        }
      );
    });

    it('checks we are able to access templates using {{user.custom_data.custom_field2}}', function(done) {
      testClient.on(
        '/custom/custom_field2_value',
        function(data) {
          test.expect(data.test).to.be('data');
          done();
        },
        function() {
          testClient.set(
            '/custom/custom_field2_value',
            {
              test: 'data'
            },
            function(e) {
              if (e) return done(e);
            }
          );
        }
      );
    });

    it('checks we are able to access an explicit permission', function(done) {
      var username = 'TEST USER@blah.com' + test_id;

      testClient.on(
        '/explicit/test/*',
        function(data) {
          test.expect(data.value).to.be(1);
          done();
        },
        function(e) {
          if (e) return done(e);
          testClient.set('/explicit/test/' + username, 1, function(e) {
            if (e) return done(e);
          });
        }
      );
    });

    it('checks we are not able to access unspecified paths', function(done) {
      var username = 'TEST USER@blah.com' + test_id;

      testClient.on(
        '/not_allowed/test/*',
        function() {
          done(new Error('untest.expected access granted'));
        },
        function(e) {
          if (!e) return done(new Error('untest.expected access granted'));
          test.expect(e.toString()).to.be('AccessDenied: unauthorized');
          testClient.set('/not_allowed/test/' + username, 1, function(e) {
            if (!e) return done(new Error('untest.expected access granted'));
            test.expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();
          });
        }
      );
    });

    it('checks we are not able to access via a template, due to an illegal promotion exploit (* in a {{property}} of the session context)', function(done) {
      testClient.on(
        '/forbidden/*',
        function() {
          done(new Error('untest.expected access granted'));
        },
        function(e) {
          if (!e) return done(new Error('untest.expected access granted'));
          test.expect(e.toString()).to.be('AccessDenied: unauthorized');
          testClient.set('/forbidden/1', 1, function(e) {
            if (!e) return done(new Error('untest.expected access granted'));
            test.expect(e.toString()).to.be('AccessDenied: unauthorized');
            test.expect(warnings[0]).to.be(
              'illegal promotion of permissions via permissions template, permissionPath/forbidden/{{user.custom_data.custom_field_forbidden}}, replaced path: /forbidden/*'
            );
            done();
          });
        }
      );
    });

    it('changes a custom property on the user - which should update the session, checks we are no longer able to access the path the permission relates to, but are able to access based on the new property', function(done) {
      testUser.custom_data.custom_field2 = 'custom_field2_changed';
      serviceInstance.services.security.users.upsertUser(testUser, function(e) {
        if (e) return done(e);
        testClient.on(
          '/custom/custom_field2_changed',
          function(data) {
            test.expect(data.test).to.be('data');
            testClient.set(
              '/custom/custom_field2_value',
              {
                test: 'data'
              },
              function(e) {
                test.expect(e.toString()).to.be('AccessDenied: unauthorized');
                done();
              }
            );
          },
          function() {
            testClient.set(
              '/custom/custom_field2_changed',
              {
                test: 'data'
              },
              function(e) {
                if (e) return done(e);
              }
            );
          }
        );
      });
    });

    it('removes a custom property from the user - which should update the session, checks we are no longer able to access the path the combination of permission and property value relate to', function(done) {
      testClient.set(
        '/custom/custom_field1_value',
        {
          test: 'data'
        },
        function(e) {
          if (e) return done(e);
          delete testUser.custom_data.custom_field1;
          serviceInstance.services.security.users.upsertUser(testUser, function(e) {
            if (e) return done(e);
            testClient.set(
              '/custom/custom_field1_value',
              {
                test: 'data'
              },
              function(e) {
                test.expect(e.toString()).to.be('AccessDenied: unauthorized');
                done();
              }
            );
          });
        }
      );
    });

    it('subscribes to a templated path, checks we receive messages, modifies the custom data related to the path, we ensure we are unable to get messages on the path anymore', function(done) {
      this.timeout(10000);
      var receivedCount = 0;
      testClient.on(
        '/custom/custom_field3_value',
        function() {
          receivedCount++;
          if (receivedCount === 2) return;
          testUser.custom_data.custom_field3 = 'custom_field3_changed';
          serviceInstance.services.security.users.upsertUser(testUser, function(e) {
            if (e) return done(e);
            adminClient.set(
              '/custom/custom_field3_value',
              {
                test: 'data'
              },
              function(e) {
                if (e) return done(e);
                setTimeout(function() {
                  test.expect(receivedCount).to.be(1);
                  done();
                }, 2000);
              }
            );
          });
        },
        function(e) {
          if (e) return done(e);
          testClient.set(
            '/custom/custom_field3_value',
            {
              test: 'data'
            },
            function(e) {
              if (e) return done(e);
            }
          );
        }
      );
    });

    it('subscribes to a templated path, checks we receive messages, removes the permission from the users group, we ensure we are unable to get messages on the path anymore', function(done) {
      this.timeout(10000);
      var receivedCount = 0;
      testClient.on(
        '/custom/custom_field4_value',
        function() {
          receivedCount++;
          if (receivedCount === 2) return;
          serviceInstance.services.security.groups
            .removePermission(testGroup.name, '/custom/{{user.custom_data.custom_field4}}', 'on')
            .then(function() {
              adminClient.set(
                '/custom/custom_field4_value',
                {
                  test: 'data'
                },
                function(e) {
                  if (e) return done(e);
                  setTimeout(function() {
                    test.expect(receivedCount).to.be(1);
                    done();
                  }, 2000);
                }
              );
            });
        },
        function(e) {
          if (e) return done(e);
          testClient.set(
            '/custom/custom_field4_value',
            {
              test: 'data'
            },
            function(e) {
              if (e) return done(e);
            }
          );
        }
      );
    });

    it('removes a templated permission from the group, checks we are no longer able to access the path the permission relates to', function(done) {
      this.timeout(10000);

      testClient.on(
        '/custom/custom_field5_value',
        function() {
          serviceInstance.services.security.groups
            .removePermission(testGroup.name, '/custom/{{user.custom_data.custom_field5}}', 'set')
            .then(function() {
              testClient.set(
                '/custom/custom_field5_value',
                {
                  test: 'data'
                },
                function(e) {
                  test.expect(e.toString()).to.be('AccessDenied: unauthorized');
                  done();
                }
              );
            });
        },
        function(e) {
          if (e) return done(e);
          testClient.set(
            '/custom/custom_field5_value',
            {
              test: 'data'
            },
            function(e) {
              if (e) return done(e);
            }
          );
        }
      );
    });
  });
});
