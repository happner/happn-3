describe('f5_client_disconnection', function () {

  var expect = require('expect.js');
  var happn = require('../lib/index')
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');
  var Promise = require('bluebird');

  var test_secret = 'test_secret';
  var mode = "embedded";
  var default_timeout = 4000;
  var happnInstance = null;

  var clientCount = 5;

  var Service1;

  var Service2;

  var webSocketClientsService1 = [];

  var localClientsService1 = [];

  var webSocketClientsService2 = [];

  var localClientsService2 = [];

  before('should initialize the services', function (callback) {

    this.timeout(10000);

    test_id = Date.now() + '_' + require('shortid').generate();

    try {

      service.create({
        port: 55002
      }, function (e, happnInst) {

        if (e) return callback(e);

        Service1 = happnInst;

        console.log('created unsecured instance:::');

        service.create({
          secure: true,
          port: 55003
        }, function (e, happnInst) {

          if (e) return callback(e);

          Service2 = happnInst;

          console.log('created secured instance:::');

          callback();
        });
      });
    } catch (e) {
      callback(e);
    }
  });

  var getClients = function (service, clientCount, opts, callback) {

    var wsClientCollection = [];
    var localClientCollection = [];

    async.times(clientCount, function (count, countCB) {

      try {

        happn_client.create(opts, function (e, instance) {

          if (e) return callback(e);

          wsClientCollection.push(instance);

          service.services.session.localClient(opts, function (e, instance) {

            if (e) return callback(e);

            localClientCollection.push(instance);

            countCB();
          });
        });

      } catch (e) {
        countCB(e);
      }

    }, function (e) {

      if (e) return callback(e);

      callback(null, wsClientCollection, localClientCollection);

    });
  };

  it('should initialize the Service1 clients, disconnect all the clients and ensure we have no remaining client data', function (callback) {

    getClients(Service1, 5, {
      port: 55002
    }, function (e, wsClients, localClients) {
      if (e) return callback(e);

      Service1.services.session.disconnectAllClients(function (e) {
        if (e) return callback(e);

        console.log(Service1.services.session.__sessions);
        callback();
      });
    });
  });

  it('should initialize the Service2 clients, disconnect all the clients and ensure we have no remaining client data', function (callback) {

    getClients(Service2, 5, {
      port: 55003,
      username: '_ADMIN',
      password: 'happn'
    }, function (e, wsClients, localClients) {
      if (e) return callback(e);

      Service2.services.session.disconnectAllClients(function (e) {
        if (e) return callback(e);

        console.log(Service2.services.session.__sessions);
        callback();
      });
    });
  });

});
