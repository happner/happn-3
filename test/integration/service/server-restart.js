var expect = require('expect.js');
var Happn = require('../../../');
const tests = require('../../__fixtures/utils/test_helper').create();
describe(tests.testName(__filename, 3), function() {
  var server;

  function startServer(done) {
    Happn.service
      .create()
      .then(function(_server) {
        server = _server;
      })
      .then(done)
      .catch(done);
  }

  before('start server', function(done) {
    this.timeout(5000);
    startServer(done);
  });

  after('stop server', function(done) {
    if (!server) return done();
    server.stop(
      {
        reconnect: false
      },
      done
    );
  });

  context('subscriptions', function() {
    it('subscriptions are resumed without duplication after server restart', function(done) {
      var client;
      var countReceived = 0;

      var received = function() {
        countReceived++;
      };

      Happn.client
        .create()

        .then(function(_client) {
          client = _client;
          return client.on('/test/*', received);
        })

        .then(function() {
          return client.set('/test/x', {});
        })

        .then(function() {
          return tests.delay(200);
        })

        .then(function() {
          expect(countReceived).to.equal(1); // pre-test (sanity)
        })

        .then(function() {
          return server.stop({
            reconnect: true
          });
        })

        .then(function() {
          server = null;
          var reject;

          var promise = new Promise(function(resolve, _reject) {
            reject = _reject;
            client.onEvent('reconnect-successful', resolve);
          });

          startServer(function(e) {
            if (e) reject(e);
          });

          return promise;
        })

        .then(function() {
          return client.set('/test/x', {});
        })

        .then(function() {
          return tests.delay(200);
        })

        .then(function() {
          expect(countReceived).to.equal(2); // re-subscribed automatically on connect
        })

        .then(done)
        .catch(done);
    });
  });
});
