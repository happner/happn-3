describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var expect = require('expect.js');
    var service = happn.service;
    var happn_client = happn.client;

    var serviceConfig = {
      secure: true,
      services: {
        session: {
          config: {
            primusOpts: {
              pingInterval: 2000
            }
          }
        }
      }
    };

    var serviceInstance;
    var clientInstance;

    this.timeout(25000);

    function createService(callback) {
      service.create(serviceConfig, function(e, happnInst) {
        if (e) return callback(e);
        serviceInstance = happnInst;
        callback();
      });
    }

    afterEach('it stops the test service', function(done) {
      clientInstance.disconnect(function() {
        serviceInstance.stop(
          {
            reconnect: false
          },
          done
        );
      });
    });

    beforeEach('start the test service', function(done) {
      createService(function(e) {
        if (e) return done(e);
        happn_client
          .create({
            config: {
              username: '_ADMIN',
              password: 'happn'
            }
          })
          .then(function(client) {
            clientInstance = client;
            done();
          })
          .catch(done);
      });
    });

    it('tests that session keepalive via heartbeats functions', function(done) {
      var reconnects = 0;
      var pongs = 0;

      clientInstance.onEvent('reconnect-scheduled', function() {
        reconnects++;
      });

      clientInstance.socket.on('outgoing::pong', function() {
        console.log('pong received...still testing please be patient.');
        pongs++;
      });

      setTimeout(function() {
        expect(pongs > 3).to.be(true);
        expect(reconnects).to.be(0);
        done();
      }, 15000);
    });

    it('tests that session reconnects because heartbeats have not found their way to the server', function(done) {
      var reconnects = 0;

      clientInstance.onEvent('reconnect-scheduled', function() {
        reconnects++;
      });

      var oldWrite = clientInstance.socket._write.bind(clientInstance.socket);

      var newWrite = function(data) {
        if (data.indexOf && data.indexOf('primus::pong') === 0) return;
        oldWrite(data);
      };

      clientInstance.socket._write = newWrite;

      clientInstance.socket.on('outgoing::pong', function() {
        console.log('pong received...still testing please be patient.');
      });

      setTimeout(function() {
        expect(reconnects > 0).to.be(true);
        clientInstance.socket._write = oldWrite;
        done();
      }, 15000);
    });
  }
);
