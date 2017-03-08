describe('g4_client_offline_disconnect', function () {

  var expect = require('expect.js');
  var Happn = require('../lib/index');
  var server, client;

  var startServer = function (done) {
    Happn.service.create()
      .then(function (_server) {
        server = _server;
      })
      .then(done).catch(done);
  };

  before('start server', startServer);

  before('start client', function (done) {
    Happn.client.create()
      .then(function (_client) {
        client = _client;
      })
      .then(done).catch(done);
  });

  after('stop server', function (done) {
    if (!server) return done();
    server.stop({reconnect: false}, done);
  });

  it('can disconnect client when server offline', function (done) {
    // ...and stops the reconnect attempts

    this.timeout(30 * 1000);

    if (!client) return done(new Error('missing client'));

    client.on('/test/subscription', function () {}, function (e) {

      if (e) return done(e);

      var disconnectCalled = false;
      var reconnectCount = 0;

      client.socket.on('reconnect scheduled', function () {

        reconnectCount++;

        if (disconnectCalled) return;

        disconnectCalled = true;

        var reconnected = false;

        client.socket.on('reconnected', function () {

          reconnected = true;

        });

        client.disconnect(function (e) {

          if (e) return done(e);

          setTimeout(function () {

            // should only have first reconnect
            expect(reconnectCount).to.eql(1);

            // start server to confirm no reconnect happens
            startServer(function (e) {

              if (e) return done(e);

              setTimeout(function () {

                expect(reconnected).to.eql(false);

                done();

              }, 2000);

            });

          }, 1000);

        });

      });

      server.stop({reconnect: true}, function (e) {

        if (e) return done(e);

        server = undefined;

      });

    });

  });

});
