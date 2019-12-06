describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var Protocol = require('../../../lib/services/protocol/service');

    it('tests the processMessageIn method, happn_1.3.0 protocol', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_1'] = {
          success: function() {
            done();
          }
        };

        protocolMock.processInboundStack = function(message, protocol, callback) {
          expect(message.session.protocol).to.be('happn_1.3.0');
          callback(null, message);
        };

        protocolMock.processMessageIn(
          {
            session: {
              protocol: 'happn_1.3.0'
            }
          },
          function() {}
        );
      });
    });

    it('tests the processInboundStack method, __suppress', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          },
          security: {
            processAuthorize: function() {
              done(new Error('this should not have happened'));
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_4'] = {
          transformIn: function(message) {
            message.__suppress = true;
            return message;
          }
        };

        protocolMock.processInboundStack(
          {
            session: {
              protocol: 'happn_4'
            }
          },
          protocolMock.config.protocols['happn_4'],
          function(e, message) {
            if (e) return done(e);
            expect(message.__suppress).to.be(true);
            done();
          }
        );
      });
    });

    it('tests the processInboundStack method, __suppress, negative test', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          },
          security: {
            processAuthorize: function() {
              done();
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_4'] = {
          transformIn: function(message) {
            return message;
          }
        };

        protocolMock.processInboundStack(
          {
            session: {
              protocol: 'happn_4'
            }
          },
          protocolMock.config.protocols['happn_4'],
          function() {}
        );
      });
    });

    it('tests the processInboundStack method, action set, processStore fails', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          data: {
            processStore: function(authorized, callback) {
              callback(new Error('a data set error happened'));
            }
          },
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          },
          security: {
            processAuthorize: function(message, cb) {
              cb(null, message);
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_4'] = {
          transformIn: function(message) {
            return message;
          }
        };

        protocolMock.processInboundStack(
          {
            session: {
              protocol: 'happn_4'
            },
            request: {
              action: 'set'
            }
          },
          protocolMock.config.protocols['happn_4'],
          function(e) {
            expect(e.toString()).to.be('Error: a data set error happened');
            done();
          }
        );
      });
    });

    it('tests the processInboundStack method, action remove, processStore fails', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          data: {
            processStore: function(authorized, callback) {
              callback(new Error('a data set error happened'));
            },
            processRemove: function(authorized, callback) {
              callback(new Error('a data remove error happened'));
            }
          },
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          },
          security: {
            processAuthorize: function(message, cb) {
              cb(null, message);
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_4'] = {
          transformIn: function(message) {
            return message;
          }
        };

        protocolMock.processInboundStack(
          {
            session: {
              protocol: 'happn_4'
            },
            request: {
              action: 'remove'
            }
          },
          protocolMock.config.protocols['happn_4'],
          function(e) {
            expect(e.toString()).to.be('Error: a data remove error happened');
            done();
          }
        );
      });
    });

    it('tests the processInboundStack method, action remove, processPublish fails', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          data: {
            processStore: function(authorized, callback) {
              callback(new Error('a data set error happened'));
            },
            processRemove: function(authorized, callback) {
              callback(null, authorized);
            }
          },
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          },
          security: {
            processAuthorize: function(message, cb) {
              cb(null, message);
            }
          },
          publisher: {
            processPublish: function(message, cb) {
              cb(new Error('a publish error happened'));
            }
          }
        }
      };
      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_4'] = {
          transformIn: function(message) {
            return message;
          }
        };

        protocolMock.processInboundStack(
          {
            session: {
              protocol: 'happn_4'
            },
            request: {
              action: 'remove'
            }
          },
          protocolMock.config.protocols['happn_4'],
          function(e) {
            expect(e.toString()).to.be('Error: a publish error happened');
            done();
          }
        );
      });
    });

    it('tests the processInboundStack method, action get, processGet fails', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          data: {
            processGet: function(authorized, callback) {
              callback(new Error('a data get error happened'));
            }
          },
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          },
          security: {
            processAuthorize: function(message, cb) {
              cb(null, message);
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_4'] = {
          transformIn: function(message) {
            return message;
          }
        };

        protocolMock.processInboundStack(
          {
            session: {
              protocol: 'happn_4'
            },
            request: {
              action: 'get'
            }
          },
          protocolMock.config.protocols['happn_4'],
          function(e) {
            expect(e.toString()).to.be('Error: a data get error happened');
            done();
          }
        );
      });
    });

    it('tests the processInboundStack method, action on, processSubscribe fails', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          subscription: {
            prepareSubscribeMessage: function(authorized) {
              return authorized;
            },
            processSubscribe: function(authorized, callback) {
              callback(new Error('a subscribe broke'));
            }
          },
          data: {
            processGet: function(authorized, callback) {
              callback(new Error('a data get error happened'));
            }
          },
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          },
          security: {
            processAuthorize: function(message, cb) {
              cb(null, message);
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_4'] = {
          transformIn: function(message) {
            return message;
          }
        };

        protocolMock.processInboundStack(
          {
            session: {
              protocol: 'happn_4'
            },
            request: {
              action: 'on'
            }
          },
          protocolMock.config.protocols['happn_4'],
          function(e) {
            expect(e.toString()).to.be('Error: a subscribe broke');
            done();
          }
        );
      });
    });

    it('tests the processMessageIn method, happn_2 protocol', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_2'] = {
          success: function() {
            done();
          }
        };

        protocolMock.processInboundStack = function(message, protocol, callback) {
          expect(message.session.protocol).to.be('happn_2');
          callback(null, message);
        };

        protocolMock.processMessageIn(
          {
            session: {
              protocol: 'happn_2'
            }
          },
          function() {}
        );
      });
    });

    it('tests the processMessageIn method, negative test', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            SystemError: function(message) {
              expect(message).to.be('unknown inbound protocol: happn_1.3.0');
              done();
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.processMessageIn = function processMessageIn(message, callback) {
          var _this = this;

          var protocol = _this.config.protocols[message.session.protocol];
          if (!protocol)
            return callback(
              _this.happn.services.error.SystemError(
                'unknown inbound protocol: ' + message.session.protocol,
                'protocol'
              )
            );

          _this
            .processInboundStack(message, protocol)
            .then(function(processed) {
              callback(null, protocol.success(processed));
            })
            .catch(function(e) {
              _this.__handleProtocolError(protocol, message, e, callback);
            });
        }.bind(protocolMock);

        protocolMock.processMessageIn({
          session: {
            protocol: 'happn_1.3.0'
          }
        });
      });
    });

    it('tests the processMessageIn method, bad protocol', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            SystemError: function(message) {
              expect(message).to.be('unknown inbound protocol: bad');
              done();
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.processMessageIn({
          session: {
            protocol: 'bad'
          }
        });
      });
    });

    it('tests the processMessageInLayers method, happn_1.3.0 protocol', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_1'] = {
          success: function() {
            done();
          }
        };

        protocolMock.processInboundStack = function(message, protocol, callback) {
          expect(message.session.protocol).to.be('happn_1.3.0');
          callback(null, message);
        };

        protocolMock.processMessageInLayers(
          {
            session: {
              protocol: 'happn_1.3.0'
            }
          },
          function() {}
        );
      });
    });

    it('tests the processMessageOutLayers method, happn_1.3.0 protocol', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            handleSystem: function() {},
            SystemError: function(message) {
              done(new Error(message));
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config.protocols['happn_1'] = {
          transformOut: function(message) {
            return message;
          },
          emit: function(transformedPublication, session) {
            expect(session.protocol).to.be('happn_1.3.0');
            done();
          }
        };

        protocolMock.processLayers = function(message, layers, callback) {
          callback(null, message);
        };

        protocolMock.processMessageOutLayers(
          {
            session: {
              protocol: 'happn_1.3.0'
            }
          },
          function() {}
        );
      });
    });

    it('tests the processMessageInLayers method, bad protocol', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            SystemError: function(message) {
              expect(message).to.be('unknown inbound protocol: bad');
              done();
            }
          }
        }
      };

      protocolMock.processInboundStack = function(message, protocol, callback) {
        expect(message.session.protocol).to.be('bad');
        callback(null, message);
      };

      protocolMock.initialize({}, function() {
        protocolMock.processMessageInLayers({
          session: {
            protocol: 'bad'
          }
        });
      });
    });

    it('tests the processSystem method, bad protocol', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            SystemError: function(message) {
              expect(message).to.be('unknown system protocol: bad');
              done();
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.processSystem(
          {
            session: {
              protocol: 'bad'
            }
          },
          function(e) {
            expect(e).to.be(undefined);
          }
        );
      });
    });

    it('tests the processSystem method', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {}
          },
          error: {
            SystemError: function() {
              done(new Error('was not meant to happn'));
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.processSystem(
          {
            session: {
              protocol: 'happn_4'
            }
          },
          function(e, message) {
            expect(e).to.be(null);
            expect(message).to.eql({
              session: {
                protocol: 'happn_4'
              }
            });
            done();
          }
        );
      });
    });

    it('tests the processSystemOut method, error', function(done) {
      var protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      protocolMock.happn = {
        connect: {},
        log: {
          warn: function() {}
        },
        services: {
          session: {
            on: function() {},
            getClient: function() {}
          },
          error: {
            handleSystem: function(error) {
              expect(error.toString()).to.be('Error: test emit error');
              done();
            }
          }
        }
      };

      protocolMock.initialize({}, function() {
        protocolMock.config = {
          protocols: {
            happn_4: {
              transformSystem: function(message) {
                return message;
              },
              emit: function() {
                throw new Error('test emit error');
              }
            }
          }
        };

        protocolMock.processSystemOut(
          {
            session: {
              protocol: 'happn_4'
            }
          },
          function(e, message) {
            expect(message).to.eql({
              session: {
                protocol: 'happn_4'
              }
            });
            done();
          }
        );
      });
    });

    it('tests the __cleanseRequestForLogs method', function() {
      const protocolMock = new Protocol({
        logger: {
          createLogger: function() {
            return {
              $$TRACE: function() {}
            };
          }
        }
      });

      //undefined request and session
      expect(JSON.parse(protocolMock.__cleanseRequestForLogs(undefined, undefined))).to.eql({});

      //undefined request and existing session
      expect(
        JSON.parse(
          protocolMock.__cleanseRequestForLogs(undefined, {
            user: {
              username: 'test'
            }
          })
        )
      ).to.eql({
        username: 'test'
      });
      //existing request and existing session
      expect(
        JSON.parse(
          protocolMock.__cleanseRequestForLogs(
            {
              path: 'test-path',
              action: 'test-action',
              sessionId: 'test-session-id'
            },
            {
              user: {
                username: 'test'
              }
            }
          )
        )
      ).to.eql({
        username: 'test',
        path: 'test-path',
        action: 'test-action',
        sessionId: 'test-session-id'
      });
    });
  }
);
