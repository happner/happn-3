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

  var redundantClient;

  var default_timeout = 4000;

  var instances = [];

  after('stop all services', function (callback) {

    service1Client.disconnect({timeout:2000})
      .then(service2Client.disconnect({timeout:2000}))
      .then(service3Client.disconnect({timeout:2000}))
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
  };

  before('should initialize the services', function (callback) {

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

  before('should initialize the clients', function (callback) {
    this.timeout(default_timeout);

    try {
      //plugin, config, context,

      happn_client.create({config: {port: service1Port}}, function (e, instance) {

        if (e) return callback(e);

        service1Client = instance;
        happn_client.create({config: {port: service2Port}}, function (e, instance) {

          if (e) return callback(e);

          service2Client = instance;
          happn_client.create({config: {port: service3Port}}, function (e, instance) {

            if (e) return callback(e);

            service3Client = instance;
            callback();

          });
        });
      });

    } catch (e) {
      callback(e);
    }
  });

  var setData = function(client, id, callback){
    return client.set('/test/data', {id:id}, callback);
  };

  before('should set up the test data', function (callback) {

    setData(service1Client, 1, function(e){
      if (e) return callback(e);
      setData(service2Client, 2, function(e){
        if (e) return callback(e);
        setData(service3Client, 3, callback);
      });
    });
  });

  it('should connect to the first service, then service to be switched off - fallback to second service', function(done){

    this.timeout(5000);

    happn_client.create([
      {config: {port: service1Port}},
      {config: {port: service2Port}},
      {config: {port: service3Port}}
    ], {
        info:'test',//info is appended to each connection
        poolType:happn.constants.CONNECTION_POOL_TYPE.ORDERED,//default is 0 RANDOM
        poolReconnectAttempts:3, //how many switches to perform until a connection is made
        socket:{
          reconnect:{
            retries:1,//one retry
            timeout:100
          }
        }
      }, function (e, instance) {

      if (e) return done(e);

      redundantClient = instance;

      redundantClient.onEvent('reconnect-successful', function(data){

        redundantClient.get('/test/data', function(e, response) {

          if (e) return done(e);

          expect(response.id).to.be(2);

          redundantClient.disconnect(done);
        });
      });

      redundantClient.get('/test/data', function(e, response){

        if (e) return done(e);

        expect(response.id).to.be(1);

        instances[0].stop(function(e){

          if (e) return done(e);
        });
      });
    });
  });
});
