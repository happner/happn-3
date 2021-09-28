const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  const CONSTANTS = require('../../../lib/constants');
  const happn = require('../../../lib/index');
  const service = happn.service;

  let serviceInstance = null;
  const testId = Date.now() + '_' + require('shortid').generate();
  var currentClient;

  this.timeout(20000);

  let serviceConfig = {
    secure: true
  };
  let testGroup;

  before('should initialize the service', async () => {
    serviceInstance = await service.create(serviceConfig);
  });

  let createdCounter = 0;
  let addedTestGroup;
  let addedTestuser;

  function createTestClient(callback) {
    testGroup = {
      name: 'TEST GROUP' + testId,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup.permissions = {};

    testGroup.permissions['/security_directory_changed/' + testId + '/testsubscribe/data/all/*'] = {
      actions: ['*']
    };
    testGroup.permissions[
      '/security_directory_changed/' + testId + '/testsubscribe/data/remove/*'
    ] = {
      actions: ['remove', 'set', 'on']
    };
    testGroup.permissions['/security_directory_changed/' + testId + '/testsubscribe/data/get/2'] = {
      actions: ['get', 'set']
    };
    testGroup.permissions['/security_directory_changed/' + testId + '/testsubscribe/data/set/*'] = {
      actions: ['set']
    };
    testGroup.permissions['/security_directory_changed/' + testId + '/on/1'] = {
      actions: ['on']
    };
    testGroup.permissions['/security_directory_changed/' + testId + '/on/2'] = {
      actions: ['on']
    };
    testGroup.permissions['/security_directory_changed/' + testId + '/on/*'] = {
      actions: ['set']
    };

    var testUser = {
      username: 'TEST USER@blah.com' + createdCounter++,
      password: 'TEST PWD'
    };

    serviceInstance.services.security.users.upsertGroup(
      testGroup,
      {
        overwrite: true
      },
      function(e, result) {
        if (e) return callback(e);
        addedTestGroup = result;

        serviceInstance.services.security.users.upsertUser(
          testUser,
          {
            overwrite: false
          },
          function(e, result) {
            if (e) return callback(e);
            addedTestuser = result;

            serviceInstance.services.security.users.linkGroup(
              addedTestGroup,
              addedTestuser,
              function(e) {
                if (e) return callback(e);

                serviceInstance.services.session
                  .localClient({
                    username: testUser.username,
                    password: 'TEST PWD'
                  })

                  .then(function(clientInstance) {
                    callback(null, clientInstance);
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

  var removeOnPermissionByUpsertingGroup = function(
    permissionPath,
    updateSecurityDirectory,
    callback
  ) {
    if (!updateSecurityDirectory) return callback();

    addedTestGroup.permissions[permissionPath] = { prohibit: ['on'] };

    serviceInstance.services.security.groups.upsertGroup(addedTestGroup, addedTestuser, callback);
  };

  var removeGroup = function(client, updateSecurityDirectory, callback) {
    if (!updateSecurityDirectory) return callback();

    serviceInstance.services.security.groups.unlinkGroup(addedTestGroup, addedTestuser, callback);
  };

  var removePermission = function(permissionPath, updateSecurityDirectory, callback) {
    if (!updateSecurityDirectory) return callback();

    serviceInstance.services.security.groups
      .removePermission(addedTestGroup.name, permissionPath)
      .then(function() {
        callback();
      })
      .catch(callback);
  };

  var doOperations = function(client, options, callback) {
    var listenerId1;
    var listenerId2;

    //first listen for the change
    client.on(
      '/security_directory_changed/' + testId + '/testsubscribe/data/remove/*',
      {
        event_type: 'set',
        count: 1
      },
      function() {
        client.on(
          '/security_directory_changed/' + testId + '/testsubscribe/data/all/*',
          {
            event_type: 'set',
            count: 1
          },
          function() {
            client.off(listenerId1, function(e) {
              if (e) return callback(e);

              client.off(listenerId2, function(e) {
                if (e) return callback(e);

                client.offPath('/security_directory_changed/*', callback);
              });
            });
          },
          function(e, listenerId) {
            if (!e) {
              listenerId2 = listenerId;
              //then make the change
              client.set(
                '/security_directory_changed/' + testId + '/testsubscribe/data/all/1',
                {
                  property1: 'property1',
                  property2: 'property2',
                  property3: 'property3'
                },
                null,
                function(e) {
                  if (e) return callback(e);
                }
              );
            } else callback(e);
          }
        );
      },
      function(e, listenerId) {
        if (!e) {
          listenerId1 = listenerId;
          //then make the change
          client.set(
            '/security_directory_changed/' + testId + '/testsubscribe/data/remove/1',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            null,
            function(e) {
              if (e) return callback(e);
            }
          );
        } else callback(e);
      }
    );
  };

  var doSetOperation = function(client, options, callback) {
    client.set(
      '/security_directory_changed/' + testId + '/testsubscribe/data/set/1',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      options,
      callback
    );
  };

  var doSetOperationsForOn1 = function(client, options, callback) {
    client.set(
      '/security_directory_changed/' + testId + '/on/1',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      options,
      function(e) {
        if (e) return callback(e);

        client.set(
          '/security_directory_changed/' + testId + '/on/1',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          options,
          function(e) {
            if (e) return callback(e);

            client.set(
              '/security_directory_changed/' + testId + '/on/1',
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              options,
              callback
            );
          }
        );
      }
    );
  };

  var doSetOperationsForOn2 = function(client, options, callback) {
    client.set(
      '/security_directory_changed/' + testId + '/on/2',
      {
        property1: 'property1',
        property2: 'property2',
        property3: 'property3'
      },
      options,
      function(e) {
        if (e) return callback(e);

        client.set(
          '/security_directory_changed/' + testId + '/on/2',
          {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          },
          options,
          function(e) {
            if (e) return callback(e);

            client.set(
              '/security_directory_changed/' + testId + '/on/2',
              {
                property1: 'property1',
                property2: 'property2',
                property3: 'property3'
              },
              options,
              callback
            );
          }
        );
      }
    );
  };

  it('should do a bunch of operations, remove the the group from a client, wait a sec and see we are unable to perform operations', function(done) {
    this.timeout(15000);

    var groupUnlinkedChangedData;

    serviceInstance.services.security.on('security-data-changed', function(changed) {
      if (changed.whatHappnd === 'unlink-group') groupUnlinkedChangedData = changed.changedData;
    });

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      doOperations(client, null, function(e) {
        if (e) return done(e);

        removeGroup(client, true, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            doOperations(client, null, function(e) {
              test.expect(e.toString()).to.be('AccessDenied: unauthorized');
              test.expect(groupUnlinkedChangedData).to.eql({
                path:
                  '/_SYSTEM/_SECURITY/_USER/TEST USER@blah.com0/_USER_GROUP/TEST GROUP' + testId,
                permissions: testGroup.permissions
              });

              done();
            });
          }, 300);
        });
      });
    });
  });

  it('should do a set operations, modify the set permission, wait a sec and see we are unable to perform the set operation', function(done) {
    this.timeout(15000);

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      doSetOperation(client, null, function(e) {
        if (e) return done(e);

        removePermission(
          '/security_directory_changed/' + testId + '/testsubscribe/data/set/*',
          true,
          function(e) {
            if (e) return done(e);

            setTimeout(function() {
              doSetOperation(client, null, function(e) {
                test.expect(e.toString()).to.be('AccessDenied: unauthorized');

                done();
              });
            }, 300);
          }
        );
      });
    });
  });

  it('should do a bunch of operations, remove the the group from a client, wait a sec and see we are unable to perform operations, negative test', function(done) {
    this.timeout(15000);

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      doOperations(client, null, function(e) {
        if (e) return done(e);

        removeGroup(client, false, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            doOperations(client, null, done);
          }, 300);
        });
      });
    });
  });

  it('should do a set operations, modify the set permission, wait a sec and see we are unable to perform the set operation, negative test', function(done) {
    this.timeout(15000);

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      doSetOperation(client, null, function(e) {
        if (e) return done(e);

        removePermission(
          '/security_directory_changed/' + testId + '/testsubscribe/data/set/*',
          false,
          function(e) {
            if (e) return done(e);

            setTimeout(function() {
              doSetOperation(client, null, done);
            }, 300);
          }
        );
      });
    });
  });

  it('should do an on, check we receive events, modify the on permission, wait a sec and see we no longer receive the events, also check security service events', function(done) {
    this.timeout(15000);

    var count = 0;

    var securityServiceEventCount = 0;

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      client.on(
        '/security_directory_changed/' + testId + '/on/1',
        function() {
          count++;
        },
        function(e) {
          if (e) return done(e);
        }
      );

      doSetOperationsForOn1(client, null, function(e) {
        if (e) return done(e);

        test.expect(count).to.be(3);

        serviceInstance.services.security.on('security-data-changed', function() {
          securityServiceEventCount++;
        });

        removePermission('/security_directory_changed/' + testId + '/on/1', true, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            doSetOperationsForOn1(client, null, function(e) {
              if (e) return done(e);

              setTimeout(function() {
                //wait in case our events have not caught up
                test.expect(count).to.be(3); //must stay the same
                test.expect(securityServiceEventCount).to.be(1);
                done();
              }, 300);
            });
          }, 300);
        });
      });
    });
  });

  it('should do an on, check we receive events, modify the on permission, wait a sec and see we still have access to events we should', function(done) {
    this.timeout(15000);

    var count = 0;

    var securityServiceEventCount = 0;

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      client.on(
        '/security_directory_changed/' + testId + '/on/2',
        function() {
          count++;
        },
        function(e) {
          if (e) return done(e);
        }
      );

      doSetOperationsForOn2(client, null, function(e) {
        if (e) return done(e);

        test.expect(count).to.be(3);

        serviceInstance.services.security.on('security-data-changed', function() {
          securityServiceEventCount++;
        });

        removePermission('/security_directory_changed/' + testId + '/on/1', true, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            doSetOperationsForOn2(client, null, function(e) {
              if (e) return done(e);

              setTimeout(function() {
                test.expect(count).to.be(6);
                test.expect(securityServiceEventCount).to.be(1);
                done();
              }, 300);
            });
          }, 300);
        });
      });
    });
  });

  it('should do an on, check we receive events, modify the on permission, wait a sec and see we no longer receive the events, also check security service events', function(done) {
    this.timeout(15000);

    var count = 0;

    var securityServiceEventCount = 0;

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      client.on(
        '/security_directory_changed/' + testId + '/on/1',
        function() {
          count++;
        },
        function(e) {
          if (e) return done(e);
        }
      );

      doSetOperationsForOn1(client, null, function(e) {
        if (e) return done(e);

        test.expect(count).to.be(3);

        serviceInstance.services.security.on('security-data-changed', function() {
          securityServiceEventCount++;
        });

        removePermission('/security_directory_changed/' + testId + '/on/1', true, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            doSetOperationsForOn1(client, null, function(e) {
              if (e) return done(e);

              setTimeout(function() {
                //wait in case our events have not caught up
                test.expect(count).to.be(3);
                test.expect(securityServiceEventCount).to.be(1);
                done();
              }, 300);
            });
          }, 300);
        });
      });
    });
  });

  it('should do an on, check we receive events, modify the on permission via a group upsert, wait a sec and see we no longer receive the events, also check security service events', function(done) {
    this.timeout(15000);

    var count = 0;

    var securityServiceEventCount = 0;

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      client.on(
        '/security_directory_changed/' + testId + '/on/1',
        function() {
          count++;
        },
        function(e) {
          if (e) return done(e);
        }
      );

      doSetOperationsForOn1(client, null, function(e) {
        if (e) return done(e);

        test.expect(count).to.be(3);

        serviceInstance.services.security.on('security-data-changed', function() {
          securityServiceEventCount++;
        });

        removeOnPermissionByUpsertingGroup(
          '/security_directory_changed/' + testId + '/on/1',
          true,
          function(e) {
            if (e) return done(e);

            setTimeout(function() {
              doSetOperationsForOn1(client, null, function(e) {
                if (e) return done(e);

                setTimeout(function() {
                  //wait in case our events have not caught up
                  test.expect(count).to.be(3);
                  test.expect(securityServiceEventCount).to.be(1);
                  done();
                }, 300);
              });
            }, 300);
          }
        );
      });
    });
  });

  it('should do an on, check we receive events, modify the on permission via a group upsert, wait a sec and see we no longer receive the events, also check security service events, negative test', function(done) {
    this.timeout(15000);

    var count = 0;

    var securityServiceEventCount = 0;

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      client.on(
        '/security_directory_changed/' + testId + '/on/1',
        function() {
          count++;
        },
        function(e) {
          if (e) return done(e);
        }
      );

      doSetOperationsForOn1(client, null, function(e) {
        if (e) return done(e);

        test.expect(count).to.be(3);

        serviceInstance.services.security.on('security-data-changed', function() {
          securityServiceEventCount++;
        });

        removeOnPermissionByUpsertingGroup(
          '/security_directory_changed/' + testId + '/on/1',
          false,
          function(e) {
            if (e) return done(e);

            setTimeout(function() {
              doSetOperationsForOn1(client, null, function(e) {
                if (e) return done(e);

                setTimeout(function() {
                  //wait in case our events have not caught up
                  test.expect(count).to.be(6);
                  test.expect(securityServiceEventCount).to.be(0);
                  done();
                }, 300);
              });
            }, 300);
          }
        );
      });
    });
  });

  it('should do an on, check we receive events, modify the on permission, wait a sec and see we no longer receive the events, also check security service events, negative test', function(done) {
    this.timeout(15000);

    var count = 0;

    var securityServiceEventCount = 0;

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      client.on(
        '/security_directory_changed/' + testId + '/on/1',
        function() {
          count++;
        },
        function(e) {
          if (e) return done(e);
        }
      );

      doSetOperationsForOn1(client, null, function(e) {
        if (e) return done(e);

        test.expect(count).to.be(3);

        serviceInstance.services.security.on('security-data-changed', function() {
          securityServiceEventCount++;
        });

        removePermission('/security_directory_changed/' + testId + '/on/1', false, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            doSetOperationsForOn1(client, null, function(e) {
              if (e) return done(e);

              setTimeout(function() {
                //wait in case our events have not caught up
                test.expect(count).to.be(6); //must be double, as we had not updated the sd change key in the db
                test.expect(securityServiceEventCount).to.be(0);
                done();
              }, 300);
            });
          }, 300);
        });
      });
    });
  });

  it('should do an on, check we receive events, modify the on permission, wait a sec and see we are now unable to do the .on anymore', function(done) {
    this.timeout(15000);

    var count = 0;

    var securityServiceEventCount = 0;

    createTestClient(function(e, client) {
      if (e) return done(e);

      currentClient = client;

      client.on(
        '/security_directory_changed/' + testId + '/on/2',
        function() {
          count++;
        },
        function(e) {
          if (e) return done(e);
        }
      );

      doSetOperationsForOn2(client, null, function(e) {
        if (e) return done(e);

        test.expect(count).to.be(3);

        client.onSystemMessage(function(key) {
          if (key === 'security-data-changed') securityServiceEventCount++;
        });

        test.expect(Object.keys(client.state.events).length).to.be(1);
        test.expect(Object.keys(client.state.refCount).length).to.be(1);
        test.expect(Object.keys(client.state.listenerRefs).length).to.be(1);

        removePermission('/security_directory_changed/' + testId + '/on/2', true, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            client.on(
              '/security_directory_changed/' + testId + '/on/2',
              function() {},
              function(e) {
                try {
                  test.expect(e).to.not.be(null);
                  test.expect(e.toString()).to.be('AccessDenied: unauthorized');
                  test.expect(securityServiceEventCount).to.be(1);

                  test.expect(Object.keys(client.state.events).length).to.be(0);
                  test.expect(Object.keys(client.state.refCount).length).to.be(0);
                  test.expect(Object.keys(client.state.listenerRefs).length).to.be(0);

                  //console.log('state after:::', JSON.stringify(client.state, null, 2));

                  done();
                } catch (e) {
                  done(e);
                }
              }
            );
          }, 1300);
        });
      });
    });
  });

  it('be able to deal with a user updated scenario where the user has actually been deleted concurrently', async () => {
    currentClient = await require('util').promisify(createTestClient)();
    const oldDisconnectSession = serviceInstance.services.session.disconnectSession.bind(
      serviceInstance.services.session
    );
    // dont disconnect the session, so we are able to match the user session to the UPSERT_USER event
    serviceInstance.services.session.disconnectSession = (_sessionId, callback) => {
      if (callback) callback();
    };
    await serviceInstance.services.security.users.deleteUser({
      username: currentClient.session.user.username
    });
    await test.delay(2000);
    serviceInstance.services.subscription.config.allowNestedPermissions = true;
    await test.nodeUtils
      .promisify(serviceInstance.services.security.__dataChangedInternal)
      .bind(serviceInstance.services.security)(
      CONSTANTS.SECURITY_DIRECTORY_EVENTS.UPSERT_USER,
      {
        username: currentClient.session.user.username
      },
      null
    );
    serviceInstance.services.session.disconnectSession = oldDisconnectSession;
    serviceInstance.services.subscription.config.allowNestedPermissions = false;
  });

  function disconnectClients(options, callback) {
    if (currentClient) {
      currentClient.disconnect(
        {
          timeout: 2000
        },
        callback
      );
    } else callback();
  }

  after(function(done) {
    this.timeout(20000);
    disconnectClients(null, function() {
      serviceInstance.stop(done);
    });
  });
});
