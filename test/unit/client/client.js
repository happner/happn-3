describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(5000);

  var expect = require('expect.js');
  var path = require('path');
  var HappnClient = require('../../../lib/client');
  var Constants = require('../../../lib/constants');

  function mockHappnClient(log, state, session, serverInfo, socket, clientOptions){

    var happnClient = new HappnClient();

    happnClient.__initializeEvents();
    happnClient.__initializeState();

    happnClient.log = log || {
      error:function(){}
    };

    happnClient.status = state != null?state: Constants.CLIENT_STATE.ACTIVE;
    happnClient.session = session || {id:'test'};
    happnClient.serverInfo = serverInfo || {};

    happnClient.socket = socket || {
      write: function(message){

      },
      on:function(eventName){

      }
    };

    happnClient.options = clientOptions || {callTimeout: 60000};

    return happnClient;
  }

  it('tests the __performDataRequest function set null options', function (done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action){
      callback();
    };

    happnClient.__performDataRequest('/test/path', 'set', {test:'data'}, null, function(e, response){
      if (e) return done(e);
      done();
    });
  });

  it('tests the __performDataRequest function set null options no callback', function (done) {

    var happnClient = mockHappnClient();

    happnClient.__requestCallback = function(message, callback, options, eventId, path, action){
      callback();
    };

    happnClient.__performDataRequest('/test/path', 'set', {test:'data'});

    done();
  });

  it('tests the __performDataRequest function set null options, error state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.ERROR);

    happnClient.__performDataRequest('/test/path', 'set', {test:'data'}, null, function(e, response){
      expect(e.toString()).to.be('Error: client in an error state');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    });
  });

  it('tests the __performDataRequest function set null options, connect error state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.CONNECT_ERROR);

    happnClient.__performDataRequest('/test/path', 'set', {test:'data'}, null, function(e, response){
      expect(e.toString()).to.be('Error: client in an error state');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    });
  });

  it('tests the __performDataRequest function set null options, disconnected state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.DISCONNECTED);

    happnClient.__performDataRequest('/test/path', 'set', {test:'data'}, null, function(e, response){
      expect(e.toString()).to.be('Error: client is disconnected');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    });
  });

  it('tests the __performDataRequest function set null options, uninitialized state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.UNINITIALIZED);

    happnClient.__performDataRequest('/test/path', 'set', {test:'data'}, null, function(e, response){
      expect(e.toString()).to.be('Error: client not initialized yet');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    });
  });

  it('tests the __performDataRequest function set null options, no callback, error state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.ERROR);

    try{
      happnClient.__performDataRequest('/test/path', 'set', {test:'data'});
    }catch(e){
      expect(e.toString()).to.be('Error: client in an error state');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, connect error state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.CONNECT_ERROR);

    try{
      happnClient.__performDataRequest('/test/path', 'set', {test:'data'});
    }catch(e){
      expect(e.toString()).to.be('Error: client in an error state');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, disconnected state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.DISCONNECTED);

    try{
      happnClient.__performDataRequest('/test/path', 'set', {test:'data'});
    }catch(e){
      expect(e.toString()).to.be('Error: client is disconnected');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, uninitialized state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.UNINITIALIZED);

    try{
      happnClient.__performDataRequest('/test/path', 'set', {test:'data'});
    }catch(e){
      expect(e.toString()).to.be('Error: client not initialized yet');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __performDataRequest function set null options, no callback, uninitialized state', function (done) {

    var happnClient = mockHappnClient(null, Constants.CLIENT_STATE.UNINITIALIZED);

    try{
      happnClient.__performDataRequest('/test/path', 'set', {test:'data'});
    }catch(e){
      expect(e.toString()).to.be('Error: client not initialized yet');
      expect(e.detail).to.be('action: set, path: /test/path');
      done();
    }
  });

  it('tests the __getListener function', function () {

    var happnClient = mockHappnClient();
    //handler, parameters, path, variableDepth
    var mockParameters = {
      count:10,
      event_type:'test-event',
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

  it('tests the __confirmRemoteOn function, with error', function (done) {

    var happnClient = mockHappnClient();
    var path = 'test-path';
    var parameters = {
      count:10,
      event_type:'test-event',
      initialEmit: true,
      initialCallback: true,
      meta: 'test-meta',
      depth: 20
    };

    var listener = {};

    happnClient._remoteOn = function(path, parameters, callback){
      callback(new Error('test-error'));
    }

    happnClient.__clearListenerState = function(){};

    happnClient.__confirmRemoteOn(path, parameters, listener, function(e){
      expect(e.toString()).to.be("Error: test-error");
      done();
    });
  });

  it('tests the __confirmRemoteOn function, with response error', function (done) {

    var happnClient = mockHappnClient();
    var path = 'test-path';
    var parameters = {
      count:10,
      event_type:'test-event',
      initialEmit: true,
      initialCallback: true,
      meta: 'test-meta',
      depth: 20
    };

    var listener = {};

    happnClient._remoteOn = function(path, parameters, callback){
      callback(null, {
        status: 'error',
        payload:'test-error'
      });
    }

    happnClient.__clearListenerState = function(){};

    happnClient.__confirmRemoteOn(path, parameters, listener, function(e){
      expect(e).to.be('test-error');
      done();
    });
  });
});
