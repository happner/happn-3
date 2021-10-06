var expect = require('expect.js');
var Happn = require('../../../');
const util = require('util');
const tests = require('../../__fixtures/utils/test_helper').create();
describe(tests.testName(__filename, 3), function() {
  var server;

  var startServer = function(callback) {
    Happn.service
      .create()
      .then(function(_server) {
        server = _server;
      })
      .then(callback)
      .catch(callback);
  };

  var stopServerDisconnect = function(callback) {
    if (!server) return callback();
    server.stop(
      {
        reconnect: false
      },
      function(e) {
        if (e) return callback(e);
        server = undefined; // ?? perhaps also on e, messy
        callback();
      }
    );
  };

  var stopServerReconnect = function(callback) {
    if (!server) return callback();
    server.stop(
      {
        reconnect: true
      },
      function(e) {
        if (e) return callback(e);
        server = undefined;
        callback();
      }
    );
  };

  before('start server', startServer);

  after('stop server', stopServerDisconnect);

  it('emits reconnect-scheduled', function(done) {
    var client;
    var reconnectScheduledFired = false;

    Promise.resolve()

      .then(function() {
        // other tests may have left the server stopped.
        if (server) return;
        return util.promisify(startServer)();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client) {
        client = _client;
      })

      .then(function() {
        client.onEvent('reconnect-scheduled', function() {
          reconnectScheduledFired = true;
        });
      })

      .then(function() {
        return util.promisify(stopServerReconnect)();
      })

      .then(function() {
        return tests.delay(500);
      })

      .then(function() {
        expect(reconnectScheduledFired).to.eql(true);
      })

      .then(done)

      .catch(done);
  });

  it('emits reconnect-successful', function(done) {
    var client;
    var reconnectSuccessfulFired = false;

    Promise.resolve()

      .then(function() {
        // other tests may have left the server stopped.
        if (server) return;
        return util.promisify(startServer)();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client) {
        client = _client;
      })

      .then(function() {
        client.onEvent('reconnect-successful', function() {
          reconnectSuccessfulFired = true;
        });
      })

      .then(function() {
        return util.promisify(stopServerReconnect)();
      })

      .then(function() {
        return util.promisify(startServer)();
      })

      .then(function() {
        return tests.delay(3000);
      })

      .then(function() {
        expect(reconnectSuccessfulFired).to.eql(true);
      })

      .then(done)

      .catch(done);
  }).timeout(5000);

  it('enables subscribe and unsubscribe', function(done) {
    var client;
    var events = {};
    var expectedEvents;

    Promise.resolve()

      .then(function() {
        // other tests may have left the server stopped.
        if (server) return;
        return util.promisify(startServer)();
      })

      .then(function() {
        return Happn.client.create();
      })

      .then(function(_client) {
        client = _client;
      })

      .then(function() {
        var subscriptionId = client.onEvent('reconnect-successful', function() {});
        // expect(subscriptionId).to.equal('reconnect-successful|0');
        expect(typeof subscriptionId).to.equal('string');
      })

      .then(function() {
        client.onEvent('reconnect-scheduled', function() {
          events[1] = true;
        });
        var subscription2 = client.onEvent('reconnect-scheduled', function() {
          events[2] = true;
        });
        var subscription3 = client.onEvent('reconnect-scheduled', function() {
          events[3] = true;
        });
        client.onEvent('reconnect-scheduled', function() {
          events[4] = true;
        });
        client.offEvent(subscription2);
        client.offEvent(subscription3);
        expectedEvents = {
          1: true,
          4: true
        };
      })

      .then(function() {
        return util.promisify(stopServerReconnect)();
      })

      .then(function() {
        return tests.delay(500);
      })

      .then(function() {
        expect(events).to.eql(expectedEvents);
      })

      .then(done)

      .catch(done);
  });
});
