describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var async = require('async');
    var uuid = require('uuid');
    var Logger = require('happn-logger');
    var CheckPoint = require('../../../lib/services/security/checkpoint');
    var Promise = require('bluebird');
    //var log = require('why-is-node-running');

    var serviceConfig = {
      services: {
        security: {
          config: {
            sessionTokenSecret: 'TESTTOKENSECRET',
            keyPair: {
              privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
              publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
            },
            profiles: [
              //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
              {
                name: 'web-session',
                session: {
                  $and: [
                    {
                      user: {
                        username: {
                          $eq: 'WEB_SESSION'
                        }
                      },
                      type: {
                        $eq: 0
                      }
                    }
                  ]
                },
                policy: {
                  ttl: '4 seconds',
                  inactivity_threshold: '2 seconds' //this is costly, as we need to store state on the server side
                }
              },
              {
                name: 'rest-device',
                session: {
                  $and: [
                    {
                      //filter by the security properties of the session - check if this session user belongs to a specific group
                      user: {
                        groups: {
                          REST_DEVICES: {
                            $exists: true
                          }
                        }
                      },
                      type: {
                        $eq: 0
                      } //token stateless
                    }
                  ]
                },
                policy: {
                  ttl: 2000, //stale after 2 seconds
                  inactivity_threshold: '2 days' //stale after 2 days
                }
              },
              {
                name: 'trusted-device',
                session: {
                  $and: [
                    {
                      //filter by the security properties of the session, so user, groups and permissions
                      user: {
                        groups: {
                          TRUSTED_DEVICES: {
                            $exists: true
                          }
                        }
                      },
                      type: {
                        $eq: 1
                      } //stateful connected device
                    }
                  ]
                },
                policy: {
                  ttl: '2 seconds', //stale after 2 seconds
                  permissions: {
                    //permissions that the holder of this token is limited, regardless of the underlying user
                    '/TRUSTED_DEVICES/*': {
                      actions: ['*']
                    }
                  }
                }
              },
              {
                name: 'specific-device',
                session: {
                  $and: [
                    {
                      //instance based mapping, so what kind of session is this?
                      type: {
                        $in: [0, 1]
                      }, //any type of session
                      ip_address: {
                        $eq: '127.0.0.1'
                      }
                    }
                  ]
                },
                policy: {
                  ttl: Infinity, //this device has this access no matter what
                  inactivity_threshold: Infinity,
                  permissions: {
                    //this device has read-only access to a specific item
                    '/SPECIFIC_DEVICE/*': {
                      actions: ['get', 'on']
                    }
                  }
                }
              },
              {
                name: 'non-reusable',
                session: {
                  $and: [
                    {
                      //instance based mapping, so what kind of session is this?
                      user: {
                        groups: {
                          LIMITED_REUSE: {
                            $exists: true
                          }
                        }
                      },
                      type: {
                        $in: [0, 1]
                      } //stateless or stateful
                    }
                  ]
                },
                policy: {
                  usage_limit: 2 //you can only use this session call twice
                }
              },
              {
                name: 'default-stateful', // this is the default underlying profile for stateful sessions
                session: {
                  $and: [
                    {
                      type: {
                        $eq: 1
                      }
                    }
                  ]
                },
                policy: {
                  ttl: Infinity,
                  inactivity_threshold: Infinity
                }
              },
              {
                name: 'default-stateless', // this is the default underlying profile for ws sessions
                session: {
                  $and: [
                    {
                      type: {
                        $eq: 0
                      }
                    }
                  ]
                },
                policy: {
                  ttl: 60000 * 10, //session goes stale after 10 minutes
                  inactivity_threshold: Infinity
                }
              }
            ]
          }
        }
      }
    };

    var getService = function(config, callback) {
      happn.service.create(config, function(e, instance) {
        if (e) return callback(e);
        callback(null, instance);
      });
    };

    var stopService = function(instance, callback) {
      instance.stop(
        {
          reconnect: false
        },
        callback
      );
    };

    var stopServices = function(happnMock, callback) {
      async.eachSeries(
        ['log', 'error', 'utils', 'crypto', 'cache', 'session', 'data', 'security'],
        function(serviceName, eachServiceCB) {
          if (!happnMock.services[serviceName].stop) return eachServiceCB();
          happnMock.services[serviceName].stop(eachServiceCB);
        },
        callback
      );
    };

    var mockServices = function(callback, servicesConfig) {
      var testConfig = {
        secure: true,
        services: {
          cache: {},
          data: {},
          crypto: {},
          security: {}
        }
      };

      var testServices = {};

      testServices.cache = require('../../../lib/services/cache/service');
      testServices.crypto = require('../../../lib/services/crypto/service');
      testServices.data = require('../../../lib/services/data/service');
      testServices.security = require('../../../lib/services/security/service');
      testServices.session = require('../../../lib/services/session/service');
      testServices.utils = require('../../../lib/services/utils/service');
      testServices.error = require('../../../lib/services/error/service');
      testServices.log = require('../../../lib/services/log/service');

      var checkpoint = require('../../../lib/services/security/checkpoint');

      testServices.checkpoint = new checkpoint({
        logger: Logger
      });

      var happnMock = {
        config: {
          services: {
            security: {}
          }
        },
        services: {
          system: {
            package: require('../../../package.json')
          }
        }
      };

      if (servicesConfig) testConfig = servicesConfig;

      async.eachSeries(
        ['log', 'error', 'utils', 'crypto', 'cache', 'session', 'data', 'security'],
        function(serviceName, eachServiceCB) {
          testServices[serviceName] = new testServices[serviceName]({
            logger: Logger
          });

          testServices[serviceName].happn = happnMock;

          happnMock.services[serviceName] = testServices[serviceName];

          if (serviceName === 'error')
            happnMock.services[serviceName].handleFatal = function(message, e) {
              throw e;
            };

          if (serviceName === 'session') {
            happnMock.services[serviceName].config = {};
            return happnMock.services[serviceName].initializeCaches(eachServiceCB);
          }

          if (!happnMock.services[serviceName].initialize) return eachServiceCB();
          else
            testServices[serviceName].initialize(
              testConfig.services[serviceName] || {},
              eachServiceCB
            );
        },
        function(e) {
          if (e) return callback(e);

          callback(null, happnMock);
        }
      );
    };

    // after('after all', function(){
    //   log();
    // });

    it('should test the session filtering capability', function(done) {
      var sift = require('sift').default;

      var testSession = {
        user: {
          username: 'WEB_SESSION'
        },
        type: 0
      };

      var testSessionNotFound = {
        user: {
          username: 'WEB_SESSION'
        },
        type: 1
      };

      var foundItem = sift(serviceConfig.services.security.config.profiles[0].session, [
        testSession
      ]);

      expect(foundItem.length).to.be(1);

      var notFoundItem = sift(serviceConfig.services.security.config.profiles[0].session, [
        testSessionNotFound
      ]);

      expect(notFoundItem.length).to.be(0);

      var foundInGroupItem = sift(serviceConfig.services.security.config.profiles[0].session, [
        testSessionNotFound,
        testSession
      ]);

      expect(foundInGroupItem.length).to.be(1);

      var testSession1 = {
        user: {
          groups: {
            REST_DEVICES: {
              permissions: {}
            }
          }
        },
        type: 0
      };

      var foundItemProfile1 = sift(serviceConfig.services.security.config.profiles[1].session, [
        testSession1
      ]);

      expect(foundItemProfile1.length).to.be(1);

      var testSession2 = {
        user: {
          groups: {
            TRUSTED_DEVICES: {
              permissions: {}
            }
          }
        },
        type: 1
      };

      var foundItemProfile2 = sift(serviceConfig.services.security.config.profiles[2].session, [
        testSession2,
        testSession1
      ]);

      expect(foundItemProfile2.length).to.be(1);

      expect(foundItemProfile2[0].user.groups.TRUSTED_DEVICES).to.not.be(null);
      expect(foundItemProfile2[0].user.groups.TRUSTED_DEVICES).to.not.be(undefined);

      done();
    });

    it('should test the sign and fail to verify function of the crypto service, bad digest', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var Crypto = require('happn-util-crypto');

        var crypto = new Crypto();

        var testKeyPair = crypto.createKeyPair();

        var nonce = crypto.createHashFromString(uuid.v4().toString());

        var verifyResult = happnMock.services.crypto.verify(
          nonce,
          'a dodgy digest',
          testKeyPair.publicKey
        );

        expect(verifyResult).to.be(false);

        stopServices(happnMock, done);
      });
    });

    it('should test the sign and fail to verify function of the crypto service, bad nonce', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var Crypto = require('happn-util-crypto');
        var crypto = new Crypto();

        var testKeyPair = crypto.createKeyPair();

        var nonce = crypto.createHashFromString(uuid.v4().toString());
        var digest = crypto.sign(nonce, testKeyPair.privateKey);

        var verifyResult = happnMock.services.crypto.verify(
          'a dodgy nonce',
          digest,
          testKeyPair.publicKey
        );

        expect(verifyResult).to.be(false);

        stopServices(happnMock, done);
      });
    });

    it('should test the sign and verify function of the crypto service', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var Crypto = require('happn-util-crypto');
        var crypto = new Crypto();

        var testKeyPair = crypto.createKeyPair();

        var nonce = crypto.createHashFromString(uuid.v4().toString());
        var digest = crypto.sign(nonce, testKeyPair.privateKey);

        var verifyResult = happnMock.services.crypto.verify(nonce, digest, testKeyPair.publicKey);

        expect(verifyResult).to.be(true);
        stopServices(happnMock, done);
      });
    });

    it('should test the sign and verify function of the crypto service, from a generated nonce', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var Crypto = require('happn-util-crypto');
        var crypto = new Crypto();

        var testKeyPair = crypto.createKeyPair();

        var nonce = happnMock.services.crypto.generateNonce();
        var digest = crypto.sign(nonce, testKeyPair.privateKey);

        var verifyResult = happnMock.services.crypto.verify(nonce, digest, testKeyPair.publicKey);
        expect(verifyResult).to.be(true);
        stopServices(happnMock, done);
      });
    });

    it('should test the default config settings', function(done) {
      var happn = require('../../../lib/index');
      var happn_client = happn.client;

      var clientInstance = happn_client.__instance({
        username: '_ADMIN',
        keyPair: {
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
        }
      });

      expect(clientInstance.options.publicKey).to.be(
        'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
      );
      expect(clientInstance.options.privateKey).to.be(
        'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
      );

      clientInstance = happn_client.__instance({
        username: '_ADMIN',
        publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
        privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
      });

      expect(clientInstance.options.publicKey).to.be(
        'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
      );
      expect(clientInstance.options.privateKey).to.be(
        'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
      );

      clientInstance = happn_client.__instance({
        username: '_ADMIN',
        password: 'happntest'
      });

      expect(clientInstance.options.username).to.be('_ADMIN');
      expect(clientInstance.options.password).to.be('happntest');

      clientInstance = happn_client.__instance({
        config: {
          username: '_ADMIN',
          password: 'happntest'
        }
      });

      expect(clientInstance.options.username).to.be('_ADMIN');
      expect(clientInstance.options.password).to.be('happntest');

      done();
    });

    it('should test the __prepareLogin method, password', function(done) {
      var happn = require('../../../lib/index');
      var happn_client = happn.client;

      var clientInstance = happn_client.__instance({
        username: '_ADMIN',
        password: 'happnTestPWD'
      });

      clientInstance.serverInfo = {};

      var loginParameters = {
        username: clientInstance.options.username,
        password: 'happnTestPWD'
      };

      clientInstance.performRequest = function(path, action, data, options, cb) {
        cb(new Error('this wasnt meant to happn'));
      };

      //loginParameters, callback
      clientInstance.__prepareLogin(loginParameters, function(e, prepared) {
        if (e) return done(e);

        expect(prepared.username).to.be(clientInstance.options.username);
        expect(prepared.password).to.be('happnTestPWD');

        done();
      });
    });

    it('should test the __prepareLogin method, digest', function(done) {
      var happn = require('../../../lib/index');
      var happn_client = happn.client;

      var Crypto = require('happn-util-crypto');
      var crypto = new Crypto();

      var nonce;

      var clientInstance = happn_client.__instance({
        username: '_ADMIN',
        keyPair: {
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
        }
      });

      clientInstance.serverInfo = {};

      var loginParameters = {
        username: clientInstance.options.username,
        publicKey: clientInstance.options.publicKey,
        loginType: 'digest'
      };

      clientInstance.__performSystemRequest = function(action, data, options, cb) {
        var nonce_requests = {};

        if (!options) options = {};

        if (action === 'request-nonce') {
          nonce = crypto.generateNonce();

          var request = {
            nonce: nonce,
            publicKey: data.publicKey
          };

          nonce_requests[nonce] = request;

          cb(null, {
            nonce: nonce
          });
        }
      };

      clientInstance.__ensureCryptoLibrary(function(e) {
        if (e) return done(e);

        //loginParameters, callback
        clientInstance.__prepareLogin(loginParameters, function(e, prepared) {
          if (e) return done(e);

          var verificationResult = crypto.verify(
            nonce,
            prepared.digest,
            clientInstance.options.publicKey
          );

          expect(verificationResult).to.be(true);

          done();
        });
      });
    });

    it('tests the security services __profileSession method, default profiles', function(done) {
      var session = {
        user: {
          username: 'WEB_SESSION'
        }
      };

      mockServices(function(e, happnMock) {
        if (e) return done(e);

        happnMock.services.security.__profileSession(session);

        expect(session.policy[0].ttl).to.be(0);
        expect(session.policy[1].ttl).to.be(0);

        expect(session.policy[0].inactivity_threshold).to.be(Infinity);
        expect(session.policy[1].inactivity_threshold).to.be(Infinity);

        stopServices(happnMock, done);
      });
    });

    it('tests the security services authorize method', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          type: 0,
          user: {
            username: 'BLAH',
            groups: {}
          },
          policy: {
            1: {
              ttl: 2000
            },
            0: {
              ttl: 4000
            }
          }
        };

        happnMock.services.security.__checkRevocations = function(session, cb) {
          cb(null, true);
        };

        happnMock.services.security.checkpoint._authorizeUser = function(
          session,
          path,
          action,
          callback
        ) {
          callback(null, false);
        };

        happnMock.services.security.authorize(session, null, null, function(e, authorized) {
          if (e) return done(e);
          expect(authorized).to.be(false);
          session.bypassAuthUser = true;
          happnMock.services.security.authorize(session, null, null, function(e, authorized) {
            if (e) return done(e);
            expect(authorized).to.be(true);
            done();
          });
        });
      });
    });

    it('tests the security checkpoints _authorizeSession ttl', function(done) {
      this.timeout(20000);

      var checkpoint = new CheckPoint({
        logger: require('happn-logger')
      });

      var CacheService = require('../../../lib/services/cache/service');
      var cacheInstance = new CacheService();

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      cacheInstance.happn = {
        services: {
          utils: utils
        }
      };

      cacheInstance.initialize({}, function(e) {
        if (e) return done(e);

        var securityService = {
          happn: {
            services: {
              utils: utils
            }
          },
          cacheService: cacheInstance,
          onDataChanged: function() {}
        };

        var testSession = {
          id: 99,
          type: 1,
          timestamp: Date.now(),
          policy: {
            1: {
              ttl: 2000
            },
            0: {
              ttl: 4000
            }
          }
        };

        var SessionService = require('../../../lib/services/session/service');
        var sessionInstance = new SessionService({
          logger: require('happn-logger')
        });

        sessionInstance.happn = {
          services: {
            utils: utils
          }
        };

        checkpoint.happn = {
          services: {
            utils: utils,
            cache: cacheInstance,
            session: sessionInstance
          }
        };

        checkpoint.initialize({}, securityService, function(e) {
          if (e) return done(e);

          checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e) {
            if (e) return done(e);

            setTimeout(function() {
              checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(
                e,
                authorized,
                reason
              ) {
                expect(authorized).to.be(false);
                expect(reason).to.be('expired session token');

                testSession.type = 0;

                //we have a more permissive ttl for stateless sessions
                checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(
                  e,
                  authorized
                ) {
                  expect(authorized).to.be(true);

                  done();
                });
              });
            }, 2500);
          });
        });
      });
    });

    it('tests the security checkpoints _authorizeSession inactivity_threshold timed out', function(done) {
      this.timeout(20000);

      var checkpoint = new CheckPoint({
        logger: require('happn-logger')
      });

      var CacheService = require('../../../lib/services/cache/service');
      var cacheInstance = new CacheService();

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      cacheInstance.happn = {
        services: {
          utils: utils
        }
      };

      cacheInstance.initialize({}, function(e) {
        if (e) return done(e);

        var securityService = {
          happn: {
            services: {
              utils: utils
            }
          },
          cacheService: cacheInstance,
          onDataChanged: function() {}
        };

        var testSession = {
          id: 99,
          type: 1,
          timestamp: Date.now(),
          policy: {
            1: {
              ttl: 6000,
              inactivity_threshold: 1000
            },
            0: {
              ttl: 5000,
              inactivity_threshold: 10000
            }
          }
        };

        var SessionService = require('../../../lib/services/session/service');
        var sessionInstance = new SessionService({
          logger: require('happn-logger')
        });

        sessionInstance.happn = {
          services: {
            utils: utils
          }
        };

        checkpoint.happn = {
          services: {
            utils: utils,
            cache: cacheInstance,
            session: sessionInstance
          }
        };

        checkpoint.initialize({}, securityService, function(e) {
          if (e) return done(e);

          setTimeout(function() {
            checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(
              e,
              authorized,
              reason
            ) {
              if (e) return done(e);

              expect(authorized).to.be(false);
              expect(reason).to.be('session inactivity threshold reached');

              testSession.type = 0; //should be fine - plenty of time

              checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(
                e,
                authorized
              ) {
                expect(authorized).to.be(true);
                checkpoint.stop();
                done();
              });
            });
          }, 1500);
        });
      });
    });

    it('tests the security checkpoints _authorizeSession inactivity_threshold active then timed out', function(done) {
      this.timeout(20000);

      var checkpoint = new CheckPoint({
        logger: require('happn-logger')
      });

      var CacheService = require('../../../lib/services/cache/service');
      var cacheInstance = new CacheService();

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      cacheInstance.happn = {
        services: {
          utils: utils
        }
      };

      cacheInstance.initialize({}, function(e) {
        if (e) return done(e);

        var securityService = {
          happn: {
            services: {
              utils: utils
            }
          },
          cacheService: cacheInstance,
          onDataChanged: function() {}
        };

        var testSession = {
          id: 99,
          type: 1,
          timestamp: Date.now(),
          policy: {
            1: {
              ttl: 6000,
              inactivity_threshold: 1000
            },
            0: {
              ttl: 5000,
              inactivity_threshold: 10000
            }
          }
        };

        var SessionService = require('../../../lib/services/session/service');
        var sessionInstance = new SessionService({
          logger: require('happn-logger')
        });

        sessionInstance.happn = {
          services: {
            utils: utils
          }
        };

        checkpoint.happn = {
          services: {
            utils: utils,
            cache: cacheInstance,
            session: sessionInstance
          }
        };

        checkpoint.initialize({}, securityService, function(e) {
          if (e) return done(e);

          checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized) {
            if (e) return done(e);

            expect(authorized).to.be(true);

            setTimeout(function() {
              checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(
                e,
                authorized,
                reason
              ) {
                expect(authorized).to.be(false);
                expect(reason).to.be('session inactivity threshold reached');

                checkpoint.stop();
                done();
              });
            }, 1500);
          });
        });
      });
    });

    it('tests the security checkpoints _authorizeSession inactivity_threshold keep-alive', function(done) {
      this.timeout(20000);

      var checkpoint = new CheckPoint({
        logger: require('happn-logger')
      });

      var CacheService = require('../../../lib/services/cache/service');
      var cacheInstance = new CacheService();

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      cacheInstance.happn = {
        services: {
          utils: utils
        }
      };

      cacheInstance.initialize({}, function(e) {
        if (e) return done(e);

        var securityService = {
          happn: {
            services: {
              utils: utils
            }
          },
          cacheService: cacheInstance,
          onDataChanged: function() {}
        };

        var testSession = {
          id: 99,
          type: 1,
          timestamp: Date.now(),
          policy: {
            1: {
              inactivity_threshold: 2000
            },
            0: {
              inactivity_threshold: 2000
            }
          }
        };

        var SessionService = require('../../../lib/services/session/service');
        var sessionInstance = new SessionService({
          logger: require('happn-logger')
        });

        sessionInstance.happn = {
          services: {
            utils: utils
          }
        };

        checkpoint.happn = {
          services: {
            utils: utils,
            cache: cacheInstance,
            session: sessionInstance
          }
        };

        checkpoint.initialize({}, securityService, function(e) {
          if (e) return done(e);

          var counter = 0;

          var checkSessionIsAlive = function() {
            checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized) {
              expect(authorized).to.be(true);

              if (counter < 3) {
                counter++;

                setTimeout(function() {
                  checkSessionIsAlive();
                }, 1200);
              } else {
                testSession.type = 0;

                setTimeout(function() {
                  return checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(
                    e,
                    authorized,
                    reason
                  ) {
                    expect(authorized).to.be(false);
                    expect(reason).to.be('session inactivity threshold reached');

                    checkpoint.stop();
                    done();
                  });
                }, 2100);
              }
            });
          };

          checkSessionIsAlive();
        });
      });
    });

    it('tests the security checkpoints _authorizeSession inactivity_threshold', function(done) {
      this.timeout(20000);

      var checkpoint = new CheckPoint({
        logger: require('happn-logger')
      });

      var CacheService = require('../../../lib/services/cache/service');
      var cacheInstance = new CacheService();

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      cacheInstance.happn = {
        services: {
          utils: utils
        }
      };

      var testSession = {
        id: 99,
        type: 1,
        timestamp: Date.now(),
        policy: {
          1: {
            inactivity_threshold: 2000
          },
          0: {
            inactivity_threshold: 2000
          }
        }
      };

      var securityService = {
        happn: {
          services: {
            utils: utils
          }
        },
        cacheService: cacheInstance,
        onDataChanged: function() {}
      };

      var SessionService = require('../../../lib/services/session/service');
      var sessionInstance = new SessionService({
        logger: require('happn-logger')
      });

      sessionInstance.happn = {
        services: {
          utils: utils
        }
      };

      checkpoint.happn = {
        services: {
          utils: utils,
          cache: cacheInstance,
          security: securityService,
          session: sessionInstance
        }
      };

      cacheInstance.initialize({}, function(e) {
        if (e) return done(e);

        checkpoint.initialize({}, securityService, function(e) {
          if (e) return done(e);

          checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(e, authorized) {
            expect(authorized).to.be(true);

            setTimeout(function() {
              checkpoint._authorizeSession(testSession, '/test/blah', 'on', function(
                e,
                authorized,
                reason
              ) {
                expect(authorized).to.be(false);
                expect(reason).to.be('session inactivity threshold reached');

                checkpoint.stop();
                done();
              });
            }, 2100);
          });
        });
      });
    });

    it('tests the security checkpoints _authorizeSession permissions passthrough', function(done) {
      this.timeout(20000);

      var checkpoint = new CheckPoint({
        logger: require('happn-logger')
      });

      var CacheService = require('../../../lib/services/cache/service');
      var cacheInstance = new CacheService();

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      cacheInstance.happn = {
        services: {
          utils: utils
        }
      };

      var testSession = {
        id: 99,
        type: 0,
        timestamp: Date.now(),
        policy: {
          1: {
            ttl: 6000,
            inactivity_threshold: 1000
          },
          0: {
            ttl: 15000,
            inactivity_threshold: 2000,
            permissions: {
              '/test/permission/*': {
                actions: ['*']
              }
            }
          }
        }
      };

      var securityService = {
        happn: {
          services: {
            utils: utils
          }
        },
        cacheService: cacheInstance,
        onDataChanged: function() {}
      };

      var SessionService = require('../../../lib/services/session/service');
      var sessionInstance = new SessionService({
        logger: require('happn-logger')
      });

      sessionInstance.happn = {
        services: {
          utils: utils
        }
      };

      checkpoint.happn = {
        services: {
          utils: utils,
          cache: cacheInstance,
          security: securityService,
          session: sessionInstance
        }
      };

      cacheInstance.initialize({}, function(e) {
        if (e) return done(e);

        checkpoint.initialize({}, securityService, function(e) {
          if (e) return done(e);

          checkpoint._authorizeSession(testSession, '/test/permission/24', 'on', function(
            e,
            authorized,
            reason,
            passthrough1
          ) {
            if (e) return done(e);

            expect(passthrough1).to.be(true);

            checkpoint._authorizeSession(testSession, '/test1/permission/24', 'on', function(
              e,
              authorized,
              reason,
              passthrough2
            ) {
              if (e) return done(e);

              expect(passthrough2).to.be(undefined);
              expect(authorized).to.be(false);

              checkpoint.stop();
              done();
            });
          });
        });
      });
    });

    it('tests the security checkpoints token usage limit', function(done) {
      this.timeout(20000);

      var checkpoint = new CheckPoint({
        logger: require('happn-logger')
      });

      var CacheService = require('../../../lib/services/cache/service');
      var cacheInstance = new CacheService();

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      cacheInstance.happn = {
        services: {
          utils: utils
        }
      };

      var testSession = {
        id: 99,
        type: 0,
        timestamp: Date.now(),
        policy: {
          1: {
            usage_limit: 2,
            ttl: 2000
          },
          0: {
            usage_limit: 1,
            ttl: 2000
          }
        }
      };
      var securityService = {
        happn: {
          services: {
            utils: utils
          }
        },
        cacheService: cacheInstance,
        onDataChanged: function() {}
      };

      var SessionService = require('../../../lib/services/session/service');
      var sessionInstance = new SessionService({
        logger: require('happn-logger')
      });

      sessionInstance.happn = {
        services: {
          utils: utils
        }
      };

      checkpoint.happn = {
        services: {
          utils: utils,
          cache: cacheInstance,
          security: securityService,
          session: sessionInstance
        }
      };

      cacheInstance.initialize({}, function(e) {
        if (e) return done(e);

        checkpoint.initialize({}, securityService, function(e) {
          if (e) return done(e);

          checkpoint.__checkUsageLimit(testSession, testSession.policy[1], function(e, ok) {
            if (e) return done(e);

            expect(ok).to.be(true);

            checkpoint.__checkUsageLimit(testSession, testSession.policy[1], function(e) {
              if (e) return done(e);

              checkpoint.__checkUsageLimit(testSession, testSession.policy[1], function(e, ok) {
                if (e) return done(e);

                expect(ok).to.be(false);

                checkpoint.stop();
                done();
              });
            });
          });
        });
      });
    });

    it('tests the security services generateToken and decodeToken methods', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          id: 1,
          isToken: true,
          username: 'TEST',
          timestamp: Date.now(),
          ttl: 3000,
          permissions: {}
        };

        var token = happnMock.services.security.generateToken(session);
        var decoded = happnMock.services.security.decodeToken(token);

        for (var propertyName in session) {
          expect(JSON.stringify(session[propertyName])).to.be(
            JSON.stringify(decoded[propertyName])
          );
        }

        stopServices(happnMock, done);
      });
    });

    it('tests the security services createAuthenticationNonce and verifyAuthenticationDigest methods', function(done) {
      this.timeout(5000);

      var happn = require('../../../lib/index');
      var happn_client = happn.client;

      var clientInstance = happn_client.__instance({
        username: '_ADMIN',
        keyPair: {
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
        }
      });

      clientInstance.__ensureCryptoLibrary(function(e) {
        if (e) return done(e);

        mockServices(function(e, happnMock) {
          var mockSession = {
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          };

          expect(happnMock.services.security.config.defaultNonceTTL).to.be(60000);

          happnMock.services.security.createAuthenticationNonce(mockSession, function(e, nonce) {
            if (e) return done(e);

            mockSession.digest = clientInstance.__signNonce(nonce);

            happnMock.services.security.verifyAuthenticationDigest(mockSession, function(
              e,
              verified
            ) {
              if (e) return done(e);
              expect(verified).to.be(true);

              stopServices(happnMock, done);
            });
          });
        });
      });
    });

    it('tests the security services createAuthenticationNonce method, timing out', function(done) {
      this.timeout(5000);

      var happn = require('../../../lib/index');
      var happn_client = happn.client;

      var clientInstance = happn_client.__instance({
        username: '_ADMIN',
        keyPair: {
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
          privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M='
        }
      });

      clientInstance.__ensureCryptoLibrary(function(e) {
        if (e) return done(e);

        mockServices(function(e, happnMock) {
          var mockSession = {
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          };

          expect(happnMock.services.security.config.defaultNonceTTL).to.be(60000);

          happnMock.services.security.config.defaultNonceTTL = 500; //set it to something small

          happnMock.services.security.createAuthenticationNonce(mockSession, function(e, nonce) {
            if (e) return done(e);

            mockSession.digest = clientInstance.__signNonce(nonce);

            setTimeout(function() {
              happnMock.services.security.verifyAuthenticationDigest(mockSession, function(e) {
                expect(e.toString()).to.be('Error: nonce expired or public key invalid');
                stopServices(happnMock, done);
              });
            }, 1000);
          });
        });
      });
    });

    it('should create a user with a public key, then login using a signature', function(done) {
      this.timeout(20000);

      var config = {
        secure: true,
        sessionTokenSecret:
          'absolutely necessary if you want tokens to carry on working after a restart',
        profiles: [
          {
            name: 'web-session',
            session: {
              user: {
                username: {
                  $eq: 'WEB_SESSION'
                }
              },
              type: {
                $eq: 0
              }
            },
            policy: {
              ttl: 4000,
              inactivity_threshold: 2000 //this is costly, as we need to store state on the server side
            }
          }
        ]
      };

      getService(config, function(e, instance) {
        if (e) return done(e);

        var testGroup = {
          name: 'CONNECTED_DEVICES',
          permissions: {
            '/CONNECTED_DEVICES/*': {
              actions: ['*']
            }
          }
        };

        var testUser = {
          username: 'WEB_SESSION',
          publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
        };

        var addedTestGroup;
        var addedTestuser;

        var serviceInstance = instance;

        serviceInstance.services.security.users.upsertGroup(
          testGroup,
          {
            overwrite: false
          },
          function(e, result) {
            if (e) return done(e);
            addedTestGroup = result;

            serviceInstance.services.security.users.upsertUser(
              testUser,
              {
                overwrite: false
              },
              function(e, result) {
                if (e) return done(e);
                addedTestuser = result;

                serviceInstance.services.security.users.linkGroup(
                  addedTestGroup,
                  addedTestuser,
                  function(e) {
                    if (e) return done(e);

                    happn.client
                      .create({
                        username: testUser.username,
                        publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2',
                        privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
                        loginType: 'digest'
                      })

                      .then(function(clientInstance) {
                        clientInstance.disconnect(function(e) {
                          //eslint-disable-next-line no-console
                          if (e) console.warn('couldnt disconnect client:::', e);
                          serviceInstance.stop(done);
                        });
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
    });

    //issue:::
    it('should create a user with a public key, then fail login to a using a signature - bad public key', function(done) {
      this.timeout(20000);

      var config = {
        secure: true,
        sessionTokenSecret:
          'absolutely necessary if you want tokens to carry on working after a restart',
        profiles: [
          {
            name: 'web-session',
            session: {
              user: {
                username: {
                  $eq: 'WEB_SESSION'
                }
              },
              type: {
                $eq: 0
              }
            },
            policy: {
              ttl: 4000,
              inactivity_threshold: 2000 //this is costly, as we need to store state on the server side
            }
          }
        ]
      };

      var CryptoService = require('../../../lib/services/crypto/service');
      var crypto = new CryptoService({
        logger: Logger
      });

      crypto.initialize({}, function(e) {
        if (e) return done(e);

        getService(config, function(e, instance) {
          if (e) return done(e);

          var testGroup = {
            name: 'CONNECTED_DEVICES',
            permissions: {
              '/CONNECTED_DEVICES/*': {
                actions: ['*']
              }
            }
          };

          var testUser = {
            username: 'WEB_SESSION',
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          };

          var addedTestGroup;
          var addedTestuser;

          var serviceInstance = instance;

          serviceInstance.services.security.users.upsertGroup(
            testGroup,
            {
              overwrite: false
            },
            function(e, result) {
              if (e) return done(e);
              addedTestGroup = result;

              serviceInstance.services.security.users.upsertUser(
                testUser,
                {
                  overwrite: false
                },
                function(e, result) {
                  if (e) return done(e);
                  addedTestuser = result;

                  serviceInstance.services.security.users.linkGroup(
                    addedTestGroup,
                    addedTestuser,
                    function(e) {
                      if (e) return done(e);

                      var newKeypair = crypto.createKeyPair();

                      var creds = {
                        username: testUser.username,
                        publicKey: newKeypair.publicKey,
                        privateKey: newKeypair.privateKey
                      };

                      happn.client
                        .create(creds)

                        .then(function() {
                          done(new Error('this was not meant to happn'));
                        })

                        .catch(function(e) {
                          expect(e.toString()).to.be('AccessDenied: Invalid credentials');
                          serviceInstance.stop(done);
                        });
                    }
                  );
                }
              );
            }
          );
        });
      });
    });

    it('should test the policy ms settings', function(done) {
      var SecurityService = require('../../../lib/services/security/service.js');

      var securityService = new SecurityService({
        logger: Logger
      });

      var Utils = require('../../../lib/services/utils/service.js');

      var utils = new Utils({
        logger: require('happn-logger')
      });

      securityService.happn = {
        services: {
          utils: utils
        }
      };

      securityService
        .__initializeProfiles(serviceConfig.services.security.config)
        .then(function() {
          expect(securityService.__cache_Profiles[0].policy.ttl).to.be(4000);
          expect(securityService.__cache_Profiles[0].policy.inactivity_threshold).to.be(2000);
          expect(securityService.__cache_Profiles[1].policy.inactivity_threshold).to.be(
            60000 * 60 * 48
          );
          done();
        })
        .catch(done);
    });

    it('should create a user and login, getting a token - then should be able to use the token to log in again', function(done) {
      this.timeout(20000);

      var config = {
        secure: true,
        sessionTokenSecret:
          'absolutely necessary if you want tokens to carry on working after a restart',
        profiles: [
          {
            name: 'web-session',
            session: {
              user: {
                username: {
                  $eq: 'WEB_SESSION'
                }
              },
              type: {
                $eq: 0
              }
            },
            policy: {
              ttl: 4000,
              inactivity_threshold: 2000 //this is costly, as we need to store state on the server side
            }
          }
        ]
      };

      getService(config, function(e, instance) {
        if (e) return done(e);

        var testGroup = {
          name: 'CONNECTED_DEVICES',
          permissions: {
            '/CONNECTED_DEVICES/*': {
              actions: ['*']
            },
            '/test/data': {
              actions: ['*']
            }
          }
        };

        var testUser = {
          username: 'WEB_SESSION',
          password: 'test'
        };

        var addedTestGroup;
        var addedTestuser;

        var serviceInstance = instance;

        serviceInstance.services.security.users.upsertGroup(
          testGroup,
          {
            overwrite: false
          },
          function(e, result) {
            if (e) return done(e);
            addedTestGroup = result;

            serviceInstance.services.security.users.upsertUser(
              testUser,
              {
                overwrite: false
              },
              function(e, result) {
                if (e) return done(e);
                addedTestuser = result;

                serviceInstance.services.security.users.linkGroup(
                  addedTestGroup,
                  addedTestuser,
                  function(e) {
                    if (e) return done(e);

                    var creds = {
                      username: testUser.username,
                      password: testUser.password
                    };

                    happn.client
                      .create(creds)

                      .then(function(clientInstance) {
                        var tokenCreds = {
                          username: testUser.username,
                          token: clientInstance.session.token
                        };

                        happn.client
                          .create(tokenCreds)

                          .then(function(tokenClientInstance) {
                            tokenClientInstance.set(
                              '/test/data',
                              {
                                test: 'data'
                              },
                              function(e) {
                                if (e) return done(e);
                                tokenClientInstance.disconnect();
                                clientInstance.disconnect();
                                serviceInstance.stop(done);
                              }
                            );
                          })
                          .catch(function(e) {
                            done(e);
                          });
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
    });

    it('tests the processLogin method, session dropped while logging in', function(done) {
      getService(
        {
          secure: true
        },
        function(e, instance) {
          if (e) return done(e);

          instance.services.security.login = function(credentials, sessionId, request, callback) {
            callback(null, 2);
          };

          instance.services.security.processLogin = Promise.promisify(
            instance.services.security.processLogin
          );

          instance.services.security
            .processLogin({
              session: {
                id: 1
              },
              request: {
                data: {}
              }
            })
            .then(function() {
              done(new Error('unexpected success'));
            })
            .catch(function(e) {
              expect(e.toString()).to.be('Error: session with id 1 dropped while logging in');
              stopService(instance, done);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - link-group', function(done) {
      this.timeout(5000);

      getService(
        {
          secure: true
        },
        function(e, instance) {
          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {}
                },
                protocol: 1
              }
            }
          };

          instance.services.security
            .resetSessionPermissions('link-group', {
              _meta: {
                path: '/_SYSTEM/_SECURITY/_USER/test-user-1/_USER_GROUP/test-group'
              }
            })
            .then(function(effectedSessions) {
              expect(effectedSessions).to.eql([
                {
                  id: 1,
                  username: 'test-user-1',
                  isToken: false,
                  permissionSetKey: '5xfClf+YJ9/4BdiLw/kvXH2uvh0=',
                  happn: undefined,
                  user: {
                    username: 'test-user-1',
                    groups: {
                      'test-group': {
                        _meta: {
                          path: '/_SYSTEM/_SECURITY/_USER/test-user-1/_USER_GROUP/test-group'
                        }
                      }
                    }
                  },
                  protocol: 1,
                  causeSubscriptionsRefresh: true
                }
              ]);
              stopService(instance, done);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - unlink-group', function(done) {
      this.timeout(5000);

      getService(
        {
          secure: true
        },
        function(e, instance) {
          if (e) return done(e);

          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {
                    'test-group': {}
                  }
                },
                protocol: 1
              }
            }
          };

          instance.services.security
            .resetSessionPermissions('unlink-group', {
              path: '/_SYSTEM/_SECURITY/_USER/test-user-1/_USER_GROUP/test-group'
            })
            .then(function(effectedSessions) {
              expect(effectedSessions).to.eql([
                {
                  id: 1,
                  username: 'test-user-1',
                  isToken: false,
                  permissionSetKey: '2jmj7l5rSw0yVb/vlWAYkK/YBwk=',
                  protocol: 1,
                  happn: undefined,
                  user: {
                    username: 'test-user-1',
                    groups: {}
                  },
                  causeSubscriptionsRefresh: true
                }
              ]);
              stopService(instance, done);
            })
            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - delete-user', function(done) {
      this.timeout(5000);

      var ended = false;

      getService(
        {
          secure: true
        },
        function(e, instance) {
          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              ended = true;
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {
                    'test-group': {}
                  }
                },
                protocol: 1
              }
            }
          };

          instance.services.security
            .resetSessionPermissions('delete-user', {
              obj: {
                _meta: {
                  path: '/_SYSTEM/_SECURITY/_USER/test-user-1'
                }
              }
            })
            .then(function(effectedSessions) {
              setTimeout(function() {
                //should be empty
                expect(effectedSessions).to.eql([]);
                expect(ended).to.be(true);
                stopService(instance, done);
              }, 1000);
            })
            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - delete-group', function(done) {
      this.timeout(5000);

      getService(
        {
          secure: true
        },
        function(e, instance) {
          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {
                    'test-group': {}
                  }
                },
                protocol: 1
              }
            }
          };

          instance.services.security
            .resetSessionPermissions('delete-group', {
              obj: {
                name: 'test-group'
              }
            })
            .then(function(effectedSessions) {
              expect(effectedSessions).to.eql([
                {
                  id: 1,
                  username: 'test-user-1',
                  isToken: false,
                  permissionSetKey: '2jmj7l5rSw0yVb/vlWAYkK/YBwk=',
                  protocol: 1,
                  happn: undefined,
                  user: {
                    username: 'test-user-1',
                    groups: {}
                  },
                  causeSubscriptionsRefresh: true
                }
              ]);
              stopService(instance, done);
            })
            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - upsert-group', function(done) {
      this.timeout(5000);

      getService(
        {
          secure: true
        },
        function(e, instance) {
          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {
                    'test-group': {}
                  }
                },
                protocol: 1
              }
            }
          };

          instance.services.session.__sessions[
            '1'
          ].data.permissionSetKey = instance.services.security.generatePermissionSetKey(
            instance.services.session.__sessions['1'].data.user
          );

          instance.services.security
            .resetSessionPermissions('upsert-group', {
              name: 'test-group'
            })
            .then(function(effectedSessions) {
              expect(effectedSessions).to.eql([
                {
                  id: 1,
                  username: 'test-user-1',
                  isToken: false,
                  permissionSetKey: '5xfClf+YJ9/4BdiLw/kvXH2uvh0=',
                  protocol: 1,
                  happn: undefined,
                  user: {
                    username: 'test-user-1',
                    groups: {
                      'test-group': {}
                    }
                  },
                  causeSubscriptionsRefresh: false
                }
              ]);
              stopService(instance, done);
            })
            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - permission-removed', function(done) {
      this.timeout(5000);

      getService(
        {
          secure: true
        },
        function(e, instance) {
          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {
                    'test-group': {}
                  }
                },
                protocol: 1
              }
            }
          };

          instance.services.session.__sessions[
            '1'
          ].data.permissionSetKey = instance.services.security.generatePermissionSetKey(
            instance.services.session.__sessions['1'].data.user
          );

          instance.services.security
            .resetSessionPermissions('permission-removed', {
              groupName: 'test-group'
            })
            .then(function(effectedSessions) {
              expect(effectedSessions).to.eql([
                {
                  id: 1,
                  username: 'test-user-1',
                  isToken: false,
                  permissionSetKey: '5xfClf+YJ9/4BdiLw/kvXH2uvh0=',
                  protocol: 1,
                  happn: undefined,
                  user: {
                    username: 'test-user-1',
                    groups: {
                      'test-group': {}
                    }
                  },
                  causeSubscriptionsRefresh: true
                }
              ]);
              stopService(instance, done);
            })
            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - permission-upserted', function(done) {
      this.timeout(5000);

      getService(
        {
          secure: true
        },
        function(e, instance) {
          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {
                    'test-group': {}
                  }
                },
                protocol: 1
              }
            }
          };

          instance.services.session.__sessions[
            '1'
          ].data.permissionSetKey = instance.services.security.generatePermissionSetKey(
            instance.services.session.__sessions['1'].data.user
          );

          instance.services.security
            .resetSessionPermissions('permission-upserted', {
              groupName: 'test-group'
            })
            .then(function(effectedSessions) {
              expect(effectedSessions).to.eql([
                {
                  id: 1,
                  username: 'test-user-1',
                  isToken: false,
                  permissionSetKey: '5xfClf+YJ9/4BdiLw/kvXH2uvh0=',
                  protocol: 1,
                  happn: undefined,
                  user: {
                    username: 'test-user-1',
                    groups: {
                      'test-group': {}
                    }
                  },
                  causeSubscriptionsRefresh: true
                }
              ]);
              stopService(instance, done);
            })
            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    it('tests resetSessionPermissions method - upsert-user', function(done) {
      this.timeout(5000);

      getService(
        {
          secure: true
        },
        function(e, instance) {
          var client = {
            sessionId: '1',
            once: function(evt, handler) {
              if (evt === 'end') this.__handler = handler;
            }.bind(client),
            end: function() {
              this.__handler();
            }.bind(client)
          };

          instance.services.session.__sessions = {
            '1': {
              client: client,
              data: {
                id: 1,
                user: {
                  username: 'test-user-1',
                  groups: {
                    'test-group': {}
                  }
                },
                protocol: 1
              }
            }
          };

          instance.services.session.__sessions[
            '1'
          ].data.permissionSetKey = instance.services.security.generatePermissionSetKey(
            instance.services.session.__sessions['1'].data.user
          );

          instance.services.security.users.getUser = function(username, callback) {
            callback(null, {
              username: username
            });
          };

          instance.services.security
            .resetSessionPermissions('upsert-user', {
              username: 'test-user-1'
            })
            .then(function(effectedSessions) {
              expect(effectedSessions).to.eql([
                {
                  id: 1,
                  username: 'test-user-1',
                  isToken: false,
                  permissionSetKey: '5xfClf+YJ9/4BdiLw/kvXH2uvh0=',
                  protocol: 1,
                  happn: undefined,
                  user: {
                    username: 'test-user-1'
                  },
                  causeSubscriptionsRefresh: true
                }
              ]);
              stopService(instance, done);
            })
            .catch(function(e) {
              done(e);
            });
        }
      );
    });

    it('should be able to work with configured pbkdf2Iterations', function(done) {
      mockServices(
        async (e, happnMock) => {
          if (e) return done(e);
          expect(happnMock.services.security.config.pbkdf2Iterations).to.be(100);
          const prepared = await happnMock.services.security.users.__prepareUserForUpsert({
            username: 'test-user',
            password: 'test'
          });
          var split = prepared.password.split('$');
          expect(split[0]).to.be('pbkdf2');
          expect(split[1]).to.be('100');
          stopServices(happnMock, done);
        },
        {
          services: {
            security: {
              pbkdf2Iterations: 100
            }
          }
        }
      );
    });

    it('should be able to work with default pbkdf2Iterations', function(done) {
      mockServices(async (e, happnMock) => {
        if (e) return done(e);
        expect(happnMock.services.security.config.pbkdf2Iterations).to.be(10000);
        const prepared = await happnMock.services.security.users.__prepareUserForUpsert({
          username: 'test-user',
          password: 'test'
        });
        var split = prepared.password.split('$');
        expect(split[0]).to.be('pbkdf2');
        expect(split[1]).to.be('10000');
        stopServices(happnMock, done);
      });
    });

    it('tests the authorizeOnBehalfOf method, authorized ok', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          user: {
            username: '_ADMIN'
          }
        };

        var path = '/some/test/path';
        var action = 'SET';
        var onBehalfOf = 'test-user';

        happnMock.services.security.users.getUser = function(username, callback) {
          callback(null, {
            username: 'test-user',
            groups: {}
          });
        };

        happnMock.services.security.__getOnBehalfOfSession = function(
          username,
          onBehalfOf,
          getOnBehalfOfCallback
        ) {
          getOnBehalfOfCallback(null, {
            id: 'test-session-id',
            user: {
              username: 'test-user',
              groups: {}
            },
            policy: {
              '1': {}
            },
            type: '1'
          });
        };

        var callback = function(err, authorized) {
          expect(authorized).to.be(true);
          done();
        };

        happnMock.services.security.checkpoint._authorizeSession = function(
          session,
          path,
          action,
          authorizeSessionCallback
        ) {
          authorizeSessionCallback(null, true);
        };

        happnMock.services.security.checkpoint._authorizeUser = function(
          session,
          path,
          action,
          authorizeUserCallback
        ) {
          authorizeUserCallback(null, true);
        };

        happnMock.services.security.authorizeOnBehalfOf(
          session,
          path,
          action,
          onBehalfOf,
          callback
        );
      });
    });

    it('tests the authorizeOnBehalfOf method, _authorizeSession false', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          user: {
            username: '_ADMIN'
          }
        };

        var path = '/some/test/path';
        var action = 'SET';
        var onBehalfOf = 'test-user';

        happnMock.services.security.users.getUser = function(username, callback) {
          callback(null, {
            username: 'test-user',
            groups: {}
          });
        };

        happnMock.services.security.__getOnBehalfOfSession = function(
          username,
          onBehalfOf,
          getOnBehalfOfCallback
        ) {
          getOnBehalfOfCallback(null, {
            id: 'test-session-id',
            user: {
              username: 'test-user',
              groups: {}
            },
            policy: {
              '1': {}
            },
            type: '1'
          });
        };

        var callback = function(err, authorized) {
          expect(authorized).to.be(false);
          done();
        };

        happnMock.services.security.checkpoint._authorizeSession = function(
          session,
          path,
          action,
          authorizeSessionCallback
        ) {
          authorizeSessionCallback(null, false);
        };

        happnMock.services.security.checkpoint._authorizeUser = function(
          session,
          path,
          action,
          authorizeUserCallback
        ) {
          authorizeUserCallback(null, true);
        };

        happnMock.services.security.authorizeOnBehalfOf(
          session,
          path,
          action,
          onBehalfOf,
          callback
        );
      });
    });

    it('tests the authorizeOnBehalfOf method, _authorizeUser false', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          user: {
            username: '_ADMIN'
          }
        };

        var path = '/some/test/path';
        var action = 'SET';
        var onBehalfOf = 'test-user';

        happnMock.services.security.users.getUser = function(username, callback) {
          callback(null, {
            username: 'test-user',
            groups: {}
          });
        };

        happnMock.services.security.__getOnBehalfOfSession = function(
          username,
          onBehalfOf,
          getOnBehalfOfCallback
        ) {
          getOnBehalfOfCallback(null, {
            id: 'test-session-id',
            user: {
              username: 'test-user',
              groups: {}
            },
            policy: {
              '1': {}
            },
            type: '1'
          });
        };

        var callback = function(err, authorized) {
          expect(authorized).to.be(false);
          done();
        };

        happnMock.services.security.checkpoint._authorizeSession = function(
          session,
          path,
          action,
          authorizeSessionCallback
        ) {
          authorizeSessionCallback(null, true);
        };

        happnMock.services.security.checkpoint._authorizeUser = function(
          session,
          path,
          action,
          authorizeUserCallback
        ) {
          authorizeUserCallback(null, false);
        };

        happnMock.services.security.authorizeOnBehalfOf(
          session,
          path,
          action,
          onBehalfOf,
          callback
        );
      });
    });

    it('tests the authorizeOnBehalfOf method, onBehalfOf not found', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          user: {
            username: '_ADMIN'
          }
        };

        var path = '/some/test/path';
        var action = 'SET';
        var onBehalfOf = 'test-user';

        happnMock.services.security.users.getUser = function(username, callback) {
          callback(null, {
            username: 'test-user',
            groups: {}
          });
        };

        happnMock.services.security.__getOnBehalfOfSession = function(
          username,
          onBehalfOf,
          getOnBehalfOfCallback
        ) {
          getOnBehalfOfCallback(null, null);
        };

        var callback = function(err, authorized, reason) {
          expect(authorized).to.be(false);
          expect(reason).to.be('on behalf of user does not exist');
          done();
        };

        happnMock.services.security.checkpoint._authorizeSession = function(
          session,
          path,
          action,
          authorizeSessionCallback
        ) {
          authorizeSessionCallback(null, true);
        };

        happnMock.services.security.checkpoint._authorizeUser = function(
          session,
          path,
          action,
          authorizeUserCallback
        ) {
          authorizeUserCallback(null, true);
        };

        happnMock.services.security.authorizeOnBehalfOf(
          session,
          path,
          action,
          onBehalfOf,
          callback
        );
      });
    });

    it('tests the authorizeOnBehalfOf method, onBehalfOf not _ADMIN user', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          user: {
            username: 'illuminaughty'
          }
        };

        var path = '/some/test/path';
        var action = 'SET';
        var onBehalfOf = 'test-user';

        happnMock.services.security.users.getUser = function(username, callback) {
          callback(null, {
            username: 'test-user',
            groups: {}
          });
        };

        happnMock.services.security.__getOnBehalfOfSession = function(
          username,
          onBehalfOf,
          getOnBehalfOfCallback
        ) {
          getOnBehalfOfCallback(null, {
            id: 'test-session-id',
            user: {
              username: 'test-user',
              groups: {}
            },
            policy: {
              '1': {}
            },
            type: '1'
          });
        };

        var callback = function(err, authorized, reason) {
          expect(authorized).to.be(false);
          expect(reason).to.be('session attempting to act on behalf of is not authorized');
          done();
        };

        happnMock.services.security.checkpoint._authorizeSession = function(
          session,
          path,
          action,
          authorizeSessionCallback
        ) {
          authorizeSessionCallback(null, true);
        };

        happnMock.services.security.checkpoint._authorizeUser = function(
          session,
          path,
          action,
          authorizeUserCallback
        ) {
          authorizeUserCallback(null, true);
        };

        happnMock.services.security.authorizeOnBehalfOf(
          session,
          path,
          action,
          onBehalfOf,
          callback
        );
      });
    });

    it('tests the __getOnBehalfOfSession method - uncached', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          user: {
            username: 'illuminaughty'
          },
          happn: {
            happn: 'info'
          }
        };

        var onBehalfOf = 'test-user';
        var wasCached = false;
        let fetchedUserFromDb = false;

        happnMock.services.security.__cache_session_on_behalf_of = {
          getSync: () => {
            return null;
          },
          setSync: (username, user) => {
            wasCached = user;
          }
        };

        happnMock.services.security.users.getUser = function(username, callback) {
          fetchedUserFromDb = true;
          callback(null, {
            username: 'test-user',
            groups: {}
          });
        };

        happnMock.services.security.__getOnBehalfOfSession(session, onBehalfOf, (e, onBehalfOf) => {
          if (e) return done(e);
          expect(fetchedUserFromDb).to.be(true);
          expect(onBehalfOf.user).to.eql({
            username: 'test-user',
            groups: {}
          });
          expect(onBehalfOf.happn).to.eql({
            happn: 'info'
          });
          expect(wasCached.user).to.eql({
            username: 'test-user',
            groups: {}
          });
          done();
        });
      });
    });

    it('tests the __getOnBehalfOfSession method - cached', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);

        var session = {
          user: {
            username: 'illuminaughty'
          }
        };

        var onBehalfOf = 'test-user';

        happnMock.services.security.__cache_session_on_behalf_of = {
          getSync: () => {
            return {
              cached: true,
              user: {
                username: 'test-user',
                groups: {}
              }
            };
          },
          setSync: () => {}
        };

        let fetchedUserFromDb = false;

        happnMock.services.security.users.getUser = function(username, callback) {
          fetchedUserFromDb = true;
          callback(null, {
            username: 'test-user',
            groups: {}
          });
        };

        happnMock.services.security.__getOnBehalfOfSession(session, onBehalfOf, (e, onBehalfOf) => {
          if (e) return done(e);
          expect(fetchedUserFromDb).to.be(false);
          expect(onBehalfOf.user).to.eql({
            username: 'test-user',
            groups: {}
          });
          done();
        });
      });
    });

    it('tests the sessionFromRequest method', function(done) {
      mockServices(function(e, happnMock) {
        if (e) return done(e);
        let warningHappened = false;
        happnMock.services.security.log = {
          warn: message => {
            expect(message.indexOf('failed decoding session token from request')).to.be(0);
            warningHappened = true;
          }
        };
        happnMock.services.security.decodeToken = token => {
          return JSON.parse(JSON.stringify(token));
        };
        happnMock.services.system = {
          getDescription: () => {
            return {
              name: 'test-description'
            };
          }
        };
        expect(
          happnMock.services.security.sessionFromRequest(
            {
              connection: {},
              headers: {},
              happn_session: {
                test: 'session'
              }
            },
            {}
          )
        ).to.eql({
          test: 'session'
        });
        happnMock.services.security.decodeToken = token => {
          return { token };
        };
        expect(
          happnMock.services.security.sessionFromRequest(
            {
              connection: {},
              headers: {},
              cookies: {
                get: () => {
                  return 'TEST-TOKEN';
                }
              }
            },
            {}
          )
        ).to.eql({
          token: 'TEST-TOKEN',
          type: 0,
          happn: {
            name: 'test-description'
          }
        });

        expect(warningHappened).to.be(false);

        happnMock.services.system = {
          getDescription: () => {
            throw new Error('test error');
          }
        };

        expect(
          happnMock.services.security.sessionFromRequest(
            {
              connection: {},
              headers: {},
              cookies: {
                get: cookieName => {
                  return {
                    token: 'TEST-TOKEN',
                    cookieName
                  };
                }
              }
            },
            {}
          )
        ).to.eql(null);
        expect(warningHappened).to.be(true);
        done();
      });
    });

    it('tests the __initializeSessionTokenSecret method, found secret', async () => {
      const SecurityService = require('../../../lib/services/security/service');
      const serviceInst = new SecurityService({
        logger: Logger
      });
      const config = {};
      serviceInst.dataService = {
        get: function(path, callback) {
          return callback(null, {
            data: {
              secret: 'TEST-SECRET'
            }
          });
        }
      };
      await serviceInst.__initializeSessionTokenSecret(config);
      expect(config.sessionTokenSecret).to.be('TEST-SECRET');
    });

    it('tests the __initializeSessionTokenSecret method, unfound secret', async () => {
      const SecurityService = require('../../../lib/services/security/service');
      const serviceInst = new SecurityService({
        logger: Logger
      });
      const config = {};
      let upserted;
      serviceInst.dataService = {
        get: function(path, callback) {
          return callback(null, null);
        },
        upsert: function(path, data, callback) {
          upserted = data.secret;
          callback();
        }
      };
      await serviceInst.__initializeSessionTokenSecret(config);
      expect(upserted != null).to.be(true);
      expect(config.sessionTokenSecret).to.be(upserted);
    });

    it('tests the __initializeSessionTokenSecret method, error on get', async () => {
      const SecurityService = require('../../../lib/services/security/service');
      const serviceInst = new SecurityService({
        logger: Logger
      });
      const config = {};
      //eslint-disable-next-line
      let upserted,
        errorHappened = false;
      serviceInst.dataService = {
        get: function(path, callback) {
          return callback(new Error('test-error'));
        },
        upsert: function(path, data, callback) {
          upserted = data.secret;
          callback();
        }
      };
      try {
        await serviceInst.__initializeSessionTokenSecret(config);
      } catch (e) {
        expect(e.message).to.be('test-error');
        errorHappened = true;
      }
      expect(errorHappened).to.be(true);
    });

    it('tests the __initializeSessionTokenSecret method, error on upsert', async () => {
      const SecurityService = require('../../../lib/services/security/service');
      const serviceInst = new SecurityService({
        logger: Logger
      });
      const config = {};
      let errorHappened = false;
      serviceInst.dataService = {
        get: function(path, callback) {
          return callback(null, null);
        },
        upsert: function(path, data, callback) {
          return callback(new Error('test-error'));
        }
      };
      try {
        await serviceInst.__initializeSessionTokenSecret(config);
      } catch (e) {
        expect(e.message).to.be('test-error');
        errorHappened = true;
      }
      expect(errorHappened).to.be(true);
    });
  }
);
