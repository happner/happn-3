describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happn_client = happn.client;

    var test_secret = 'test_secret';
    var default_timeout = 10000;
    var happnInstance = null;

    var primusClient;

    function startService(callback) {
      try {
        service.create(function(e, happnInst) {
          if (e) return callback(e);

          happnInstance = happnInst;
          callback();
        });
      } catch (e) {
        callback(e);
      }
    }

    function stopService(callback) {
      if (happnInstance) happnInstance.stop(callback);
    }

    after(function(done) {
      stopService(done);
    });

    before('should initialize the service', function(done) {
      this.timeout(20000);
      startService(done);
    });

    /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
    it('should initialize a client, check the standard configuration is in place', function(callback) {
      this.timeout(default_timeout);

      try {
        happn_client.create(function(e, instance) {
          if (e) return callback(e);
          primusClient = instance;

          expect(primusClient.socket.options.reconnect.retries).to.be(Infinity);
          expect(primusClient.socket.options.reconnect.max).to.be(180000);

          expect(primusClient.socket.recovery.retries).to.be(Infinity);
          expect(primusClient.socket.recovery.max).to.be(180000);

          primusClient.disconnect(callback);
        });
      } catch (e) {
        callback(e);
      }
    });

    /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
    it('should initialize a client, and set up configurable options', function(callback) {
      this.timeout(default_timeout);

      try {
        happn_client.create(
          {
            socket: {
              reconnect: {
                retries: 60,
                max: 2100000
              }
            }
          },
          function(e, instance) {
            if (e) return callback(e);
            primusClient = instance;

            expect(primusClient.socket.options.reconnect.retries).to.be(60);
            expect(primusClient.socket.options.reconnect.max).to.be(2100000);

            expect(primusClient.socket.recovery.retries).to.be(60);
            expect(primusClient.socket.recovery.max).to.be(2100000);

            primusClient.disconnect(callback);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
    it('should initialize a client, and set up configurable options, not nested', function(callback) {
      this.timeout(default_timeout);

      try {
        happn_client.create(
          {
            reconnect: {
              retries: 50,
              max: 2000000
            }
          },
          function(e, instance) {
            if (e) return callback(e);
            primusClient = instance;

            expect(primusClient.socket.options.reconnect.retries).to.be(50);
            expect(primusClient.socket.options.reconnect.max).to.be(2000000);

            expect(primusClient.socket.recovery.retries).to.be(50);
            expect(primusClient.socket.recovery.max).to.be(2000000);

            primusClient.disconnect(callback);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('should initialize a client, and set up configurable options', function(callback) {
      this.timeout(default_timeout);

      try {
        happn_client.create(
          {
            reconnect: {
              retries: 10, //10 times
              max: 2000 //2 seconds
            }
          },
          function(e, instance) {
            if (e) return callback(e);
            primusClient = instance;

            expect(primusClient.socket.options.reconnect.retries).to.be(10);
            expect(primusClient.socket.options.reconnect.max).to.be(2000);

            expect(primusClient.socket.recovery.retries).to.be(10);
            expect(primusClient.socket.recovery.max).to.be(2000);

            primusClient.disconnect(callback);
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('should initialize a client, and set up configurable options - with stopped service, we check the backoff', function(callback) {
      this.timeout(30000);

      try {
        happn_client.create(
          {
            reconnect: {
              retries: Infinity, //10 times
              max: 1000 //1 seconds
            }
          },
          function(e, instance) {
            if (e) return callback(e);
            primusClient = instance;

            let reconnectCount = 0;

            primusClient.onEvent('reconnect-scheduled', function() {
              reconnectCount++;
            });

            stopService(function() {
              setTimeout(function() {
                primusClient.disconnect();
                if (reconnectCount < 14)
                  return callback(new Error('expected reconnecvt count too small'));
                callback();
              }, 15000);
            });
          }
        );
      } catch (e) {
        callback(e);
      }
    });

    it('should initialize a client, and set up configurable options - with stopped service, we check the allowed retries', function(callback) {
      this.timeout(30000);

      try {
        startService(function(e) {
          if (e) return callback(e);

          happn_client.create(
            {
              reconnect: {
                retries: 10, //10 times
                max: 1000 //1 seconds
              }
            },
            function(e, instance) {
              if (e) return callback(e);
              primusClient = instance;

              let reconnectCount = 0;

              primusClient.onEvent('reconnect-scheduled', function() {
                reconnectCount++;
              });

              stopService(function() {
                setTimeout(function() {
                  primusClient.disconnect();
                  if (reconnectCount != 10)
                    return callback(new Error('expected reconnecvt count not 10'));
                  callback();
                }, 13000);
              });
            }
          );
        });
      } catch (e) {
        callback(e);
      }
    });
  }
);
