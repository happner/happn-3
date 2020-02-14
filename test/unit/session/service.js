describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const expect = require('expect.js');
    const Logger = require('happn-logger');
    const SessionService = require('../../../lib/services/session/service');

    it('should test the stats method', function() {
      const sessionService = new SessionService({
        logger: Logger
      });
      expect(sessionService.stats()).to.eql({
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
        }
      });
      expect(safe).to.eql({
        id: 'sessionData.id',
        info: 'sessionData.info',
        type: 'sessionData.type',
        timestamp: 'sessionData.timestamp',
        isEncrypted: true,
        policy: 'sessionData.policy',
        token: 'sessionData.token',
        encryptedSecret: 'sessionData.encryptedSecret',
        user: {
          username: 'username',
          publicKey: 'publicKey'
        }
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
        expect(client.happnConnected > 0).to.be(true);
        expect(client.sessionId).to.not.be(undefined);
        expect(data).to.eql({
          id: client.sessionId,
          protocol: 'happn',
          happn: sessionService.happn.services.system.getDescription()
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
      expect(client.happnProtocol).to.be('happn_4');
    });
  }
);
