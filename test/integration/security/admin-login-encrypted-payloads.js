xdescribe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var fs = require('fs');
    var happn = require('../../../lib/index');
    var default_timeout = 10000;
    var tmpFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
    var currentService = null;

    var originalPassword = 'original';
    var modifiedPassword = 'modified';

    var stopService = function(callback) {
      if (currentService) {
        currentService.stop(function(e) {
          if (e && e.toString() !== 'Error: Not running') return callback(e);
          callback();
        });
      } else callback();
    };

    var initService = function(filename, name, callback) {
      stopService(function(e) {
        if (e) return callback(e);
        var serviceConfig = {
          port: 55505,
          name: name,
          services: {
            security: {
              config: {
                adminUser: { password: originalPassword }
              }
            },
            data: {
              config: {
                filename: filename
              }
            }
          },
          secure: true,
          encryptPayloads: true
        };

        happn.service.create(serviceConfig, function(e, happnService) {
          if (e) return callback(e);
          currentService = happnService;
          callback();
        });
      });
    };

    var getClient = function(service, callback) {
      service.services.session.localAdminClient(function(e, instance) {
        if (e) return callback(e);
        callback(null, instance);
      });
    };

    before('should initialize the service', function(callback) {
      this.timeout(20000);

      initService(tmpFile, 'admin_login', callback);
    });

    after('should delete the temp data file', function(callback) {
      this.timeout(20000);

      stopService(function() {
        fs.unlink(tmpFile, function() {
          callback();
        });
      });
    });

    it('does an admin login, should modify the admin password, restart the service and do an admin login, then pull data from a restricted path', function(callback) {
      this.timeout(default_timeout);

      //modify the original password
      currentService.services.security.users
        .__upsertUser({ username: '_ADMIN', password: modifiedPassword })

        .then(function() {
          //test the login works with the modified password
          getClient(currentService, function(e) {
            if (e) return callback(e);

            //restart the service and ensure we are able to login with the new password
            initService(tmpFile, 'admin_login', function(e) {
              if (e) return callback(e);

              //test the login works with the modified password
              getClient(currentService, function(e, client) {
                if (e) return callback(e);

                client.get('/_SYSTEM/*', function(e, records) {
                  if (e) return callback(e);

                  expect(records.length > 0).to.be(true);
                  expect(Object.keys(currentService.services.session.__sessions).length).to.be(1);

                  client.on(
                    '/test/path',
                    function(data) {
                      expect(data.test).to.be('data');
                      client.disconnect({ reconnect: false });

                      setTimeout(function() {
                        expect(
                          Object.keys(currentService.services.session.__sessions).length
                        ).to.be(0);
                        callback();
                      }, 3000);
                    },
                    function(e) {
                      if (e) return callback(e);

                      client.set('/test/path', { test: 'data' }, function(e) {
                        if (e) return callback(e);
                      });
                    }
                  );
                });
              });
            });
          });
        })
        .catch(callback);
    });
  }
);
