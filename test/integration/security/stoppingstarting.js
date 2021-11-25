require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  context('stopping and starting secure meshes', function() {
    var happn = require('../../../lib/index');
    var testDbFile = test.newTestFile();
    var persistKey = '/persistence_test/' + require('shortid').generate();
    var currentService = null;

    var stopService = function(callback) {
      if (currentService) {
        currentService.stop(function(e) {
          if (e && e.toString() !== 'Error: Not running') return callback(e);
          callback();
        });
      } else callback();
    };

    var initService = function(filename, name, callback) {
      var doInitService = function() {
        var serviceConfig = {
          services: {
            data: {
              config: {}
            }
          },
          secure: true
        };

        serviceConfig.services.data.config.filename = filename;
        serviceConfig.name = name;

        happn.service.create(serviceConfig, function(e, happnService) {
          if (e) return callback(e);
          currentService = happnService;
          callback();
        });
      };

      stopService(function(e) {
        if (e) return callback(e);
        doInitService();
      });
    };

    var getClient = function(service, callback) {
      service.services.session.localClient(
        {
          username: '_ADMIN',
          password: 'happn'
        },
        function(e, instance) {
          if (e) return callback(e);

          callback(null, instance);
        }
      );
    };

    before('should initialize the service', function(callback) {
      this.timeout(20000);
      initService(testDbFile, 'b2_eventemitter_security_stoppingstarting', callback);
    });

    after('should delete the temp data file', function(callback) {
      this.timeout(20000);

      stopService(function() {
        test.fs.unlink(testDbFile, function() {
          callback();
        });
      });
    });

    it('should push some data into a permanent datastore', function(callback) {
      getClient(currentService, function(e, testclient) {
        if (e) return callback(e);

        testclient.set(
          persistKey,
          {
            property1: 'prop1',
            prop2: 'prop2'
          },
          null,
          callback
        );
      });
    });

    it('should disconnect then reconnect and reverify the data', function(callback) {
      initService(testDbFile, 'b2_eventemitter_security_stoppingstarting', function(e) {
        if (e) return callback(e);

        getClient(currentService, function(e, testclient) {
          if (e) return callback(e);

          testclient.get(persistKey, null, function(e, response) {
            if (e) return callback(e);

            test.expect(response.property1).to.be('prop1');
            callback();
          });
        });
      });
    });

    it('should create a memory server - check for the data - shouldnt be any', function(callback) {
      initService(null, 'b2_eventemitter_security_stoppingstarting', function(e) {
        if (e) return callback(e);

        getClient(currentService, function(e, testclient) {
          if (e) return callback(e);

          testclient.get(persistKey, null, function(e, response) {
            if (e) return callback(e);

            test.expect(response).to.eql(null);
            callback();
          });
        });
      });
    });

    it('should stop then start and verify the server name', function(callback) {
      initService(testDbFile, 'b2_eventemitter_security_stoppingstarting', function(e) {
        if (e) return callback(e);

        var currentPersistedServiceName = currentService.services.system.name;
        test.expect(currentPersistedServiceName).to.be('b2_eventemitter_security_stoppingstarting');

        initService(null, null, function() {
          var currentUnpersistedServiceName = currentService.services.system.name;
          test
            .expect(currentUnpersistedServiceName)
            .to.not.be('b2_eventemitter_security_stoppingstarting');
          test.expect(currentUnpersistedServiceName).to.not.be(null);
          test.expect(currentUnpersistedServiceName).to.not.be(undefined);

          initService(testDbFile, null, function(e) {
            if (e) return callback(e);

            var currentPersistedRestartedServiceName = currentService.services.system.name;
            test
              .expect(currentPersistedRestartedServiceName)
              .to.be('b2_eventemitter_security_stoppingstarting');
            callback();
          });
        });
      });
    });

    it('should stop then start and verify the server keypair', function(callback) {
      initService(testDbFile, 'b2_eventemitter_security_stoppingstarting', function(e) {
        if (e) return callback(e);

        var currentPersistedServicePublicKey = currentService.services.security._keyPair.publicKey.toString();

        test.expect(currentPersistedServicePublicKey).to.not.be(null);
        test.expect(currentPersistedServicePublicKey).to.not.be(undefined);
        test.expect(currentPersistedServicePublicKey).to.not.be('');

        initService(null, null, function() {
          var currentUnPersistedServicePublicKey = currentService.services.security._keyPair.publicKey.toString();
          test
            .expect(currentUnPersistedServicePublicKey)
            .to.not.be(currentPersistedServicePublicKey);
          test.expect(currentUnPersistedServicePublicKey).to.not.be(null);
          test.expect(currentUnPersistedServicePublicKey).to.not.be(undefined);
          test.expect(currentUnPersistedServicePublicKey).to.not.be('');

          initService(testDbFile, null, function(e) {
            if (e) return callback(e);

            var currentPersistedRestartedServicePublicKey = currentService.services.security._keyPair.publicKey.toString();
            test
              .expect(currentPersistedRestartedServicePublicKey)
              .to.be(currentPersistedServicePublicKey);
            callback();
          });
        });
      });
    });
  });
});
