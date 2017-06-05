// network-simulator uses [socket].cork() to mimic large payload - not implemented in node v0.10

if (!process.version.match(/^v0\.10/)) {

  var filename = require('path').basename(__filename);
  var expect = require('expect.js');
  var NetworkSimulator = require('./lib/network-simulator');
  var happn = require('..');
  var HappnServer = happn.service;
  var HappnClient = happn.client;

  describe(filename, function () {

    this.timeout(40000);

    var happnPort = 55000;
    var relayPort = 8080;

    var events = [];

    before('start network relay', function (done) {

      this.network = new NetworkSimulator({

        log: false,

        forwardToPort: happnPort,
        listenPort: relayPort,
        latency: 250 // actual network latency, not faux large payload transmission-time, see .startLargePayload()
      });

      this.network.start().then(done).catch(done);

    });

    before('start happn server', function (done) {

      var _this = this;

      function heartBeatSkippedHandler(data) {
        events.push('SKIPPED ' + data);
      }

      function flatLineHandler(data) {
        events.push('FLATLINED ' + data);
      }

      HappnServer.create({
        services:{
          session:{
            config:{
              primusOpts:{
                // timeout:4000,  // No longer valid, learns heartbeat from client-side ping/pong values,
                                  // or defaults according to older client-side defaults
                allowSkippedHeartBeats: 1, // gets reset to 2 minimum in happn-primus server
                pongSkipTime: 1000 // de-duplicate per-client pongs sent within this time
              },
              primusEvents:{
                'heartbeat-skipped': heartBeatSkippedHandler,
                'flatline': flatLineHandler
              }
            }
          }
        }
      })

        .then(function (server) {
          _this.server = server;
          done();
        })

        .catch(done);

    });

    after('stop happn server', function (done) {

      if (!this.server) return done();
      this.server.stop({reconnect: false}, done);

    });

    after('stop network relay', function (done) {

      this.network.stop().then(done).catch(done);

    });

    context('the client', function () {

      before('start happn client', function (done) {

        var _this = this;

        HappnClient.create({
          port: relayPort,
          ping: 2000,
          pong: 1000
        })

          .then(function (client) {
            _this.client = client;

            client.socket.on('outgoing::ping', function () {
              events.push('SENT PING');
            });

            client.socket.on('incoming::pong', function () {
              events.push('RECEIVED PONG');
            });

            done();
          })

          .catch(done);

      });

      it('receives expected event pattern', function (done) {

        var _this = this;

        this.network.startLargePayload();

        this.client.onEvent('reconnect-successful', function () {

          events.push('RECONNECTED');

          _this.client.disconnect();

          _this.network.stopLargePayload();

          expect(events).to.eql([
            'SENT PING',
            'SKIPPED 1',
            'RECEIVED PONG',
            'SENT PING',
            'SKIPPED 2',
            'RECEIVED PONG',
            'SENT PING',
            'FLATLINED 3',
            'RECONNECTED'
          ]);

          done();

        });

      });

    });

  });

}
