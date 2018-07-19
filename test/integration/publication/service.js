var Happn = require('../../..'),
  expect = require('expect.js'),
  async = require('async'),
  shortid = require('shortid');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),  function () {

  var UtilsService = require('../../../lib/services/utils/service');

  var utilsService = new UtilsService();

  before('', function () {

  });

  after('', function () {

  });

  function mockQueueService(items, itemPushedHandler, publications, publicationPushedHandler) {

    if (!publications) publications = [];

    return {
      happn: {
        services: {
          stats: {}
        }
      },
      itemPushedHandler: itemPushedHandler,
      publicationPushedHandler: publicationPushedHandler,
      pushOutbound: function (message, callback) {

        this.items.push(message);

        callback();

        if (this.itemPushedHandler) this.itemPushedHandler(message);
      },
      items: items,
      publications: publications,
      pushPublication: function (publication, callback) {

        var _this = this;

        publications.push(publication);

        if (callback) callback();

        if (_this.publicationPushedHandler) _this.publicationPushedHandler(publication);
      }
    };
  }

  function mockPublisherService(config, queueItems, queuePushedHandler, publications, publicationPushedHandler, callback) {

    var PublisherService = require('../../../lib/services/publisher/service');

    var publisherService = new PublisherService({
      logger: {
        createLogger: function (key) {
          return {
            warn: function (message) {
              //console.log(message);
            },
            info: function (message) {
              //console.log(message);
            },
            success: function (message) {
              //console.log(message);
            },
            error: function (message) {
              //console.log(message);
            },
            $$TRACE: function (message) {
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
        queue: mockQueueService(queueItems, queuePushedHandler, publications, publicationPushedHandler)
      }
    };

    publisherService.initialize(config, function (e) {

      if (e) return callback(e);

      return callback(null, publisherService);

    });
  }


  it('instantiates a publication, defaulted options', function (done) {

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
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data",
        "channel": "/SET@/set/some/data",
        "sessionId": "1",
        "consistency": 2,
        "publicationId": "1-10"
      },
      "protocol": "happn-1.0.0",
      __outbound: true
    };

    var publication = new Publication(message);

    expect(publication.options.consistency).to.be(2); //transactional by default

    expect(publication.origin).to.be(message.session);

    expect(publication.id).to.be(message.session.id + '-' + message.request.eventId); //publications have a unique id built up from session and eventId

    expect(publication.payload).to.eql(JSON.stringify(expectedMessage)); //not what gets queued exactly, just the data bit

    expect(publication.recipients.length).to.eql(message.recipients.length);

    done();

  });

  it('instantiates a publication, defined options', function (done) {

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
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data",
        "channel": "/SET@/set/some/data",
        "sessionId": "1",
        "consistency": 1,
        "publicationId": "1-10"
      },
      "protocol": "happn-1.0.0",
      __outbound: true
    };

    var publication = new Publication(message);

    expect(publication.options.consistency).to.be(1); //this was defined

    expect(publication.origin).to.be(message.session);

    expect(publication.id).to.be(message.session.id + '-' + message.request.eventId); //publications have a unique id

    expect(publication.payload).to.eql(JSON.stringify(expectedMessage));

    expect(publication.recipients.length).to.eql(message.recipients.length);

    done();

  });

  it('tests the publication\'s publish method, no recipients', function (done) {

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
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data"
      },
      "protocol": "happn-1.0.0"
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(0);

    var myArray = [];

    var mockQueue = mockQueueService(myArray);

    publication.publish(mockQueue, function (e, results) {

      if (e) return done(e);

      done();

    });

  });

  it('tests the publications publish method, with recipients, default consistency', function (done) {

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
      recipients: [{
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '1'
          }
        }
      }, {
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '2'
          }
        }
      }],
      response: {
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var expectedMessage = {
      "data": {
        "data": {
          "was": "set"
        }
      },
      "_meta": {
        "path": "/set/some/data",
        "action": "/SET@/set/some/data",
        "type": "data"
      },
      "protocol": "happn-1.0.0"
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(2);

    var myArray = [];

    var mockQueue = mockQueueService(myArray);

    publication.publish(mockQueue, function (e, results) {

      if (e) return done(e);

      done();

    });
  });

  it('tests the publications publish method, with recipients, acknowledged consistency', function (done) {

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
      recipients: [{
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '1'
          }
        }
      }, {
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '2'
          }
        }
      }],
      response: {
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(2);

    var myArray = [];

    var mockQueue = mockQueueService(myArray, function (processedMessage) {

      publication.acknowledge(processedMessage, function (e) {
        if (e) return done(e);
      });
    });

    publication.publish(mockQueue, function (e, results) {

      if (e) return done(e);

      done();
    });
  });

  it('tests the publications publish method, queued consistency', function (done) {

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
      recipients: [{
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '1'
          }
        }
      }, {
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '2'
          }
        }
      }],
      response: {
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(2);

    var myArray = [];

    var processed = 0;

    var mockQueue = mockQueueService(myArray, function (processedMessage) {

      processed++;

      if (processed == message.recipients.length) {

        return done();
      }
    });

    publication.publish(mockQueue, function (e, results) {

      if (e) return done(e);

      //console.log(results);

    });

  });

  it('tests the publications publish method, transactional consistency', function (done) {

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
      recipients: [{
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '1'
          }
        }
      }, {
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '2'
          }
        }
      }, {
          data: {
            action: 'SET',
            path: '/set/some/data',
            session: {
              id: '3'
            }
          }
        }
      ],
      response: {
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(3);

    var myArray = [];

    var processed = 0;

    var mockQueue = mockQueueService(myArray, function (processedMessage) {

      processed++;

      if (processed == message.recipients.length) {

        return done();
      }
    });

    publication.publish(mockQueue, function (e, results) {

      if (e) return done(e);

      //console.log(results);

    });

  });

  it('tests the publications publish method, deferred consistency', function (done) {

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
          consistency: 0
        }
      },
      session: {
        id: '1'
      },
      protocol: 'happn-1.0.0',
      recipients: [{
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '1'
          }
        }
      }, {
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '2'
          }
        }
      }, {
        data: {
          action: 'SET',
          path: '/set/some/data',
          session: {
            id: '3'
          }
        }
      }
      ],
      response: {
        "data": {
          "data": {
            "was": "set"
          }
        },
        "_meta": {
          "path": "/set/some/data",
          "action": "set",
          "type": "response"
        }
      }
    };

    var publication = new Publication(message);

    expect(publication.recipients.length).to.eql(3);

    var myArray = [];

    var processed = 0;

    var mockQueue = mockQueueService(myArray, function (processedMessage) {

      processed++;

      if (processed == message.recipients.length) {

        return done();
      }
    });

    publication.publish(mockQueue, function (e, results) {

      if (e) return done(e);

      //console.log(results);

    });

  });

  it('tests the publisher service, deferred consistency', function (done) {

    var config = {};

    var queueItems = [];

    var queuePushedHandler = function (item) {
      //console.log('queue pushed:::', item);
    };

    var publicationPushedHandler = function (item) {
      //console.log('pub pushed:::', item);
    };

    mockPublisherService(config, queueItems, queuePushedHandler, [], publicationPushedHandler, function (e, mockPublisher) {

      if (e) return callback(e);

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
            consistency: 0
          }
        },
        session: {
          id: '1'
        },
        protocol: 'happn-1.0.0',
        recipients: [{
          data: {
            action: 'SET',
            path: '/set/some/data',
            session: {
              id: '1'
            }
          }
        }, {
          data: {
            action: 'SET',
            path: '/set/some/data',
            session: {
              id: '2'
            }
          }
        }, {
          data: {
            action: 'SET',
            path: '/set/some/data',
            session: {
              id: '3'
            }
          }
        }
        ],
        response: {
          "data": {
            "data": {
              "was": "set"
            }
          },
          "_meta": {
            "path": "/set/some/data",
            "action": "set",
            "type": "response"
          }
        }
      };

      mockPublisher.processPublish(message, function (e, response) {

        if (e) return done(e);
        done();

      });
    });
  });

  it('tests the publisher service, transactional consistency', function (done) {

    var config = {};

    var queueItems = [];

    var pubService;

    var queuePushedHandler = function (item) {
      //console.log('queue pushed:::', item);
    };

    var publicationPushedHandler = function (item) {
      //console.log('pub pushed:::', item);

      pubService.performPublication(item, function (e) {

        if (e) return done(e);

      });
    };

    mockPublisherService(config, queueItems, queuePushedHandler, [], publicationPushedHandler, function (e, mockPublisher) {

      if (e) return callback(e);

      pubService = mockPublisher;

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
            consistency: 0
          }
        },
        session: {
          id: '1'
        },
        protocol: 'happn-1.0.0',
        recipients: [{
          data: {
            action: 'SET',
            path: '/set/some/data',
            session: {
              id: '1'
            }
          }
        }, {
          data: {
            action: 'SET',
            path: '/set/some/data',
            session: {
              id: '2'
            }
          }
        }, {
          data: {
            action: 'SET',
            path: '/set/some/data',
            session: {
              id: '3'
            }
          }
        }],
        response: {
          "data": {
            "data": {
              "was": "set"
            }
          },
          "_meta": {
            "path": "/set/some/data",
            "action": "set",
            "type": "response"
          }
        }
      };

      mockPublisher.processPublish(message, function (e, response) {

        if (e) return done(e);
        done();

      });
    });
  });

});
