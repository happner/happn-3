const tests = require('../../__fixtures/utils/test_helper').create();

describe(tests.testName(__filename, 3), function() {
  const happn = require('../../../lib/index');
  const service = happn.service;
  const happn_client = happn.client;
  let socketClient;
  let eventEmitterClient;

  this.timeout(10000);

  it('tests it does not log attach detach events', function(callback) {
    const messages = [];
    attachDetachTest(
      true,
      msg => {
        messages.push(msg);
      },
      e => {
        if (e) return callback(e);
        tests.expect(messages.length).to.be(0);
        callback();
      }
    );
  });

  it('tests it does log attach detach events', function(callback) {
    const messages = [];
    attachDetachTest(
      false,
      msg => {
        messages.push(msg);
      },
      e => {
        if (e) return callback(e);
        tests.expect(messages.length).to.be(4);
        callback();
      }
    );
  });

  function attachDetachTest(disableSessionEventLogging, logger, callback) {
    const serviceConfig = {
      services: {
        session: {
          config: {
            disableSessionEventLogging
          }
        }
      }
    };
    var serviceInstance;

    service.create(serviceConfig, function(e, happnInst) {
      if (e) return callback(e);

      serviceInstance = happnInst;
      serviceInstance.services.session.log.info = logger;

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
          serviceInstance.services.session
            .localClient({
              username: '_ADMIN',
              password: 'happn'
            })

            .then(function(clientInstance) {
              eventEmitterClient = clientInstance;
              return disconnectClient(eventEmitterClient);
            })

            .then(() => {
              return disconnectClient(socketClient);
            })

            .then(() => {
              return tests.delay(3000);
            })

            .then(() => {
              serviceInstance.stop(callback);
            })

            .catch(function(e) {
              callback(e);
            });
        }
      );
    });
  }

  function disconnectClient(client) {
    return new Promise(resolve => {
      client.disconnect(resolve);
    });
  }
});
