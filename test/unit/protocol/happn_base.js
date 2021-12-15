describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');

    function mockProtocol(callback) {
      const Protocol = require('../../../lib/services/protocol/happn_base');
      const protocol = new Protocol();

      const UtilsService = require('../../../lib/services/utils/service');

      protocol.protocolVersion = 'happn';
      protocol.happn = {
        services: {
          utils: new UtilsService()
        }
      };

      protocol.__createResponse = function(e, message, response, opts) {
        var _meta = {};

        var local = opts ? opts.local : false;

        if (response == null)
          response = {
            data: null
          };
        else {
          if (response._meta) _meta = response._meta;
          if (response.paths) response = response.paths;
        }

        _meta.type = 'response';
        _meta.status = 'ok';

        if (_meta.published == null) _meta.published = false;

        _meta.eventId = message.eventId;

        delete _meta._id;

        if (['login', 'describe'].indexOf(message.action) === -1)
          _meta.sessionId = message.sessionId;

        _meta.action = message.action;

        response._meta = _meta;

        response.protocol = this.protocolVersion;

        if (e) {
          response._meta.status = 'error';

          response._meta.error = {};

          if (e.name == null) response._meta.error.name = e.toString();
          else response._meta.error.name = e.name;

          if (typeof e === 'object') {
            Object.keys(e).forEach(function(key) {
              response._meta.error[key] = e[key];
            });

            if (response._meta.error.message == null && e.message)
              response._meta.error.message = e.message; //this is a non-iterable property
          }

          return response;
        }

        if (
          message.action === 'on' &&
          message.options &&
          (message.options.initialCallback || message.options.initialEmit)
        )
          response.data = this.__formatReturnItems(response.initialValues, local);

        if (Array.isArray(response)) {
          response = this.__formatReturnItems(response, local);

          if (!local) response.push(_meta);
          //we encapsulate the meta data in the array, so we can pop it on the other side
          else response._meta = _meta; // the _meta is preserved as an external property because we arent having to serialize
        }
        return response;
      };
      return callback(null, protocol);
    }

    function mockProtocolMockCrypto() {
      const Protocol = require('../../../lib/services/protocol/happn_base');
      const protocol = new Protocol();

      const UtilsService = require('../../../lib/services/utils/service');

      protocol.protocolVersion = 'happn';

      protocol.happn = {
        services: {
          utils: new UtilsService()
        }
      };

      protocol.__createResponse = function(e, message, response, opts) {
        var _meta = {};

        var local = opts ? opts.local : false;

        if (response == null)
          response = {
            data: null
          };
        else {
          if (response._meta) _meta = response._meta;
          if (response.paths) response = response.paths;
        }

        _meta.type = 'response';
        _meta.status = 'ok';

        if (_meta.published == null) _meta.published = false;

        _meta.eventId = message.eventId;

        delete _meta._id;

        if (['login', 'describe'].indexOf(message.action) === -1)
          _meta.sessionId = message.sessionId;

        _meta.action = message.action;

        response._meta = _meta;

        response.protocol = this.protocolVersion;

        if (e) {
          response._meta.status = 'error';

          response._meta.error = {};

          if (e.name == null) response._meta.error.name = e.toString();
          else response._meta.error.name = e.name;

          if (typeof e === 'object') {
            Object.keys(e).forEach(function(key) {
              response._meta.error[key] = e[key];
            });

            if (response._meta.error.message == null && e.message)
              response._meta.error.message = e.message; //this is a non-iterable property
          }

          return response;
        }

        if (
          message.action === 'on' &&
          message.options &&
          (message.options.initialCallback || message.options.initialEmit)
        )
          response.data = this.__formatReturnItems(response.initialValues, local);

        if (Array.isArray(response)) {
          response = this.__formatReturnItems(response, local);

          if (!local) response.push(_meta);
          //we encapsulate the meta data in the array, so we can pop it on the other side
          else response._meta = _meta; // the _meta is preserved as an external property because we arent having to serialize
        }

        return response;
      };

      return protocol;
    }

    it('tests the fail method, login action', function(done) {
      mockProtocol(function(e, protocol) {
        if (e) return done(e);

        var failure = protocol.fail({
          session: {
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
          protocol: 'happn'
        });

        done();
      });
    });

    it('tests the fail method, not login action', function(done) {
      mockProtocol(function(e, protocol) {
        if (e) return done(e);

        var failure = protocol.fail({
          session: {
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

    it('tests the fail method', function(done) {
      var inputMessage = {
        error: new Error('test error'),
        session: {
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

      mockProtocol(function(e, protocol) {
        if (e) return done(e);

        var fail = protocol.fail(inputMessage);
        expect(fail.response).to.eql(expectedOutputMessage);

        done();
      });
    });

    it('tests the fail method, no request', function(done) {
      var inputMessage = {
        error: new Error('test error'),
        session: {
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

      mockProtocol(function(e, protocol) {
        if (e) return done(e);

        inputMessage.raw = inputMessage.request;
        delete inputMessage.request;

        var fail = protocol.fail(inputMessage);
        expect(fail.response).to.eql(expectedOutputMessage);

        done();
      });
    });

    it('tests the validate function', function() {
      const protocol = mockProtocolMockCrypto();
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

    it('tests the validate function', function() {
      const protocol = mockProtocolMockCrypto();
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

    it('tests the __formatReturnItem function', function() {
      const protocol = mockProtocolMockCrypto();
      expect(
        protocol.__formatReturnItem({
          data: { test: 'data' },
          _meta: 'test-meta'
        })
      ).to.eql({ test: 'data', _meta: 'test-meta' });
    });

    it('tests the __formatReturnItems function', function() {
      const protocol = mockProtocolMockCrypto();

      expect(
        protocol.__formatReturnItems({
          data: { test: 'data' },
          _meta: 'test-meta'
        })
      ).to.eql([{ test: 'data', _meta: 'test-meta' }]);

      expect(
        protocol.__formatReturnItems([
          {
            data: { test: 'data' },
            _meta: 'test-meta'
          },
          {
            data: { test: 'data-1' },
            _meta: 'test-meta-1'
          }
        ])
      ).to.eql([
        { test: 'data', _meta: 'test-meta' },
        { test: 'data-1', _meta: 'test-meta-1' }
      ]);
    });
  }
);
