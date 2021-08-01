describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var happn = require('../../../lib/index');
    var happn_client = happn.client;

    var expect = require('expect.js');

    var testClient;
    var serviceInstance;
    var serviceInstanceLocked;
    var serviceInstanceLockedConvenient;

    var getService = async function(config) {
      return new Promise((resolve, reject) => {
        happn.service.create(config, (e, instance) => {
          if (e) return reject(e);
          resolve(instance);
        });
      });
    };

    before('it starts secure defaulted service', async () => {
      serviceInstance = await getService({
        secure: true,
        port: 55000
      });

      serviceInstance.specialSetting = 55000;
    });

    before('it starts secure locked down service', async () => {
      serviceInstanceLocked = await getService({
        secure: true,
        port: 55001,
        services: {
          security: {
            config: {
              disableDefaultAdminNetworkConnections: true
            }
          }
        }
      });
      serviceInstanceLocked.specialSetting = 55001;
    });

    before('it starts secure locked down service, convenience option', async () => {
      serviceInstanceLockedConvenient = await getService({
        secure: true,
        port: 55002,
        disableDefaultAdminNetworkConnections: true
      });
      serviceInstanceLockedConvenient.specialSetting = 55002;
    });

    after('should disconnect the test clients', async () => {
      this.timeout(10000);
      if (testClient) await testClient.disconnect({ reconnect: false });
    });

    after('should stop the test services', async () => {
      this.timeout(10000);

      if (serviceInstance) await serviceInstance.stop();
      if (serviceInstanceLocked) await serviceInstanceLocked.stop();
      if (serviceInstanceLockedConvenient) await serviceInstanceLockedConvenient.stop();
    });

    it('authenticates with the _ADMIN user, using the default password on the non-locked service', async () => {
      testClient = await happn_client.create({
        config: {
          username: '_ADMIN',
          password: 'happn'
        }
      });
    });

    function doWebRequest(path, port, callback) {
      var request = require('request');

      request({ url: 'http://127.0.0.1:' + port + path }, function(error, response, body) {
        callback(error, body);
      });
    }

    it('fails to authenticate with the _ADMIN user, over a web post', function(done) {
      doWebRequest('/auth/login?username=_ADMIN&password=happn', 55001, function(e, body) {
        console.log(body)
        expect(JSON.parse(body).error.message).to.be(
          'use of _ADMIN credentials over the network is disabled'
        );
        done();
      });
    });

    it('fails to authenticate with the _ADMIN user, over a web post, negative test', function(done) {
      doWebRequest('/auth/login?username=_ADMIN&password=happn', 55000, function(e, body) {
        expect(JSON.parse(body).error).to.be(null);
        done();
      });
    });

    it('fails to authenticate with the _ADMIN user, on the locked service', function(done) {
      happn_client.create(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 55001
          }
        },
        function(e) {
          expect(e.toString()).to.be(
            'AccessDenied: use of _ADMIN credentials over the network is disabled'
          );
          done();
        }
      );
    });

    it('fails to authenticate with the _ADMIN user, on the convenience locked service', function(done) {
      happn_client.create(
        {
          config: {
            username: '_ADMIN',
            password: 'happn',
            port: 55002
          }
        },
        function(e) {
          expect(e.toString()).to.be(
            'AccessDenied: use of _ADMIN credentials over the network is disabled'
          );
          done();
        }
      );
    });

    it('fails to authenticate with the _ADMIN user, on the locked service, using a session token', function(done) {
      serviceInstanceLocked.services.session.localClient(
        {
          username: '_ADMIN',
          password: 'happn'
        },
        function(e, adminClient) {
          if (e) return done(e);

          var token = adminClient.session.token;

          adminClient.disconnect(function() {
            happn_client.create(
              {
                config: {
                  port: 55001,
                  token: token
                }
              },
              function(e) {
                expect(e.toString()).to.be(
                  'AccessDenied: use of _ADMIN credentials over the network is disabled'
                );
                done();
              }
            );
          });
        }
      );
    });

    it('authenticates with the _ADMIN user, on the locked service using localAdminClient', function(done) {
      serviceInstanceLocked.services.session.localAdminClient(function(e, adminClient) {
        if (e) return done(e);
        adminClient.get('/_SYSTEM/*', function(e, items) {
          if (e) return done(e);
          expect(items.length > 0).to.be(true);
          adminClient.disconnect(function() {
            done();
          });
        });
      });
    });

    it('authenticates with the localClient using _ADMIN', function(done) {
      serviceInstanceLocked.services.session.localClient(
        {
          username: '_ADMIN',
          password: 'happn'
        },
        function(e, adminClient) {
          if (e) return done(e);
          adminClient.get('/_SYSTEM/*', function(e, items) {
            if (e) return done(e);
            expect(items.length > 0).to.be(true);
            adminClient.disconnect(function() {
              done();
            });
          });
        }
      );
    });
  }
);
