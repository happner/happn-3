const testHelper = require('../../__fixtures/utils/test_helper').create();
describe(testHelper.testName(__filename, 3), function() {
  this.timeout(10000);

  var expect = require('expect.js');
  var HappnClient = require('../../../lib/client');
  var Constants = require('../../../lib/constants');

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
      on: function() {}
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
        expect(e.toString()).to.be('Error: client not active');
        expect(e.detail).to.be('action: set, path: /test/path');
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
        expect(e.toString()).to.be('Error: client in an error state');
        expect(e.detail).to.be('action: set, path: /test/path');
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
        expect(e.toString()).to.be('Error: client is disconnected');
        expect(e.detail).to.be('action: set, path: /test/path');
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
        expect(e.toString()).to.be('Error: client not initialized yet');
        expect(e.detail).to.be('action: set, path: /test/path');
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
      expect(e.toString()).to.be('Error: client not active');
      expect(e.detail).to.be('action: set, path: /test/path');
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
      expect(e.toString()).to.be('Error: client in an error state');
      expect(e.detail).to.be('action: set, path: /test/path');
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
      expect(e.toString()).to.be('Error: client is disconnected');
      expect(e.detail).to.be('action: set, path: /test/path');
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
      expect(e.toString()).to.be('Error: client not initialized yet');
      expect(e.detail).to.be('action: set, path: /test/path');
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
      expect(e.toString()).to.be('Error: client not initialized yet');
      expect(e.detail).to.be('action: set, path: /test/path');
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

    expect(listener).to.eql({
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
      expect(e.toString()).to.be('Error: test-error');
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
      expect(e).to.be('test-error');
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
        expect(remoteOnCalled).to.be(3);
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
      expect(e.toString()).to.be('Error: failed re-establishing listener to path: test/event/1/*');
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
      expect(e.toString()).to.be('Error: failed re-establishing listener to path: test/event/1/*');
      done();
    });
  });

  it('tests the __destroySocket function', async () => {
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
        happnClient.__destroySocket(socket, e => {
          if (e) return reject(e);
          resolve();
        });
      });
    };

    let localEnded;
    expect(
      await destroySocketPromise({
        _local: true,
        end: () => {
          localEnded = true;
        }
      })
    ).to.be(undefined);
    expect(localEnded).to.be(true);

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
    expect(await destroySocketPromise(readyStateNot1DestroyedSocket)).to.be(undefined);
    expect(readyStateNot1Destroyed).to.be(true);

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
        expect(evt === 'close');
        readyState1DestroyedSocket.handler = handler;
        return readyState1DestroyedSocket;
      }
    };
    const readyState1DestroyedResult = await destroySocketPromise(readyState1DestroyedSocket);
    await testHelper.delay(2000);
    expect(readyState1DestroyedResult).to.be(undefined);
    expect(readyState1Destroyed).to.be(true);
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
      testHelper.expect(e).to.be(undefined);
    });
  });

  it('tests the __getConnection function ', function() {});
});
