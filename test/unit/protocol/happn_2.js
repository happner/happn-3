var path = require('path');
var expect = require('expect.js');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function() {

  it('tests the fail method, not login action, encrypted payloads', function(done) {

    const Protocol = require('../../../lib/services/protocol/happn_2');
    const protocol = new Protocol();

    const CryptoService = require('../../../lib/services/crypto/service');
    var cryptoService = new CryptoService();

    cryptoService.initialize({}, function(e){

      if (e) return done(e);

      protocol.happn = {
        services: {
          crypto: cryptoService
        }
      }

      var failure = protocol.fail({
        session: {
          isEncrypted: true,
          secret:'1898981',
          protocol:'happn'
        },
        error: new Error('test error'),
        request: {
          action: 'set'
        },
        response: {
          data: 'test'
        }
      });

      expect(failure.response).to.eql({
        "encrypted": "0764bcc8773108aa57b37fd437c7f285081ab9c8bc20e7640bce4be2ed00f2d801e589fd8f098851b74e5f818b2888ba1c9e4afd12a2426a08354fcc5e03b4ab88379db26b331864b97cb5c0e2499634cb2aa2802be2157ab01f2e22262e70fc5548f7b5e16029178b8ce68550100f5e5d7c69004d9ea9e864d16dabb1242fb4cb20869382bab0598db46a9e30"
      });

      done();
    });
  });

  it('tests the fail method, login action, encrypted payloads', function(done) {

    const Protocol = require('../../../lib/services/protocol/happn_2');
    const protocol = new Protocol();

    const CryptoService = require('../../../lib/services/crypto/service');
    var cryptoService = new CryptoService();

    cryptoService.initialize({}, function(e){

      if (e) return done(e);

      protocol.happn = {
        services: {
          crypto: cryptoService
        }
      }

      var failure = protocol.fail({
        session: {
          isEncrypted: true,
          secret:'1898981',
          protocol:'happn'
        },
        error: new Error('test error'),
        request: {
          action: 'login'
        },
        response: {
          data: 'test'
        }
      });

      expect(failure.response).to.eql({ data: 'test',
        _meta:
         { type: 'response',
           status: 'error',
           published: false,
           eventId: undefined,
           action: 'login',
           error: { name: 'Error', message: 'test error' } },
        protocol: undefined }
      );

      done();
    });
  });

  it('tests the fail method, not login action, encrypted payloads, negative', function(done) {

    const Protocol = require('../../../lib/services/protocol/happn_2');
    const protocol = new Protocol();

    protocol.protocolVersion = 'happn';

    const CryptoService = require('../../../lib/services/crypto/service');
    var cryptoService = new CryptoService();

    cryptoService.initialize({}, function(e){

      if (e) return done(e);

      protocol.happn = {
        services: {
          crypto: cryptoService
        }
      }

      var failure = protocol.fail({
        session: {
          isEncrypted: false,
          secret:'1898981'
        },
        error: new Error('test error'),
        request: {
          action: 'set',
          eventId:1,
          sessionId:1,
          protocol:'happn'
        },
        response: {
          data: 'test'
        }
      });

      expect(failure.response).to.eql({
        "data": "test",
        "_meta": {
          "type": "response",
          "status": "error",
          "published": false,
          "eventId": 1,
          "sessionId": 1,
          "action": "set",
          "error": {
            "name": "Error",
            "message": "test error"
          }
        },
        "protocol": "happn"
      });

      done();
    });
  });

  it('tests the success method, encrypted payloads', function(done) {

    const Protocol = require('../../../lib/services/protocol/happn_2');
    const protocol = new Protocol();

    protocol.protocolVersion = 'happn';

    const CryptoService = require('../../../lib/services/crypto/service');
    var cryptoService = new CryptoService();

    cryptoService.initialize({}, function(e){

      if (e) return done(e);

      protocol.happn = {
        services: {
          crypto: cryptoService
        }
      }

      var success = protocol.success({
        session: {
          isEncrypted: true,
          secret:'1898981'
        },
        request: {
          action: 'set',
          eventId:1,
          sessionId:1,
          protocol:'happn'
        },
        response: {
          data: 'test'
        }
      });

      expect(success.response).to.eql({ encrypted: '0764bcc8773108aa57b37fd437c7f285081ab9c8bc20e7640bce4be2ed00f2d801e589fd8f098851b74e5f818b2888ba1c9e4afd18bb12295867168c421fa5af8420d7ed69704e71bd3ce4c0b80e9923f627efd438f4157ab0187f676b254bea1800e4a3b82324028f86aa9d48770e49462c36004d83bef463df69a1ff3c37e2c63282c389eabf' });

      done();
    });
  });

  it('tests the success method, encrypted payloads, negative', function(done) {

    const Protocol = require('../../../lib/services/protocol/happn_2');
    const protocol = new Protocol();

    protocol.protocolVersion = 'happn';

    const CryptoService = require('../../../lib/services/crypto/service');
    var cryptoService = new CryptoService();

    cryptoService.initialize({}, function(e){

      if (e) return done(e);

      protocol.happn = {
        services: {
          crypto: cryptoService
        }
      }

      var success = protocol.success({
        session: {
          isEncrypted: false,
          secret:'1898981'
        },
        request: {
          action: 'set',
          eventId:1,
          sessionId:1,
          protocol:'happn'
        },
        response: {
          data: 'test'
        }
      });

      expect(success.response).to.eql({
        "data": "test",
        "_meta": {
          "type": "response",
          "status": "ok",
          "published": false,
          "eventId": 1,
          "sessionId": 1,
          "action": "set"
        },
        "protocol": "happn"
      });

      done();
    });
  });
});
