//const log = require('why-is-node-running');

describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3),function () {

  var expect = require('expect.js');
  var async = require('async');
  var happn = require('../../../lib/index');
  var service1 = happn.service;
  var service2 = happn.service;

  var service1Port = 8000;
  var service2Port = 8000;

  var service1Client;
  var service2Client;
  var defaultClient;

  var default_timeout = 4000;

  var instances = [];

  var initializeService = function (instance, port, callback, deferListen) {
    instance.create({
        port: port,
        deferListen: deferListen || false
      },
      function (e, instance) {
        if (e) return callback(e);
        instances.push(instance);
        callback();
      }
    );
  };

  it('should initialize the services, with one taking up the port, we should check port availablility happens', function (callback) {

    this.timeout(20000);

    try {

      initializeService(service1, service1Port, function (e) {

        if (e) return callback(e);

        setTimeout(function(){
          instances[0].stop();
        }, 3000);

        var logs = [];

        initializeService(service2, service2Port, function (e) {

          if (e) return callback(e);

          instances[1].services.transport.happn.log.info = function(message){
            logs.push(message);
          }

          instances[1].listen(function(e){

            if (e) return callback(e);

            var waitingMessageFound = false;

            logs.forEach(function(logItem){
              if (logItem.indexOf('port number ' + 8000 + ' held by another process') == 0) waitingMessageFound = true;
            });

            expect(waitingMessageFound).to.be(true);

            instances[1].stop();
            instances = [];
            setTimeout(callback, 2000);
          })
        }, true);
      });

    } catch (e) {
      callback(e);
    }
  });

  it('should initialize the services, with one taking up the port, we should check port availablility happens, then eventually times out', function (callback) {

    this.timeout(20000);

    try {

      initializeService(service1, service1Port, function (e) {

        if (e) return callback(e);

        var logs = [];

        initializeService(service2, service2Port, function (e) {

          if (e) return callback(e);

          instances[1].services.transport.happn.log.info = function(message){
            logs.push(message);
          }

          instances[1].listen(function(e){

            expect(e.toString()).to.be('Error: timeout');

            var waitingMessageFound = false;

            logs.forEach(function(logItem){
              if (logItem.indexOf('port number ' + 8000 + ' held by another process') == 0) waitingMessageFound = true;
            });

            expect(waitingMessageFound).to.be(true);

            instances[0].stop();
            instances[1].stop();
            setTimeout(callback, 2000);
          })
        }, true);
      });

    } catch (e) {
      callback(e);
    }
  });

  // after('shows why node is still running', function(callback){
  //   this.timeout(5000);
  //   setTimeout(function(){
  //     log();
  //     callback();
  //   }, 2000);
  // });
});
