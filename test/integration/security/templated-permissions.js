describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var serviceInstance;
    var adminClient;
    var expect = require('expect.js');
    var test_id = Date.now() + '_' + require('shortid').generate();

    var testClient;

    var tempFile1 = __dirname + '/tmp/testdata_templated-permissions.db';

    var getService = function(config, callback) {
      happn.service.create(config, callback);
    };

    var warnings = [];

    before('it starts completely defaulted service', function(done) {
      getService(
        {
          secure: true,
          services: {
            data: {
              config: {
                datastores: [
                  {
                    name: 'persisted',
                    settings: {
                      filename: tempFile1
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

          serviceInstance.services.security.checkpoint.log.warn = function(message) {
            warnings.push(message);
          };

          done();
        }
      );
    });

    after('should stop the service', function(callback) {
      this.timeout(15000);

      if (testClient)
        testClient.disconnect({
          reconnect: false
        });

      if (adminClient)
        adminClient.disconnect({
          reconnect: false
        });

      setTimeout(function() {
        serviceInstance.stop(
          {
            reconnect: false
          },
          function() {
            callback();
          }
        );
      }, 5000);
    });

    after('should delete the temp data file', function() {
      require('fs').unlinkSync(tempFile1);
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
              return serviceInstance.services.security.users.linkGroup(
                addedTestGroup,
                addedTestuser
              );
            })
            .then(function(result) {
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
            expect(data.value).to.be(1);
            expect(data.gauge).to.be('logins');
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
              expect(data.test).to.be('data');
              done();
            });
          }
        );
      });

      it('checks we are able to access templates using {{user.custom_data.custom_field2}}', function(done) {
        testClient.on(
          '/custom/custom_field2_value',
          function(data) {
            expect(data.test).to.be('data');
            done();
          },
          function(e) {
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
            expect(data.value).to.be(1);
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
          function(data) {
            done(new Error('unexpected access granted'));
          },
          function(e) {
            if (!e) return done(new Error('unexpected access granted'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            testClient.set('/not_allowed/test/' + username, 1, function(e) {
              if (!e) return done(new Error('unexpected access granted'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            });
          }
        );
      });

      it('checks we are not able to access via a template, due to an illegal promotion exploit (* in a {{property}} of the session context)', function(done) {
        testClient.on(
          '/forbidden/*',
          function(data) {
            done(new Error('unexpected access granted'));
          },
          function(e) {
            if (!e) return done(new Error('unexpected access granted'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            testClient.set('/forbidden/1', 1, function(e) {
              if (!e) return done(new Error('unexpected access granted'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              expect(warnings[0]).to.be(
                'illegal promotion of permissions via permissions template, permissionPath/forbidden/{{user.custom_data.custom_field_forbidden}}, replaced path: /forbidden/*'
              );
              done();
            });
          }
        );
      });

      it('changes a custom property on the user - which should update the session, checks we are no longer able to access the path the permission relates to, but are able to access based on the new property', function(done) {
        testUser.custom_data.custom_field2 = 'custom_field2_changed';
        serviceInstance.services.security.users.upsertUser(testUser, function(e, upserted) {
          if (e) return done(e);
          testClient.on(
            '/custom/custom_field2_changed',
            function(data) {
              expect(data.test).to.be('data');
              testClient.set(
                '/custom/custom_field2_value',
                {
                  test: 'data'
                },
                function(e) {
                  expect(e.toString()).to.be('AccessDenied: unauthorized');
                  done();
                }
              );
            },
            function(e) {
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
            serviceInstance.services.security.users.upsertUser(testUser, function(e, upserted) {
              if (e) return done(e);
              testClient.set(
                '/custom/custom_field1_value',
                {
                  test: 'data'
                },
                function(e) {
                  expect(e.toString()).to.be('AccessDenied: unauthorized');
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
          function(data) {
            receivedCount++;
            if (receivedCount == 2) return;
            testUser.custom_data.custom_field3 = 'custom_field3_changed';
            serviceInstance.services.security.users.upsertUser(testUser, function(e, upserted) {
              if (e) return done(e);
              adminClient.set(
                '/custom/custom_field3_value',
                {
                  test: 'data'
                },
                function(e) {
                  if (e) return done(e);
                  setTimeout(function() {
                    expect(receivedCount).to.be(1);
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
          function(data) {
            receivedCount++;
            if (receivedCount == 2) return;
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
                      expect(receivedCount).to.be(1);
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

      it('compacts the db file', function(done) {
        serviceInstance.services.data.compact(function(e, result) {
          if (e) return done(e);
          done();
        });
      });

      it('removes a templated permission from the group, checks we are no longer able to access the path the permission relates to', function(done) {
        this.timeout(10000);
        var receivedCount = 0;
        testClient.on(
          '/custom/custom_field5_value',
          function(data) {
            serviceInstance.services.security.groups
              .removePermission(testGroup.name, '/custom/{{user.custom_data.custom_field5}}', 'set')
              .then(function() {
                testClient.set(
                  '/custom/custom_field5_value',
                  {
                    test: 'data'
                  },
                  function(e) {
                    expect(e.toString()).to.be('AccessDenied: unauthorized');
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
  }
);
