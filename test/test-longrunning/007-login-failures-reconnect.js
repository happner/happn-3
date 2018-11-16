var Happn = require('../../lib/index');
var expect = require('expect.js');
var Promise = require('bluebird');

var service1Name;
//checks info is stored next to login
describe(require('path').basename(__filename), function () {

  this.timeout(60000);

  var testPort = 55001;

  var server1;

  var testGroup2 = {
    name: 'TEST GROUP2',
    custom_data: {
      customString: 'custom2',
      customNumber: 0
    }
  };

  testGroup2.permissions = {
    '/@HTTP/secure/test/removed/user': {
      actions: ['get']
    },
    '/@HTTP/secure/test/not_removed/user': {
      actions: ['get']
    }
  };

  var testUser2 = {
    username: 'TEST USER2@blah.com',
    password: 'TEST PWD'
  };

  function linkUser() {
    return new Promise(function (resolve, reject) {
      var addedTestGroup2;
      var addedTestuser2;

      server1.services.security.users.upsertGroup(testGroup2, {
        overwrite: false
      }, function (e, result) {

        if (e) return reject(e);
        addedTestGroup2 = result;

        server1.services.security.users.upsertUser(testUser2, {
          overwrite: false
        }, function (e, result) {

          if (e) return reject(e);
          addedTestuser2 = result;

          server1.services.security.users.linkGroup(addedTestGroup2, addedTestuser2, function (e) {

            if (e) return reject(e);
            resolve();
          });
        });
      });
    });
  }

  function createService(allowLogin, returnError) {

    return Happn.service.create({
        secure: true,
        port: testPort
      })

      .then(function (server) {

        server1 = server;
        service1Name = server.name;

        if (!allowLogin) {
          if (returnError) {
            server1.services.security.login = function (credentials, sessionId, request, callback) {
              this.emit('loginAttempt');
              callback(new Error('TEST ERROR'));
            };
          } else {
            server1.services.security.login = function (credentials, sessionId, request, callback) {
              this.emit('loginAttempt');
            };
          }
        }
        server1.services.session.primus.on('connection', function () {
          console.log('Connection attempt');
          server1.services.session.emit('connectionAttempt');
        });
      })
      .then(linkUser);
  }

  function stopService() {
    return new Promise(function (resolve) {

      if (!server1) resolve();

      server1.stop(function (e) {
        if (e) {
          console.warn('failed to stop server1: ' + e.toString());
          reject(e);
          return;
        }

        resolve();
      });
    });
  }

  before('starts the services', function () {
    return createService(true);
  });

  after('stops the services', function () {
    return stopService();
  });

  it('logs in normally', function () {
    Happn.client.create({
        config: {
          username: testUser2.username,
          password: testUser2.password,
          port: testPort
        }
      })
      .then(function (clientInstance) {
        return clientInstance.disconnect();
      });
  });

  it('tests login retries', function (done) {

    this.timeout(10000);

    var client;

    Happn.client.create({
        username: testUser2.username,
        password: testUser2.password,
        port: testPort,
        loginRetry: 10, //this means we retry logging in to the same endpoint 10 times before failing
        loginRetryInterval: 2000 //will retry every 2 seconds
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function waitForDisconnect() {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-scheduled',
              function waitForReconnectScheduled() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function startServiceWithNoLogin() {

        return createService(false, true);
      })
      .then(function waitForLoginAttempt() {

        return new Promise(function (resolve) {
          server1.services.security.on('loginAttempt', function waitForAttempt() {
            server1.services.subscription.removeAllListeners('loginAttempt');
            resolve();
          });
        });
      })
      .then(function () {

        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-successful',

              function waitForConnectSuccess() {

                client.offEvent(subHandle);
                client.disconnect(done);
              }
            );
            resolve();
          }
        });
      })
      .then(function () {

        server1.services.security.login = function (credentials, sessionId, request, callback) {
          this.emit('loginAttempt');
          callback(null, {user:{}}); //allow login
        }.bind(server1.services.security);

      });
  });

  it('can login again if a login attempt failed on reconnect', function () {

    var client;

    return Happn.client.create({
        config: {
          username: testUser2.username,
          password: testUser2.password,
          port: testPort,
          callTimeout: 2000,
          loginRetry: 0 //don't login retry
        }
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function waitForDisconnect() {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-scheduled',
              function waitForReconnectScheduled() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function startServiceWithNoLogin() {

        return createService(false);
      })
      .then(function waitForLoginAttempt() {

        return new Promise(function (resolve) {
          server1.services.security.on('loginAttempt', function waitForAttempt() {
            server1.services.subscription.removeAllListeners('loginAttempt');
            resolve();
          });
        });
      })
      .then(function () {
        delete server1.services.security.login;
      })
      .then(function () {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-successful',
              function waitForConnectSuccess() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function () {
        return client.disconnect();
      });
  });

  it('does not retry if we are connected', function () {

    this.timeout(30000);

    var client;

    return Happn.client.create({
        config: {
          username: testUser2.username,
          password: testUser2.password,
          port: testPort,
          callTimeout: 2000,
          loginRetry: 0 //don't login retry
        }
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function waitForDisconnect() {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-scheduled',
              function waitForReconnectScheduled() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function startServiceWithNoLogin() {
        return createService(false);
      })
      .then(function waitForLoginAttempt() {

        return new Promise(function (resolve) {
          server1.services.security.on('loginAttempt', function waitForAttempt() {
            server1.services.security.removeAllListeners('loginAttempt');
            resolve();
          });
        });
      })
      .then(stopService)
      .then(function () {
        return createService(true);
      })
      .then(function () {
        return new Promise(function (resolve) {
          {
            var subHandle = client.onEvent('reconnect-successful',
              function waitForConnectSuccess() {
                client.offEvent(subHandle);
                resolve();
              });
          }
        });
      })
      .then(function () {

        return new Promise(function (resolve, reject) {
          {

            var subHandle = client.onEvent('reconnect',
              function waitForConnectSuccess() {
                reject(new Error('This should not happen'));
              });

            setTimeout(function () {
              client.offEvent(subHandle);
              resolve();
            }, 20000);
          }
        });
      })
      .then(function () {
        return client.disconnect();
      });
  });

  it('will not reconnect after shutdown', function () {

    this.timeout(30000);

    var client;

    return Happn.client.create({
        username: testUser2.username,
        password: testUser2.password,
        port: testPort,
        callTimeout: 2000,
        loginRetry: 0 //don't login retry
      })
      .then(function (clientInstance) {
        client = clientInstance;
        return stopService();
      })
      .then(function () {
        return client.disconnect();
      })
      .then(function startServiceWithNoLogin() {
        return createService(false);
      })
      .then(function () {

        return new Promise(function (resolve) {
          {
            var eventCalled = 0;

            var subHandle = client.onEvent('reconnect',
              function waitForReconnect() {
                eventCalled++;
              });

            setTimeout(function () {
              expect(eventCalled).to.equal(0);
              client.offEvent(subHandle);
              return client.disconnect(function(){
                resolve();
              });
            }, 20000);
          }
        });
      })
  });

  it('kills a client that is started with "create" and fails to login', function (done) {

    this.timeout(60000);

    var started = Date.now();

    var reconnectionAttempts = 0;

    Happn.client.create({
        config: {
          username: testUser2.username,
          password: 'bad_password',
          port: testPort,
          loginRetry: 0,
          loginTimeout: 4000
        }
      })
      .then(function () {
        return done(new Error('Should not get a client'));
      })
      .catch(function (e) {

        expect(e).to.not.be(null);

        stopService()

          .then(function () {
            return createService(true);
          })

          .then(function () {

            server1.services.session.on('connectionAttempt', function waitForAttempt() {
              reconnectionAttempts++;
            });

            setTimeout(function () {

              server1.services.session.removeAllListeners('connectionAttempt');

              expect(reconnectionAttempts == 0).to.be(true);

              done();

            }, 10000);
          });
      });

  });

  it('only calls the create callback once', function (done) {

    this.timeout(60000);

    var callbackCalled = 0;

    Happn.client.create({
      username: testUser2.username,
      password: testUser2.password,
      port: testPort + 1,
      callTimeout: 2000,
      loginRetry: 0 //don't login retry

    }, function (e) {

      callbackCalled++;

      expect(e).to.be.an('object');

      setTimeout(function () {
        expect(callbackCalled).to.equal(1);
        done();
      }, 30000);
    });
  });
});
