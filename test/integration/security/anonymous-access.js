const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  const request = require('request');
  const happn = require('../../../lib/index');
  let serviceInstance, serviceInstanceAnonymous;
  let adminClient;
  const expect = require('expect.js');
  const test_id = Date.now() + '_' + require('shortid').generate();
  const filename = test.path.resolve(__dirname, `../../test-temp/anonymous-access-${test_id}.db`);
  let anonymousClient;
  let anonymousClientWS;
  let addedAnonymousGroup;

  this.timeout(60000);

  before('it starts secure service, with anonymous access switched on', async () => {
    test.log(`test file name: ${filename}`);
    serviceInstanceAnonymous = await getService({
      secure: true,
      services: {
        security: {
          config: {
            allowAnonymousAccess: true
          }
        }
      }
    });
    serviceInstance = await getService({
      port: 55001,
      secure: true
    });

    adminClient = await getClient({
      username: '_ADMIN',
      password: 'happn'
    });
  });

  after('stop the services', async () => {
    this.timeout(15000);
    if (anonymousClient)
      await anonymousClient.disconnect({
        reconnect: false
      });
    if (anonymousClientWS)
      await anonymousClientWS.disconnect({
        reconnect: false
      });
    if (adminClient)
      await adminClient.disconnect({
        reconnect: false
      });
    serviceInstance.stop();
    serviceInstanceAnonymous.stop();
  });

  context('login', function() {
    it('authenticates with the anonymous user', async () => {
      anonymousClient = await serviceInstanceAnonymous.services.session.localClient({
        username: '_ANONYMOUS'
      });
    });

    it('fails to authenticate with the anonymous user', async () => {
      let message;
      try {
        await serviceInstance.services.session.localClient({
          username: '_ANONYMOUS'
        });
      } catch (e) {
        message = e.message;
      }
      test.expect(message).to.be('Anonymous access is disabled');
    });

    it('authenticates with the anonymous user - websocket', async () => {
      anonymousClientWS = await getClient({
        username: '_ANONYMOUS'
      });
    });

    it('fails to authenticate with the anonymous user - websocket', async () => {
      let message;
      try {
        await getClient({
          config: {
            username: '_ANONYMOUS',
            port: 55001
          }
        });
      } catch (e) {
        message = e.message;
      }
      test.expect(message).to.be('Anonymous access is disabled');
    });
  });

  context('user creation and updates', function() {
    it('fails to add anonymous user', async () => {
      let message;
      try {
        await serviceInstance.services.security.users.upsertUser({
          username: '_ANONYMOUS',
          password: 'anonymous'
        });
      } catch (e) {
        message = e.message;
      }
      test.expect(message).to.be('validation failure: username cannot be reserved name _ANONYMOUS');
    });

    it('fails to add anonymous user - anonymous access not configured', async () => {
      let message;
      try {
        await serviceInstanceAnonymous.services.security.users.upsertUser({
          username: '_ANONYMOUS',
          password: 'anonymous'
        });
      } catch (e) {
        message = e.message;
      }
      test.expect(message).to.be('validation failure: username cannot be reserved name _ANONYMOUS');
    });
  });

  context('resources access testing', function() {
    before('creates and links an anonymous group to the anonymous user successfully', async () => {
      await createAndLinkAnonymousGroup(serviceInstanceAnonymous);
    });

    before(
      'creates and links an anonymous group to the anonymous user unsuccessfully',
      async () => {
        let message;
        try {
          await createAndLinkAnonymousGroup(serviceInstance);
        } catch (e) {
          message = e.message;
        }
        test.expect(message).to.be('Anonymous access is not configured');
      }
    );

    it('checks allowed on, and prevented from on', function(done) {
      anonymousClientWS.on(
        '/anonymous/' + test_id + '/on',
        {},
        function() {},
        function(e) {
          if (e) return done(e);

          anonymousClientWS.on(
            '/anonymous/dodge/' + test_id + '/on',
            {},
            function() {},
            function(e) {
              if (!e)
                return done(
                  new Error(
                    'you managed to subscribe, which should be impossible based on your permissions'
                  )
                );

              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('delegated authority: checks allowed on, and prevented from on', function(done) {
      adminClient.on(
        '/anonymous/' + test_id + '/on',
        {
          onBehalfOf: anonymousClientWS.session.user.username
        },
        function() {},
        function(e) {
          if (e) return done(e);

          adminClient.on(
            '/anonymous/dodge/' + test_id + '/on',
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function() {},
            function(e) {
              if (!e)
                return done(
                  new Error(
                    'you managed to subscribe, which should be impossible based on your permissions'
                  )
                );

              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('checks allowed set, and prevented from set', function(done) {
      anonymousClientWS.set('/anonymous/' + test_id + '/set', {}, function(e, result) {
        if (e) return done(e);

        expect(result._meta.path).to.be('/anonymous/' + test_id + '/set');

        anonymousClientWS.set(
          '/anonymous/dodge/' + test_id + '/set',
          {
            test: 'test'
          },
          {},
          function(e) {
            if (!e)
              return done(new Error('you just set data that you shouldnt have permissions to set'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();
          }
        );
      });
    });

    it('delegated authority: checks allowed set, and prevented from set', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/set',
        {},
        {
          onBehalfOf: anonymousClientWS.session.user.username
        },
        function(e, result) {
          if (e) return done(e);

          expect(result._meta.path).to.be('/anonymous/' + test_id + '/set');

          adminClient.set(
            '/anonymous/dodge/' + test_id + '/set',
            {
              test: 'test'
            },
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e) {
              if (!e)
                return done(
                  new Error('you just set data that you shouldnt have permissions to set')
                );
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('delegated authority: checks prevented from getPaths', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/getPaths/1',
        {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        },
        null,
        function(e) {
          expect(e == null).to.be(true);
          adminClient.set(
            '/anonymous/' + test_id + '/getPaths/2',
            {
              property1: 'property1',
              property2: 'property2',
              property3: 'property3'
            },
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e) {
              if (!e)
                return done(
                  new Error('you just set data that you shouldnt have permissions to set')
                );
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('delegated authority: checks prevented from increment', function(done) {
      adminClient.increment(
        '/anonymous/' + test_id + '/increment',
        'counter',
        1,
        {
          onBehalfOf: anonymousClientWS.session.user.username
        },
        function(e) {
          if (!e)
            return done(new Error('you just set data that you shouldnt have permissions to set'));
          expect(e.toString()).to.be('AccessDenied: unauthorized');
          done();
        }
      );
    });

    it('checks allowed get, and prevented from get', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/get',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);

          anonymousClientWS.get('/anonymous/' + test_id + '/get', {}, function(e, result) {
            if (e) return done(e);
            expect(result._meta.path).to.be('/anonymous/' + test_id + '/get');

            anonymousClientWS.get('/anonymous/dodge/' + test_id + '/get', {}, function(e) {
              if (!e)
                return done(
                  new Error('you managed to get data which you do not have permissions for')
                );
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            });
          });
        }
      );
    });

    it('delegated authority: checks allowed get, and prevented from get', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/get',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);

          adminClient.get(
            '/anonymous/' + test_id + '/get',
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e, result) {
              if (e) return done(e);
              expect(result._meta.path).to.be('/anonymous/' + test_id + '/get');

              adminClient.get(
                '/anonymous/dodge/' + test_id + '/get',
                {
                  onBehalfOf: anonymousClientWS.session.user.username
                },
                function(e) {
                  if (!e)
                    return done(
                      new Error('you managed to get data which you do not have permissions for')
                    );
                  expect(e.toString()).to.be('AccessDenied: unauthorized');
                  done();
                }
              );
            }
          );
        }
      );
    });

    it('checks allowed count, and prevented from count', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/count',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);

          anonymousClientWS.count('/anonymous/' + test_id + '/count', {}, function(e, result) {
            if (e) return done(e);
            expect(result.value).to.be(1);

            anonymousClientWS.get('/anonymous/dodge/' + test_id + '/count', {}, function(e) {
              if (!e)
                return done(
                  new Error('you managed to get data which you do not have permissions for')
                );
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            });
          });
        }
      );
    });

    it('checks allowed get but not set', function(done) {
      anonymousClientWS.get('/anonymous/' + test_id + '/get', {}, function(e, result) {
        if (e) return done(e);
        expect(result._meta.path).to.be('/anonymous/' + test_id + '/get');

        anonymousClientWS.set(
          '/anonymous/' + test_id + '/get',
          {
            test: 'test'
          },
          {},
          function(e) {
            if (!e)
              return done(new Error('you just set data that you shouldnt have permissions to set'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();
          }
        );
      });
    });

    it('delegated authority: checks allowed get but not set', function(done) {
      adminClient.get(
        '/anonymous/' + test_id + '/get',
        {
          onBehalfOf: anonymousClientWS.session.user.username
        },
        function(e, result) {
          if (e) return done(e);
          expect(result._meta.path).to.be('/anonymous/' + test_id + '/get');

          adminClient.set(
            '/anonymous/' + test_id + '/get',
            {
              test: 'test'
            },
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e) {
              if (!e)
                return done(
                  new Error('you just set data that you shouldnt have permissions to set')
                );
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('checks allowed get and on but not set', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/get_on',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          anonymousClientWS.get('/anonymous/' + test_id + '/comp/get_on', {}, function(e, result) {
            if (e) return done(e);
            expect(result._meta.path).to.be('/anonymous/' + test_id + '/comp/get_on');

            anonymousClientWS.on(
              '/anonymous/' + test_id + '/comp/get_on',
              {},
              function() {},
              function(e) {
                if (e) return done(e);

                anonymousClientWS.set(
                  '/anonymous/' + test_id + '/comp/get_on',
                  {
                    test: 'test'
                  },
                  {},
                  function(e) {
                    if (!e)
                      return done(
                        new Error('you just set data that you shouldnt have permissions to set')
                      );
                    expect(e.toString()).to.be('AccessDenied: unauthorized');
                    done();
                  }
                );
              }
            );
          });
        }
      );
    });

    it('delegated authority: checks allowed get and on but not set', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/get_on',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          adminClient.get(
            '/anonymous/' + test_id + '/comp/get_on',
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e, result) {
              if (e) return done(e);
              expect(result._meta.path).to.be('/anonymous/' + test_id + '/comp/get_on');

              adminClient.on(
                '/anonymous/' + test_id + '/comp/get_on',
                {
                  onBehalfOf: anonymousClientWS.session.user.username
                },
                function() {},
                function(e) {
                  if (e) return done(e);

                  adminClient.set(
                    '/anonymous/' + test_id + '/comp/get_on',
                    {
                      test: 'test'
                    },
                    {
                      onBehalfOf: anonymousClientWS.session.user.username
                    },
                    function(e) {
                      if (!e)
                        return done(
                          new Error('you just set data that you shouldnt have permissions to set')
                        );
                      expect(e.toString()).to.be('AccessDenied: unauthorized');
                      done();
                    }
                  );
                }
              );
            }
          );
        }
      );
    });

    it('checks allowed get but not on', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/get_not_on',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          anonymousClientWS.get('/anonymous/' + test_id + '/comp/get_not_on', {}, function(
            e,
            result
          ) {
            if (e) return done(e);
            expect(result._meta.path).to.be('/anonymous/' + test_id + '/comp/get_not_on');

            anonymousClientWS.on(
              '/anonymous/' + test_id + '/comp/get_not_on',
              {},
              function() {},
              function(e) {
                if (!e) return done(new Error('this should not have been allowed...'));
                expect(e.toString()).to.be('AccessDenied: unauthorized');
                done();
              }
            );
          });
        }
      );
    });

    it('delegated authority: checks allowed get but not on', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/get_not_on',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          adminClient.get(
            '/anonymous/' + test_id + '/comp/get_not_on',
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e, result) {
              if (e) return done(e);
              expect(result._meta.path).to.be('/anonymous/' + test_id + '/comp/get_not_on');

              adminClient.on(
                '/anonymous/' + test_id + '/comp/get_not_on',
                {
                  onBehalfOf: anonymousClientWS.session.user.username
                },
                function() {},
                function(e) {
                  if (!e) return done(new Error('this should not have been allowed...'));
                  expect(e.toString()).to.be('AccessDenied: unauthorized');
                  done();
                }
              );
            }
          );
        }
      );
    });

    it('checks allowed on but not get', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/on_not_get',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          anonymousClientWS.get('/anonymous/' + test_id + '/comp/on_not_get', {}, function(e) {
            if (!e) return done(new Error('this should not have been allowed...'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');

            anonymousClientWS.on(
              '/anonymous/' + test_id + '/comp/on_not_get',
              {},
              function() {},
              done
            );
          });
        }
      );
    });

    it('delegated authority: checks allowed on but not get', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/on_not_get',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          adminClient.get(
            '/anonymous/' + test_id + '/comp/on_not_get',
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e) {
              if (!e) return done(new Error('this should not have been allowed...'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');

              adminClient.on(
                '/anonymous/' + test_id + '/comp/on_not_get',
                {
                  onBehalfOf: anonymousClientWS.session.user.username
                },
                function() {},
                done
              );
            }
          );
        }
      );
    });

    it('checks allowed set but not get', function(done) {
      anonymousClientWS.set(
        '/anonymous/' + test_id + '/comp/set_not_get',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          anonymousClientWS.get('/anonymous/' + test_id + '/comp/set_not_get', {}, function(e) {
            if (!e) return done(new Error('this should not have been allowed...'));
            expect(e.toString()).to.be('AccessDenied: unauthorized');
            done();
          });
        }
      );
    });

    it('delegated authority: checks allowed set but not get', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/set_not_get',
        {
          'test-set': 'test-set-val'
        },
        {
          onBehalfOf: anonymousClientWS.session.user.username
        },
        function(e) {
          if (e) return done(e);
          adminClient.get(
            '/anonymous/' + test_id + '/comp/set_not_get',
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function(e) {
              if (!e) return done(new Error('this should not have been allowed...'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('checks allowed set but not on', function(done) {
      anonymousClientWS.set(
        '/anonymous/' + test_id + '/comp/set_not_on',
        {
          'test-set': 'test-set-val'
        },
        {},
        function(e) {
          if (e) return done(e);
          anonymousClientWS.on(
            '/anonymous/' + test_id + '/comp/set_not_on',
            {},
            function() {},
            function(e) {
              if (!e) return done(new Error('this should not have been allowed...'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('delegated authority: checks allowed set but not on', function(done) {
      adminClient.set(
        '/anonymous/' + test_id + '/comp/set_not_on',
        {
          'test-set': 'test-set-val'
        },
        {
          onBehalfOf: anonymousClientWS.session.user.username
        },
        function(e) {
          if (e) return done(e);
          anonymousClientWS.on(
            '/anonymous/' + test_id + '/comp/set_not_on',
            {
              onBehalfOf: anonymousClientWS.session.user.username
            },
            function() {},
            function(e) {
              if (!e) return done(new Error('this should not have been allowed...'));
              expect(e.toString()).to.be('AccessDenied: unauthorized');
              done();
            }
          );
        }
      );
    });

    it('checks allowed get all', function(done) {
      anonymousClientWS.get('/anonymous/' + test_id + '/get_all/' + test_id, {}, done);
    });

    it('checks allowed on all', function(done) {
      anonymousClientWS.on('/anonymous/' + test_id + '/on_all/' + test_id, {}, function() {}, done);
    });

    it('checks allowed set all', function(done) {
      anonymousClientWS.set(
        '/anonymous/' + test_id + '/set_all/' + test_id,
        {
          'test-set': 'test-set-val'
        },
        {},
        done
      );
    });

    it('checks against a permission that doesnt exist', function(done) {
      anonymousClientWS.get('/anonymous/whatevs' + test_id + '/get_all/' + test_id, {}, function(
        e
      ) {
        if (!e) return done(new Error('this should not have been allowed...'));
        expect(e.toString()).to.be('AccessDenied: unauthorized');
        done();
      });
    });

    it('unlinks the test group from the user, checks that the user no longer has access', async () => {
      this.timeout(5000);
      await serviceInstanceAnonymous.services.security.unlinkAnonymousGroup(addedAnonymousGroup);
      let message;
      try {
        await anonymousClientWS.set('/anonymous/' + test_id + '/set', {
          test: 'data'
        });
      } catch (e) {
        message = e.message;
      }
      test.expect(message).to.be('unauthorized');
    });

    it('re-links the test group to the test user, tests we have access again', async () => {
      this.timeout(5000);
      await serviceInstanceAnonymous.services.security.linkAnonymousGroup(addedAnonymousGroup);
      await anonymousClientWS.set('/anonymous/' + test_id + '/set', {
        test: 'data'
      });
    });

    it('tests the remove permission', function(done) {
      this.timeout(5000);
      anonymousClientWS.set(
        '/anonymous/' + test_id + '/remove-permission',
        {
          test: 'data'
        },
        function(e) {
          if (e) return done(e);

          //groupName, path, action
          serviceInstanceAnonymous.services.security.groups
            .removePermission(
              addedAnonymousGroup.name,
              '/anonymous/' + test_id + '/remove-permission',
              'set'
            )
            .then(() => {
              return new Promise(resolve => {
                setTimeout(resolve, 2000);
              });
            })
            .then(function() {
              anonymousClientWS.set(
                '/anonymous/' + test_id + '/remove-permission',
                {
                  test: 'data'
                },
                function(e) {
                  expect(e.toString()).to.be('AccessDenied: unauthorized');
                  done();
                }
              );
            })
            .catch(done);
        }
      );
    });

    it('tests the upsert permission', function(done) {
      serviceInstanceAnonymous.services.security.groups
        .upsertPermission(
          addedAnonymousGroup.name,
          '/anonymous/' + test_id + '/remove-permission',
          'set'
        )
        .then(function() {
          anonymousClientWS.set(
            '/anonymous/' + test_id + '/remove-permission',
            {
              test: 'data'
            },
            done
          );
        })
        .catch(done);
    });

    it('tests the prohibit permission', function(done) {
      var prohibitPath = '/anonymous/' + test_id + '/prohibit-permission';

      anonymousClientWS.set(
        prohibitPath,
        {
          test: 'data'
        },
        function(e) {
          if (e) return done(e);

          delete addedAnonymousGroup.permissions[prohibitPath].actions;
          addedAnonymousGroup.permissions[prohibitPath].prohibit = ['set'];

          //groupName, path, action
          serviceInstanceAnonymous.services.security.groups
            .upsertGroup(addedAnonymousGroup)
            .then(function() {
              anonymousClientWS.set(
                prohibitPath,
                {
                  test: 'data'
                },
                function(e) {
                  expect(e.toString()).to.be('AccessDenied: unauthorized');
                  done();
                }
              );
            })
            .catch(done);
        }
      );
    });

    it('cannot delete anonymous user', function(done) {
      serviceInstanceAnonymous.services.security.users.deleteUser(
        { username: '_ANONYMOUS' },
        function(e) {
          if (!e) return done(new Error('not meant to happen'));
          test
            .expect(e.message)
            .to.be('unable to delete a user with the reserved name: _ANONYMOUS');
          done();
        }
      );
    });
  });

  function getClient(config) {
    return happn.client.create(config);
  }

  function getService(config) {
    return new Promise((resolve, reject) => {
      happn.service.create(config, (e, instance) => {
        if (e) return reject(e);
        resolve(instance);
      });
    });
  }

  // eslint-disable-next-line no-unused-vars
  function doRequest(path, token) {
    return new Promise((resolve, reject) => {
      let options = {
        url: 'http://127.0.0.1:55000' + path
      };
      options.headers = {
        Cookie: ['happn_token=' + token]
      };
      request(options, function(error, response) {
        if (error) return reject(error);
        resolve(response);
      });
    });
  }
  async function createAndLinkAnonymousGroup(serviceInst) {
    const anonymousGroup = {
      name: 'ANONYMOUS'
    };

    anonymousGroup.permissions = {};

    anonymousGroup.permissions['/anonymous/' + test_id + '/all_access'] = {
      actions: ['*']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/on'] = {
      actions: ['on']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/on_all/*'] = {
      actions: ['on']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/remove'] = {
      actions: ['remove']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/remove_all/*'] = {
      actions: ['remove']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/get'] = {
      actions: ['get']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/get_all/*'] = {
      actions: ['get']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/set'] = {
      actions: ['set']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/set_all/*'] = {
      actions: ['set']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/all/*'] = {
      actions: ['*']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/comp/get_on'] = {
      actions: ['get', 'on']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/comp/get_not_on'] = {
      actions: ['get']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/comp/on_not_get'] = {
      actions: ['on']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/comp/set_not_get'] = {
      actions: ['set']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/comp/set_not_on'] = {
      actions: ['set']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/remove-permission'] = {
      actions: ['set']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/prohibit-permission'] = {
      actions: ['set']
    };
    anonymousGroup.permissions['/anonymous/' + test_id + '/web_access'] = {
      actions: ['*']
    };
    addedAnonymousGroup = await serviceInst.services.security.groups.upsertGroup(anonymousGroup, {
      overwrite: false
    });
    await test.delay(3000);
    await serviceInst.services.security.linkAnonymousGroup(addedAnonymousGroup);
  }
});
