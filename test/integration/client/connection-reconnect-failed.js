describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var delay = require('await-delay');
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happn_client = happn.client;
    this.timeout(40000);

    async function createService() {
      return new Promise(function(resolve, reject) {
        service.create(function(e, happnInst) {
          if (e) return reject(e);
          resolve(happnInst);
        });
      });
    }

    async function stopClient(client) {
      return await client.disconnect();
    }

    async function stopService(happnInst) {
      return await happnInst.stop();
    }

    async function createClient() {
      return new Promise(function(resolve, reject) {
        happn_client.create(
          {
            config: {
              connectTimeout: 1000
            }
          },
          function(e, client) {
            if (e) return reject(e);
            resolve(client);
          }
        );
      });
    }

    // after('why is node running?', function(){
    //   log();
    // })

    it('should connect, server is restarted client reconnects but fails to connect, we keep trying to reconnect', async () => {
      var service = await createService();
      var client = await createClient();

      var reconnectCount = 0;
      var reconnectSuccessfulCount = 0;
      var reconnectErrorCounts = {};

      client.onEvent('reconnect-successful', function() {
        reconnectSuccessfulCount++;
      });

      client.onEvent('reconnect-scheduled', function() {
        reconnectCount++;
      });

      client.onEvent('reconnect-error', function(evt) {
        if (!reconnectErrorCounts[evt.reason]) reconnectErrorCounts[evt.reason] = 0;
        reconnectErrorCounts[evt.reason]++;
      });

      await stopService(service);
      //eslint-disable-next-line no-console
      console.log('stopped service, setting up an error in client connect...');

      client.__oldConnect = client.connect.bind(client);

      client.connect = function(callback) {
        callback(new Error('test failure'));
      }.bind(client);

      service = await createService(); //restart service, bad dns
      //eslint-disable-next-line no-console
      console.log('started service again...');
      await delay(12000);
      await stopService(service);
      await stopClient(client);

      expect(reconnectCount > 0).to.be(true);
      expect(reconnectSuccessfulCount === 0).to.be(true);
      expect(reconnectErrorCounts['authentication-failed'] >= 2).to.be(true);
    });

    it('should connect, server is restarted client reconnects but fails to __reattachListeners, we keep trying to reconnect', async () => {
      var service = await createService();
      var client = await createClient();

      var reconnectCount = 0;
      var reconnectSuccessfulCount = 0;
      var reconnectErrorCounts = {};

      client.onEvent('reconnect-successful', function() {
        reconnectSuccessfulCount++;
      });

      client.onEvent('reconnect-scheduled', function() {
        reconnectCount++;
      });

      client.onEvent('reconnect-error', function(evt) {
        if (!reconnectErrorCounts[evt.reason]) reconnectErrorCounts[evt.reason] = 0;
        reconnectErrorCounts[evt.reason]++;
      });

      await stopService(service);
      //eslint-disable-next-line no-console
      console.log('stopped service, setting up an error in client connect...');

      client.__oldConnect = client.connect.bind(client);

      client.__reattachListeners = function(callback) {
        callback(new Error('test failure'));
      }.bind(client);

      service = await createService(); //restart service, bad dns
      //eslint-disable-next-line no-console
      console.log('started service again...');
      await delay(12000);
      await stopService(service);
      await stopClient(client);

      expect(reconnectCount > 0).to.be(true);
      expect(reconnectSuccessfulCount === 0).to.be(true);
      expect(reconnectErrorCounts['reattach-listeners-failed'] >= 2).to.be(true);
    });
  }
);
