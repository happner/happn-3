const tests = require('../../__fixtures/utils/test_helper').create(),
  ChildProcess = require('child_process'),
  path = require('path');
describe(tests.testName(__filename, 3), function() {
  this.timeout(30000);
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happnInstance1 = null;
  var serviceConfig1 = {
    secure: true,
    encryptPayloads: true,
    services: {
      security: {
        config: {
          accountLockout: {
            enabled: true,
            attempts: 3,
            retryInterval: 20000
          },
          disableDefaultAdminNetworkConnections: true,
          sessionTokenSecret: 'h1_test-secret',
          keyPair: {
            privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          },
          profiles: [
            //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
            {
              name: 'token-not-allowed',
              session: {
                $and: [
                  {
                    user: {
                      username: {
                        $eq: 'TOKEN-NOT-ALLOWED'
                      }
                    },
                    info: {
                      tokenNotAllowedForLogin: {
                        $eq: true
                      }
                    }
                  }
                ]
              },
              policy: {
                disallowTokenLogins: true
              }
            },
            {
              name: 'short-session',
              session: {
                $and: [
                  {
                    user: {
                      username: {
                        $eq: 'SHORT-SESSION'
                      }
                    },
                    info: {
                      shortSession: {
                        $eq: true
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
              name: 'browser-session',
              session: {
                $and: [
                  {
                    user: {
                      username: {
                        $eq: 'BROWSER-SESSION'
                      }
                    },
                    info: {
                      _browser: {
                        $eq: true
                      }
                    }
                  }
                ]
              },
              policy: {
                ttl: '7 days'
              }
            },
            {
              name: 'locked-session',
              session: {
                $and: [
                  {
                    user: {
                      username: {
                        $eq: 'LOCKED-SESSION'
                      }
                    },
                    info: {
                      tokenOriginLocked: {
                        $eq: true
                      }
                    }
                  }
                ]
              },
              policy: {
                ttl: 0, // no ttl
                lockTokenToOrigin: true
              }
            },
            {
              name: 'node-session',
              session: {
                $and: [
                  {
                    user: {
                      username: {
                        $eq: 'NODE-SESSION'
                      }
                    },
                    _browser: false
                  }
                ]
              },
              policy: {
                ttl: 0 // no ttl
              }
            },
            {
              name: 'source IP whitelist',
              session: {
                $and: [
                  {
                    user: {
                      username: {
                        $eq: 'TEST-ALLOWED-IP'
                      }
                    }
                  }
                ]
              },
              policy: {
                sourceIPWhitelist: [
                  '127.0.0.1',
                  'localhost',
                  '::ffff:127.0.0.1',
                  '::ffff:localhost'
                ]
              }
            },
            {
              name: 'source IP whitelist fail',
              session: {
                $and: [
                  {
                    user: {
                      username: {
                        $eq: 'TEST-NOT-ALLOWED-IP'
                      }
                    }
                  }
                ]
              },
              policy: {
                sourceIPWhitelist: ['240.0.0.1', '::ffff:240.0.0.1']
              }
            }
          ]
        }
      }
    }
  };

  before('should initialize the service', function(callback) {
    this.timeout(20000);

    try {
      service.create(serviceConfig1, function(e, happnInst1) {
        if (e) return callback(e);

        happnInstance1 = happnInst1;

        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  after(function(done) {
    if (happnInstance1)
      happnInstance1
        .stop()
        .then(done)
        .catch(done);
    else done();
  });

  it('tests the default browser profile', function(done) {
    var session = {
      info: {
        _browser: true
      }
    };

    happnInstance1.services.security.__profileSession(session);

    tests.expect(session.policy[0].ttl).to.be(7 * 24 * 60 * 60 * 1000); // 7 days

    tests.expect(session.policy[0].inactivity_threshold).to.be(60 * 60 * 1000); // 1 hour

    tests.expect(session.policy[1].ttl).to.be(7 * 24 * 60 * 60 * 1000); // 7 days

    tests.expect(session.policy[1].inactivity_threshold).to.be(60 * 60 * 1000); // 1 hour

    done();
  });

  it('tests the default stateful profile', function(done) {
    var session = {
      type: 1
    };

    happnInstance1.services.security.__profileSession(session);

    tests.expect(session.policy[1].ttl).to.be(0); // never

    tests.expect(session.policy[1].inactivity_threshold).to.be(Infinity); // never

    done();
  });

  it('tests the default stateless profile', function(done) {
    var session = {
      type: 0
    };

    happnInstance1.services.security.__profileSession(session);
    tests.expect(session.policy[1].ttl).to.be(0); // never
    tests.expect(session.policy[1].inactivity_threshold).to.be(Infinity); // never
    done();
  });

  it('tests the source IP whitelist profile, type 0', function(done) {
    var session = {
      type: 0,
      user: {
        username: 'TEST-ALLOWED-IP'
      }
    };
    happnInstance1.services.security.__profileSession(session);
    tests
      .expect(session.policy[1].sourceIPWhitelist)
      .to.eql(['127.0.0.1', 'localhost', '::ffff:127.0.0.1', '::ffff:localhost']); // never
    done();
  });

  it('tests the source IP whitelist profile, type 1', function(done) {
    var session = {
      type: 1,
      user: {
        username: 'TEST-ALLOWED-IP'
      }
    };
    happnInstance1.services.security.__profileSession(session);
    tests
      .expect(session.policy[1].sourceIPWhitelist)
      .to.eql(['127.0.0.1', 'localhost', '::ffff:127.0.0.1', '::ffff:localhost']); // never
    done();
  });

  it('tests the source IP whitelist profile - with an actual session', async () => {
    const userAllowed = await createUser('TEST-ALLOWED-IP');
    const userNotAllowed = await createUser('TEST-NOT-ALLOWED-IP');
    tests.expect(await loginWithUser(userAllowed)).to.be('OK');
    tests.expect(await loginWithUser(userNotAllowed)).to.be('Source address access restricted');
    tests.expect(await postLoginWithUser(userAllowed)).to.be('OK');
    tests.expect(await postLoginWithUser(userNotAllowed)).to.be('Source address access restricted');
  });

  it('tests we dont lockout an account that is ip restricted', async () => {
    const userNotAllowed = await createUser('TEST-NOT-ALLOWED-IP');
    for (var i = 0; i < 10; i++) {
      tests.expect(await loginWithUser(userNotAllowed)).to.be('Source address access restricted');
      tests
        .expect(await postLoginWithUser(userNotAllowed))
        .to.be('Source address access restricted');
    }
    const userLock = await checkLocks(userNotAllowed.username);
    tests.expect(userLock == null).to.be(true);
  });

  it('tests non local sessions are prevented for the _ADMIN user', async () => {
    tests
      .expect(await loginWithUser({ username: '_ADMIN', password: 'happn' }))
      .to.be('use of _ADMIN credentials over the network is disabled');
    tests
      .expect(await postLoginWithUser({ username: '_ADMIN', password: 'happn' }))
      .to.be('use of _ADMIN credentials over the network is disabled');
  });

  it('tests the source IP whitelist profile - with an actual session - proxied', async () => {
    const proxy = await startProxyService();
    const userAllowed = await createUser('TEST-ALLOWED-IP');
    const userNotAllowed = await createUser('TEST-NOT-ALLOWED-IP');
    tests.expect(await loginWithUser(userAllowed, 11235)).to.be('OK');
    tests
      .expect(await loginWithUser(userNotAllowed, 11235))
      .to.be('Source address access restricted');
    tests.expect(await postLoginWithUser(userAllowed, null, 11235)).to.be('OK');
    tests
      .expect(await postLoginWithUser(userNotAllowed, null, 11235))
      .to.be('Source address access restricted');
    proxy.kill();
  });

  it('tests non local sessions are prevented for the _ADMIN user - proxied', async () => {
    const proxy = await startProxyService();
    tests
      .expect(await loginWithUser({ username: '_ADMIN', password: 'happn' }, 11235))
      .to.be('use of _ADMIN credentials over the network is disabled');
    tests
      .expect(await postLoginWithUser({ username: '_ADMIN', password: 'happn' }, null, 11235))
      .to.be('use of _ADMIN credentials over the network is disabled');
    proxy.kill();
  });

  function checkLocks(username) {
    return new Promise((resolve, reject) => {
      happnInstance1.services.security.__locks.get(username, function(e, lock) {
        if (e) reject(e);
        resolve(lock);
      });
    });
  }

  async function startProxyService() {
    let proxyPath = path.resolve(__dirname, '../../__fixtures/node-proxy/proxy.js');
    let proxyProc = ChildProcess.fork(proxyPath, []);
    await tests.delay(2e3);
    return proxyProc;
  }

  async function createUser(username) {
    return await happnInstance1.services.security.users.upsertUser({
      username,
      password: 'happn'
    });
  }

  async function loginWithUser(user, port) {
    let clientInstance;
    try {
      clientInstance = await happn.client.create({
        username: user.username,
        password: 'happn',
        port: port || 55000
      });
    } catch (e) {
      return e.message;
    }
    await clientInstance.disconnect();
    return 'OK';
  }

  function doRequest(path, token, query, callback, excludeToken, port) {
    var request = require('request');

    var options = {
      url: `http://127.0.0.1:${port || 55000}${path}`
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

  async function postLoginWithUser(user, expectedStatus, port) {
    return new Promise(resolve => {
      doRequest(
        `/auth/login?username=${user.username}&password=happn`,
        null,
        true,
        function(response) {
          if (response.statusCode === 200) return resolve('OK');
          tests.expect(response.statusCode).to.be(expectedStatus || 401);
          resolve(JSON.parse(response.body).error.message);
        },
        true,
        port
      );
    });
  }
});
