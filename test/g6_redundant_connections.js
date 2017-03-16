describe('g6_redundant_connections', function () {

  var expect = require('expect.js');
  var happn = require('../lib/index');

  var service1 = happn.service;
  var service2 = happn.service;
  var service3 = happn.service;

  var happn_client = happn.client;

  var async = require('async');

  var service1Port = 8000;
  var service2Port = 8001;
  var service3Port = 8002;

  var service1Client;
  var service2Client;
  var service3Client;

  var default_timeout = 4000;

  var instances = [];

  after('stop all services', function (callback) {

    service1Client.disconnect({timeout:2000})
      .then(service2Client.disconnect({timeout:2000}))
      .then(defaultClient.disconnect({timeout:2000}))
      .then(function () {

        async.eachSeries(instances, function (instance, eachCallback) {
            instance.stop(eachCallback);
          },
          callback
        );
      })
      .catch(callback);

  });

  var initializeService = function (instance, port, callback) {
    instance.initialize({port: port},
      function (e, instance) {
        if (e) return callback(e);

        instances.push(instance);
        callback();
      }
    );
  }

  it('should initialize the services', function (callback) {

    this.timeout(20000);

    try {

      initializeService(service1, service1Port, function (e) {
        if (e) return callback(e);

        initializeService(service2, service2Port, function (e) {
          if (e) return callback(e);

          initializeService(service3, service3Port, callback);
        });
      });

    } catch (e) {
      callback(e);
    }
  });

  it('should initialize the client', function (callback) {

    this.timeout(default_timeout);

    try {

      happn_client.create([
        {config: {port: service1Port}},
        {config: {port: service2Port}},
        {config: {port: service3Port}}
      ], {info:'test'}, function (e, instance) {



      });
    } catch (e) {
      callback(e);
    }
  });

});
