const Happn = require('../../../');
const shortid = require('shortid');
const testHelper = require('../../__fixtures/utils/test_helper').create();
const expect = require('expect.js');
var openSockets;

describe(testHelper.testName(__filename, 3), function() {
  var remote;
  var webSocketsClient;
  var path = require('path');
  var spawn = require('child_process').spawn;

  var libFolder = path.resolve(
    __dirname,
    '..',
    '..',
    '__fixtures',
    'test',
    'integration',
    'client',
    'reconnection-encrypted'
  );

  var events = [];

  this.timeout(40000);

  beforeEach('start server and connect client', buildUp);
  afterEach('disconnect client and stop server', tearDown);

  it('kills the server, then restarts it, then tests the subscriptions still exist and work', function(done) {
    webSocketsClient.onEvent('reconnect-successful', function() {
      //eslint-disable-next-line no-console
      console.log('we have reconnected ok, testing events');
      testEvent(done);
    });
    killServer();
    //eslint-disable-next-line no-console
    console.log('stopped server, wait 10 secs');
    setTimeout(() => {
      //eslint-disable-next-line no-console
      console.log('starting server...');
      startServer(function(e) {
        if (e) return done(e);
      });
    }, 10000);
  });

  it('kills the server, then restarts it, ensuring connection restoration, while we are polling client side', function(done) {
    const requestResults = [];
    const requestIndex = 0;

    let interval = setInterval(() => {
      webSocketsClient.set(`/poll/test/${requestIndex}`, { test: 'data' }, (e, result) => {
        if (e) return requestResults.push(e.message);
        requestResults.push(result);
      });
    }, 1000);

    function checkRequestResults(callback) {
      if (
        requestResults.every(result => {
          if (result !== 'client not active') {
            if (result.test !== 'data') {
              callback(new Error('unexpected result'));
              return false;
            }
          }
          return true;
        })
      )
        callback();
    }

    webSocketsClient.onEvent('reconnect-successful', function() {
      //eslint-disable-next-line no-console
      console.log('we have reconnected ok, testing events');
      testEvent(e => {
        if (e) return done(e);
        setTimeout(() => {
          clearInterval(interval);
          checkRequestResults(done);
        }, 5000);
      });
    });
    killServer();
    //eslint-disable-next-line no-console
    console.log('stopped server, wait 10 secs');
    setTimeout(() => {
      //eslint-disable-next-line no-console
      console.log('starting server...');
      startServer(function(e) {
        if (e) return done(e);
      });
    }, 10000);
  });

  it('connects but fails to authenticate, we ensure that the client socket is cleaned up and no successive attempts are made', function(done) {
    this.timeout(120000);
    connectClient('blah', () => {
      //do nothing
    }).catch(e => {
      expect(e.message).to.be('Invalid credentials');
      setTimeout(() => {
        expect(openSockets).to.be(0);
        done();
      }, 20000);
    });
  });

  it('disconnects and we ensure that the client socket is cleaned up and no successive attempts are made', function(done) {
    this.timeout(120000);
    const reconnectEvents = [];
    function pushEventData(evt, data) {
      reconnectEvents.push({ evt, data });
    }
    webSocketsClient.onEvent('reconnect-error', function(data) {
      pushEventData('reconnect-error', data);
    });
    webSocketsClient.onEvent('reconnect-timeout', function(data) {
      pushEventData('reconnect-timeout', data);
    });
    webSocketsClient.onEvent('reconnect-successful', function(data) {
      pushEventData('reconnect-successful', data);
    });
    connectClient('happn', async e => {
      if (e) return done(e);
      await webSocketsClient.disconnect();
      setTimeout(() => {
        expect(reconnectEvents.length).to.be(0);
        expect(openSockets).to.be(0);
        done();
      }, 20000);
    });
  });

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
        openSockets = parseInt(data.toString().replace(/OPEN_SOCKETS/, ''));
      }
      if (data.toString().match(/ERROR/)) {
        return callback(new Error('failed to start server'));
      }
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
    webSocketsClient = await Happn.client.create({
      config: {
        username: '_ADMIN',
        password,
        port: 55005
      }
    });
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
    try {
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
  }
});
