var expect = require('expect.js');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 4),
  function () {
    it('tests the fail method, not login action, encrypted payloads', function (done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();
      const utils = require('../../../lib/services/utils/shared');

      cryptoService.initialize({}, function (e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService,
            utils: utils
          }
        };

        var failure = protocol.fail({
          session: {
            isEncrypted: true,
            secret: '18989811111111111111111111111111',
            protocol: 'happn'
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
          encrypted:
            '658ace4ecb470ca904e8e479246b0f22c1603889d539ddea959600d6657e88bf3bb919066c211d419841b15831a193a5572fb683f5dbf70685002455bde855df5d8772e1f3fdea320e4705bb45dee31657587b857fbbb4b71e948484684378009865fe64f8bb6dcf13c185896437956e8cb3c6b5ec79fe700e89f2fe045c47b0ae9d8544103b1b480c80458ba9'
        });

        done();
      });
    });

    it('tests the fail method, login action, encrypted payloads', function (done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      const utils = require('../../../lib/services/utils/shared');



      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function (e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService,
            util: utils
          }
        };

        var failure = protocol.fail({
          session: {
            isEncrypted: true,
            secret: '18989811111111111111111111111111',
            protocol: 'happn'
          },
          error: new Error('test error'),
          request: {
            action: 'login'
          },
          response: {
            data: 'test'
          }
        });

        expect(failure.response).to.eql({
          data: 'test',
          _meta: {
            type: 'response',
            status: 'error',
            published: false,
            eventId: undefined,
            action: 'login',
            error: { name: 'Error', message: 'test error' }
          },
          protocol: undefined
        });

        done();
      });
    });

    it('tests the fail method, not login action, encrypted payloads, negative', function (done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function (e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var failure = protocol.fail({
          session: {
            isEncrypted: false,
            secret: '18989811111111111111111111111111'
          },
          error: new Error('test error'),
          request: {
            action: 'set',
            eventId: 1,
            sessionId: 1,
            protocol: 'happn'
          },
          response: {
            data: 'test'
          }
        });

        expect(failure.response).to.eql({
          data: 'test',
          _meta: {
            type: 'response',
            status: 'error',
            published: false,
            eventId: 1,
            sessionId: 1,
            action: 'set',
            error: {
              name: 'Error',
              message: 'test error'
            }
          },
          protocol: 'happn'
        });

        done();
      });
    });

    it('tests the success method, encrypted payloads', function (done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      const utils = require('../../../lib/services/utils/shared');


      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function (e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService,
            utils: utils
          }
        };

        var success = protocol.success({
          session: {
            isEncrypted: true,
            secret: '18989811111111111111111111111111'
          },
          request: {
            action: 'set',
            eventId: 1,
            sessionId: 1,
            protocol: 'happn'
          },
          response: {
            data: 'test'
          }
        });

        expect(success.response).to.eql({
          encrypted:
            '658ace4ecb470ca904e8e479246b0f22c1603889d539ddea959600d6657e88bf3bb919066c211d419841b15831a193a5572fb683ffc2a745d5527d15a1f444db519038bef1bebc270a0754bb1f99ec016a5536d16cadb4b71e93d5c125484316d52ded72a1f860da17cbc9917c50947997e399b5ec64e96c0987f6f44a445fe6a38f81141b6b14'
        });

        done();
      });
    });

    it('tests the success method, encrypted payloads, negative', function (done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function (e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var success = protocol.success({
          session: {
            isEncrypted: false,
            secret: '18989811111111111111111111111111'
          },
          request: {
            action: 'set',
            eventId: 1,
            sessionId: 1,
            protocol: 'happn'
          },
          response: {
            data: 'test'
          }
        });

        expect(success.response).to.eql({
          data: 'test',
          _meta: {
            type: 'response',
            status: 'ok',
            published: false,
            eventId: 1,
            sessionId: 1,
            action: 'set'
          },
          protocol: 'happn'
        });

        done();
      });
    });

    it('tests the validate function', function(){

      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      const UtilsService = require('../../../lib/services/utils/service');
      const badPathMessage = 'Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*';

      protocol.protocolVersion = 'happn';

      protocol.happn = {
        services:{
          utils:new UtilsService()
        }
      }

      expect(protocol.validate({})).to.eql({});

      var testMessage = {request:{
        action:'on',
        path:'/test/1'
      }};

      expect(protocol.validate(testMessage)).to.eql(testMessage);

      testMessage = {request:{
        action:'on',
        path:'\\test\\1'
      }};

      try{
        protocol.validate(testMessage);
      }catch(e){
        expect(e.message).to.be(badPathMessage);
      }
    });

    function mockProtocol(){
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      const UtilsService = require('../../../lib/services/utils/service');

      protocol.protocolVersion = 'happn';
  //this.happn.services.security._keyPair.privateKey
      protocol.happn = {
        services:{
          utils:new UtilsService(),
          crypto:{
            asymmetricDecrypt: function(pubKey, privKey, encrypted){
              return encrypted;
            },
            symmetricDecryptObjectiv: function(encrypted, secret){
              return encrypted;
            }
          },
          security:{
            _keyPair:{
              privateKey:'mock-priv-key'
            }
          }
        }
      }

      return protocol;
    }

    it('tests the transformIn method, encrypted message', function(done) {

      var protocol = mockProtocol();

      expect(protocol.transformIn({
        raw:'test'
      })).to.eql({
        request: 'test'
      });

      expect(protocol.transformIn({
        session:{
          secret:'test-secretbhetshwyer342638shete'
        },
        raw:{
          encrypted:'test'
        }
      })).to.eql({
        request: 'test',
        session:{
          secret:'test-secretbhetshwyer342638shete'
        }
      });

      done();
    });

    it('tests the transformIn method, encrypted login', function(done) {

      var protocol = mockProtocol();

      var transformed = protocol.transformIn({
        session:{
          secret:'test-secret'
        },
        raw:{
          action:'login',
          data:{
            encrypted:JSON.stringify({"test":"object"})
          }
        }
      });

      expect(transformed).to.eql({
        "session": {
          "secret": "test-secret",
          "isEncrypted": true
        },
        "request": {
          "action": "login",
          "data": {
            "test": "object",
            "isEncrypted": true
          },
          "eventId":undefined,
          "publicKey":undefined
        }
      });

      done();
    });

    it('tests the transformSystem method, disconnect no options', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformSystem({
        action:'disconnect'
      });

      expect(transformed).to.eql({
        "action": "disconnect",
        "response": {
          "_meta": {
            "type": "system"
          },
          "eventKey": "server-side-disconnect",
          "data": "server side disconnect",
          "reconnect": true
        }
      });

      done();
    });

    it('tests the transformSystem method, disconnect with options', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformSystem({
        action:'disconnect',
        options:{
          reconnect: false,
          reason: 'just die'
        }
      });

      expect(transformed).to.eql({
        "action": "disconnect",
        "options": {
          "reason": "just die",
          "reconnect": false
        },
        "response": {
          "_meta": {
            "type": "system"
          },
          "eventKey": "server-side-disconnect",
          "data": "just die",
          "reconnect": false
        }
      });

      done();
    });

    it('tests the transformSystem method, security-data-changed', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformSystem({
        eventKey:'security-data-changed',
        data:'something happened'
      });

      expect(transformed).to.eql({
        "data": "something happened",
        "eventKey": "security-data-changed",
        "request": {
          "publication": {
            "_meta": {
              "type": "system"
            },
            "data": "something happened",
            "eventKey": "security-data-changed"
          }
        }
      });
      done();
    });
  });
