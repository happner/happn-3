const testHelper = require('../../__fixtures/utils/test_helper').create();
describe(testHelper.testName(__filename, 3), function() {
  const expect = require('expect.js');
  const happn = require('../../../lib/index');
  const service = happn.service;
  const happn_client = happn.client;
  const delay = require('await-delay');
  const Primus = require('happn-primus-wrapper');
  this.timeout(60000);

  var serviceInstance;
  var clientInstance;

  it('tests switching the cleanup on, zombie sockets are removed, verbose', async () => {
    await getService(2000, 5000, true);
    zombieSocket();
    zombieSocket();
    zombieSocket();
    zombieSocket();
    await delay(2000);
    expect(Object.keys(serviceInstance.services.session.__sessions).length > 1).to.be(true);
    await delay(15000);
    expect(Object.keys(serviceInstance.services.session.__sessions).length).to.be(1);
  });

  it('tests switching the cleanup on, zombie sockets are removed, not verbose', async () => {
    await getService(2000, 5000, false);
    zombieSocket();
    zombieSocket();
    zombieSocket();
    zombieSocket();
    await delay(2000);
    expect(Object.keys(serviceInstance.services.session.__sessions).length > 1).to.be(true);
    await delay(15000);
    expect(Object.keys(serviceInstance.services.session.__sessions).length).to.be(1);
  });

  it('tests switching the cleanup on, zombie sockets are not removed', async () => {
    await getService(0);
    zombieSocket();
    zombieSocket();
    zombieSocket();
    zombieSocket();
    await delay(5000);
    expect(Object.keys(serviceInstance.services.session.__sessions).length).to.be(5);
    await delay(15000);
    expect(Object.keys(serviceInstance.services.session.__sessions).length).to.be(5);
  });

  it('tests switching the cleanup on, on an unsecured server, happn shouldnt start up', async () => {
    try {
      await getService(2000, 5000, true, false);
    } catch (e) {
      expect(e.message).to.be('unable to cleanup sockets in an unsecure setup');
    }
  });

  afterEach('disconnects the client and stops the server', async () => {
    this.timeout(3000);
    await disconnectZombies();
    await disconnectClient();
    await stopService();
  });

  // in case this is necessary next time
  // after('why is node running', async () => {
  //   await testHelper.printOpenHandles(5000);
  // });

  const zombies = [];

  function zombieSocket() {
    var Socket = Primus.createSocket({
      manual: true
    });
    const socket = new Socket('http://localhost:55000', {
      strategy: 'disconnect,online'
    });
    socket.once('close', destroyZombie(socket));
    zombies.push(socket);
  }

  function destroyZombie(zombie) {
    return () => {
      setTimeout(() => {
        zombie.destroy();
      }, 0);
    };
  }

  function disconnectZombies() {
    for (var i = 0; i < zombies.length; i++) {
      try {
        zombies.pop().end();
      } catch (e) {
        //do nothing
      }
    }
  }

  function disconnectClient() {
    return new Promise((resolve, reject) => {
      if (clientInstance)
        clientInstance.disconnect(e => {
          if (e) return reject(e);
          resolve();
          clientInstance = null;
        });
      else resolve();
    });
  }

  function stopService() {
    return new Promise((resolve, reject) => {
      if (serviceInstance) {
        let intervalCheck = !!serviceInstance.services.session.__unconfiguredSessionCleanupInterval;
        serviceInstance.stop(e => {
          if (e) return reject(e);
          if (
            intervalCheck &&
            !!serviceInstance.services.session.__unconfiguredSessionCleanupInterval
          )
            return reject(new Error('cleanup interval not stopped'));
          resolve();
          serviceInstance = null;
        });
      } else resolve();
    });
  }

  function getService(cleanupInterval, cleanupThreshold, cleanupVerbose, secureInstance) {
    return new Promise((resolve, reject) => {
      const serviceConfig = {
        secure: secureInstance === undefined ? true : secureInstance,
        services: {
          session: {
            config: {}
          }
        }
      };

      if (cleanupInterval) {
        serviceConfig.services.session.config.unconfiguredSessionCleanup = {
          interval: cleanupInterval, //check every N milliseconds
          threshold: cleanupThreshold || 10e3, //sessions are cleaned up if they remain unconfigured for 10 seconds
          verbose: cleanupVerbose //cleanups are logged
        };
      }

      service.create(serviceConfig, function(e, happnInst) {
        if (e) return reject(e);
        serviceInstance = happnInst;
        happn_client.create(
          {
            config: {
              username: '_ADMIN',
              password: 'happn'
            },
            info: {
              from: 'startup'
            }
          },
          function(e, instance) {
            if (e) return reject(e);
            clientInstance = instance;
            resolve();
          }
        );
      });
    });
  }
});
