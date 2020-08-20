const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  const Logger = require('happn-logger');
  const SessionService = require('../../../lib/services/session/service');

  this.timeout(5000);

  it('should test the stats method', function() {
    const sessionService = new SessionService({
      logger: Logger
    });
    test.expect(sessionService.stats()).to.eql({
      sessions: 0
    });
  });

  it('should test the __safeSessionData method', function() {
    const sessionService = new SessionService({
      logger: Logger
    });
    const safe = sessionService.__safeSessionData({
      id: 'sessionData.id',
      info: 'sessionData.info',
      type: 'sessionData.type',
      timestamp: 'sessionData.timestamp',
      isEncrypted: true,
      policy: 'sessionData.policy',
      token: 'sessionData.token',
      encryptedSecret: 'sessionData.encryptedSecret',
      not: 'visible',
      user: {
        username: 'username',
        publicKey: 'publicKey',
        secret: 'secret'
      },
      url: 'test.url.com'
    });
    test.expect(safe).to.eql({
      id: 'sessionData.id',
      info: 'sessionData.info',
      type: 'sessionData.type',
      msgCount: undefined,
      legacyPing: false,
      timestamp: 'sessionData.timestamp',
      isEncrypted: true,
      policy: 'sessionData.policy',
      protocol: undefined,
      tlsEncrypted: undefined,
      cookieName: undefined,
      browser: false,
      intraProc: false,
      sourceAddress: null,
      sourcePort: null,
      upgradeUrl: 'test.url.com',
      happnVersion: undefined,
      happn: undefined,
      user: { username: 'username', publicKey: 'publicKey' }
    });
  });

  it('should test the onConnect method', function(done) {
    const sessionService = new SessionService({
      logger: Logger
    });
    sessionService.happn = {
      services: {
        system: {}
      }
    };
    sessionService.happn.services.system = {
      getDescription: function() {
        return 'description';
      }
    };
    var client = {
      on: function() {}
    };

    sessionService.on('connect', function(data) {
      test.expect(client.happnConnected > 0).to.be(true);
      test.expect(client.sessionId).to.not.be(undefined);
      test.expect(data).to.eql({
        id: client.sessionId,
        info: undefined,
        type: undefined,
        msgCount: 0,
        legacyPing: false,
        timestamp: undefined,
        isEncrypted: false,
        policy: undefined,
        protocol: 'happn',
        tlsEncrypted: false,
        cookieName: undefined,
        browser: false,
        intraProc: true,
        sourceAddress: undefined,
        sourcePort: undefined,
        upgradeUrl: undefined,
        happnVersion: undefined,
        happn: 'description'
      });
      done();
    });

    sessionService.onConnect(client);
  });

  it('should test the __configureSession method', function() {
    const sessionService = new SessionService({ logger: Logger });
    var message = {
      data: {
        protocol: 'happn_4'
      }
    };
    var client = {
      sessionId: 0
    };
    sessionService.__configureSession(message, client);

    sessionService.__sessions[0] = {
      client: client,
      data: {}
    };
    sessionService.__configureSession(message, client);
    test.expect(client.happnProtocol).to.be('happn_4');
  });

  it('should test the getSessionEventJSON method, anonymous', function() {
    const sessionService = new SessionService({ logger: Logger });
    test
      .expect(
        sessionService.getSessionEventJSON('test-event', {
          sourceAddress: '127.0.0.1',
          sourcePort: 5678,
          upgradeUrl: 'http://test/upgrade',
          happnVersion: '1.2.3',
          protocol: 'happn_4'
        })
      )
      .to.eql(
        JSON.stringify({
          event: 'test-event',
          username: 'anonymous (unsecure connection)',
          sourceAddress: '127.0.0.1',
          sourcePort: 5678,
          upgradeUrl: 'http://test/upgrade',
          happnVersion: '1.2.3',
          happnProtocolVersion: 'happn_4'
        })
      );
  });

  it('should test the getSessionEventJSON method, user', function() {
    const sessionService = new SessionService({ logger: Logger });
    test
      .expect(
        sessionService.getSessionEventJSON('test-event', {
          user: {
            username: 'test-username'
          },
          sourceAddress: '127.0.0.1',
          sourcePort: 5678,
          upgradeUrl: 'http://test/upgrade',
          happnVersion: '1.2.3',
          protocol: 'happn_4'
        })
      )
      .to.eql(
        JSON.stringify({
          event: 'test-event',
          username: 'test-username',
          sourceAddress: '127.0.0.1',
          sourcePort: 5678,
          upgradeUrl: 'http://test/upgrade',
          happnVersion: '1.2.3',
          happnProtocolVersion: 'happn_4'
        })
      );
  });

  it('should test the logSessionAttached method', function(done) {
    const sessionService = new SessionService({
      logger: {
        createLogger: () => {
          return {
            $$TRACE: () => {},
            info: message => {
              test.expect(message).to.eql(
                JSON.stringify({
                  event: 'session attached',
                  username: 'test-username',
                  sourceAddress: '127.0.0.1',
                  sourcePort: 5678,
                  upgradeUrl: 'http://test/upgrade',
                  happnVersion: '1.2.3',
                  happnProtocolVersion: 'happn_4'
                })
              );
              done();
            }
          };
        }
      }
    });
    sessionService.config = {};
    sessionService.logSessionAttached({
      user: {
        username: 'test-username'
      },
      sourceAddress: '127.0.0.1',
      sourcePort: 5678,
      upgradeUrl: 'http://test/upgrade',
      happnVersion: '1.2.3',
      protocol: 'happn_4'
    });
  });

  it('should test the logSessionDetached method', function(done) {
    const sessionService = new SessionService({
      logger: {
        createLogger: () => {
          return {
            $$TRACE: () => {},
            info: message => {
              test.expect(message).to.eql(
                JSON.stringify({
                  event: 'session detached',
                  username: 'test-username',
                  sourceAddress: '127.0.0.1',
                  sourcePort: 5678,
                  upgradeUrl: 'http://test/upgrade',
                  happnVersion: '1.2.3',
                  happnProtocolVersion: 'happn_4'
                })
              );
              done();
            }
          };
        }
      }
    });
    sessionService.config = {};
    sessionService.logSessionDetached({
      user: {
        username: 'test-username'
      },
      sourceAddress: '127.0.0.1',
      sourcePort: 5678,
      upgradeUrl: 'http://test/upgrade',
      happnVersion: '1.2.3',
      protocol: 'happn_4'
    });
  });

  it('should test the logSessionAttached method is disabled', function(done) {
    const sessionService = new SessionService({
      logger: {
        createLogger: () => {
          return {
            $$TRACE: () => {},
            info: message => {
              test.expect(message).to.eql(
                JSON.stringify({
                  event: 'session attached',
                  username: 'test-username',
                  sourceAddress: '127.0.0.1',
                  sourcePort: 5678,
                  upgradeUrl: 'http://test/upgrade',
                  happnVersion: '1.2.3',
                  happnProtocolVersion: 'happn_4'
                })
              );
              done(new Error('should not have happened'));
            }
          };
        }
      }
    });
    sessionService.config = { disableSessionEventLogging: true };
    sessionService.logSessionAttached({
      user: {
        username: 'test-username'
      },
      sourceAddress: '127.0.0.1',
      sourcePort: 5678,
      upgradeUrl: 'http://test/upgrade',
      happnVersion: '1.2.3',
      protocol: 'happn_4'
    });
    setTimeout(done, 2000);
  });

  it('should test the logSessionDetached method is disabled', function(done) {
    const sessionService = new SessionService({
      logger: {
        createLogger: () => {
          return {
            $$TRACE: () => {},
            info: message => {
              test.expect(message).to.eql(
                JSON.stringify({
                  event: 'session detached',
                  username: 'test-username',
                  sourceAddress: '127.0.0.1',
                  sourcePort: 5678,
                  upgradeUrl: 'http://test/upgrade',
                  happnVersion: '1.2.3',
                  happnProtocolVersion: 'happn_4'
                })
              );
              done(new Error('should not have happened'));
            }
          };
        }
      }
    });
    sessionService.config = { disableSessionEventLogging: true };
    sessionService.logSessionDetached({
      user: {
        username: 'test-username'
      },
      sourceAddress: '127.0.0.1',
      sourcePort: 5678,
      upgradeUrl: 'http://test/upgrade',
      happnVersion: '1.2.3',
      protocol: 'happn_4'
    });
    setTimeout(done, 2000);
  });
});
