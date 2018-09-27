describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');
  var happnInstance = null;
  var Promise = require('bluebird');

  this.timeout(10000);

  before('should initialize the service', function (done) {
    try {
      service.create(function (e, happnInst) {
        if (e) return done(e);
        happnInstance = happnInst;
        done();
      });
    } catch (e) {
      done(e);
    }
  });

  after(function (done) {
    this.timeout(20000);
    client.disconnect({
      timeout: 2000
    }, done);
  });

  var client;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the client', function (done) {
    happn_client.create(function (e, instance) {
      if (e) return done(e);
      client = instance;
      client.onAsync = Promise.promisify(client.on);
      done();
    });
  });

  it('does a normal subscription, initialEmit and initialCallback - checks the listener state, then unsubscribes and checks the listener state', function (done) {

    var eventData = [];

    var handleEvent = function(data){
      eventData.push(data);
    }

    var reference1;
    var reference2;
    var reference3;

    client.set('/test/path', {test:1})
    .then(function(){
      return client.onAsync('/test/path', {}, handleEvent);
    })
    .then(function(reference){
      reference1 = reference;
      expect(Object.keys(client.state.events).length).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(1);
      expect(Object.keys(client.state.listenerRefs).length).to.be(1);
      return client.onAsync('/test/path', {initialEmit:true}, handleEvent);
    })
    .then(function(reference){
      reference2 = reference;
      expect(eventData.length).to.be(1);
      expect(Object.keys(client.state.events).length).to.be(1);
      expect(client.state.events['/ALL@/test/path'].length).to.be(2);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(1);
      expect(Object.keys(client.state.listenerRefs).length).to.be(2);
      return client.onAsync('/test/path', {initialCallback:true}, handleEvent);
    })
    .then(function(reference, items){
      reference3 = reference[0];
      expect(eventData.length).to.be(1);
      expect(Object.keys(client.state.events).length).to.be(1);
      expect(client.state.events['/ALL@/test/path'].length).to.be(3);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(1);
      expect(Object.keys(client.state.listenerRefs).length).to.be(3);
      return client.off(reference1);
    })
    .then(function(){
      expect(eventData.length).to.be(1);
      expect(Object.keys(client.state.events).length).to.be(1);
      expect(client.state.events['/ALL@/test/path'].length).to.be(2);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(undefined);
      expect(Object.keys(client.state.listenerRefs).length).to.be(2);
      return client.off(reference2);
    })
    .then(function(){
      expect(eventData.length).to.be(1);
      expect(Object.keys(client.state.events).length).to.be(1);
      expect(client.state.events['/ALL@/test/path'].length).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}']).to.be(undefined);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(undefined);
      expect(Object.keys(client.state.listenerRefs).length).to.be(1);
      return client.off(reference3);
    })
    .then(function(){
      expect(eventData.length).to.be(1);
      expect(Object.keys(client.state.events).length).to.be(0);
      expect(client.state.events['/ALL@/test/path']).to.be(undefined);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}']).to.be(undefined);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}']).to.be(undefined);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(undefined);
      expect(Object.keys(client.state.listenerRefs).length).to.be(0);
      done();
    });
  });

  it('does 2 subscriptions, one with count of 1, we do an off and ensure both are no more in the listener state', function (done) {

    var eventData = [];

    var handleEvent = function(data){
      eventData.push(data);
    }

    var reference1;
    var reference2;

    client.set('/test/path', {test:1})
    .then(function(){
      return client.onAsync('/test/path', {count:1}, handleEvent);
    })
    .then(function(reference){
      reference1 = reference;
      return client.onAsync('/test/path', {}, handleEvent);
    })
    .then(function(reference){
      reference2 = reference;
      expect(Object.keys(client.state.events).length).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":1}']).to.be(1);
      expect(Object.keys(client.state.listenerRefs).length).to.be(2);
      return client.set('/test/path', {test:2});
    })
    .then(function(result){

      return new Promise(function(resolve){
        setTimeout(resolve, 2000);
      });
    })
    .then(function(result){
      expect(Object.keys(client.state.events).length).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']).to.be(1);
      expect(client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":1}']).to.be(undefined);
      expect(Object.keys(client.state.listenerRefs).length).to.be(1);
      done();
    });
  });

  xit('does a normal subscription, initialEmit and initialCallback - checks the listener state, does a reconnect (server restart) - check the listener state', function (done) {

  });

  xit('does a normal subscription, initialEmit and initialCallback - disconnects - check the listener state', function (done) {

  });
});
