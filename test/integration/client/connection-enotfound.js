describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var log = require('why-is-node-running');
    var delay = require('await-delay');
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happn_client = happn.client;
    var async = require('async');
    var test_secret = 'test_secret';
    var happnInstance = null;
    var test_id;

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

    async function createClient(host) {
      return new Promise(function(resolve, reject) {
        happn_client.create(
          {
            config: {
              host,
              connectTimeout: 2000
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

    it('should connect, server is restarted and dns record is reset, should carry on reconnecting', async () => {
      var dns = require('dns');
      dns.__oldLookup = dns.lookup.bind(dns);
      dns.lookup = function(domain, options, callback) {
        if (typeof options === 'function') {
          callback = options;
          options = { family: 4, hints: 1024 };
        }
        return callback(null, '127.0.0.1', 4);
      };

      var service = await createService();
      var client = await createClient('test-domain.com');

      var reconnectCount = 0;
      var reconnectSuccessfulCount = 0;

      client.onEvent('reconnect-successful', function() {
        reconnectSuccessfulCount++;
      });

      client.onEvent('reconnect-scheduled', function() {
        reconnectCount++;
        if (reconnectCount == 1) {
          dns.lookup = function(domain, options, callback) {
            if (typeof options === 'function') {
              callback = options;
              options = { family: 4, hints: 1024 };
              return callback(null, '0.0.0.0', 4);
            }
            return callback(new Error('getaddrinfo ENOTFOUND'));
          };
        }
      });

      await stopService(service);
      console.log('stopped service, setting up bad dns...');
      await delay(5000);
      service = await createService(); //restart service, bad dns
      console.log('started service again...');
      await delay(10000);
      await stopService(service);
      console.log('stopped service, fixing dns...');
      dns.lookup = function(domain, options, callback) {
        if (typeof options === 'function') {
          callback = options;
          options = { family: 4, hints: 1024 };
        }
        return callback(null, '127.0.0.1', 4);
      };
      expect(reconnectSuccessfulCount > 0).to.be(false);
      service = await createService();
      console.log('started service, client should reconnect...');
      await delay(15000);
      await stopService(service);
      await stopClient(client);
      dns.lookup = dns.__oldLookup;
      expect(reconnectCount > 3).to.be(true);
      expect(reconnectSuccessfulCount > 0).to.be(true);
    });
  }
);
