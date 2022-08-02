describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const expect = require('expect.js');
    const sinon = require('sinon');
    const Happn = require('../../../');
    const shortid = require('shortid');
    let remote,
      webSocketsClient,
      lastOpenSockets,
      errorStateCount = 0;
    let path = require('path');
    let spawn = require('child_process').spawn;
    this.timeout(40e3);

    var libFolder = path.resolve(
      __dirname,
      '..',
      '..',
      '__fixtures',
      'test',
      'integration',
      'client',
      'reconnection'
    );

    var events = [];
    before('start server and connect client', buildUp);
    afterEach('check we only have a single subscription', () => {
      expect(webSocketsClient.state.events['/ALL@test/event/*'].length).to.be(1);
    });
    after('disconnect client and stop server', tearDown);

    it('is able to reconnect the client forcefully, and re-establish subscriptions', async () => {
      for (let reconnectTimes = 0; reconnectTimes < 10; reconnectTimes++) {
        await reconnectAndTest();
      }
    });

    it('is able to cause an error to occur on the socket, we reconnect and re-establish subscriptions', async () => {
      for (let reconnectTimes = 0; reconnectTimes < 10; reconnectTimes++) {
        await errorAndTest();
      }
    });

    it('is able to cause an error to occur on the socket, the server is also down, we ensure we eventually reconnect', async () => {
      await errorAndTest(8);
      expect(webSocketsClient.log.warn.lastCall.args[0]).to.be(
        'retrying reconnection after 2000ms'
      );
    });

    it('reconnects properly with a flapping server', async () => {
      await killAndRestartServerAfter(1);
      await killAndRestartServerAfter(1);
      await killAndRestartServerAfter(1);
      await killAndRestartServerAfter(1);
      await killAndRestartServerAfter(1);
      await errorAndTest();
    });

    function errorAndTest(killServerForSeconds) {
      return new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          reject('reconnect timed out');
        }, 300e3);
        webSocketsClient.onEvent('reconnect-successful', function() {
          clearTimeout(timeout);
          testEvent(resolve);
        });
        webSocketsClient.socket.emit('error', new Error('test error'));
        if (killServerForSeconds > 0) {
          killAndRestartServerAfter(killServerForSeconds);
        }
        webSocketsClient.set('test/data', { test: 'data' }, e => {
          if (e) {
            if (e.message === 'client in an error state') {
              errorStateCount++;
            } else {
              throw e;
            }
          }
        });
      });
    }

    function killAndRestartServerAfter(seconds) {
      return new Promise((resolve, reject) => {
        killServer();
        setTimeout(() => {
          startServer(e => {
            if (e) {
              return reject(e);
            }
            // eslint-disable-next-line no-console
            console.log(`server restarted after ${seconds} seconds`);
            resolve();
          });
        }, seconds * 1e3);
      });
    }

    function reconnectAndTest() {
      return new Promise((resolve, reject) => {
        let timeout = setTimeout(() => {
          reject('reconnect timed out');
        }, 5e3);
        webSocketsClient.onEvent('reconnect-successful', function() {
          clearTimeout(timeout);
          testEvent(resolve);
        });
        webSocketsClient.reconnect();
      });
    }

    var clientEventHandler = function(data, meta) {
      events.push({
        data: data,
        meta: meta
      });
    };

    var testEvent = function(callback) {
      var eventId = shortid.generate();

      webSocketsClient.set(
        'test/event/' + eventId,
        {
          id: eventId
        },
        function(e) {
          if (e) return callback(e);

          setTimeout(function() {
            var eventData = events[events.length - 1];

            if (eventData.data.id !== eventId)
              return callback(new Error('no event data found for id: ' + eventId));

            callback();
          }, 300);
        }
      );
    };

    function startServer(callback) {
      remote = spawn('node', [path.join(libFolder, 'service.js')]);

      remote.stdout.on('data', function(data) {
        if (data.toString().match(/READY/)) {
          callback();
        }
        if (data.toString().match(/OPEN_SOCKETS/)) {
          lastOpenSockets = parseInt(data.toString().replace(/OPEN_SOCKETS/, ''));
        }
        if (data.toString().match(/ERROR/)) return callback(new Error('failed to start server'));
      });
    }

    function buildUp(callback) {
      startServer(function(e) {
        if (e) return callback(e);
        connectClient('happn', callback);
      });
    }

    async function connectClient(password, callback) {
      if (webSocketsClient) await webSocketsClient.disconnect();
      try {
        webSocketsClient = await Happn.client.create({
          username: '_ADMIN',
          password,
          port: 55005,
          retryOnSocketErrorMaxInterval: 2e3
        });
      } catch (e) {
        return callback(e);
      }

      webSocketsClient.log.warn = sinon.spy(webSocketsClient.log.warn);
      webSocketsClient.on('test/event/*', clientEventHandler, function(e) {
        if (e) return callback(e);
        testEvent(function(e) {
          if (e) return callback(e);
          callback();
        });
      });
    }

    function killServer() {
      remote.kill();
    }

    function tearDown(callback) {
      //wait 2 seconds so that the server is able to emit lastOpenSockets
      setTimeout(() => {
        try {
          expect(errorStateCount).to.be.greaterThan(0);
          expect(lastOpenSockets).to.be(1);
          if (webSocketsClient)
            webSocketsClient.disconnect(function() {
              killServer();
              callback();
            });
          else {
            killServer();
            callback();
          }
        } catch (e) {
          //eslint-disable-next-line no-console
          console.warn('teardown g6 failed:::', e);
        }
      }, 2e3);
    }
  }
);
