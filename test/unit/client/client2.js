//const log = require('why-is-node-running');
const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  this.timeout(10e3);
  const HappnClient = require('../../../lib/client');
  const Constants = require('../../../lib/constants');
  let happnClient;
  it('tests that the initialize function calls connect and login if there is a socket', function(done) {
    happnClient = mockHappnClient();
    happnClient.login = function(callback) {
      return callback(null, 'done');
    };
    happnClient.__prepareInstanceOptions({});
    happnClient.connect = cb => {
      cb();
    };
    happnClient.initialize(function(err, results) {
      test.expect(err).to.be(null);
      test.expect(results.status).to.equal(Constants.CLIENT_STATE.ACTIVE);
      test.expect(results.session).to.be(null);
      done();
    });
  });

  it('tests the __prepareSecurityOptions function', function(done) {
    happnClient = mockHappnClient();
    var options = {
      keyPair: {
        publicKey: 123,
        privateKey: 456
      }
    };
    happnClient.__prepareSecurityOptions(options);
    test.expect(options.publicKey).to.eql(123);
    test.expect(options.privateKey).to.eql(456);
    done();
  });

  it('tests the __prepareSocketOptions function, defaults', function(done) {
    happnClient = mockHappnClient();
    var opts = {};
    happnClient.__prepareSocketOptions(opts);
    var expectedOpts = {
      socket: {
        reconnect: {
          retries: Infinity,
          max: 180000
        },
        timeout: 30000,
        strategy: 'disconnect,online',
        pingTimeout: 45e3
      }
    };
    test.expect(opts).to.eql(expectedOpts);
    done();
  });

  it('tests the __prepareSocketOptions function', function(done) {
    happnClient = mockHappnClient();
    var opts = {
      connectTimeout: 40e3,
      socket: {
        reconnect: {
          retries: 10,
          max: 120e3
        },
        strategy: 'disconnect',
        pingTimeout: 30e3
      }
    };
    happnClient.__prepareSocketOptions(opts);
    var expectedOpts = {
      connectTimeout: 40e3,
      socket: {
        reconnect: {
          retries: 10,
          max: 120e3
        },
        timeout: 40e3,
        strategy: 'disconnect',
        pingTimeout: 30e3
      }
    };
    test.expect(opts).to.eql(expectedOpts);
    done();
  });

  it('tests the __prepareConnectionOptions function.', function(done) {
    happnClient = mockHappnClient();

    const opts = happnClient.__prepareConnectionOptions({}, {});
    test.expect(opts).to.eql({
      host: '127.0.0.1',
      port: 55000,
      protocol: 'http',
      url: 'http://127.0.0.1:55000'
    });
    done();
  });

  it('tests the __prepareConnectionOptions function with defaults.', function(done) {
    happnClient = mockHappnClient();
    var defaults = {
      protocol: 'ssh',
      allowSelfSignedCerts: true,
      username: 'Janco',
      password: 'private'
    };
    const opts = happnClient.__prepareConnectionOptions({}, defaults);
    test.expect(opts).to.eql({
      allowSelfSignedCerts: true,
      username: 'Janco',
      password: 'private',
      host: '127.0.0.1',
      port: 55000,
      protocol: 'ssh',
      url: 'ssh://127.0.0.1:55000'
    });
    done();
  });

  it('tests the __prepareInstanceOptions function with blank options', function(done) {
    happnClient = mockHappnClient();
    happnClient.__prepareInstanceOptions({});
    test.expect(happnClient.options).to.eql({
      retryOnSocketErrorMaxInterval: 120e3,
      reconnectWait: 1000,
      callTimeout: 60000,
      defaultVariableDepth: 5,
      host: '127.0.0.1',
      port: 55000,
      protocol: 'http',
      url: 'http://127.0.0.1:55000',
      socket: {
        reconnect: {
          retries: Infinity,
          max: 180000
        },
        timeout: 30000,
        strategy: 'disconnect,online',
        pingTimeout: 45e3
      },
      info: {
        _browser: false
      },
      loginRetry: 4,
      loginRetryInterval: 5000,
      loginTimeout: 60000
    });
    done();
  });

  it('tests the __prepareInstanceOptions function with mostly blank options, including keyPair(security) object', function(done) {
    happnClient = mockHappnClient();
    happnClient.__prepareInstanceOptions({
      keyPair: {
        publicKey: 123,
        privateKey: 456
      }
    });
    test.expect(happnClient.options).to.eql({
      retryOnSocketErrorMaxInterval: 120e3,
      reconnectWait: 1000,
      keyPair: {
        publicKey: 123,
        privateKey: 456
      },
      callTimeout: 60000,
      defaultVariableDepth: 5,
      host: '127.0.0.1',
      port: 55000,
      protocol: 'http',
      url: 'http://127.0.0.1:55000',
      publicKey: 123,
      privateKey: 456,
      socket: {
        reconnect: {
          retries: Infinity,
          max: 180000
        },
        timeout: 30000,
        strategy: 'disconnect,online',
        pingTimeout: 45e3
      },
      info: {
        _browser: false
      },
      loginRetry: 4,
      loginRetryInterval: 5000,
      loginTimeout: 60000
    });
    done();
  });

  it('tests the __updateOptions function', function(done) {
    happnClient = mockHappnClient();
    var possibility = {
      url: '1.0.0.127',
      host: 'local',
      port: 8000,
      protocol: 'http',
      allowSelfSignedCerts: false,
      username: 'Janco',
      password: 'Private',
      publicKey: 123,
      privateKey: 456,
      token: 'None',
      someRubbish: 'rubbish',
      moreRubbish: 'rubbish'
    };
    var possibility2 = {
      callTimeout: 5000,
      url: '1.0.0.127',
      host: 'local',
      port: 8000,
      protocol: 'http',
      allowSelfSignedCerts: false,
      username: 'Janco',
      password: 'Private',
      publicKey: 123,
      privateKey: 456,
      token: 'None'
    };

    happnClient.__updateOptions(possibility);
    test.expect(happnClient.options).to.eql(possibility2);
    done();
  });

  xit('tests the __initializeConnectivity function.', function(done) {
    happnClient = mockHappnClient();
    var opts = happnClient.__prepareConnectionOptions({}, {});
    //TODO Mock socket function?
    happnClient.__initializeConnectivity(opts, function(err, data) {
      //eslint-disable-next-line no-console
      console.log(data);
      //eslint-disable-next-line no-console
      console.log(err);
      //TODO::: Can't Timing out
      done();
    });
  });

  xit('tests the __connectSocket function.', function(done) {
    happnClient = mockHappnClient();

    happnClient.__connectSocket(function() {
      //TODO::: This test passes, but causes the client and test framework to hang
      done();
    });
  });

  it('tests the __initializeState function', function(done) {
    happnClient = mockHappnClient();
    happnClient.__initializeState();
    test.expect(happnClient.state.events).to.eql({});

    test.expect(happnClient.state.requestEvents).to.eql({});
    test.expect(happnClient.state.currentEventId).to.eql(0);
    test.expect(happnClient.state.currentListenerId).to.eql(0);
    test.expect(happnClient.state.errors).to.eql([]);
    test.expect(happnClient.state.clientType).to.eql('socket');
    test.expect(happnClient.state.systemMessageHandlers).to.eql([]);
    test.expect(happnClient.status).to.eql(Constants.CLIENT_STATE.UNINITIALIZED);
    test.expect(happnClient.state.ackHandlers).to.eql({});
    test.expect(happnClient.state.eventHandlers).to.eql({});
    done();
  });

  it("tests the __initializeEvents function creates functions for 'onEvent', 'offEvent' and 'emit'", function(done) {
    happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    test.expect(typeof happnClient.onEvent).to.eql('function');
    test.expect(typeof happnClient.offEvent).to.eql('function');
    test.expect(typeof happnClient.emit).to.eql('function');
    done();
  });

  it("tests the 'onEvent' function created by __initializeEvents throws an error if no event_name is supplied", function(done) {
    happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    try {
      happnClient.onEvent();
    } catch (e) {
      test.expect(e.toString()).to.eql('Error: event name cannot be blank or null');
      done();
    }
  });

  it("tests the 'onEvent' function created by __initializeEvents throws an error if event_handler isn't a function", function(done) {
    happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    try {
      happnClient.onEvent('MyEvent', 'MyHandler');
    } catch (e) {
      test.expect(e.toString()).to.eql('Error: event handler must be a function');
      done();
    }
  });

  it("tests the 'onEvent' function created by __initializeEvents returns the correct information", function(done) {
    happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    test
      .expect(
        happnClient.onEvent('MyEvent', function(x) {
          //eslint-disable-next-line no-console
          console.log(x);
        })
      )
      .to.eql('MyEvent|0');
    test
      .expect(
        happnClient.onEvent('MyEvent', function(x) {
          //eslint-disable-next-line no-console
          console.log(typeof x);
        })
      )
      .to.eql('MyEvent|1');
    test
      .expect(
        happnClient.onEvent('MyNewEvent', function(x) {
          //eslint-disable-next-line no-console
          console.log(typeof x);
        })
      )
      .to.eql('MyNewEvent|0');
    test.expect(typeof happnClient.state.eventHandlers['MyEvent'][0]).to.eql('function');
    test.expect(typeof happnClient.state.eventHandlers['MyEvent'][1]).to.eql('function');
    test.expect(typeof happnClient.state.eventHandlers['MyNewEvent'][0]).to.eql('function');
    done();
  });

  it("tests the 'offEvent' function created by __initializeEvents removes an event handler", function(done) {
    happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    happnClient.onEvent('MyEvent', function() {
      //do nothing
    });
    happnClient.onEvent('MyEvent', function() {
      //do nothing
    });
    happnClient.offEvent('MyEvent|0');

    test.expect(happnClient.state.eventHandlers['MyEvent'][0]).to.be(null);
    test.expect(typeof happnClient.state.eventHandlers['MyEvent'][1]).to.eql('function');
    done();
  });

  it('tests the getScript function returns an error when not called from a browser', function(done) {
    happnClient = mockHappnClient();
    happnClient.getScript('http://www.google.com', function(err) {
      test.expect(err.toString()).to.eql('Error: only for browser');
      done();
    });
  });

  xit('tests the getScript function when called from a browser', function() {
    //TODO::: Not sure how to test this!
  });

  it('tests the getResources function returns a callback.', function(done) {
    happnClient = mockHappnClient();

    happnClient.getResources(function() {
      done();
    });
  });

  xit('tests the stop function.', function(done) {
    happnClient = mockHappnClient();

    happnClient.stop(function() {
      //TODO::: Can't test: Socket issues
      done();
    });
  });

  it('tests the __ensureCryptoLibrary function returns a callback.', function(done) {
    happnClient = mockHappnClient();

    happnClient.__ensureCryptoLibrary(function() {
      done();
    });
  });

  it('tests the __attachSession function.', function(done) {
    happnClient = mockHappnClient();
    happnClient.__attachSession('This is a session');
    test.expect(happnClient.session).to.eql('This is a session');
    done();
  });

  it('tests the __payloadToError function.', function(done) {
    happnClient = mockHappnClient();
    var payload = 'This is an error';
    const e = happnClient.__payloadToError(payload);
    test.expect(e.toString()).to.eql('Error: This is an error');
    done();
  });

  it('tests the __payloadToError function when payload contains a message.', function(done) {
    happnClient = mockHappnClient();
    var payload = {
      message: 'This is an error'
    };
    const e = happnClient.__payloadToError(payload);
    test.expect(e.toString()).to.eql('Error: This is an error');
    done();
  });

  it('tests the __doLogin function will attach a session with mocked systemRequest.', function(done) {
    happnClient = mockHappnClient();
    happnClient.__performSystemRequest = function(action, data, options, callback) {
      callback(null, {
        session: 'This is a session',
        _meta: {
          status: 'ok'
        }
      });
    };
    happnClient.__doLogin({}, function() {
      test.expect(happnClient.session).to.eql({
        session: 'This is a session'
      });
      done();
    });
  });

  it('tests the __doLogin function will return an error with mocked systemRequest if _meta.status is not ok.', function(done) {
    happnClient = mockHappnClient();
    happnClient.__performSystemRequest = function(action, data, options, callback) {
      callback(null, {
        _meta: {},
        payload: 'this is an error'
      });
    };
    happnClient.__doLogin({}, function(e) {
      test.expect(e.toString()).to.eql('Error: this is an error');
      done();
    });
  });

  it('tests the __doLogin function will return an error with mocked systemRequest if system Request returns an error', function(done) {
    happnClient = mockHappnClient();
    happnClient.__performSystemRequest = function(action, data, options, callback) {
      callback(new Error('system request failed'), null);
    };
    happnClient.__doLogin({}, function(e) {
      test.expect(e.toString()).to.eql('Error: system request failed');
      done();
    });
  });

  xit('tests the __signNonce function.', function(done) {
    //TODO::: NEEDS A 32-bit buffer for nonce???
    happnClient = mockHappnClient();

    happnClient.__prepareInstanceOptions({
      keyPair: {
        privateKey: 'pqPVklZ9kdANfeEZhNFYYznGKKh/cz3qI7JUfVEJRwg=',
        publicKey: 'AwKAM+xrypUPLMMKgQBJ6oSpg2+9szVLlL5u7yjM8XlG'
      }
    });

    happnClient.__ensureCryptoLibrary();

    const a = happnClient.__signNonce(':::32 Bit buffer???');
    //eslint-disable-next-line no-console
    console.log(a);
    done();
  });

  it('tests the __prepareLogin function will calback login paramaters if not digest.', function(done) {
    happnClient = mockHappnClient();
    var loginParameters = {
      name: 'Janco',
      password: 'private',
      loginType: 'password'
    };
    happnClient.__prepareLogin(loginParameters, function(e, data) {
      test.expect(data).to.eql(loginParameters);
      done();
    });
  });

  it('tests the login function calls doLogin and request callback.', function(done) {
    happnClient = mockHappnClient();

    happnClient.__doLogin = function(options, callback) {
      callback(options);
    };

    happnClient.__requestCallback = function(message, callback) {
      callback(message);
    };

    happnClient.__prepareInstanceOptions({
      username: 'Janco'
    });

    happnClient.socket.write = function() {};

    var happnPackage = require('../../../package.json');

    happnClient.login(function(data) {
      test.expect(data).to.eql({
        action: 'configure-session',
        eventId: 1,
        data: { protocol: 'happn_4', version: happnPackage.version, browser: false },
        sessionId: 'test'
      });
      done();
    });
  });

  it('tests that the connect function calls the login function when there is a socket.', function(done) {
    happnClient = mockHappnClient();
    happnClient.login = function(callback) {
      return callback(null, 'done');
    };
    happnClient.__prepareInstanceOptions({});
    happnClient.__getConnection = cb => {
      cb(null, mockSocket());
    };
    happnClient.connect(function(err, data) {
      test.expect(err).to.be(null);
      test.expect(data).to.be('done');
      done();
    });
  });

  it('tests the handle_end function emits a "connection-ended" event and sets status to disconnected.', function(done) {
    happnClient = mockHappnClient();
    happnClient.__attachSession({
      id: 'This is a session'
    });
    happnClient.emit = function(event_type, data) {
      test.expect(event_type).to.eql('connection-ended');
      test.expect(data).to.eql('This is a session');
      test.expect(this.status).to.eql(Constants.CLIENT_STATE.DISCONNECTED);
      done();
    };
    happnClient.handle_end();
  });

  it('tests the handle_reconnect_timeout function emits a reconnect-timeout event.', function(done) {
    happnClient = mockHappnClient();

    happnClient.emit = function(event_type, data) {
      test.expect(event_type).to.eql('reconnect-timeout');
      test.expect(data).to.eql({
        err: {},
        opts: {}
      });
      test.expect(this.status).to.eql(Constants.CLIENT_STATE.DISCONNECTED);
      done();
    };

    happnClient.handle_reconnect_timeout({}, {});
  });

  it('tests the handle_reconnect_scheduled function emits a reconnect scheduled event.', function(done) {
    happnClient = mockHappnClient();
    happnClient.emit = function(event_type) {
      test.expect(event_type).to.eql('reconnect-scheduled');
      test.expect(this.status).to.eql(Constants.CLIENT_STATE.RECONNECTING);
      done();
    };
    happnClient.handle_reconnect_scheduled();
  });

  it('tests the getEventId function.', function(done) {
    happnClient = mockHappnClient();
    test.expect(happnClient.getEventId()).to.eql(1);
    test.expect(happnClient.getEventId()).to.eql(2);
    done();
  });

  it('tests the __requestCallback function.', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback(
      {
        eventId: 'MyEvent|1'
      },
      function(e, response) {
        return response;
      },
      {
        timeout: 100
      },
      'MyEvent|1'
    );
    test
      .expect(typeof happnClient.state.requestEvents['MyEvent|1'].handleResponse)
      .to.eql('function');
    done();
  });

  it('tests the __performSystemRequest function writes a message to the socket with null options.', function(done) {
    happnClient = mockHappnClient();
    happnClient.socket.write = function(message) {
      test.expect(message).to.eql({
        action: 'login',
        eventId: 1,
        data: {
          username: 'Janco1',
          password: 'private'
        },
        sessionId: 'test'
      });
      done();
    };

    happnClient.__performSystemRequest(
      'login',
      {
        username: 'Janco1',
        password: 'private'
      },
      null,
      function() {}
    );
  });

  it('tests the __performSystemRequest function writes a message to the socket with timeout options.', function(done) {
    this.timeout(20000);
    happnClient = mockHappnClient();
    happnClient.socket.write = function(message) {
      test.expect(message).to.eql({
        action: 'login',
        eventId: 1,
        data: {
          username: 'Janco2',
          password: 'private'
        },
        options: {
          timeout: 100
        },
        sessionId: 'test'
      });
      done();
    };

    happnClient.__performSystemRequest(
      'login',
      {
        username: 'Janco2',
        password: 'private'
      },
      {
        timeout: 100
      },
      function() {}
    );
  });

  it('tests the __performSystemRequest function will return a callback if one is passed to it.', function(done) {
    happnClient = mockHappnClient();

    happnClient.socket.write = function() {};

    happnClient.__performSystemRequest(
      'login',
      {
        username: 'Janco3',
        password: 'private'
      },
      {
        timeout: 50
      },
      function(error) {
        test.expect(error.toString()).to.eql('Error: api request timed out');
        done();
      }
    );
  });

  it('tests the getChannel function.', function(done) {
    happnClient = mockHappnClient();
    test.expect(happnClient.getChannel('test', 'test_action')).to.eql('/TEST_ACTION@test');
    done();
  });

  it('tests that the get function will call __getDataRequest and returns a callback ', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.get('/test/path', function(e) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the getPaths function will call __getDataRequest and returns a callback ', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.getPaths('/test/path', function(e) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getDataRequest and returns a callback ', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.increment('/test/path', 1, 1, function(e) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback when increment property is not specified (i.e. replaced by callback function) ', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.increment('/test/path', 1, function(e) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback when increment and gauge properties are not specified (i.e. replaced by callback function) ', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.increment('/test/path', function(e) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will return an error callback if the increment is NAN ', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.increment('/test/path', 1, 'string', function(e) {
      test.expect(e.toString()).to.eql('Error: increment must be a number');
      done();
    });
  });

  it('tests that the set function calls __getdatarequest and returns a callback', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.set(
      '/test/path',
      {
        test: 'data'
      },
      function(e) {
        if (e) return done(e);
        done();
      }
    );
  });

  it('tests that the set function will return an error callback if a wildcard "*" is used in path', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.set(
      '/test/*/path',
      {
        test: 'data'
      },
      function(e) {
        test
          .expect(e.toString())
          .to.eql(
            "Error: Bad path, if the action is 'set' the path cannot contain the * wildcard character"
          );
        done();
      }
    );
  });

  it('tests that the set function will return an error callback if an illegal character is used in path', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.set(
      '/test/^/path',
      {
        test: 'data'
      },
      function(e) {
        test
          .expect(e.toString())
          .to.eql(
            'Error: Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*'
          );
        done();
      }
    );
  });

  it('tests that the remove function will call the  __getDataRequest function and so return a callback', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.remove('/test/path', null, function() {
      done();
    });
  });

  it('tests that the remove function will call the  __getDataRequest function and return a callback when parameters are ommitted', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };

    happnClient.remove('/test/path', function() {
      done();
    });
  });

  it('tests the __reattachListeners function returns a callback', function(done) {
    happnClient = mockHappnClient();

    happnClient.__reattachListeners(function() {
      done();
    });
  });

  it('tests the reconnect function emits a reconnect event', function(done) {
    const happnClient = mockHappnClient();
    happnClient.__prepareInstanceOptions({});

    happnClient.onEvent('reconnect', function(data) {
      test.expect(data).to.eql(options);
      happnClient.disconnect({}, function() {
        done();
      });
    });

    var options = {
      Name: 'Options'
    };

    happnClient.reconnect(options);
  });

  it('tests the reconnect function calls connect', function(done) {
    happnClient = mockHappnClient();

    happnClient.connect = function(cb) {
      test.expect(typeof cb).to.eql('function');
      done();
    };
    happnClient.onEvent('reconnect', function() {});
    var options = {
      Name: 'Options'
    };

    happnClient.reconnect(options);
  });

  it('tests the handle_error function with a non fatal error', function(done) {
    happnClient = mockHappnClient();

    happnClient.onEvent('error', function(e, response) {
      test.expect(e.toString()).to.eql('Error: This is an error');
      test.expect(response).to.be(undefined);
    });

    happnClient.handle_error(new Error('This is an error'), false);
    test.expect(happnClient.state.errors[0].error.toString()).to.eql('Error: This is an error');
    done();
  });

  it("tests that the __attachpublishedAck function will callback an error if options aren't correct", function(done) {
    happnClient = mockHappnClient();

    try {
      happnClient.__attachPublishedAck({}, {});
    } catch (err) {
      test.expect(err.toString()).to.eql('Error: onPublished handler in options is missing');
      done();
    }
  });

  it('tests that the __attachpublishedAck function will callback with an error if timed out  ', function(done) {
    const options = {
      onPublished: function(e) {
        test.expect(e.toString()).to.eql('Error: publish timed out');
        done();
      },
      onPublishedTimeout: 10
    };
    happnClient = mockHappnClient();
    happnClient.__attachPublishedAck(options, {});
  });

  it('tests the handle_ack function works when __attachPublishedAck has been called', function(done) {
    happnClient = mockHappnClient();

    var message = {
      sessionId: '1',
      eventId: '1'
    };
    var message2 = {
      id: '1-1',
      result: 'Good',
      status: 'good'
    };
    var options = {
      onPublished: function(e, results) {
        test.expect(results).to.eql('Good');
        done();
      },
      onPublishedTimeout: 1000
    };
    happnClient.__attachPublishedAck(options, message);
    happnClient.handle_ack(message2);
  });

  it("tests the handle_ack function throws an error on a message with status: 'error' after __attachPublishedAck has been called", function(done) {
    happnClient = mockHappnClient();

    var message = {
      sessionId: '1',
      eventId: '1'
    };
    var message2 = {
      id: '1-1',
      error: 'Bad',
      status: 'error',
      result: 'Bad'
    };
    var options = {
      onPublished: function(e, results) {
        test.expect(e.toString()).to.eql('Error: Bad');
        test.expect(results).to.eql('Bad');
        done();
      },
      onPublishedTimeout: 100
    };
    happnClient.__attachPublishedAck(options, message);
    happnClient.handle_ack(message2);
  });

  it('tests the handle_publication function', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback(
      {
        eventId: 'MyEvent|1'
      },
      function(e, data) {
        test.expect(data).to.eql(message);
        done();
      },
      {},
      'MyEvent|1'
    );
    var message = {
      _meta: {
        eventId: 'MyEvent|1'
      },
      message: 'Hello'
    };
    happnClient.handle_publication(message);
  });

  it("tests the handle_publication function calls __handleSystemMessage if _meta.type = 'system'", function(done) {
    happnClient = mockHappnClient();
    happnClient.__handleSystemMessage = function(data) {
      test.expect(data).to.eql(message);
      done();
    };
    var message = {
      _meta: {
        type: 'system',
        eventId: 'MyEvent|1'
      },
      message: 'Hello'
    };
    happnClient.handle_publication(message);
  });

  it("tests the handle_publication function calls handle_data if _meta.type = 'data'", function(done) {
    happnClient = mockHappnClient();
    happnClient.handle_data = function(channel, data) {
      test.expect(channel).to.eql('test');
      test.expect(data).to.eql(message);
      done();
    };
    var message = {
      _meta: {
        channel: 'test',
        type: 'data',
        eventId: 'MyEvent|1'
      },
      message: 'Hello'
    };
    happnClient.handle_publication(message);
  });

  it("tests the handle_publication function calls handle_ack if _meta.type = 'ack'", function(done) {
    happnClient = mockHappnClient();
    happnClient.handle_ack = function(data) {
      test.expect(data).to.eql(message);
      done();
    };
    var message = {
      _meta: {
        type: 'ack',
        eventId: 'MyEvent|1'
      },
      message: 'Hello'
    };
    happnClient.handle_publication(message);
  });

  it('tests the handle_publication function works when message is an array', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback(
      {
        eventId: 'MyEvent|1'
      },
      function(e, data) {
        test.expect(data).to.eql(['Hello']);
        done();
      },
      {},
      'MyEvent|1'
    );
    var message = [
      'Hello',
      {
        eventId: 'MyEvent|1'
      }
    ];
    happnClient.handle_publication(message);
  });

  it('tests the handle_publication function can handle an error', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback(
      {
        eventId: 'MyEvent|1'
      },
      function(e, data) {
        test.expect(e.toString()).to.eql('Error: This is an error');
        test.expect(data).to.eql(message);
        done();
      },
      {},
      'MyEvent|1'
    );

    var message = {
      _meta: {
        status: 'error',
        error: {
          name: 'Error',
          message: 'This is an error'
        },
        eventId: 'MyEvent|1'
      },
      message: 'Bad message with error'
    };
    happnClient.handle_publication(message);
  });

  it('tests the handle_response_array function', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback(
      {
        eventId: 'MyEvent|1'
      },
      function(e, data) {
        test.expect(data).to.eql('Hello');
        done();
      },
      {},
      'MyEvent|1'
    );
    var response = 'Hello';
    const meta = {
      eventId: 'MyEvent|1'
    };
    happnClient.handle_response_array(null, response, meta);
  });

  it('tests the handle_response function', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback(
      {
        eventId: 'MyEvent|1'
      },
      function(e, data) {
        test.expect(data).to.eql(response);
        done();
      },
      {},
      'MyEvent|1'
    );
    var response = {
      _meta: {
        eventId: 'MyEvent|1'
      },
      message: 'Hello'
    };
    happnClient.handle_response(null, response);
  });

  it('tests the handle_response function, passing a timeout', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback(
      {
        eventId: 'MyEvent|1'
      },
      function(e, data) {
        test.expect(data).to.eql(response);
        done();
      },
      {
        timeout: 100
      },
      'MyEvent|1'
    );
    var response = {
      _meta: {
        eventId: 'MyEvent|1'
      },
      message: 'Hello'
    };
    happnClient.handle_response(null, response);
  });

  it('tests the __acknowledge function', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback = function(message, callback) {
      callback();
    };
    var message = {
      _meta: {
        consistency: Constants.CONSISTENCY.ACKNOWLEDGED,
        acknowledged: false
      }
    };
    happnClient.__acknowledge(message, function(result) {
      test.expect(result._meta.acknowledged).to.eql(true);
      done();
    });
  });

  it('tests that the __acknowledge function will return an error in the message and not acknowledge if an error occurs in the __getDataRequest', function(done) {
    happnClient = mockHappnClient();
    happnClient.__requestCallback = function(message, callback) {
      callback(new Error('Bad'));
    };
    var message = {
      _meta: {
        consistency: Constants.CONSISTENCY.ACKNOWLEDGED,
        acknowledged: true
      }
    };
    happnClient.__acknowledge(message, function(result) {
      test.expect(result._meta.acknowledged).to.eql(false);
      test.expect(result._meta.acknowledgedError.toString()).to.eql('Error: Bad');
      done();
    });
  });

  it('tests the delegate_handover function when delegate runcount > count', function(done) {
    this.timeout(5000);

    happnClient = mockHappnClient();
    happnClient.__prepareInstanceOptions({});

    var delegate = {
      count: 1,
      runcount: 2,
      handler: function() {
        done(new Error('untest.expected'));
      }
    };

    var message = JSON.stringify({
      message: 'test'
    });
    happnClient.delegate_handover(message, {}, delegate);
    setTimeout(done, 2000);
  });

  it('tests the delegate_handover function when delegate runcount == count', function(done) {
    this.timeout(5000);
    let tm = setTimeout(() => {
      done(new Error('untest.expected'));
    }, 3000);
    happnClient = mockHappnClient();
    happnClient._offListener = (_id, cb) => cb();
    var delegate = {
      count: 1,
      runcount: 0,
      handler: () => {
        clearTimeout(tm);
        done();
      }
    };
    var message = JSON.stringify({
      message: 'test'
    });
    happnClient.delegate_handover(message, {}, delegate);
  });

  it('tests the delegate_handover function when runcount will equal count after 1 iteration', function(done) {
    happnClient = mockHappnClient();

    happnClient.__acknowledge = function(data, cb) {
      cb(data);
    };

    var delegate = {
      count: 2,
      runcount: 1,
      handler: function(data, meta) {
        test.expect(data).to.eql(message.data);
        test.expect(meta).to.eql(message._meta);
        done();
      }
    };
    var message = {
      data: 'This is a message',
      _meta: 'Meta'
    };
    happnClient.delegate_handover(JSON.stringify(message.data), message._meta, delegate);
  });

  it('tests the delegate_handover function when count >> runcount', function(done) {
    happnClient = mockHappnClient();
    happnClient.__acknowledge = function(data, cb) {
      cb(data);
    };

    var delegate = {
      count: 10,
      runcount: 1,
      handler: function(data, meta) {
        test.expect(data).to.eql(message.data);
        test.expect(meta).to.eql(message._meta);
        done();
      }
    };
    var message = {
      data: 'This is a message',
      _meta: 'Meta'
    };
    happnClient.delegate_handover(JSON.stringify(message.data), message._meta, delegate);
  });

  it('tests the handle_data function with one event handler', function(done) {
    happnClient = mockHappnClient();

    happnClient.state.events = {
      'MyEvent|1': [
        {
          handler: function(data, meta) {
            test.expect(data).to.eql(message.data);
            test.expect(meta).to.eql(message._meta);
            done();
          }
        }
      ]
    };
    happnClient.__acknowledge = function(data, cb) {
      cb(data);
    };

    var message = {
      _meta: {
        eventId: 'MyEvent|1'
      },
      data: 'Hello'
    };
    happnClient.handle_data('MyEvent|1', message);
  });

  it('tests the handle_data function with multiple handlers', function(done) {
    happnClient = mockHappnClient();
    var n = 0;
    var testDone = function() {
      n++;
      if (n === 2) done();
    };
    happnClient.state.events = {
      'MyEvent|1': [
        {
          handler: function(data, meta) {
            test.expect(data).to.eql(message.data);
            test.expect(meta).to.eql(message._meta);
            testDone();
          }
        },
        {
          handler: function(data, meta) {
            test.expect(data).to.eql(message.data);
            test.expect(meta).to.eql(message._meta);
            testDone();
          }
        }
      ]
    };
    happnClient.__acknowledge = function(data, cb) {
      cb(data);
    };

    var message = {
      _meta: {
        eventId: 'MyEvent|1'
      },
      data: 'Hello'
    };
    happnClient.handle_data('MyEvent|1', message);
  });

  it('tests the __handleSystemMessage function will set status to disconnected if message event key is server-side-disconnect', function(done) {
    happnClient = mockHappnClient();
    var message = {
      eventKey: 'server-side-disconnect'
    };
    happnClient.__handleSystemMessage(message);
    test.expect(happnClient.status).to.eql(Constants.CLIENT_STATE.DISCONNECTED);
    done();
  });

  it('tests the offSystemMessage function', function(done) {
    happnClient = mockHappnClient();
    test
      .expect(
        happnClient.onSystemMessage(function(x) {
          //eslint-disable-next-line no-console
          console.log(x);
        })
      )
      .to.eql(0);
    happnClient.offSystemMessage(0);
    test.expect(happnClient.state.systemMessageHandlers.length).to.eql(0);
    done();
  });

  it('tests the onSystemMessage function', function(done) {
    happnClient = mockHappnClient();
    test
      .expect(
        happnClient.onSystemMessage(function(x) {
          //eslint-disable-next-line no-console
          console.log(x);
        })
      )
      .to.eql(0);
    test
      .expect(
        happnClient.onSystemMessage(function(x) {
          //eslint-disable-next-line no-console
          console.log(x);
        })
      )
      .to.eql(1);
    done();
  });

  it('tests the _remoteOn function calls request callback', function(done) {
    happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback) {
      callback();
    };
    happnClient._remoteOn('test/path', null, function() {
      done();
    });
  });

  it('tests the on function returns will create a callbackHandler and that handle_data will call it', function(done) {
    happnClient = mockHappnClient();
    var parameters = {
      event_type: 'Call',
      meta: {}
    };
    var response = {
      _meta: {
        eventId: 1
      },
      data: 'This is a message',
      status: 'OK'
    };

    happnClient.socket.write = function() {
      happnClient.handle_response(null, response);
    };

    happnClient.on(
      'MyEvent',
      parameters,
      function(data, meta) {
        test.expect(data).to.eql('This is a message');
        test.expect(meta).to.eql({
          eventId: 1
        });
        done();
      },
      function() {
        happnClient.handle_data('/CALL@MyEvent', response);
      }
    );
  });

  it('tests the on function throws an error if not called with a callback', function(done) {
    happnClient = mockHappnClient();
    happnClient
      .on()
      .then(function() {
        done(new Error('this should not have happened'));
      })
      .catch(function(error) {
        test
          .expect(error.toString())
          .to.eql('Error: you cannot subscribe without passing in a subscription callback');
        done();
      });
  });

  it('tests the on function throws an error if using onPublished handler (mocking handler) without a callback', function(done) {
    happnClient = mockHappnClient();
    var parameters = {
      onPublished: function(x) {
        //eslint-disable-next-line no-console
        console.log(x);
      }
    };
    happnClient.on('test/path', parameters, 'string', undefined).catch(function(error) {
      test
        .expect(error.toString())
        .to.eql('Error: callback cannot be null when using the onPublished event handler');
      done();
    });
  });

  it('tests the onAll function', function(done) {
    happnClient = mockHappnClient();

    var response = {
      status: 'OK',
      _meta: {
        eventId: '1'
      }
    };

    happnClient.socket.write = function() {
      happnClient.handle_response(null, response);
    };

    happnClient.onAll(
      function(data, meta) {
        test.expect(data).to.eql('This is data');
        test.expect(meta).to.eql('This is meta');
        done();
      },
      function() {
        happnClient.handle_data('/ALL@*', {
          data: 'This is data',
          _meta: 'This is meta'
        });
      }
    );
  });

  it('tests the _remoteOff function', function(done) {
    happnClient = mockHappnClient();

    var channel = '/THIS@that';
    var message1 = {
      action: 'off',
      eventId: 1,
      options: {
        referenceId: 0,
        timeout: 5000
      },
      path: channel,
      data: null,
      sessionId: 'test'
    };

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      test.expect(path).to.equal(channel);
      test.expect(options).to.eql({
        referenceId: 0,
        timeout: 5000
      });
      test.expect(message).to.eql(message1);
      test.expect(eventId).to.eql(1);
      test.expect(action).to.eql('off');

      callback(null, {
        status: 'OK'
      });
    };

    happnClient._remoteOff('/THIS@that', function() {
      done();
    });
  });

  it('tests the _offListener function', function(done) {
    happnClient = mockHappnClient();
    var path;
    happnClient._remoteOff = function(channel, listenerRef, cb) {
      if (typeof listenerRef === 'function') cb = listenerRef;
      path = channel;
      cb();
    };

    happnClient.state.refCount = {
      A: 1,
      B: 1,
      C: 1,
      D: 1
    };

    happnClient.state.events = {
      event1: [
        {
          id: 1,
          eventKey: 'A'
        },
        {
          id: 2,
          eventKey: 'B'
        },
        {
          id: 3,
          eventKey: 'C'
        }
      ],
      event2: [
        {
          id: 5,
          eventKey: 'D'
        }
      ]
    };

    happnClient._offListener(5, function() {
      test.expect(path).to.eql('event2');
      test.expect(happnClient.state.events['event2']).to.be(undefined);
      done();
    });
  });

  it('tests the _offPath function', function(done) {
    happnClient = mockHappnClient();
    happnClient._remoteOff = function(channel, listenerRef, callback) {
      if (typeof listenerRef === 'function') {
        callback = listenerRef;
        listenerRef = 0;
      }
      callback();
    };
    happnClient.state.events = {
      '/EVENT1@SOMEWHERE': [
        {
          id: 1,
          referenceId: 'A'
        },
        {
          id: 2,
          referenceId: 'B'
        },
        {
          id: 3,
          referenceId: 'C'
        }
      ],
      '/EVENT2@SOMEWHERE': [
        {
          id: 1,
          referenceId: 'A'
        },
        {
          id: 2,
          referenceId: 'B'
        },
        {
          id: 3,
          referenceId: 'C'
        }
      ],
      event2: [
        {
          id: 4,
          referenceId: 'D'
        },
        {
          id: 5,
          referenceId: 'E'
        },
        {
          id: 6,
          referenceId: 'F'
        }
      ]
    };
    happnClient.offPath('SOMEWHERE', function() {
      test.expect(happnClient.state.events).to.eql({
        event2: [
          {
            id: 4,
            referenceId: 'D'
          },
          {
            id: 5,
            referenceId: 'E'
          },
          {
            id: 6,
            referenceId: 'F'
          }
        ]
      });
      done();
    });
  });

  it('tests the offAll function', function(done) {
    happnClient = mockHappnClient();
    happnClient._remoteOff = function(channel, callback) {
      test.expect(channel).to.eql('*');
      callback();
    };
    happnClient.state.events = {
      '/EVENT1@SOMEWHERE': [
        {
          id: 1,
          referenceId: 'A'
        },
        {
          id: 2,
          referenceId: 'B'
        },
        {
          id: 3,
          referenceId: 'C'
        }
      ],
      event2: [
        {
          id: 4,
          referenceId: 'D'
        },
        {
          id: 5,
          referenceId: 'E'
        },
        {
          id: 6,
          referenceId: 'F'
        }
      ]
    };
    happnClient.offAll(function() {
      test.expect(happnClient.state.events).to.eql({});
      done();
    });
  });

  it('tests the off function returns a callback', function(done) {
    happnClient = mockHappnClient();
    happnClient.off(1, function() {
      done();
    });
  });

  it('tests the off function returns an error if the handle is null', function(done) {
    happnClient = mockHappnClient();
    happnClient.off(null, function(err) {
      test.expect(err.toString()).to.eql('Error: handle cannot be null');
      done();
    });
  });

  it('tests the off function returns an error if the handle is NAN', function(done) {
    happnClient = mockHappnClient();
    happnClient.off('string', function(err) {
      test.expect(err.toString()).to.eql('Error: handle must be a number');
      done();
    });
  });

  it('tests the __connectionCleanup function will call socket.end correctly if it is mocked.', function(done) {
    happnClient = mockHappnClient();
    let alreadyCalled = false;
    happnClient.socket.destroy = function() {
      if (alreadyCalled) return;
      alreadyCalled = true;
      done();
    };
    happnClient.log.warn = function() {};
    happnClient.__connectionCleanup(e => {
      if (e) return done(e);
    });
  });

  it('tests the revokeSession function calls a perform system request with revoke-session', function(done) {
    happnClient = mockHappnClient();
    happnClient.__performSystemRequest = function(action, data, options, callback) {
      test.expect(action).to.equal('revoke-token');
      callback();
    };
    happnClient.revokeToken(function() {
      done();
    });
  });

  afterEach('cleans up client', function() {
    if (happnClient) {
      happnClient.disconnect();
    }
  });

  // after('shows why node is still running', function () {
  //   test.printOpenHandles(2e3);
  // });

  function mockSocket() {
    return {
      removeAllListeners: test.sinon.stub(),
      write: test.sinon.stub(),
      on: test.sinon.stub(),
      destroy: test.sinon.stub(),
      end: test.sinon.stub()
    };
  }

  function mockHappnClient(log, state, session, serverInfo, socket, clientOptions) {
    happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeState();
    happnClient.log = log || {
      error: function() {},
      info: function() {},
      warn: function() {}
    };

    happnClient.status = state != null ? state : Constants.CLIENT_STATE.ACTIVE;
    happnClient.session = session || {
      id: 'test'
    };
    happnClient.serverInfo = serverInfo || {};

    happnClient.socket = socket || mockSocket();

    happnClient.options = clientOptions || {
      callTimeout: 5000
    };

    return happnClient;
  }
});
