describe('03_heartbeats', function() {
  var expect = window.expect;
  var happn_client = window.HappnClient;

  var clientInstance;
  var default_timeout = 60000;

  this.timeout(default_timeout);

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  beforeEach('creates client', function(callback) {
    happn_client.create(
      {
        port: 55002,
        config: {
          username: '_ADMIN',
          password: 'happn'
        }
      },
      function(e, instance) {
        if (e) return callback(e);
        clientInstance = instance;
        callback();
      }
    );
  });

  afterEach('disconnects client', function(callback) {
    if (clientInstance) return clientInstance.disconnect(callback);
    callback();
  });

  it('tests that session keepalive via heartbeats functions', function(done) {
    this.timeout(default_timeout);

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
      expect(pongs > 3).to.be.equal(true);
      expect(reconnects).to.be.equal(0);
      done();
    }, 15000);
  });

  it('tests that session reconnects because heartbeats have not found their way to the server', function(done) {
    this.timeout(default_timeout);

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
      expect(reconnects > 0).to.be.equal(true);
      clientInstance.socket._write = oldWrite;
      done();
    }, 15000);
  });
});
