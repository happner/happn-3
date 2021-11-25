require('../../__fixtures/utils/test_helper').describe(__filename, 20000, test => {
  context('stopping and starting meshes', function() {
    var happn = require('../../../lib/index');

    var default_timeout = 10000;
    var testDbFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
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
          name: name,
          services: {
            data: {
              config: {
                filename: filename
              }
            }
          }
        };

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
      currentService.services.session.localClient(callback);
    };

    before('should initialize the service', function(callback) {
      this.timeout(20000);
      initService(testDbFile, '5_eventemitter_stoppingstarting', callback);
    });

    after('should delete the temp data file', async () => {
      await test.cleanup([], [currentService]);
    });

    it('should push some data into a permanent datastore', function(callback) {
      this.timeout(default_timeout);

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
      this.timeout(default_timeout);

      initService(testDbFile, '5_eventemitter_stoppingstarting', function(e) {
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
      this.timeout(default_timeout);

      initService(null, '5_eventemitter_stoppingstarting', function(e) {
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
      this.timeout(default_timeout);
      initService(testDbFile, '5_eventemitter_stoppingstarting', function(e) {
        if (e) return callback(e);

        var currentPersistedServiceName = currentService.services.system.name;
        test.expect(currentPersistedServiceName).to.be('5_eventemitter_stoppingstarting');

        initService(null, null, function() {
          var currentUnpersistedServiceName = currentService.services.system.name;
          test.expect(currentUnpersistedServiceName).to.not.be('5_eventemitter_stoppingstarting');
          test.expect(currentUnpersistedServiceName).to.not.be(null);
          test.expect(currentUnpersistedServiceName).to.not.be(undefined);

          initService(testDbFile, null, function(e) {
            if (e) return callback(e);

            var currentPersistedRestartedServiceName = currentService.services.system.name;
            test.expect(currentPersistedRestartedServiceName).to.be('5_eventemitter_stoppingstarting');
            callback();
          });
        });
      });
    });
  });
});
