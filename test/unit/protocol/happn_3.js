var path = require('path');
var expect = require('expect.js');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    it('tests the fail method, not login action, encrypted payloads', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function(e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var failure = protocol.fail({
          session: {
            isEncrypted: true,
            secret: '1898981',
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
            '0764bcc8773108aa57b37fd437c7f285081ab9c8bc20e7640bce4be2ed00f2d801e589fd8f098851b74e5f818b2888ba1c9e4afd12a2426a08354fcc5e03b4ab88379db26b331864b97cb5c0e2499634cb2aa2802be2157ab01f2e22262e70fc5548f7b5e16029178b8ce68550100f5e5d7c69004d9ea9e864d16dabb1242fb4cb20869382bab0598db46a9e30'
        });

        done();
      });
    });

    it('tests the fail method, login action, encrypted payloads', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function(e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var failure = protocol.fail({
          session: {
            isEncrypted: true,
            secret: '1898981',
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

    it('tests the fail method, not login action, encrypted payloads, negative', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function(e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var failure = protocol.fail({
          session: {
            isEncrypted: false,
            secret: '1898981'
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

    it('tests the success method, encrypted payloads', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function(e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var success = protocol.success({
          session: {
            isEncrypted: true,
            secret: '1898981'
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
            '0764bcc8773108aa57b37fd437c7f285081ab9c8bc20e7640bce4be2ed00f2d801e589fd8f098851b74e5f818b2888ba1c9e4afd18bb12295867168c421fa5af8420d7ed69704e71bd3ce4c0b80e9923f627efd438f4157ab0187f676b254bea1800e4a3b82324028f86aa9d48770e49462c36004d83bef463df69a1ff3c37e2c63282c389eabf'
        });

        done();
      });
    });

    it('tests the success method, encrypted payloads, negative', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function(e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var success = protocol.success({
          session: {
            isEncrypted: false,
            secret: '1898981'
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

    it('tests the fail method', function(done) {
      var inputMessage = {
        error: new Error('test error'),
        session: {
          isEncrypted: false,
          secret: '1898981'
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
      };

      var expectedOutputMessage = {
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
      };

      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function(e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        var fail = protocol.fail(inputMessage);
        expect(fail.response).to.eql(expectedOutputMessage);

        done();
      });
    });

    it('tests the fail method, no request', function(done) {
      var inputMessage = {
        error: new Error('test error'),
        session: {
          isEncrypted: false,
          secret: '1898981'
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
      };

      var expectedOutputMessage = {
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
      };

      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      const CryptoService = require('../../../lib/services/crypto/service');
      var cryptoService = new CryptoService();

      cryptoService.initialize({}, function(e) {
        if (e) return done(e);

        protocol.happn = {
          services: {
            crypto: cryptoService
          }
        };

        inputMessage.raw = inputMessage.request;
        delete inputMessage.request;

        var fail = protocol.fail(inputMessage);
        expect(fail.response).to.eql(expectedOutputMessage);

        done();
      });
    });

    function mockProtocol() {
      const Protocol = require('../../../lib/services/protocol/happn_3');
      const protocol = new Protocol();

      const UtilsService = require('../../../lib/services/utils/service');

      protocol.protocolVersion = 'happn';
      //this.happn.services.security._keyPair.privateKey
      protocol.happn = {
        services: {
          utils: new UtilsService(),
          crypto: {
            asymmetricDecrypt: function(pubKey, privKey, encrypted) {
              return encrypted;
            },
            symmetricDecryptObject: function(encrypted, secret) {
              return encrypted;
            }
          },
          security: {
            _keyPair: {
              privateKey: 'mock-priv-key'
            }
          }
        }
      };

      return protocol;
    }

    it('tests the validate function', function() {
      var protocol = mockProtocol();
      const badPathMessage =
        'Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*';

      expect(protocol.validate({})).to.eql({});

      var testMessage = {
        request: {
          action: 'on',
          path: '/test/1'
        }
      };

      expect(protocol.validate(testMessage)).to.eql(testMessage);

      testMessage = {
        request: {
          action: 'on',
          path: '\\test\\1'
        }
      };

      try {
        protocol.validate(testMessage);
      } catch (e) {
        expect(e.message).to.be(badPathMessage);
      }
    });

    it('tests the transformIn method, encrypted message', function(done) {
      var protocol = mockProtocol();

      expect(
        protocol.transformIn({
          raw: 'test'
        })
      ).to.eql({
        request: 'test'
      });

      expect(
        protocol.transformIn({
          session: {
            secret: 'test-secret'
          },
          raw: {
            encrypted: 'test'
          }
        })
      ).to.eql({
        request: 'test',
        session: {
          secret: 'test-secret'
        }
      });

      done();
    });

    it('tests the transformIn method, encrypted login', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformIn({
        session: {
          secret: 'test-secret'
        },
        raw: {
          action: 'login',
          data: {
            encrypted: JSON.stringify({ test: 'object' })
          }
        }
      });

      expect(transformed).to.eql({
        session: {
          secret: 'test-secret',
          isEncrypted: true
        },
        request: {
          action: 'login',
          data: {
            test: 'object',
            isEncrypted: true
          },
          eventId: undefined,
          publicKey: undefined
        }
      });

      done();
    });

    it('tests the transformSystem method, disconnect no options', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformSystem({
        action: 'disconnect'
      });

      expect(transformed).to.eql({
        action: 'disconnect',
        response: {
          _meta: {
            type: 'system'
          },
          eventKey: 'server-side-disconnect',
          data: 'server side disconnect',
          reconnect: true
        }
      });

      done();
    });

    it('tests the transformSystem method, disconnect with options', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformSystem({
        action: 'disconnect',
        options: {
          reconnect: false,
          reason: 'just die'
        }
      });

      expect(transformed).to.eql({
        action: 'disconnect',
        options: {
          reason: 'just die',
          reconnect: false
        },
        response: {
          _meta: {
            type: 'system'
          },
          eventKey: 'server-side-disconnect',
          data: 'just die',
          reconnect: false
        }
      });

      done();
    });

    it('tests the transformSystem method, security-data-changed', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformSystem({
        eventKey: 'security-data-changed',
        data: 'something happened'
      });

      expect(transformed).to.eql({
        data: 'something happened',
        eventKey: 'security-data-changed',
        request: {
          publication: {
            _meta: {
              type: 'system'
            },
            data: 'something happened',
            eventKey: 'security-data-changed'
          }
        }
      });
      done();
    });
  }
);
