let expect = require('expect.js'),
  CONSISTENCY = require('../../../').constants.CONSISTENCY;

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var UtilsService = require('../../../lib/services/utils/service');
    var utilsService = new UtilsService();

    before('', function() {});
    after('', function() {});

    function mockPublisherService(config, recipients, callback, processMessageOut) {
      if (!processMessageOut)
        processMessageOut = function(message, callback) {
          callback(null, message);
        };

      var PublisherService = require('../../../lib/services/publisher/service');

      var publisherService = new PublisherService({
        logger: {
          createLogger: function(/*key*/) {
            return {
              warn: function(/*message*/) {
                //console.log(message);
              },
              info: function(/*message*/) {
                //console.log(message);
              },
              success: function(/*message*/) {
                //console.log(message);
              },
              error: function(/*message*/) {
                //console.log(message);
              },
              $$TRACE: function(/*message*/) {
                //console.log(message);
              }
            };
          }
        }
      });

      publisherService.happn = {
        services: {
          stats: {},
          utils: utilsService,
          subscription: {
            getRecipients: function() {
              return recipients;
            }
          },
          protocol: {
            processMessageOut: processMessageOut
          }
        }
      };

      publisherService.initialize(config, function(e) {
        if (e) return callback(e);
        return callback(publisherService);
      });
    }

    it('instantiates a publication, defaulted options', function(done) {
      mockPublisherService({}, [], function(publisherService) {
        var Publication = require('../../../lib/services/publisher/publication');

        var message = {
          request: {
            action: 'set',
            eventId: 10,
            path: '/set/some/data',
            data: {
              test: 'data'
            },
            options: {
              other: 'data'
            }
          },
          session: {
            id: '1'
          },
          protocol: 'happn-1.0.0',
          recipients: [],
          response: {
            data: {
              data: {
                was: 'set'
              }
            },
            _meta: {
              path: '/set/some/data',
              action: 'set',
              type: 'response',
              created: 'created',
              modified: 'modified'
            }
          }
        };

        var expectedMessage = {
          data: {
            data: {
              was: 'set'
            }
          },
          _meta: {
            path: '/set/some/data',
            action: '/SET@/set/some/data',
            type: 'data',
            sessionId: '1',
            consistency: 2,
            publicationId: '1-10',
            created: 'created',
            modified: 'modified'
          },
          protocol: 'happn-1.0.0',
          __outbound: true
        };

        var publication = new Publication(message, {}, publisherService.happn);

        expect(publication.options.consistency).to.be(2); //transactional by default

        expect(publication.origin).to.be(message.session);

        expect(publication.id).to.be(message.session.id + '-' + message.request.eventId); //publications have a unique id built up from session and eventId

        expect(publication.payload).to.eql(expectedMessage); //not what gets queued exactly, just the data bit

        expect(publication.recipients.length).to.eql(message.recipients.length);

        done();
      });
    });

    it('instantiates a publication, defined options', function(done) {
      mockPublisherService({}, [], function(publisherService) {
        var Publication = require('../../../lib/services/publisher/publication');

        var message = {
          request: {
            action: 'set',
            eventId: 10,
            path: '/set/some/data',
            data: {
              test: 'data'
            },
            options: {
              other: 'data',
              consistency: 1
            }
          },
          session: {
            id: '1'
          },
          protocol: 'happn-1.0.0',
          recipients: [],
          response: {
            data: {
              data: {
                was: 'set'
              }
            },
            _meta: {
              path: '/set/some/data',
              action: 'set',
              type: 'response',
              created: 'created',
              modified: 'modified'
            }
          }
        };

        var expectedMessage = {
          data: {
            data: {
              was: 'set'
            }
          },
          _meta: {
            path: '/set/some/data',
            action: '/SET@/set/some/data',
            type: 'data',
            sessionId: '1',
            consistency: 1,
            publicationId: '1-10',
            created: 'created',
            modified: 'modified'
          },
          protocol: 'happn-1.0.0',
          __outbound: true
        };

        var publication = new Publication(message, {}, publisherService.happn);

        expect(publication.options.consistency).to.be(1); //this was defined

        expect(publication.origin).to.be(message.session);

        expect(publication.id).to.be(message.session.id + '-' + message.request.eventId); //publications have a unique id

        expect(publication.payload).to.eql(expectedMessage);

        expect(publication.recipients.length).to.eql(message.recipients.length);

        done();
      });
    });

    it("tests the publication's publish method, no recipients", function(done) {
      mockPublisherService({}, [], function(publisherService) {
        var Publication = require('../../../lib/services/publisher/publication');

        var message = {
          request: {
            action: 'set',
            eventId: 10,
            path: '/set/some/data',
            data: {
              test: 'data'
            },
            options: {
              other: 'data',
              consistency: 1
            }
          },
          session: {
            id: '1'
          },
          protocol: 'happn-1.0.0',
          recipients: [],
          response: {
            data: {
              data: {
                was: 'set'
              }
            },
            _meta: {
              path: '/set/some/data',
              action: 'set',
              type: 'response',
              created: 'created',
              modified: 'modified'
            }
          }
        };

        var publication = new Publication(message, {}, publisherService.happn);

        expect(publication.recipients.length).to.eql(0);

        publication.publish(function(e) {
          if (e) return done(e);
          done();
        });
      });
    });

    it('tests the publications publish method, with recipients, default consistency', function(done) {
      mockPublisherService(
        {},
        [
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '1'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '2'
              }
            }
          }
        ],
        function(publisherService) {
          var Publication = require('../../../lib/services/publisher/publication');

          var message = {
            request: {
              action: 'set',
              eventId: 10,
              path: '/set/some/data',
              data: {
                test: 'data'
              },
              options: {
                other: 'data',
                consistency: 2
              }
            },
            session: {
              id: '1'
            },
            protocol: 'happn-1.0.0',
            response: {
              data: {
                data: {
                  was: 'set'
                }
              },
              _meta: {
                path: '/set/some/data',
                action: 'set',
                type: 'response'
              }
            }
          };

          var publication = new Publication(message, {}, publisherService.happn);

          expect(publication.recipients.length).to.eql(2);

          publication.publish(function(e) {
            if (e) return done(e);
            done();
          });
        }
      );
    });

    it('tests the publications publish method, with recipients, acknowledged consistency', function(done) {
      mockPublisherService(
        {},
        [
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '1'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '2'
              }
            }
          }
        ],
        function(publisherService) {
          var Publication = require('../../../lib/services/publisher/publication');

          var message = {
            request: {
              action: 'set',
              eventId: 10,
              path: '/set/some/data',
              data: {
                test: 'data'
              },
              options: {
                other: 'data',
                consistency: 3
              }
            },
            session: {
              id: '1'
            },
            protocol: 'happn-1.0.0',
            response: {
              data: {
                data: {
                  was: 'set'
                }
              },
              _meta: {
                path: '/set/some/data',
                action: 'set',
                type: 'response'
              }
            }
          };

          var publication = new Publication(message, {}, publisherService.happn);

          expect(publication.recipients.length).to.eql(2);

          publication.publish(function(e) {
            if (e) return done(e);
            expect(publication.unacknowledged_recipients.length).to.eql(0);
            done();
          });

          setTimeout(function() {
            expect(publication.unacknowledged_recipients.length).to.eql(2);
            publication.acknowledge('1');
            publication.acknowledge('2');
          }, 1000);
        }
      );
    });

    it('tests the publications publish method, transactional consistency', function(done) {
      var out = 0;

      mockPublisherService(
        {},
        [
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '1'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '2'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '3'
              }
            }
          }
        ],
        function(publisherService) {
          var Publication = require('../../../lib/services/publisher/publication');

          var message = {
            request: {
              action: 'set',
              eventId: 10,
              path: '/set/some/data',
              data: {
                test: 'data'
              },
              options: {
                other: 'data',
                consistency: 2
              }
            },
            session: {
              id: '1'
            },
            protocol: 'happn-1.0.0',
            response: {
              data: {
                data: {
                  was: 'set'
                }
              },
              _meta: {
                path: '/set/some/data',
                action: 'set',
                type: 'response'
              }
            }
          };

          var publication = new Publication(message, {}, publisherService.happn);

          expect(publication.recipients.length).to.eql(3);

          publication.publish(function(e) {
            if (e) return done(e);
            expect(out).to.be(3);
            done();
          });
        },
        function(message, callback) {
          out++;
          callback(null, message);
        }
      );
    });

    it('tests the publications publish method, deferred consistency', function(done) {
      this.timeout(5000);
      var out = 0;

      mockPublisherService(
        {},
        [
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '1'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '2'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '3'
              }
            }
          }
        ],
        function(publisherService) {
          var Publication = require('../../../lib/services/publisher/publication');

          var message = {
            request: {
              action: 'set',
              eventId: 10,
              path: '/set/some/data',
              data: {
                test: 'data'
              },
              options: {
                other: 'data',
                consistency: 1
              }
            },
            session: {
              id: '1'
            },
            protocol: 'happn-1.0.0',
            response: {
              data: {
                data: {
                  was: 'set'
                }
              },
              _meta: {
                path: '/set/some/data',
                action: 'set',
                type: 'response'
              }
            }
          };

          var publication = new Publication(message, {}, publisherService.happn);

          expect(publication.recipients.length).to.eql(3);

          publication.publish(function(e) {
            if (e) return done(e);
            expect(out).to.be(3);
            done();
          });
        },
        function(message, callback) {
          setTimeout(function() {
            out++;
            callback(null, message);
          }, 2000);
        }
      );
    });

    it('tests the publisher service, deferred consistency', function(done) {
      this.timeout(5000);

      var config = {};

      mockPublisherService(
        config,
        [
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '1'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '2'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '3'
              }
            }
          }
        ],
        function(mockPublisher) {
          var message = {
            request: {
              action: 'set',
              eventId: 10,
              path: '/set/some/data',
              data: {
                test: 'data'
              },
              options: {
                other: 'data',
                consistency: CONSISTENCY.DEFERRED
              }
            },
            session: {
              id: '1'
            },
            protocol: 'happn-1.0.0',
            response: {
              data: {
                data: {
                  was: 'set'
                }
              },
              _meta: {
                path: '/set/some/data',
                action: 'set',
                type: 'response'
              }
            }
          };

          var published = false;
          var gotResults = false;

          mockPublisher.publication = {
            create: function() {
              return {
                publish: function(callback) {
                  published = true;
                  callback();
                },
                options: {
                  consistency: CONSISTENCY.DEFERRED
                },
                resultsMessage: function() {
                  gotResults = true;
                  return {};
                }
              };
            }
          };

          mockPublisher.processPublish(message, function(e) {
            expect(gotResults).to.be(false);
            expect(published).to.be(false);
            setTimeout(() => {
              expect(gotResults).to.be(true);
              done(e);
            }, 2000);
          });
        }
      );
    });

    it('tests the publisher service, transactional consistency', function(done) {
      var config = {};

      mockPublisherService(
        config,
        [
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '1'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '2'
              }
            }
          },
          {
            data: {
              action: 'SET',
              path: '/set/some/data',
              session: {
                id: '3'
              }
            }
          }
        ],
        function(mockPublisher) {
          var message = {
            request: {
              action: 'set',
              eventId: 10,
              path: '/set/some/data',
              data: {
                test: 'data'
              },
              options: {
                other: 'data',
                consistency: 2
              }
            },
            session: {
              id: '1'
            },
            protocol: 'happn-1.0.0',
            response: {
              data: {
                data: {
                  was: 'set'
                }
              },
              _meta: {
                path: '/set/some/data',
                action: 'set',
                type: 'response'
              }
            }
          };

          var published = false;

          mockPublisher.publication = {
            create: function() {
              return {
                publish: function(callback) {
                  published = true;
                  callback();
                },
                options: {
                  consistency: CONSISTENCY.TRANSACTIONAL
                }
              };
            }
          };

          mockPublisher.processPublish(message, function(e) {
            expect(published).to.be(true);
            done(e);
          });
        }
      );
    });
  }
);
