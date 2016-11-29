describe('2_websockets_embedded_sanity', function () {

  // require('benchmarket').start();
  // after(require('benchmarket').store());

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

  var clientCount = 100;

  function getter (object, propertyName, value) {
    Object.defineProperty(object, propertyName, {
      get: function () {
        return value;
      },
      enumerable: true
    })
  }

  function property (object, propertyName, value) {
    Object.defineProperty(object, propertyName, {
      value: value,
      enumerable: false,
      writable: true
    })
  }

  function Tester(){}

  Tester.prototype.__onHappnDisconnect = function(){};
  Tester.prototype.__onHappnReconnect = function(){};

  it('create, then manually destroy ' + clientCount + ' clients', function (callback) {

    this.timeout(clientCount * 10000);

    async.times(clientCount, function(counter, clientCB){

      var tester = new Tester();

      happn_client.create(function (e, instance) {

        if (e) return clientCB(e);

        getter(tester, 'client', instance);

        property(tester, '__disconnectSubscriptionId',
          instance.onEvent('connection-ended', tester.__onHappnDisconnect.bind(tester))
        );

        property(tester, '__retryConnectSubscriptionId',
          instance.onEvent('reconnect-scheduled', tester.__onHappnDisconnect.bind(tester))
        );

        property(tester, '__reconnectSubscriptionId',
          instance.onEvent('reconnect-successful', tester.__onHappnReconnect.bind(tester))
        );

        tester.client.socket.on('destroy', function(){
          console.log('destroyed:::', counter);
          clientCB();
        });

        tester.client.socket.destroy();
      });

    }, callback);

  });

  //require('benchmarket').stop();

});
