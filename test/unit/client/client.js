const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  this.timeout(15000);
  const HappnClient = require('../../../lib/client');
  const Constants = require('../../../lib/constants');
  function mockHappnClient(
    log,
    state,
    session,
    serverInfo,
    socket,
    clientOptions,
    removeAllListeners,
    socketEnd
  ) {
    var happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeState();

    happnClient.log = log || {
      error: function() {}
    };

    happnClient.status = state != null ? state : Constants.CLIENT_STATE.ACTIVE;
    happnClient.session = session || {
      id: 'test'
    };
    happnClient.serverInfo = serverInfo || {};

    happnClient.socket = socket || {
      end: socketEnd || function() {},
      removeAllListeners: removeAllListeners || function() {},
      write: function() {},
      on: function() {},
      destroy: function() {}
    };

    happnClient.options = clientOptions || {
      callTimeout: 60000
    };

    return happnClient;
  }

  it('tests the __performDataRequest function set null options', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.__performDataRequest(
      '/test/path',
      'set',
      {
        test: 'data'
      },
      null,
      function(e) {
        if (e) return done(e);
        done();
      }
    );
  });

  it('tests the __performDataRequest function set null options no callback', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.__performDataRequest('/test/path', 'set', {
      test: 'data'
    });

    done();
  });

  it('tests the __performDataRequest function set null options, inactive state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.ERROR);

    happnClient.__performDataRequest(
      '/test/path',
      'set',
      {
        test: 'data'
      },
      null,
      function(e) {
        test.expect(e.toString()).to.be('Error: client not active');
        test.expect(e.detail).to.be('action: set, path: /test/path');
        done();
      }
    );
  });

  it('tests the __performDataRequest function set null options, connect error state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.CONNECT_ERROR);

    happnClient.__performDataRequest(
      '/test/path',
      'set',
      {
        test: 'data'
      },
      null,
      function(e) {
        test.expect(e.toString()).to.be('Error: client in an error state');
        test.expect(e.detail).to.be('action: set, path: /test/path');
        done();
      }
    );
  });

  it('tests the __performDataRequest function set null options, disconnected state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.DISCONNECTED);

    happnClient.__performDataRequest(
      '/test/path',
      'set',
      {
        test: 'data'
      },
      null,
      function(e) {
        test.expect(e.toString()).to.be('Error: client is disconnected');
        test.expect(e.detail).to.be('action: set, path: /test/path');
        done();
      }
    );
  });

  it('tests the __performDataRequest function set null options, uninitialized state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.UNINITIALIZED);

    happnClient.__performDataRequest(
      '/test/path',
      'set',
      {
        test: 'data'
      },
      null,
      function(e) {
        test.expect(e.toString()).to.be('Error: client not initialized yet');
        test.expect(e.detail).to.be('action: set, path: /test/path');
        done();
      }
    );
  });

  it('tests the __performDataRequest function set null options, no callback, error state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.ERROR);

    try {
      happnClient.__performDataRequest('/test/path', 'set', {
        test: 'data'
      });
    } catch (e) {
      test.expect(e.toString()).to.be('Error: client not active');
      test.expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, connect error state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.CONNECT_ERROR);

    try {
      happnClient.__performDataRequest('/test/path', 'set', {
        test: 'data'
      });
    } catch (e) {
      test.expect(e.toString()).to.be('Error: client in an error state');
      test.expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, disconnected state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.DISCONNECTED);

    try {
      happnClient.__performDataRequest('/test/path', 'set', {
        test: 'data'
      });
    } catch (e) {
      test.expect(e.toString()).to.be('Error: client is disconnected');
      test.expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, uninitialized state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.UNINITIALIZED);

    try {
      happnClient.__performDataRequest('/test/path', 'set', {
        test: 'data'
      });
    } catch (e) {
      test.expect(e.toString()).to.be('Error: client not initialized yet');
      test.expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, uninitialized state', function(done) {
    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.UNINITIALIZED);

    try {
      happnClient.__performDataRequest('/test/path', 'set', {
        test: 'data'
      });
    } catch (e) {
      test.expect(e.toString()).to.be('Error: client not initialized yet');
      test.expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __getListener function', function() {
    var happnClient = mockHappnClient();
    //handler, parameters, path, variableDepth
    var mockParameters = {
      count: 10,
      event_type: 'test-event',
      initialEmit: true,
      initialCallback: true,
      meta: 'test-meta',
      depth: 20
    };
    var listener = happnClient.__getListener('test-handler', mockParameters, 'test-path', 15);

    test.expect(listener).to.eql({
      handler: 'test-handler',
      count: 10,
      eventKey: JSON.stringify({
        path: 'test-path',
        event_type: 'test-event',
        count: 10,
        initialEmit: true,
        initialCallback: true,
        meta: 'test-meta',
        depth: 20
      }),
      runcount: 0,
      meta: 'test-meta',
      id: 0,
      initialEmit: true,
      initialCallback: true,
      depth: 20,
      variableDepth: 15
    });
  });

  it('tests the __confirmRemoteOn function, with error', function(done) {
    var happnClient = mockHappnClient();
    var path = 'test-path';
    var parameters = {
      count: 10,
      event_type: 'test-event',
      initialEmit: true,
      initialCallback: true,
      meta: 'test-meta',
      depth: 20
    };

    var listener = {};

    happnClient._remoteOn = function(path, parameters, callback) {
      callback(new Error('test-error'));
    };

    happnClient.__clearListenerState = function() {};

    happnClient.__confirmRemoteOn(path, parameters, listener, function(e) {
      test.expect(e.toString()).to.be('Error: test-error');
      done();
    });
  });

  it('tests the __confirmRemoteOn function, with response error', function(done) {
    var happnClient = mockHappnClient();
    var path = 'test-path';
    var parameters = {
      count: 10,
      event_type: 'test-event',
      initialEmit: true,
      initialCallback: true,
      meta: 'test-meta',
      depth: 20
    };

    var listener = {};

    happnClient._remoteOn = function(path, parameters, callback) {
      callback(null, {
        status: 'error',
        payload: 'test-error'
      });
    };

    happnClient.__clearListenerState = function() {};

    happnClient.__confirmRemoteOn(path, parameters, listener, function(e) {
      test.expect(e).to.be('test-error');
      done();
    });
  });

  it('tests the __reattachListeners function', function(done) {
    var happnClient = mockHappnClient();
    var remoteOnCalled = 0;

    happnClient._remoteOn = function(eventPath, parameters, callback) {
      remoteOnCalled++;
      callback(null, {
        id: remoteOnCalled
      });
    };

    happnClient.state.events = {
      'test/event/1/*': [
        {
          meta: {},
          eventKey: 0
        }
      ],
      'test/event/2/*': [
        {
          meta: {},
          eventKey: 1
        }
      ],
      'test/event/3/*': [
        {
          meta: {},
          eventKey: 2
        }
      ]
    };

    happnClient.__reattachListeners(function(e) {
      if (e) return done(e);

      setTimeout(function() {
        test.expect(remoteOnCalled).to.be(3);
        done();
      }, 2000);
    });
  });

  it('tests the __reattachListeners function fails', function(done) {
    var happnClient = mockHappnClient();

    happnClient._remoteOn = function(eventPath, parameters, callback) {
      callback(new Error('failed'));
    };

    happnClient.state.events = {
      'test/event/1/*': [
        {
          meta: {},
          eventKey: 0
        }
      ],
      'test/event/2/*': [
        {
          meta: {},
          eventKey: 1
        }
      ],
      'test/event/3/*': [
        {
          meta: {},
          eventKey: 2
        }
      ]
    };

    happnClient.__reattachListeners(function(e) {
      test
        .expect(e.toString())
        .to.be('Error: failed re-establishing listener to path: test/event/1/*');
      done();
    });
  });

  it('tests the __reattachListeners function ignores 401, 403 errors', function(done) {
    var happnClient = mockHappnClient();
    var remoteOnCalled = 0;

    happnClient._remoteOn = function(eventPath, parameters, callback) {
      remoteOnCalled++;
      if (remoteOnCalled === 1)
        return callback({
          id: remoteOnCalled
        });

      var failureError = new Error('failed');

      if (remoteOnCalled === 2) failureError.code = 401;
      if (remoteOnCalled === 3) failureError.code = 403;

      callback(failureError);
    };

    happnClient.state.events = {
      'test/event/1/*': [
        {
          meta: {},
          eventKey: 0
        }
      ],
      'test/event/2/*': [
        {
          meta: {},
          eventKey: 1
        }
      ],
      'test/event/3/*': [
        {
          meta: {},
          eventKey: 2
        }
      ]
    };

    happnClient.__reattachListeners(function(e) {
      test
        .expect(e.toString())
        .to.be('Error: failed re-establishing listener to path: test/event/1/*');
      done();
    });
  });

  it('tests the __endAndDestroySocket function', async () => {
    var happnClient = mockHappnClient(
      null,
      null,
      null,
      null,
      null,
      null,
      function() {},
      function() {}
    );

    happnClient.log = {
      warn: function() {}
    };

    const destroySocketPromise = socket => {
      return new Promise((resolve, reject) => {
        happnClient.__endAndDestroySocket(socket, e => {
          if (e) return reject(e);
          resolve();
        });
      });
    };

    let localEnded;
    test
      .expect(
        await destroySocketPromise({
          _local: true,
          end: () => {
            localEnded = true;
          }
        })
      )
      .to.be(undefined);
    test.expect(localEnded).to.be(true);

    let readyStateNot1Destroyed;
    let readyStateNot1DestroyedSocket = {
      readyState: 2,
      end: () => {
        return readyStateNot1DestroyedSocket;
      },
      destroy: () => {
        readyStateNot1Destroyed = true;
      }
    };
    test.expect(await destroySocketPromise(readyStateNot1DestroyedSocket)).to.be(undefined);
    test.expect(readyStateNot1Destroyed).to.be(true);

    let readyState1Destroyed;
    let readyState1DestroyedSocket = {
      readyState: 1,
      end: () => {
        readyState1DestroyedSocket.handler();
        return readyStateNot1DestroyedSocket;
      },
      destroy: () => {
        readyState1Destroyed = true;
        return readyStateNot1DestroyedSocket;
      },
      once: (evt, handler) => {
        test.expect(evt === 'close');
        readyState1DestroyedSocket.handler = handler;
        return readyState1DestroyedSocket;
      }
    };
    const readyState1DestroyedResult = await destroySocketPromise(readyState1DestroyedSocket);
    await test.delay(2000);
    test.expect(readyState1DestroyedResult).to.be(undefined);
    test.expect(readyState1Destroyed).to.be(true);
  });

  it('tests the __connectionCleanup function, socket present', function(done) {
    this.timeout(5000);

    const socket = {
      end: () => {
        return socket;
      },
      destroy: done
    };

    const happnClient = mockHappnClient(null, null, null, null, socket, null, function() {}, null);

    happnClient.log = {
      warn: function() {}
    };

    happnClient.__connectionCleanup(null, e => {
      test.expect(e).to.be(undefined);
    });
  });

  it('tests the __writeCookie function ', function() {
    this.timeout(5000);
    const happnClient = mockHappnClient(null, null, null, null, null, null, function() {}, null);
    happnClient.options = happnClient.options || {};
    happnClient.options.protocol = 'https';
    let mockDocument = {};
    happnClient.__writeCookie(
      {
        httpsCookie: true,
        cookieName: 'test_happn_token',
        token: '[test token]',
        cookieDomain: '[test cookie domain]'
      },
      mockDocument
    );
    test
      .expect(mockDocument.cookie)
      .to.be('test_happn_token=[test token]; path=/; domain=[test cookie domain]; Secure;');
    happnClient.options.protocol = 'http';
    mockDocument = {};
    happnClient.__writeCookie(
      {
        cookieName: 'happn_token',
        token: '[test token]',
        cookieDomain: '[test cookie domain]'
      },
      mockDocument
    );
    test
      .expect(mockDocument.cookie)
      .to.be('happn_token=[test token]; path=/; domain=[test cookie domain];');
  });

  it('tests the cookie lifecycle events, write and expire', function() {
    this.timeout(5000);
    const events = [];
    const cookieEventHandler = (event, cookie) => {
      events.push({ event, cookie });
    };
    const happnClient = mockHappnClient(null, null, null, null, null, null, function() {}, null);
    happnClient.options = happnClient.options || {};
    happnClient.options.protocol = 'https';
    happnClient.cookieEventHandler = cookieEventHandler;
    let mockDocument = {};
    happnClient.__writeCookie(
      {
        httpsCookie: true,
        cookieName: 'test_happn_token',
        token: '[test token]',
        cookieDomain: '[test cookie domain]'
      },
      mockDocument
    );
    happnClient.__expireCookie(
      {
        httpsCookie: true,
        cookieName: 'test_happn_token',
        token: '[test token]',
        cookieDomain: '[test cookie domain]'
      },
      mockDocument
    );
    test.expect(events).to.eql([
      {
        event: 'cookie-write',
        cookie: 'test_happn_token=[test token]; path=/; domain=[test cookie domain]; Secure;'
      },
      {
        event: 'cookie-expired',
        cookie:
          'test_happn_token=; path=/; domain=[test cookie domain]; Secure;; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
      }
    ]);
  });

  it('tests the cookie __setCookieCheckTimer', async () => {
    this.timeout(5000);
    const events = [];
    global.document = {};
    const cookieEventHandler = (event, cookie) => {
      events.push({ event, cookie });
    };
    let mockDocument = {};
    const happnClient = mockHappnClient(null, null, null, null, null, null, function() {}, null);
    happnClient.options = happnClient.options || {};
    happnClient.options.protocol = 'https';
    happnClient.log = {
      warn: () => {}
    };

    happnClient.__setCookieCheckTimer(); // we see that nothing happens on this call as cookieEventHandler is null

    happnClient.cookieEventHandler = cookieEventHandler;

    happnClient.__setCookieCheckTimer(
      {
        httpsCookie: true,
        cookieName: 'test_happn_token',
        token: '[test token]',
        cookieDomain: '[test cookie domain]'
      },
      mockDocument
    );
    happnClient.__writeCookie(
      {
        httpsCookie: true,
        cookieName: 'test_happn_token',
        token: '[test token]',
        cookieDomain: '[test cookie domain]'
      },
      mockDocument
    );
    happnClient.__expireCookie(
      {
        httpsCookie: true,
        cookieName: 'test_happn_token',
        token: '[test token]',
        cookieDomain: '[test cookie domain]'
      },
      mockDocument
    );
    await test.delay(5000);
    test.expect(events).to.eql([
      { event: 'cookie-created', cookie: '' },
      {
        event: 'cookie-write',
        cookie: 'test_happn_token=[test token]; path=/; domain=[test cookie domain]; Secure;'
      },
      {
        event: 'cookie-expired',
        cookie:
          'test_happn_token=; path=/; domain=[test cookie domain]; Secure;; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
      },
      { event: 'cookie-deleted', cookie: '' }
    ]);
    happnClient.disconnect({ deleteCookie: true });
    happnClient.__cookieCleanup(mockDocument);
    global.document = null;
  });
});
