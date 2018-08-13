describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function() {

  this.timeout(5000);

  var expect = require('expect.js');
  var path = require('path');
  var HappnClient = require('../../../lib/client');
  var Constants = require('../../../lib/constants');

  function mockHappnClient(log, state, session, serverInfo, socket, clientOptions) {

    var happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeProperties();
    happnClient.log = log || {
      error: function() {}
    }

    happnClient.state = state != null ? state : Constants.CLIENT_STATE.ACTIVE;
    happnClient.session = session || {
      id: 'test'
    };
    happnClient.serverInfo = serverInfo || {};

    happnClient.socket = socket || {
      write: function(message) {

      },
      on: function(eventName) {

      }
    }

    happnClient.options = clientOptions || {
      callTimeout: 60000
    };

    return happnClient;
  }

  it("tests that the initialize function calls authenticate and login if there is a socket", function(done) {
    var happnClient = mockHappnClient();
    happnClient.socket = true;
    happnClient.login = function(callback) {
      return callback(null, "YAY");
    };
    happnClient.initialize(function(err, results) {
      expect(err).to.be(null)
      expect(results.state).to.equal(Constants.CLIENT_STATE.ACTIVE)
      expect(results.session).to.be(null)
      done()
    })

  })

  it("tests the __prepareSecurityOptions function", function(done) {
    var happnClient = mockHappnClient();
    var options = {
      keyPair: {
        publicKey: 123,
        privateKey: 456
      }
    };
    happnClient.__prepareSecurityOptions(options);
    expect(options.publicKey).to.eql(123);
    expect(options.privateKey).to.eql(456);
    done()
  })

  it("tests the __prepareSocketOptions  function", function(done) {
    var happnClient = mockHappnClient();
    var opts = {};
    happnClient.__prepareSocketOptions(opts)
    var expectedOpts = {
      socket: {
        reconnect: {
          retries: Infinity,
          max: 180000
        },
        timeout: 30000,
        strategy: "disconnect,online,timeout"
      }
    };
    expect(opts).to.eql(expectedOpts);
    done()
  })

  it('tests the __prepareConnectionOptions function.', function(done) {
    var happnClient = mockHappnClient();

    opts = happnClient.__prepareConnectionOptions({}, {})
    expect(opts).to.eql({
      host: '127.0.0.1',
      port: 55000,
      protocol: 'http',
      url: 'http://127.0.0.1:55000'
    })
    done()
  })

  it('tests the __prepareConnectionOptions function with defaults.', function(done) {
    var happnClient = mockHappnClient();
    var defaults = {
      protocol: 'ssh',
      allowSelfSignedCerts: true,
      username: "Janco",
      password: "private"
    }
    opts = happnClient.__prepareConnectionOptions({}, defaults)
    expect(opts).to.eql({
      allowSelfSignedCerts: true,
      username: "Janco",
      password: "private",
      host: '127.0.0.1',
      port: 55000,
      protocol: 'ssh',
      url: 'ssh://127.0.0.1:55000'
    })
    done()
  })



  it("tests the __prepareOptions function with blank options", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__prepareOptions({})
    expect(happnClient.options).to.eql({
      callTimeout: 60000,
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
        strategy: 'disconnect,online,timeout'
      },
      info: {
        _browser: false
      },
      loginRetry: 4,
      loginRetryInterval: 5000,
      loginTimeout: 60000
    })
    done()
  })

  it("tests the __prepareOptions function with mostly blank options, including pool object", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__prepareOptions({
      pool: [1, 2]
    })

    expect(happnClient.options).to.eql({
      pool: [1, 2],
      callTimeout: 60000,
      poolReconnectDelay: 0,
      poolType: 1,
      poolReconnectAttempts: 4,
      socket: {
        reconnect: {
          retries: Infinity,
          max: 180000
        },
        timeout: 30000,
        strategy: 'disconnect,online,timeout'
      },
      info: {
        _browser: false
      },
      loginRetry: 4,
      loginRetryInterval: 5000,
      loginTimeout: 60000
    })
    done()
  })

  it("tests the __prepareOptions function with mostly blank options, including keyPair(security) object", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__prepareOptions({
      keyPair: {
        publicKey: 123,
        privateKey: 456
      }
    })
    expect(happnClient.options).to.eql({
      keyPair: {
        publicKey: 123,
        privateKey: 456
      },
      callTimeout: 60000,
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
        strategy: 'disconnect,online,timeout'
      },
      info: {
        _browser: false
      },
      loginRetry: 4,
      loginRetryInterval: 5000,
      loginTimeout: 60000
    })

    done()
  })

  it("tests the __updateOptions function", function(done) {
    var happnClient = mockHappnClient();
    var possibility = {
      url: "1.0.0.127",
      host: "local",
      port: 8000,
      protocol: "http",
      allowSelfSignedCerts: false,
      username: "Janco",
      password: "Private",
      publicKey: 123,
      privateKey: 456,
      token: "None",
      someRubbish: "rubbish",
      moreRubbish: "rubbish"
    };
    var possibility2 = {
      "callTimeout": 60000,
      url: "1.0.0.127",
      host: "local",
      port: 8000,
      protocol: "http",
      allowSelfSignedCerts: false,
      username: "Janco",
      password: "Private",
      publicKey: 123,
      privateKey: 456,
      token: "None"
    }

    happnClient.__updateOptions(possibility)
    expect(happnClient.options).to.eql(possibility2)
    done()
  })

  xit('tests the __initializeConnectivity function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }
    opts = happnClient.__prepareConnectionOptions({}, {})
    //TODO Mock socket function?
    happnClient.__initializeConnectivity(opts, (err, data) => {
      console.log(data)
      console.log(err)
      //TODO Can't Timing out
      done()
    })
  })

  xit('tests the __connectSocket function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__connectSocket((err, data) => {
      //TODO This test causes the client and test framework to hang
      done()
    })
  })

  it("tests the __initializeProperties function", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__initializeProperties();
    expect(happnClient.events).to.eql({});
    expect(happnClient.messageEvents).to.eql({});
    expect(happnClient.requestEvents).to.eql({});
    expect(happnClient.currentEventId).to.eql(0);
    expect(happnClient.currentListenerId).to.eql(0);
    expect(happnClient.errors).to.eql([]);
    expect(happnClient.clientType).to.eql('socket');
    expect(happnClient.__systemMessageHandlers).to.eql([]);
    expect(happnClient.state).to.eql(Constants.CLIENT_STATE.UNINITIALIZED);
    expect(happnClient.__ackHandlers).to.eql({});
    expect(happnClient.eventHandlers).to.eql({});
    done()

  })

  it("tests the __initializeEvents function creates functions for 'onEvent', 'offEvent' and 'emit'", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    expect(typeof happnClient.onEvent).to.eql('function');
    expect(typeof happnClient.offEvent).to.eql('function');
    expect(typeof happnClient.emit).to.eql('function');
    done();
  })

  it("tests the 'onEvent' function created by __initializeEvents throws an error if no event_name is supplied", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    try {
      happnClient.onEvent()
    } catch (e) {
      expect(e.toString()).to.eql('Error: event name cannot be blank or null')
      done()
    }
  })

  it("tests the 'onEvent' function created by __initializeEvents throws an error if event_handler isn't a function", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    try {
      happnClient.onEvent("MyEvent", "MyHandler")
    } catch (e) {
      expect(e.toString()).to.eql('Error: event handler must be a function')
      done()
    }
  })

  it("tests the 'onEvent' function created by __initializeEvents returns the correct information", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    expect(happnClient.onEvent("MyEvent", function(x) {
      console.log(x)
    })).to.eql("MyEvent|0")
    expect(happnClient.onEvent("MyEvent", function(x) {
      console.log(typeof x)
    })).to.eql("MyEvent|1")
    expect(happnClient.onEvent("MyNewEvent", function(x) {
      console.log(typeof x)
    })).to.eql("MyNewEvent|0")
    expect(typeof happnClient.eventHandlers["MyEvent"][0]).to.eql('function')
    expect(typeof happnClient.eventHandlers["MyEvent"][1]).to.eql('function')
    expect(typeof happnClient.eventHandlers["MyNewEvent"][0]).to.eql('function')
    done()
  })

  it("tests the 'offEvent' function created by __initializeEvents removes an event handler", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__initializeEvents();
    var a = happnClient.onEvent("MyEvent", function(x) {
      console.log(x)
    })
    var b = happnClient.onEvent("MyEvent", function(x) {
      console.log(typeof x)
    })
    happnClient.offEvent("MyEvent|0")

    expect(happnClient.eventHandlers["MyEvent"][0]).to.be(null)
    expect(typeof happnClient.eventHandlers["MyEvent"][1]).to.eql('function')
    done()
  })

  it('tests the getScript function returns an error when not called from a browser', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }
    happnClient.getScript('http://www.google.com', (err, data) => {
      expect(err.toString()).to.eql('Error: only for browser')
      done()
    })
  })

  xit('tests the getScript function when called from a browser', function(done) {
    //TODO Not sure how to test this!
  })

  it('tests the getResources function returns a callback.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.getResources((err, data) => {
      done()
    })
  })

  xit('tests the stop function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.stop((err, data) => {

      //TODO Can't access internals
      done()
    })
  })

  xit('tests the __encryptLogin function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the __decryptLogin function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the __encryptPayload function.', function(done) {
    var happnClient = mockHappnClient();
    happnClient.session.secret = "secret"
    happnClient.crypto = {}
    happnClient.crypto.symmetricEncryptObject = (message, secret) => {
      return message.text + secret
    }
    message = {
      text: "not really a ",
      sessionID: 1
    }
    newMessage = happnClient.__encryptPayload(message)
    expect(newMessage).to.eql({
      sessionID: 1,
      encrypted: "not really a secret"
    })
  })

  xit('tests the __decryptPayload function.', function(done) {
    var happnClient = mockHappnClient();

  })

  it('tests the __ensureCryptoLibrary function returns a callback.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.__ensureCryptoLibrary((err, data) => {
      done()
    })
  })

  xit('tests the __attachSession function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the __payloadToError function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the __doLogin function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the __signNonce function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the __prepareLogin function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the login function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.login((err, data) => {

      done()
    })
  })

  it('tests that the authenticate function calls the login function when there is a socket.', function(done) {
    var happnClient = mockHappnClient();
    happnClient.socket = true;
    happnClient.login = function(callback) {
      return callback(null, "YAY");
    }
    happnClient.authenticate(function(err, data) {
      expect(err).to.be(null);
      expect(data).to.be("YAY");
      done()
    })
  })

  xit('tests that the authenticate function when there is no socket.', function(done) {
    var happnClient = mockHappnClient();
    happnClient.socket = true;
    happnClient.login = function(callback) {
      return callback(null, "YAY");
    }
    happnClient.authenticate(function(err, data) {
      expect(err).to.be(null);
      expect(data).to.be("YAY");
      done()
    })
  })

  xit('tests the handle_end function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the handle_reconnect_timeout function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the handle_reconnect_scheduled function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the getEventId function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the __requestCallback function.', function(done) {
    var happnClient = mockHappnClient();

  })
  xit('tests the __performDataRequest function.', function(done) {
    var happnClient = mockHappnClient();
    //NB: DONE in test/unit/client/cleint.js
  })

  xit('tests the __performSystemRequest function.', function(done) {
    var happnClient = mockHappnClient();

  })

  xit('tests the getChannel function.', function(done) {
    var happnClient = mockHappnClient();

  })


  it('tests that the get function will call __getdatarequest and returns a callback ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.get('/test/path', function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the getPaths function will call __getdatarequest and returns a callback ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.getPaths('/test/path', function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.increment('/test/path', 1, 1, function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback when increment property is not specified (i.e. replaced by callback function) ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.increment('/test/path', 1, function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback when increment and gauge properties are not specified (i.e. replaced by callback function) ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.increment('/test/path', function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will return an error callback if the increment is NAN ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.increment('/test/path', 1, 'string', function(e, response) {
      expect(e.toString()).to.eql("Error: increment must be a number")
      done();
    });
  });

  it('tests that the set function calls __getdatarequest and returns a callback', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.set('/test/path', {
      test: 'data'
    }, function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the set function will return an error callback if a wildcard "*" is used in path', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.set('/test/*/path', {
      test: 'data'
    }, function(e, response) {
      expect(e.toString()).to.eql("Error: Bad path, if the action is \'set\' the path cannot contain the * wildcard character");
      done();
    });
  });

  it('tests that the set function will return an error callback if an illegal character is used in path', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.set('/test/^/path', {
      test: 'data'
    }, function(e, response) {
      expect(e.toString()).to.eql("Error: Bad path, can only contain characters a-z A-Z 0-9 / & + = : @ % * ( ) _ -, ie: factory1@I&J(western-cape)/plant1:conveyer_2/stats=true/capacity=10%/*");
      done();
    });
  });

  it('tests that the setSibling function will call the set function and so return a callback', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.setSibling('/test/path', {
      test: 'data'
    }, function(e, response) {
      done();
    });
  });

  it('tests that the remove function will call the  __getDataRequest function and so return a callback', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.remove('/test/path', null,
      function(e, response) {
        done();
      });
  });

  it('tests that the remove function will call the  __getDataRequest function and return a callback when parameters are ommitted', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.remove('/test/path',
      function(e, response) {
        done();
      });
  });

  it('tests the __reattachListeners function returns a callback', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__reattachListeners(
      function(e, response) {
        done();
      });
  });

  xit('tests the reconnect function emits a reconnect event', function(done) {

    var happnClient = mockHappnClient();

    happnClient.reconnect({});
    //    happnClient.on('reconnect', data => done())
  });

  xit('tests the handle_error function', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }
  });

  it("tests that the __attachpublishedAck function will callback an error if options aren't correct", function(done) {

    var happnClient = mockHappnClient();

    try {
      happnClient.__attachPublishedAck({}, {});
    } catch (err) {
      expect(err.toString()).to.eql('Error: onPublish handler in options is missing')
      done();
    };
  });

  it("tests that the __attachpublishedAck function will callback with an error if timed out  ", function(done) {
    options = {
      onPublished: (e, results) => {
        expect(e.toString()).to.eql('Error: publish timed out');
        done()
      },
      onPublishedTimeout: 10
    }
    var happnClient = mockHappnClient();


    happnClient.__attachPublishedAck(options, {});

  });

  it("tests the handle_ack function works when __attachPublishedAck has been called", function(done) {

    var happnClient = mockHappnClient();

    message = {
      sessionId: "1",
      eventId: "1"
    }
    message2 = {
      id: "1-1",
      result: "Good",
      status: "good"
    }
    options = {
      onPublished: (e, results) => {
        expect(results).to.eql('Good');
        done()
      },
      onPublishedTimeout: 1000
    }
    happnClient.__attachPublishedAck(options, message);
    happnClient.handle_ack(message2);
  })

  it("tests the handle_ack function throws an error on a message with status: 'error' after __attachPublishedAck has been called", function(done) {

    var happnClient = mockHappnClient();

    message = {
      sessionId: "1",
      eventId: "1"
    }
    message2 = {
      id: "1-1",
      error: "Bad",
      status: "error",
      result: "Bad"
    }
    options = {
      onPublished: (e, results) => {
        expect(e.toString()).to.eql("Error: Bad");
        expect(results).to.eql('Bad');
        done()
      },
      onPublishedTimeout: 1000
    }
    happnClient.__attachPublishedAck(options, message);
    happnClient.handle_ack(message2)
  })

  xit("tests the handle_publication function", function(done) {

  })

  xit("tests the handle_response_array function", function(done) {

  })

  xit("tests the handle_response function", function(done) {

  })

  it("tests the __acknowledge function", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }
    message = {
      _meta: {
        consistency: Constants.CONSISTENCY.ACKNOWLEDGED,
        acknowledged: false
      }
    }
    happnClient.__acknowledge(message, (result) => {
      expect(result._meta.acknowledged).to.eql(true);
      done()
    })
  })

  it("tests that the __acknowledge function will return an error in the message and not acknowledge if an error occurs in the __getDataRequest", function(done) {
    var happnClient = mockHappnClient();
    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback(new Error('Bad'));
    }
    message = {
      _meta: {
        consistency: Constants.CONSISTENCY.ACKNOWLEDGED,
        acknowledged: true
      }
    }
    happnClient.__acknowledge(message, (result) => {
      expect(result._meta.acknowledged).to.eql(false);
      expect(result._meta.acknowledgedError.toString()).to.eql("Error: Bad");
      done()
    })
  })


  xit("tests the delegate_handover function", function(done) {

  })

  xit("tests the handle_data function", function(done) {

  })

  it("tests the __handleSystemMessage function will set state to disconnected if message event key is server-side-disconnect", function(done) {
    var happnClient = mockHappnClient();
    message = {
      eventKey: 'server-side-disconnect'
    }
    happnClient.__handleSystemMessage(message)
    expect(happnClient.state).to.eql(Constants.CLIENT_STATE.DISCONNECTED)
    done()
  })

  it("tests the offSystemMessage function", function(done) {
    var happnClient = mockHappnClient();
    expect(happnClient.onSystemMessage(function(x) {
      console.log(x)
    })).to.eql(0)
    happnClient.offSystemMessage(0)
    done()
  })

  it("tests the onSystemMessage function", function(done) {
    var happnClient = mockHappnClient();
    expect(happnClient.onSystemMessage(x => (console.log(x)))).to.eql(0)
    expect(happnClient.onSystemMessage(x => (console.log(x)))).to.eql(1)
    done()
  })

  it("tests the _remoteOn function", function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }
    happnClient._remoteOn("test/path", null, (e, r) => done())
  })

  xit("tests the on function returns a callback", function(done) {
    var happnClient = mockHappnClient();
    parameters = {
      onPublished: (e, results) => {
        done()
      }
    }
    happnClient.on("test/path", parameters, (e, r) => {
      console.log(e);
      console.log(r);
      done()
    })

  })

  it("tests the on function throws an error if not called with a callback", function(done) {
    var happnClient = mockHappnClient();
    process.on('unhandledRejection', error => {
      expect(error.toString()).to.eql("Error: you cannot subscribe without passing in a subscription callback")
      done()
    })
    happnClient.on()

  })

  it("tests the on function throws an error if using onPublished handler (mocking handler) without a callback", function(done) {
    var happnClient = mockHappnClient();
    parameters = {
      onPublished: function(x) {
        console.log(x)
      }
    }
    happnClient.on("test/path", parameters, 'string', undefined).catch(function(error) {
      expect(error.toString()).to.eql("Error: callback cannot be null when using the onPublished event handler");
      done()
    })
  })

  xit("tests the onAll function", function(done) {

  })

  xit("tests the _remoteOff function", function(done) {

  })

  xit("tests the _offListener function", function(done) {

  })

  xit("tests the _offPath function", function(done) {

  })

  xit("tests the offAll function", function(done) {

  })

  it("tests the off function returns a callback", function(done) {
    var happnClient = mockHappnClient();
    happnClient.off(1, (err, data) => done())
  })

  it("tests the off function returns an error if the handle is null", function(done) {
    var happnClient = mockHappnClient();
    happnClient.off(null, (err, data) => expect(err.toString()).to.eql("Error: handle cannot be null"), done())
  })

  it("tests the off function returns an error if the handle is NAN", function(done) {
    var happnClient = mockHappnClient();
    happnClient.off('string', (err, data) => expect(err.toString()).to.eql("Error: handle must be a number"), done())
  })

  it("tests the __connectionCleanup function throws an error", function(done) {
    var happnClient = mockHappnClient();
    happnClient.log.warn = e => {
      expect(e).to.eql("socket.end failed in client: TypeError: this.socket.end is not a function");
      done()
    }
    happnClient.__connectionCleanup();
    // log.warn is not a function in Mock client
  })
  it("tests the __connectionCleanup function will call socket.end correctly if it is mocked.", function(done) {
    var happnClient = mockHappnClient();
    happnClient.socket.end = () => {
      done()
    }
    happnClient.log.warn = () => {}
    happnClient.__connectionCleanup();

  })

  xit("tests the revokeSession function", function(done) {

  })

  xit("tests the discconect function", function(done) {

  })
})
