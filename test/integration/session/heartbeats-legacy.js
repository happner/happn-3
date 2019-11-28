describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var old_happn = require('happn');
    var expect = require('expect.js');
    var service = happn.service;
    var happn_client = old_happn.client;
    var pingInterval = 2000;
    var serviceConfig = {
      secure: true,
      services: {
        session: {
          config: {
            primusOpts: {
              pingInterval: pingInterval
            }
          }
        }
      }
    };

    var serviceInstance;
    var clientInstance;

    this.timeout(120000);

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
    //this.options.config.pubsub.options
    beforeEach('start the test service', function(done) {
      createService(function(e) {
        if (e) return done(e);
        happn_client
          .create({
            config: {
              username: '_ADMIN',
              password: 'happn'
            },
            pubsub: {
              options: {
                ping: pingInterval
              }
            }
          })
          .then(function(client) {
            clientInstance = client;
            clientInstance.options.config.pubsub.options.ping = pingInterval;
            clientInstance.options.config.pubsub.options.pong = pingInterval;
            done();
          })
          .catch(done);
      });
    });

    it('tests that session keepalive via heartbeats functions', function(done) {
      var reconnects = 0;
      var pings = 0;

      clientInstance.onEvent('reconnect-scheduled', function() {
        reconnects++;
      });

      clientInstance.pubsub.on('outgoing::ping', function() {
        //eslint-disable-next-line no-console
        console.log('ping sent...still testing please be patient.');
        pings++;
      });

      setTimeout(function() {
        expect(pings >= 3).to.be(true);
        expect(reconnects).to.be(0);
        expect(clientInstance.pubsub.online).to.be(true);
        done();
      }, 30000);
    });

    it('tests that session reconnects because heartbeats have not found their way to the server', function(done) {
      var reconnects = 0;

      clientInstance.onEvent('reconnect-scheduled', function() {
        reconnects++;
      });

      var oldWrite = clientInstance.pubsub._write.bind(clientInstance.pubsub);

      var newWrite = function(data) {
        if (data.indexOf && data.indexOf('primus::ping') === 0) return;
        oldWrite(data);
      };

      clientInstance.pubsub._write = newWrite;

      clientInstance.pubsub.on('outgoing::ping', function() {
        //eslint-disable-next-line no-console
        console.log('ping sent...still testing please be patient.');
      });

      setTimeout(function() {
        expect(reconnects > 0).to.be(true);
        clientInstance.pubsub._write = oldWrite;
        expect(clientInstance.pubsub.online).to.be(true);
        done();
      }, 30000);
    });
  }
);
