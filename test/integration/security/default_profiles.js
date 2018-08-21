describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),  function () {

  this.timeout(30000);

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var async = require('async');

  var happnInstance1 = null;

  var http = require('http');

  var Crypto = require('happn-util-crypto');
  var crypto = new Crypto();

  var serviceConfig1 = {
    port: 10000,
    secure: true,
    encryptPayloads: true,
    services: {
      security: {
        config: {
          sessionTokenSecret: 'h1_test-secret',
          keyPair: {
            privateKey: 'Kd9FQzddR7G6S9nJ/BK8vLF83AzOphW2lqDOQ/LjU4M=',
            publicKey: 'AlHCtJlFthb359xOxR5kiBLJpfoC2ZLPLWYHN3+hdzf2'
          },
          profiles: [ //profiles are in an array, in descending order of priority, so if you fit more than one profile, the top profile is chosen
            {
              name: "token-not-allowed",
              session: {
                $and: [{
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    tokenNotAllowedForLogin: {
                      $eq: true
                    }
                  }
                }]
              },
              policy: {
                disallowTokenLogins: true
              }
            }, {
              name: "short-session",
              session: {
                $and: [{
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    shortSession: {
                      $eq: true
                    }
                  }
                }]
              },
              policy: {
                ttl: '2 seconds'
              }
            }, {
              name: "browser-session",
              session: {
                $and: [{
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    _browser: {
                      $eq: true
                    }
                  }
                }]
              },
              policy: {
                ttl: '7 days'
              }
            }, {
              name: "locked-session",
              session: {
                $and: [{
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  info: {
                    tokenOriginLocked: {
                      $eq: true
                    }
                  }
                }]
              },
              policy: {
                ttl: 0, // no ttl
                lockTokenToOrigin: true
              }
            }, {
              name: "node-session",
              session: {
                $and: [{
                  user: {
                    username: {
                      $eq: '_ADMIN'
                    }
                  },
                  _browser: false
                }]
              },
              policy: {
                ttl: 0 // no ttl
              }
            }
          ]
        }
      }
    }
  };

  before('should initialize the service', function (callback) {

    this.timeout(20000);

    try {

      service.create(serviceConfig1, function (e, happnInst1) {

        if (e) return callback(e);

        happnInstance1 = happnInst1;

        callback();

      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    if (happnInstance1) happnInstance1.stop()
      .then(done)
      .catch(done);
    else done();
  });

  it('tests the default browser profile', function (done) {

    var session = {
      info: {
        _browser: true
      }
    };

    happnInstance1.services.security.__profileSession(session);

    expect(session.policy[0].ttl).to.be(7 * 24 * 60 * 60 * 1000); // 7 days

    expect(session.policy[0].inactivity_threshold).to.be(60 * 60 * 1000); // 1 hour

    expect(session.policy[1].ttl).to.be(7 * 24 * 60 * 60 * 1000); // 7 days

    expect(session.policy[1].inactivity_threshold).to.be(60 * 60 * 1000); // 1 hour

    done();

  });

  it('tests the default stateful profile', function (done) {

    var session = {
      type: 1
    };

    happnInstance1.services.security.__profileSession(session);

    expect(session.policy[1].ttl).to.be(0); // never

    expect(session.policy[1].inactivity_threshold).to.be(Infinity); // never

    done();

  });

  it('tests the default stateless profile', function (done) {

    var session = {
      type: 0
    };

    happnInstance1.services.security.__profileSession(session);

    expect(session.policy[1].ttl).to.be(0); // never

    expect(session.policy[1].inactivity_threshold).to.be(Infinity); // never

    done();

  });

});
