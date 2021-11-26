var expect = require('expect.js');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 4),
  function() {
    it('tests the fail method, login action', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      var failure = protocol.fail({
        session: {
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
          sessionId: undefined,
          eventId: undefined,
          action: 'login',
          error: { name: 'Error', message: 'test error' }
        },
        protocol: undefined
      });

      done();
    });

    it('tests the fail method, not login action', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      var failure = protocol.fail({
        session: {
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

    it('tests the success method', function(done) {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      protocol.protocolVersion = 'happn';

      var success = protocol.success({
        session: {
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

    it('tests the validate function', function() {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      const UtilsService = require('../../../lib/services/utils/service');
      const badPathMessage =
        'Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*';

      protocol.protocolVersion = 'happn';

      protocol.happn = {
        services: {
          utils: new UtilsService()
        }
      };

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

    function mockProtocol() {
      const Protocol = require('../../../lib/services/protocol/happn_4');
      const protocol = new Protocol();

      const UtilsService = require('../../../lib/services/utils/service');

      protocol.protocolVersion = 'happn';
      //this.happn.services.security._keyPair.privateKey
      protocol.happn = {
        services: {
          utils: new UtilsService(),
          security: {
            _keyPair: {
              privateKey: 'mock-priv-key'
            }
          }
        }
      };

      return protocol;
    }

    it('tests the transformIn method,  message', function(done) {
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
            secret: 'test-secretbhetshwyer342638shete'
          },
          raw: 'test'
        })
      ).to.eql({
        request: 'test',
        session: {
          secret: 'test-secretbhetshwyer342638shete'
        }
      });

      done();
    });

    it('tests the transformIn method,  login', function(done) {
      var protocol = mockProtocol();

      var transformed = protocol.transformIn({
        session: {
          secret: 'test-secret'
        },
        raw: {
          action: 'login',
          data: {
            test: 'object'
          }
        }
      });

      expect(transformed).to.eql({
        session: { secret: 'test-secret' },
        request: { action: 'login', data: { test: 'object' } }
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
