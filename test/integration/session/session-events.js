const tests = require('../../__fixtures/utils/test_helper').create();

describe(tests.testName(__filename, 3), function() {
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var socketClient;
  var eventEmitterClient;
  var socketClientSessionId;
  var eventEmitterClientSessionId;

  this.timeout(10000);

  var sessionEventsTest = function(serviceConfig, callback) {
    if (typeof serviceConfig === 'function') {
      callback = serviceConfig;
      serviceConfig = {};
    }
    var eventsFired = {};
    var serviceInstance;
    var stopped = false;

    var checkEventEmitterStructure = function(eventData, protocol, username) {
      tests.expect(eventData.id).to.be(eventEmitterClientSessionId);
      tests.expect(eventData.legacyPing).to.be(false);
      tests.expect(Number.isInteger(eventData.msgCount)).to.be(true);
      tests.expect(eventData.protocol).to.be(protocol || `happn_${tests.package.protocol}`);
      tests.expect(eventData.browser).to.be(false);
      tests.expect(eventData.intraProc).to.be(true);
      if (username) tests.expect(eventData.user.username).to.be(username);
    };

    var checkSocketEventStructure = function(eventData, protocol, username) {
      tests.expect(eventData.id).to.be(socketClientSessionId);
      tests.expect(eventData.legacyPing).to.be(false);
      tests.expect(Number.isInteger(eventData.msgCount)).to.be(true);
      tests.expect(eventData.protocol).to.be(protocol || `happn_${tests.package.protocol}`);
      tests.expect(eventData.browser).to.be(false);
      tests.expect(eventData.intraProc).to.be(false);
      tests.expect(eventData.sourceAddress).to.be('127.0.0.1');
      tests.expect(eventData.sourcePort > 0).to.be(true);
      tests.expect(eventData.upgradeUrl != null).to.be(true);
      if (username) tests.expect(eventData.user.username).to.be(username);
    };

    var checkAllEventsFired = function(callback) {
      return () => {
        checkSocketEventStructure(eventsFired['connect-socket'], 'happn');
        checkSocketEventStructure(eventsFired['session-configured-socket']);

        if (serviceConfig.secure)
          checkSocketEventStructure(eventsFired['authentic-socket'], null, '_ADMIN');
        else checkSocketEventStructure(eventsFired['authentic-socket']);

        if (serviceConfig.secure)
          checkSocketEventStructure(eventsFired['disconnect-socket'], null, '_ADMIN');
        else checkSocketEventStructure(eventsFired['disconnect-socket']);

        checkEventEmitterStructure(eventsFired['connect-eventemitter'], 'happn');
        checkEventEmitterStructure(eventsFired['session-configured-eventemitter']);

        if (serviceConfig.secure)
          checkEventEmitterStructure(eventsFired['authentic-eventemitter'], null, '_ADMIN');
        else checkEventEmitterStructure(eventsFired['authentic-eventemitter']);

        if (serviceConfig.secure)
          checkEventEmitterStructure(eventsFired['disconnect-eventemitter'], null, '_ADMIN');
        else checkEventEmitterStructure(eventsFired['disconnect-eventemitter']);

        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('token":')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('password')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('privateKey')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('keyPair')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('secret')).to.be(-1);

        if (stopped) return callback();
        stopped = true;
        return serviceInstance.stop(callback);
      };
    };

    service.create(
      serviceConfig,

      function(e, happnInst) {
        if (e) return callback(e);

        serviceInstance = happnInst;

        serviceInstance.services.session.on('connect', function(data) {
          if (data.intraProc) return (eventsFired['connect-eventemitter'] = data);
          eventsFired['connect-socket'] = data;
        });

        serviceInstance.services.session.on('authentic', function(data) {
          if (data.info._local) return (eventsFired['authentic-eventemitter'] = data);
          eventsFired['authentic-socket'] = data;
        });

        serviceInstance.services.session.on('disconnect', function(data) {
          if (data.info._local) return (eventsFired['disconnect-eventemitter'] = data);
          eventsFired['disconnect-socket'] = data;
        });

        serviceInstance.services.session.on('session-configured', function(data) {
          if (data.intraProc) return (eventsFired['session-configured-eventemitter'] = data);
          eventsFired['session-configured-socket'] = data;
        });

        happn_client.create(
          {
            config: {
              username: '_ADMIN',
              password: 'happn'
            }
          },
          function(e, instance) {
            if (e) return callback(e);

            socketClient = instance;
            socketClientSessionId = socketClient.session.id;

            serviceInstance.services.session
              .localClient({
                username: '_ADMIN',
                password: 'happn'
              })

              .then(function(clientInstance) {
                eventEmitterClient = clientInstance;
                eventEmitterClientSessionId = eventEmitterClient.session.id;
                return disconnectClient(eventEmitterClient);
              })

              .then(() => {
                return disconnectClient(socketClient);
              })

              .then(() => {
                return tests.delay(3000);
              })

              .then(checkAllEventsFired(callback))

              .catch(function(e) {
                callback(e);
              });
          }
        );
      }
    );
  };

  function disconnectClient(client) {
    return new Promise(resolve => {
      client.disconnect(resolve);
    });
  }

  it('tests session events on an unsecured mesh', function(callback) {
    sessionEventsTest(callback);
  });

  it('tests session events on a secure mesh', function(callback) {
    sessionEventsTest(
      {
        secure: true
      },
      callback
    );
  });
});
