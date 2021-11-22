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

  it('tests the cookie lifecycle events, write and delete', async () => {
    this.timeout(5000);
    const eventsHappnToken = [];
    const eventsNotFound = [];
    const eventsSpecified = [];
    const cookieInstances = {
      happn_token: 'happn_token_cookie',
      no_cookie_found: '',
      specified_cookie: 'specified_cookie'
    };
    const cookieEventHandlerHappnToken = (event, cookie) => {
      eventsHappnToken.push({ event, cookie });
    };
    const cookieEventHandlerNotFound = (event, cookie) => {
      eventsNotFound.push({ event, cookie });
    };
    const cookieEventHandlerSpecified = (event, cookie) => {
      eventsSpecified.push({ event, cookie });
    };
    const HappnClient = require('../../../lib/client');
    HappnClient.__getCookieInstance = cookieName => {
      return cookieInstances[cookieName];
    };
    HappnClient.addCookieEventHandler(cookieEventHandlerHappnToken, 'happn_token', 500);
    HappnClient.addCookieEventHandler(cookieEventHandlerNotFound, 'no_cookie_found', 500);
    HappnClient.addCookieEventHandler(cookieEventHandlerSpecified, 'specified_cookie', 550);

    await test.delay(2000);

    test.expect(eventsHappnToken).to.eql([]);
    test.expect(eventsNotFound).to.eql([]);
    test.expect(eventsSpecified).to.eql([]);

    cookieInstances['happn_token'] = '';
    cookieInstances['specified_cookie'] = '';
    cookieInstances['no_cookie_found'] = 'found_actually';

    await test.delay(2000);

    test
      .expect(eventsHappnToken)
      .to.eql([{ event: 'cookie-deleted', cookie: 'happn_token_cookie' }]);
    test.expect(eventsNotFound).to.eql([{ event: 'cookie-created', cookie: 'found_actually' }]);
    test.expect(eventsSpecified).to.eql([{ event: 'cookie-deleted', cookie: 'specified_cookie' }]);

    cookieInstances['happn_token'] = 'new_happn_token';
    cookieInstances['specified_cookie'] = 'new_specified_cookie';
    cookieInstances['no_cookie_found'] = '';

    await test.delay(2000);

    test.expect(eventsHappnToken).to.eql([
      { event: 'cookie-deleted', cookie: 'happn_token_cookie' },
      { event: 'cookie-created', cookie: 'new_happn_token' }
    ]);
    test.expect(eventsNotFound).to.eql([
      { event: 'cookie-created', cookie: 'found_actually' },
      { event: 'cookie-deleted', cookie: 'found_actually' }
    ]);
    test.expect(eventsSpecified).to.eql([
      { event: 'cookie-deleted', cookie: 'specified_cookie' },
      { event: 'cookie-created', cookie: 'new_specified_cookie' }
    ]);

    //check we dont leak intervals
    HappnClient.addCookieEventHandler(cookieEventHandlerHappnToken, 'happn_token', 500);
    HappnClient.addCookieEventHandler(cookieEventHandlerNotFound, 'no_cookie_found', 500);
    HappnClient.addCookieEventHandler(cookieEventHandlerSpecified, 'specified_cookie', 550);

    test.expect(HappnClient.__cookieEventHandlers['specified_cookie_550'].length).to.be(1);
    test.expect(HappnClient.__cookieEventHandlers['happn_token_500'].length).to.be(1);
    test.expect(HappnClient.__cookieEventHandlers['no_cookie_found_500'].length).to.be(1);

    HappnClient.clearCookieEventObjects();
    HappnClient.clearCookieEventObjects(); // clear again
  });

  it('tests getCookieEventDefaults', async () => {
    this.timeout(5000);
    test.expect(HappnClient.getCookieEventDefaults(null, null)).to.eql({
      cookieName: 'happn_token',
      interval: 1000
    });
    test.expect(HappnClient.getCookieEventDefaults('happn_token_specified', 200)).to.eql({
      cookieName: 'happn_token_specified',
      interval: 1000
    });
    test.expect(HappnClient.getCookieEventDefaults('happn_token_specified', 650)).to.eql({
      cookieName: 'happn_token_specified',
      interval: 650
    });
    s;
  });

  it('tests __getCookieInstance',  done => {
    this.timeout(5000);
    let document = { cookie: encodeURIComponent('cookieName=test;with;cookie') };
    test.expect(HappnClient.__getCookieInstance('cookieName', document)).to.be('test');
    done();
  });

  it('tests __getCookieInstance, no name match',  done => {
    this.timeout(5000);
    let document = { cookie: encodeURIComponent('notTheName=test;with;cookie') };
    test.expect(HappnClient.__getCookieInstance('cookieName', document)).to.be('');
    done();
  }) 

  it('tests loginWithCookie', async () => {
    HappnClient.__getCookieInstance = () => {
      return 'instance';
    };
    const happnClient = mockHappnClient(null, null, null, null, null, null, function() {}, null);
    happnClient.options = happnClient.options || {};
    happnClient.options.protocol = 'https';
    this.timeout(5000);
    let error;
    function callback(e) {
      error = e;
    }
    test.expect(happnClient.loginWithCookie({}, {}, false, callback)).to.be(false);
    test.expect(error.message).to.be('Logging in with cookie only valid in browser');
    const loginParameters = {};
    happnClient.loginWithCookie(loginParameters, {}, true, callback);
    test.expect(loginParameters).to.eql({ token: 'instance', useCookie: true });
  });
});
