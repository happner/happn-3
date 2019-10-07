describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service1 = happn.service;
    var service2 = happn.service;
    var serviceDefault = happn.service;

    var happn_client = happn.client;
    var async = require('async');

    var service1Port = 8000;
    var service2Port = 8001;

    var service1Client;
    var service2Client;
    var defaultClient;

    var default_timeout = 4000;

    var instances = [];

    after('stop all services', function(callback) {
      service1Client
        .disconnect({
          timeout: 2000
        })
        .then(
          service2Client.disconnect({
            timeout: 2000
          })
        )
        .then(
          defaultClient.disconnect({
            timeout: 2000
          })
        )
        .then(function() {
          async.eachSeries(
            instances,
            function(instance, eachCallback) {
              instance.stop(eachCallback);
            },
            callback
          );
        })
        .catch(callback);
    });

    var initializeService = function(instance, port, callback) {
      instance.initialize(
        {
          port: port
        },
        function(e, instance) {
          if (e) return callback(e);

          instances.push(instance);
          callback();
        }
      );
    };

    it('should initialize the services', function(callback) {
      this.timeout(20000);

      try {
        initializeService(service1, service1Port, function(e) {
          if (e) return callback(e);

          initializeService(service2, service2Port, function(e) {
            if (e) return callback(e);

            initializeService(serviceDefault, null, callback);
          });
        });
      } catch (e) {
        callback(e);
      }
    });

    it('should initialize the clients', function(callback) {
      this.timeout(default_timeout);

      try {
        //plugin, config, context,

        happn_client.create(
          {
            config: {
              port: service1Port
            }
          },
          function(e, instance) {
            if (e) return callback(e);

            service1Client = instance;
            happn_client.create(
              {
                config: {
                  port: service2Port
                }
              },
              function(e, instance) {
                if (e) return callback(e);

                service2Client = instance;
                happn_client.create(
                  {
                    config: {
                      port: 55000
                    }
                  },
                  function(e, instance) {
                    if (e) return callback(e);

                    defaultClient = instance;
                    callback();
                  }
                );
              }
            );
          }
        );
      } catch (e) {
        callback(e);
      }
    });
  }
);
