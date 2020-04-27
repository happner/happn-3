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

    var checkAllEventsFired = function(callback) {
      return () => {
        tests.expect(eventsFired['session-configured-socket'].id).to.be(socketClientSessionId);
        tests.expect(eventsFired['authentic-socket'].id).to.be(socketClientSessionId);
        tests.expect(eventsFired['disconnect-socket'].id).to.be(socketClientSessionId);
        tests
          .expect(eventsFired['session-configured-eventemitter'].id)
          .to.be(eventEmitterClientSessionId);
        tests.expect(eventsFired['authentic-eventemitter'].id).to.be(eventEmitterClientSessionId);
        tests.expect(eventsFired['disconnect-eventemitter'].id).to.be(eventEmitterClientSessionId);

        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('token":')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('password')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('privateKey')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('keyPair')).to.be(-1);
        tests.expect(JSON.stringify(eventsFired, null, 2).indexOf('secret')).to.be(-1);

        if (stopped) return callback();
        stopped = true;
        return serviceInstance.stop(
          {
            reconnect: false
          },
          callback
        );
      };
    };

    service.create(
      serviceConfig,

      function(e, happnInst) {
        if (e) return callback(e);

        serviceInstance = happnInst;

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

  it.only('tests session events on a secure mesh', function(callback) {
    sessionEventsTest(
      {
        secure: true
      },
      callback
    );
  });
});
