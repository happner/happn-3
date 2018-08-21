describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');

  this.timeout(10000);

  it('injects inbound protocol layers', function (callback) {

    var layerLog1 = [];
    var layerLog2 = [];

    var inboundLayers = [
      function (message, cb) {
        layerLog1.push(message);
        return cb(null, message);
      },
      function (message, cb) {
        layerLog2.push(message);
        return cb(null, message);
      }
    ];

    var serviceConfig = {
      secure: true,
      services: {
        protocol: {
          config: {
            inboundLayers: inboundLayers
          }
        }
      }
    };

    service.create(serviceConfig,

      function (e, happnInst) {

        if (e) return callback(e);
        var serviceInstance = happnInst;

        happn_client.create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          info: {
            from: 'startup'
          }
        }, function (e, instance) {

          if (e) return callback(e);

          var clientInstance = instance;

          clientInstance.set('/did/set', {
            'test': 'data'
          }, function (e) {

            if (e) return callback(e);

            expect(layerLog1.length > 0).to.be(true);
            expect(layerLog2.length > 0).to.be(true);

            clientInstance.disconnect(function () {

              serviceInstance.stop({
                reconnect: false
              }, callback);
            });
          });
        });
      }
    );
  });

  it('injects outbound protocol layers', function (callback) {

    var layerLog1 = [];
    var layerLog2 = [];

    var outboundLayers = [
      function (message, cb) {
        layerLog1.push(message);
        return cb(null, message);
      },
      function (message, cb) {
        layerLog2.push(message);
        return cb(null, message);
      }
    ];

    var serviceConfig = {
      secure: true,
      services: {
        protocol: {
          config: {
            outboundLayers: outboundLayers
          }
        }
      }
    };

    service.create(serviceConfig,

      function (e, happnInst) {

        if (e) return callback(e);
        var serviceInstance = happnInst;

        happn_client.create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          info: {
            from: 'startup'
          }
        }, function (e, instance) {

          if (e) return callback(e);

          var clientInstance = instance;

          clientInstance.on('/did/on', function (data) {

            expect(layerLog1.length > 0).to.be(true);
            expect(layerLog2.length > 0).to.be(true);

            clientInstance.disconnect(function () {

              serviceInstance.stop({
                reconnect: false
              }, callback);
            });
          }, function (e) {
            if (e) return callback(e);
            clientInstance.set('/did/on', {
              'test': 'data'
            }, function (e) {

              if (e) return callback(e);
            });
          });
        });
      }
    );
  });

  it('injects outbound and inbound protocol layers', function (callback) {

    var layerLog1 = [];
    var layerLog2 = [];
    var layerLog3 = [];
    var layerLog4 = [];

    var inboundLayers = [
      function (message, cb) {
        layerLog3.push(message);
        return cb(null, message);
      },
      function (message, cb) {
        layerLog4.push(message);
        return cb(null, message);
      }
    ];

    var outboundLayers = [
      function (message, cb) {
        layerLog1.push(message);
        return cb(null, message);
      },
      function (message, cb) {
        layerLog2.push(message);
        return cb(null, message);
      }
    ];

    var serviceConfig = {
      secure: true,
      services: {
        protocol: {
          config: {
            outboundLayers: outboundLayers,
            inboundLayers: inboundLayers
          }
        }
      }
    };

    service.create(serviceConfig,

      function (e, happnInst) {

        if (e) return callback(e);
        var serviceInstance = happnInst;

        happn_client.create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          },
          info: {
            from: 'startup'
          }
        }, function (e, instance) {

          if (e) return callback(e);

          var clientInstance = instance;

          clientInstance.on('/did/both', function (data) {

            expect(layerLog1.length > 0).to.be(true);
            expect(layerLog2.length > 0).to.be(true);
            expect(layerLog3.length > 0).to.be(true);
            expect(layerLog4.length > 0).to.be(true);

            clientInstance.disconnect(function () {
              serviceInstance.stop({
                reconnect: false
              }, callback);
            });
          }, function (e) {
            if (e) return callback(e);
            clientInstance.set('/did/both', {
              'test': 'data'
            }, function (e) {
              if (e) return callback(e);
            });
          });
        });
      }
    );
  });
});
