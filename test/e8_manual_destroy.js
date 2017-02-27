describe('e8_manual_destroy', function () {

  //require('benchmarket').start();
  //after(//require('benchmarket').store());

  var expect = require('expect.js');
  var happn = require('../lib/index');

  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');
  var happnInstance = null;
  var test_id;

  this.timeout(5000);

  /*
   This test demonstrates starting up the happn service -
   the authentication service will use authTokenSecret to encrypt web tokens identifying
   the logon session. The utils setting will set the system to log non priority information
   */

  before('should initialize the service', function (callback) {
    test_id = Date.now() + '_' + require('shortid').generate();

    try {
      service.create(function (e, happnInst) {
        if (e)
          return callback(e);

        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {
    happnInstance.stop(done);
  });

  var clientCount = 10;

  function Tester() {
  }

  it('create, then manually destroy ' + clientCount + ' clients', function (callback) {

    this.timeout(clientCount * 10000);

    async.times(clientCount, function (counter, clientCB) {

      var tester = new Tester();

      happn_client.create(function (e, instance) {

        if (e) return clientCB(e);

        tester.client = instance;

        tester.client.socket.on('destroy', function () {
          clientCB();
        });

        tester.client.socket.destroy();
      });

    }, callback);

  });

  //require('benchmarket').stop();

});
