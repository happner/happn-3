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
    };

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
    };

    happnClient.options = clientOptions || {
      callTimeout: 60000
    };

    return happnClient;
  }

  it('tests the __prepareConnectionOption function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    opts = happnClient.__prepareConnectionOptions({}, {});
    expect(opts).to.eql({
      host: '127.0.0.1',
      port: 55000,
      protocol: 'http',
      url: 'http://127.0.0.1:55000'
    });
    done();
  });

  xit("tests the __prepareOptions function", function(done) {

  });

  xit("tests the __updateOptions function", function(done) {

  });

  xit('tests the __initializeConnectivity function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }
    opts = happnClient.__prepareConnectionOptions({}, {})

    happnClient.__initializeConnectivity(opts, (err, data) => {
      // console.log(data)
      // console.log(err)
      //TODO Can't Timing out
      done();
    });
  });

  xit('tests the __connectSocket function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.__connectSocket((err, data) => {
      //TODO This test causes the client and test framework to hang
      done();
    });
  });

  xit("tests the __initializeEvents function", function(done) {

  });


  it('tests the getScript function returns an error when not called from a browser', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };
    happnClient.getScript('http://www.google.com', (err, data) => {
      expect(err.toString()).to.eql('Error: only for browser')
      done()
    });
  });

  xit('tests the getScript function when called from a browser', function(done) {
    //TODO Not sure how to test this!
  });

  it('tests the getResources function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.getResources((err, data) => {

      //TODO Can't access internals
      done();
    });
  });

  xit('tests the stop function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.stop((err, data) => {
      console.log(data)
      console.log(err)
      //TODO Can't access internals
      done()
    });
  });

  it('tests the __ensureCryptoLibrary function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.__ensureCryptoLibrary((err, data) => {
      //TODO This test causes the client and test framework to hang
      expect(err).to.be(undefined)
      expect(data).to.be(undefined)
      done()
    });
  });

  it('tests the __ensureCryptoLibrary function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.__ensureCryptoLibrary((err, data) => {
      //TODO This test causes the client and test framework to hang
      expect(err).to.be(undefined)
      expect(data).to.be(undefined)
      done()
    })
  })

  xit('tests the login function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.login((err, data) => {
      console.log(err)
      console.log(data)
      done()
    });
  });


  xit('tests the __encryptLogin function.', function(done) {
    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    }

    happnClient.__ensureCryptoLibrary()
    parameters = {
      publicKey: 123
    }
    encrypt = happnClient.__encryptLogin(parameters, 456)
    console.log(encrypt)
  });

  it('tests that the get function will call __getdatarequest and returns a callback ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.get('/test/path', function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the getPaths function will call __getdatarequest and returns a callback ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.getPaths('/test/path', function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.increment('/test/path', 1, 1, function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback when increment property is not specified (i.e. replaced by callback function) ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.increment('/test/path', 1, function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will call __getdatarequest and returns a callback when increment and gauge properties are not specified (i.e. replaced by callback function) ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.increment('/test/path', function(e, response) {
      if (e) return done(e);
      done();
    });
  });

  it('tests that the increment function will return an error callback if the increment is NAN ', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

    happnClient.increment('/test/path', 1, 'string', function(e, response) {
      expect(e.toString()).to.eql("Error: increment must be a number")
      done();
    });
  });

  it('tests that the set function calls __getdatarequest and returns a callback', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

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
    };

    happnClient.set('/test/*/path', {
      test: 'data'
    }, function(e, response) {
      expect(e.toString()).to.eql("Error: Bad path, if the action is \'set\' the path cannot contain the * wildcard character");
      done();
    });
  });

  it('tests that the setSibling function will call the set function and so return a callback', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

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
    };

    happnClient.remove('/test/path', null,
      function(e, response) {
        done();
      });
  });

  it('tests that the remove function will call the  __getDataRequest function and return a callback when parameters are ommitted', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };

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

  xit('tests that the handle error function', function(done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action) {
      callback();
    };
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
    };
    var happnClient = mockHappnClient();
    happnClient.__attachPublishedAck(options, {});
  });

  it("tests the handle_ack function works when __attachPublishedAck has been called", function(done) {

    var happnClient = mockHappnClient();

    message = {
      sessionId: "1",
      eventId: "1"
    };

    message2 = {
      id: "1-1",
      result: "Good",
      status: "good"
    };

    options = {
      onPublished: (e, results) => {
        expect(results).to.eql('Good');
        done()
      },
      onPublishedTimeout: 1000
    };

    happnClient.__attachPublishedAck(options, message);
    happnClient.handle_ack(message2)
  })

  it("tests the handle_ack function throws an error on a message with status: 'error' after __attachPublishedAck has been called", function(done) {

    var happnClient = mockHappnClient();

    message = {
      sessionId: "1",
      eventId: "1"
    };
    message2 = {
      id: "1-1",
      error: "Bad",
      status: "error",
      result: "Bad"
    };
    options = {
      onPublished: (e, results) => {
        expect(e.toString()).to.eql("Error: Bad");
        expect(results).to.eql('Bad');
        done()
      },
      onPublishedTimeout: 1000
    };
    happnClient.__attachPublishedAck(options, message);
    happnClient.handle_ack(message2);
  });

  xit("tests the handle_publication function", function(done) {

  });
});
