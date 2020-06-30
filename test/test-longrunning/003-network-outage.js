var path = require('path');
var filename = path.basename(__filename);
var expect = require('expect.js');
var net = require('net');
var Happn = require('../..');
describe(filename, function() {
  var server;

  this.timeout(60000);

  before('start server', function(done) {
    Happn.service
      .create({
        port: 49000 // <------------------
      })
      .then(function(_server) {
        server = _server;
      })
      .then(done)
      .catch(done);
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

  //////////////////////////////// socket proxy to fake network segmentation

  function SocketProxy(listen, target) {
    this.listen = listen;
    this.target = target;
    this.paused = false;
  }

  SocketProxy.prototype.start = function() {
    var _this = this;

    return new Promise(function(resolve, reject) {
      _this.server = net.createServer(function(clientSocket) {
        // create connection to target

        var targetSocket = net.connect({
          port: _this.target
        });

        // relay end and close

        targetSocket.on('close', function() {
          clientSocket.destroy();
        });

        clientSocket.on('close', function() {
          targetSocket.destroy();
        });

        targetSocket.on('end', function() {
          clientSocket.end();
        });

        clientSocket.on('end', function() {
          targetSocket.end();
        });

        // relay data both ways except if paused

        targetSocket.on('data', function(buf) {
          if (_this.paused) return;
          clientSocket.write(buf);
        });

        clientSocket.on('data', function(buf) {
          if (_this.paused) return;
          targetSocket.write(buf);
        });
      });

      _this.server.once('error', reject);
      _this.server.once('listening', resolve);
      _this.server.listen(_this.listen);
    });
  };

  SocketProxy.prototype.pause = function() {
    this.paused = true;
  };

  SocketProxy.prototype.resume = function() {
    this.paused = false;
  };

  ////////////////////////////////

  const listen = 55000;
  const target = 49000;
  var socketProxy = new SocketProxy(listen, target);

  context('subscriptions', function() {
    it('subscriptions are resumed without duplication after network outage', function(done) {
      var client;
      var countReceived = 0;

      var received = function() {
        countReceived++;
      };

      socketProxy
        .start()

        .then(function() {
          return Happn.client.create();
        })

        .then(function(_client) {
          client = _client;
        })

        .then(function() {
          return client.on('/test/*', received);
        })

        .then(function() {
          return client.set('/test/x', {});
        })

        .then(function() {
          return Promise.delay(200);
        })

        .then(function() {
          expect(countReceived).to.equal(1); // pre-test (sanity)
        })

        .then(function() {
          socketProxy.pause();
          //eslint-disable-next-line no-console
          console.log(
            'waiting for ping-pong to detect network outage (perhaps ping-pong rate can be increased)'
          );
        })

        .then(function() {
          return Promise.all([
            new Promise(function(resolve) {
              client.onEvent('reconnect-scheduled', function() {
                resolve();
              });
            }),
            new Promise(function(resolve) {
              server.services.session.on('disconnect', function() {
                resolve();
              });
            })
          ]);
        })

        .then(function() {
          var promise = new Promise(function(resolve) {
            client.onEvent('reconnect-successful', resolve);
          });

          socketProxy.resume();
          return promise;
        })

        .then(function() {
          return client.set('/test/x', {});
        })

        .then(function() {
          return Promise.delay(200);
        })

        .then(function() {
          expect(countReceived).to.equal(2); // re-subscribed automatically on connect
        })

        .then(done)
        .catch(done);
    });
  });
});
