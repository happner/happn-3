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

  var initializeService = function (instance, port, callback) {

    instance.initialize({port: port},

      function (e, instance) {

        if (e) return callback(e);

        instances.push(instance);
        callback();
      }
    );
  };

  var disconnectClient = function(client){

    return new Promise(function(resolve, reject){

      if (!client) resolve();

      return client.disconnect(function(){

        resolve();
      });
    });
  };

  beforeEach('should stop all the clients and services', function (callback) {

    this.timeout(20000);

    disconnectClient(service1Client)

      .then(function(){
        return disconnectClient(service2Client);
      })

      .then(function(){
        return disconnectClient(service3Client);
      })

      .then(function(){
        return disconnectClient(redundantClient);
      })

      .then(function(){

        async.eachSeries(instances, function (instance, eachCallback) {
            instance.stop(eachCallback);
          },
          function(e){

            if (e) return callback(e);

            callback();
          }
        );
      })

      .catch(callback);
  });

  beforeEach('should initialize the services', function (callback) {

    this.timeout(20000);

    try {

      initializeService(service1, service1Port, function (e) {

        if (e) return callback(e);

        initializeService(service2, service2Port, function (e) {

          if (e) return callback(e);

          initializeService(service3, service3Port, function(e){

            if (e) return callback(e);

            callback();
          });
        });
      });

    } catch (e) {
      callback(e);
    }
  });

  beforeEach('should initialize the clients', function (callback) {

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

  var setData = function (client, id, callback) {
    return client.set('/test/data', {id: id}, callback);
  };

  beforeEach('should set up the test data', function (callback) {

    setData(service1Client, 1, function (e) {
      if (e) return callback(e);
      setData(service2Client, 2, function (e) {
        if (e) return callback(e);
        setData(service3Client, 3, callback);
      });
    });
  });

  it('random connections, should connect to the first service, then service to be switched off - fallback to second service', function (done) {

    this.timeout(5000);

    happn_client.create([
      {config: {port: service1Port}},
      {config: {port: service2Port}},
      {config: {port: service3Port}}
    ], {
      info: 'test_random',//info is appended to each connection
      poolType: happn.constants.CONNECTION_POOL_TYPE.RANDOM,//default is 0 RANDOM
      poolReconnectAttempts: 6, //how many switches to perform until a connection is made
      socket: {
        reconnect: {
          retries: 1,//one retry
          timeout: 100
        }
      }
    }, function (e, instance) {

      if (e) return done(e);

      var serverId;

      var reconnections = 0;

      redundantClient = instance;

      expect(redundantClient.session.info.data).to.be('test_random');

      redundantClient.onEvent('reconnect-successful', function (data) {

        reconnections++;

        if (reconnections >= 2) {

          return done();
        }

        expect(redundantClient.session.info.data).to.be('test_random');

        redundantClient.get('/test/data', function (e, response) {

          if (e) return done(e);

          expect(response.id != serverId).to.be(true);

          serverId = response.id;

          instances[serverId - 1].stop(function (e) {

            if (e) return done(e);
          });
        });
      });

      redundantClient.get('/test/data', function (e, response) {

        if (e) return done(e);

        serverId = response.id;

        instances[serverId - 1].stop(function (e) {

          if (e) return done(e);
        });
      });
    });
  });

  it('ordered connections, should connect to the first service, then service to be switched off - fallback to second service', function (done) {

    this.timeout(5000);

    happn_client.create([
      {config: {port: service1Port}},
      {config: {port: service2Port}},
      {config: {port: service3Port}}
    ], {
      info: 'redundant_ordered',//info is appended to each connection
      poolType: happn.constants.CONNECTION_POOL_TYPE.ORDERED,//default is 0 RANDOM
      poolReconnectAttempts: 3, //how many switches to perform until a connection is made
      socket: {
        reconnect: {
          retries: 1,//one retry
          timeout: 100
        }
      }
    }, function (e, instance) {

      if (e) return done(e);

      redundantClient = instance;

      console.log('redundant client exists ok:::');

      expect(redundantClient.session.info.data).to.be('redundant_ordered');

      redundantClient.onEvent('reconnect-successful', function (data) {

        expect(redundantClient.session.info.data).to.be('redundant_ordered');

        console.log('reconnected:::');

        redundantClient.get('/test/data', function (e, response) {

          if (e) return done(e);

          console.log('did get:::', response.id);

          expect(response.id).to.be(2);

          redundantClient.disconnect(done);
        });
      });

      console.log('redundant client attached event:::');

      redundantClient.get('/test/data', function (e, response) {

        if (e) return done(e);

        console.log('redundant client did get:::', response.id);

        expect(response.id).to.be(1);

        instances[0].stop(function (e) {

          console.log('stopped service:::');
          if (e) return done(e);
        });
      });
    });
  });
});
