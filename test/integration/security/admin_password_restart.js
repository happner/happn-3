describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var async = require('async');
    var fs = require('fs');
    var happn = require('../../../lib/index');
    var test_secret = 'test_secret';
    var default_timeout = 10000;
    var tmpFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
    var currentService = null;

    var originalPassword = 'original';
    var modifiedPassword = 'modified';

    var stopService = function(callback) {
      if (currentService) {
        currentService.stop(function(e) {
          if (e && e.toString() != 'Error: Not running') return callback(e);
          callback();
        });
      } else callback();
    };

    var initService = function(filename, name, callback) {
      stopService(function(e) {
        if (e) return callback(e);
        var serviceConfig = {
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
          secure: true
        };

        happn.service.create(serviceConfig, function(e, happnService) {
          if (e) return callback(e);
          currentService = happnService;
          callback();
        });
      });
    };

    var getClient = function(service, password, callback) {
      service.services.session.localClient(
        {
          username: '_ADMIN',
          password: password
        },
        function(e, instance) {
          if (e) return callback(e);
          callback(null, instance);
        }
      );
    };

    before('should initialize the service', function(callback) {
      this.timeout(20000);

      initService(tmpFile, 'admin_password_restart', callback);
    });

    after('should delete the temp data file', function(callback) {
      this.timeout(20000);

      stopService(function(e) {
        fs.unlink(tmpFile, function(e) {
          callback();
        });
      });
    });

    it('should modify the admin password, restart the service and log in with the new password', function(callback) {
      this.timeout(default_timeout);

      //check the original password works
      getClient(currentService, originalPassword, function(e) {
        if (e) return callback(e);

        //modify the original password
        currentService.services.security.users
          .upsertUser({ username: '_ADMIN', password: modifiedPassword })

          .then(function() {
            //test the login works with the modified password
            getClient(currentService, modifiedPassword, function(e) {
              if (e) return callback(e);

              //restart the service and ensure we are able to login with the new password
              initService(tmpFile, 'admin_password_restart', function(e) {
                if (e) return callback(e);

                //test the login works with the modified password
                getClient(currentService, modifiedPassword, callback);
              });
            });
          })
          .catch(callback);
      });
    });
  }
);
