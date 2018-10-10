describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function() {

  this.timeout(5000);
  var expect = require('expect.js');

  it('tests configuring a publication', function(done) {
    var message = {
      protocol: 'happn_2',
      session: {
        id: 'test-session-id'
      },
      request: {
        eventId: 10,
        action: 'set',
        path: '/a/test/path',
        data: {
          test: 'set-data'
        },
        options: {
          meta: {
            test: 10
          }
        }
      },
      response: {
        data: {
          test: 'set-data'
        },
        _meta: {
          path: '/a/test/path'
        }
      },
      recipients: []
    };

    var options = {
      acknowledgeTimeout: 60000
    };

    var publication = require('../../../lib/services/publisher/publication').create(message, options);

    expect(JSON.parse(publication.payload)).to.eql({
      "data": {
        "test": "set-data"
      },
      "_meta": {
        "path": "/a/test/path",
        "action": "/SET@/a/test/path",
        "type": "data",
        "sessionId": "test-session-id",
        "consistency": 2,
        "publicationId": "test-session-id-10",
        "test": 10
      },
      "protocol": "happn_2",
      "__outbound": true
    });

    expect(JSON.parse(publication.mergePayload)).to.eql({
      "data": {
        "test": "set-data"
      },
      "_meta": {
        "path": "/a/test/path",
        "action": "/SET@/a/test/path",
        "type": "data",
        "sessionId": "test-session-id",
        "consistency": 2,
        "publicationId": "test-session-id-10",
        "test": 10
      },
      "protocol": "happn_2",
      "__outbound": true
    });

    expect(publication.publication_options).to.eql({
      acknowledgeTimeout: 60000
    });

    done();
  });
});
