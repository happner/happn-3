//checks info is stored next to login
describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var Happn = require('../../..');
    var expect = require('expect.js');
    var Promise = require('bluebird');
    var async = require('async');

    this.timeout(60000);

    var testPort = 55001;

    var server1;

    var activeClient;

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
      return new Promise(function(resolve, reject) {
        var addedTestGroup2;
        var addedTestuser2;

        server1.services.security.users.upsertGroup(
          testGroup2,
          {
            overwrite: false
          },
          function(e, result) {
            if (e) return reject(e);
            addedTestGroup2 = result;

            server1.services.security.users.upsertUser(
              testUser2,
              {
                overwrite: false
              },
              function(e, result) {
                if (e) return reject(e);
                addedTestuser2 = result;

                server1.services.security.users.linkGroup(addedTestGroup2, addedTestuser2, function(
                  e
                ) {
                  if (e) return reject(e);
                  resolve();
                });
              }
            );
          }
        );
      });
    }

    function createService(config) {
      config.secure = true;
      config.port = testPort;

      return Happn.service
        .create(config)
        .then(function(server) {
          server1 = server;
        })
        .then(linkUser);
    }

    function stopService() {
      return new Promise(function(resolve, reject) {
        if (!server1) resolve();

        var stopService = function(clientE) {
          //eslint-disable-next-line no-console
          if (clientE) console.warn('client disconnect failed:::', clientE);

          server1.stop(function(e) {
            if (e) {
              //eslint-disable-next-line no-console
              console.warn('failed to stop server1: ' + e.toString());
              reject(e);
              return;
            }
            resolve();
          });
        };

        if (activeClient) activeClient.disconnect(stopService);
        else stopService();
      });
    }

    after('stops the service if it exists', function(done) {
      stopService()
        .then(done)
        .catch(function() {
          done();
        });
    });

    it('does some unsuccessful logins, ensures our __locks is non existant, able to log in ok again', function(done) {
      this.timeout(10000);

      activeClient = null;

      async.series(
        [
          function(itemCB) {
            createService({
              services: {
                security: {
                  config: {
                    accountLockout: {
                      enabled: false
                    }
                  }
                }
              }
            })
              .then(function() {
                itemCB();
              })
              .catch(function(e) {
                itemCB(e);
              });
          },
          function(itemCB) {
            Happn.client
              .create({
                config: {
                  username: testUser2.username,
                  password: 'BAD...',
                  port: testPort
                }
              })
              .catch(function(e) {
                expect(e.toString()).to.be('AccessDenied: Invalid credentials');
                expect(server1.services.security.__locks).to.be(undefined);
                itemCB();
              });
          },
          function(itemCB) {
            Happn.client
              .create({
                config: {
                  username: testUser2.username,
                  password: 'BAD...',
                  port: testPort
                }
              })
              .catch(function(e) {
                expect(e.toString()).to.be('AccessDenied: Invalid credentials');
                expect(server1.services.security.__locks).to.be(undefined);
                itemCB();
              });
          },
          function(itemCB) {
            Happn.client
              .create({
                config: {
                  username: testUser2.username,
                  password: testUser2.password,
                  port: testPort
                }
              })
              .then(function(client) {
                activeClient = client;
                itemCB();
              })
              .catch(function(e) {
                itemCB(e);
              });
          },
          function(itemCB) {
            stopService()
              .then(function() {
                itemCB();
              })
              .catch(function(e) {
                itemCB(e);
              });
          }
        ],
        done
      );
    });
  }
);
