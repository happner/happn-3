describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;
  var async = require('async');
  var happnInstance = null;
  var bluebird = require('bluebird');

  this.timeout(5000);

  before('should initialize the service', function (callback) {

    try {
      service.create({secure:true}, function (e, happnInst) {
        if (e) return callback(e);
        happnInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  after(function (done) {

    this.timeout(20000);

    publisherclient.disconnect({
      timeout: 2000
    }, function (e) {
      if (e) console.warn('failed disconnecting publisher client');
      listenerclient.disconnect({
        timeout: 2000
      }, function (e) {
        if (e) console.warn('failed disconnecting listener client');
        happnInstance.stop(done);
      });
    });
  });

  var publisherclient;
  var listenerclient;
  var defaultVariableDepth = 5;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  beforeEach('should initialize the clients',  async () => {

    if (publisherclient) await publisherclient.disconnect();
    if (listenerclient) await listenerclient.disconnect();

    publisherclient = await happn_client.create({config:{username:'_ADMIN', password:'happn'}});
    listenerclient = await happn_client.create({config:{username:'_ADMIN', password:'happn', defaultVariableDepth:defaultVariableDepth}});
    listenerclient.onAsync = bluebird.promisify(listenerclient.on, {multiArgs: true});
  });


  it('does a variable depth on, ensure the client state items are correct', function(done){

    var variableDepthHandle;

    listenerclient.on('/test/path/**', { depth:4 }, function(data){
      expect(data).to.eql({set:'data'});

      listenerclient.off(variableDepthHandle, function(e){

        if (e) return done(e);

        expect(listenerclient.state.listenerRefs[variableDepthHandle]).to.eql(undefined);
        expect(listenerclient.state.listenerRefs).to.eql({});

        done();
      });
    }, function(e, handle){

      if (e) return done(e);

      expect(handle).to.be(0);

      expect(Object.keys(listenerclient.state.listenerRefs).length).to.eql(1);

      variableDepthHandle = handle;

      publisherclient.set('/test/path/1', {set:'data'}, function(e){
        if (e) return done(e);
      });
    });
  });

  it('does a variable depth on, ensure the client state items are correct, deeper path', function(done){

    var variableDepthHandle;

    listenerclient.on('/test/path/**', { depth:4 }, function(data){
      expect(data).to.eql({set:'data'});

      listenerclient.off(variableDepthHandle, function(e){

        if (e) return done(e);

        expect(listenerclient.state.listenerRefs[variableDepthHandle]).to.eql(undefined);
        expect(listenerclient.state.listenerRefs).to.eql({});

        done();
      });
    }, function(e, handle){

      if (e) return done(e);

      expect(handle).to.be(0);

      expect(Object.keys(listenerclient.state.listenerRefs).length).to.eql(1);

      variableDepthHandle = handle;

      publisherclient.set('/test/path/1/3', {set:'data'}, function(e){
        if (e) return done(e);
      });
    });
  });

  it('does a couple of variable depth ons, we disconnect the client and ensure the state is cleaned up', function(done){

    listenerclient.on('/test/path/**', { depth:4 }, function(data){}, function(e, handle1){

      listenerclient.on('/test/path/1/**', { depth:5 }, function(data){}, function(e, handle2){

        expect(Object.keys(listenerclient.state.listenerRefs).length).to.eql(2);

        listenerclient.disconnect(function(e){

          if (e) return done(e);
          expect(Object.keys(listenerclient.state.listenerRefs).length).to.eql(0);
          done();
        });
      });
    });
  });

  it('does a variable depth on which eclipses another .on, do off and ensure the correct handlers are called', function(done){

    var variableDepthHandle;
    var results = [];

    listenerclient.on('/test/path/**', { depth:4 }, function(data, meta){
      results.push({data:data, channel:meta.channel, path:meta.path});
    }, function(e, handle1){
      if (e) return done(e);
      listenerclient.on('/test/path/1/**', { depth:4 }, function(data, meta){
        results.push({data:data, channel:meta.channel, path:meta.path});
      }, function(e, handle2){
        if (e) return done(e);
        publisherclient.set('/test/path/1/1', {set:1}, function(e){
          if (e) return done(e);
          listenerclient.off(handle1, function(e){
            if (e) return done(e);
            publisherclient.set('/test/path/1/1', {set:2}, function(e){
              if (e) return done(e);
              expect(results).to.eql([
                { data: { set: 1 }, channel: '/ALL@/test/path/1/**', path: "/test/path/1/1" },
                { data: { set: 1 }, channel: '/ALL@/test/path/**', path: "/test/path/1/1" },
                { data: { set: 2 }, channel: '/ALL@/test/path/1/**', path: "/test/path/1/1" }]
              );
              done();
            });
          });
        });
      });
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

    listenerclient.set('/initialEmitTest/path', {test:1})
    .then(function(){
      return listenerclient.onAsync('/initialEmitTest/path', {}, handleEvent);
    })
    .then(function(reference){
      reference1 = reference[0];
      expect(Object.keys(listenerclient.state.events).length).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/path","event_type":"all","count":0}']).to.be(1);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(1);
      return listenerclient.onAsync('/initialEmitTest/**', {initialEmit:true}, handleEvent);
    })
    .then(function(reference){
      reference2 = reference[0];
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(2);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**'].length).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/path","event_type":"all","count":0}']).to.be(1);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(2);
      return listenerclient.onAsync('/initialEmitTest/**', {initialCallback:true}, handleEvent);
    })
    .then(function(reference, items){
      reference3 = reference[0];
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(2);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**'].length).to.be(2);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialCallback":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/path","event_type":"all","count":0}']).to.be(1);

      expect(happnInstance.services.subscription.allListeners(listenerclient.session.id).length).to.be(11);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(3);
      return listenerclient.off(reference1);
    })
    .then(function(){
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(1);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**'].length).to.be(2);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialCallback":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0}']).to.be(undefined);
      expect(happnInstance.services.subscription.allListeners(listenerclient.session.id).length).to.be(10);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(2);
      return listenerclient.off(reference2);
    })
    .then(function(){
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(1);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**'].length).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialCallback":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true,"depth":5}']).to.be(undefined);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"depth":5}']).to.be(undefined);
      expect(happnInstance.services.subscription.allListeners(listenerclient.session.id).length).to.be(5);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(1);
      return listenerclient.off(reference3);
    })
    .then(function(){
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(0);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**']).to.be(undefined);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialCallback":true}']).to.be(undefined);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true}']).to.be(undefined);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0}']).to.be(undefined);
      expect(happnInstance.services.subscription.allListeners(listenerclient.session.id).length).to.be(0);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(0);
      done();
    });
  });

  it('should subscribe and get initial values on the callback', function (callback) {

    listenerclient.set('/initialCallback/testsubscribe/data/values_on_callback_test/1', {
      "test": "data"
    }, function (e) {
      if (e) return callback(e);

      listenerclient.set('/initialCallback/testsubscribe/data/values_on_callback_test/2', {
        "test": "data1"
      }, function (e) {
        if (e) return callback(e);

        listenerclient.on('/initialCallback/**', {
          "event_type": "set",
          "initialCallback": true
        }, function (message) {

          expect(message.updated).to.be(true);
          callback();

        }, function (e, reference, response) {
          if (e) return callback(e);
          try {

            expect(response.length).to.be(2);
            expect(response[0].test).to.be('data');
            expect(response[1].test).to.be('data1');

            listenerclient.set('/initialCallback/testsubscribe/data/values_on_callback_test/1', {
              "test": "data",
              "updated": true
            }, function (e) {
              if (e) return callback(e);
            });

          } catch (err) {
            return callback(err);
          }
        });
      });
    });
  });

  it('should subscribe and get initial values emitted immediately', function (callback) {

    var caughtEmitted = 0;

    listenerclient.set('/initialEmitSpecific/testsubscribe/data/values_emitted_test/1', {
      "test": "data"
    }, function (e) {
      if (e) return callback(e);

      listenerclient.set('/initialEmitSpecific/testsubscribe/data/values_emitted_test/2', {
        "test": "data1"
      }, function (e) {
        if (e) return callback(e);

        listenerclient.on('/initialEmitSpecific/**', {
          "event_type": "set",
          "initialEmit": true
        }, function (message, meta) {

          caughtEmitted++;

          if (caughtEmitted == 2) {
            expect(message.test).to.be("data1");
            callback();
          }
        }, function (e) {
          if (e) return callback(e);
        });
      });
    });
  });

  it('should subscribe and get initial values on the callback, to the correct depth', async () => {

    this.timeout(10000);

    var caughtEmitted = [];

    await listenerclient.set('/initialEmitSpecificCorrectDepth/testsubscribe/1', {
      "test": "data1"
    });

    await publisherclient.set('/initialEmitSpecificCorrectDepth/testsubscribe/2', {
      "test": "data2"
    });

    await publisherclient.set('/initialEmitSpecificCorrectDepth/testsubscribe/3', {
      "test": "data3"
    });

    await publisherclient.set('/initialEmitSpecificCorrectDepth/testsubscribe/3/4', {
      "test": "data4"
    });

    await publisherclient.set('/initialEmitSpecificCorrectDepth/testsubscribe/3/4/5', {
      "test": "data5"
    });

    await publisherclient.set('/initialEmitSpecificCorrectDepth/testsubscribe/3/4/5/6', {
      "test": "data6"
    });

    await listenerclient.onAsync('/initialEmitSpecificCorrectDepth/testsubscribe/**', {
      "event_type": "set",
      "initialEmit": true,
      depth:2
    }, function (data) {
      caughtEmitted.push(data._meta.path);
    });

    expect(caughtEmitted.sort()).to.eql([
      '/initialEmitSpecificCorrectDepth/testsubscribe/1',
      '/initialEmitSpecificCorrectDepth/testsubscribe/2',
      '/initialEmitSpecificCorrectDepth/testsubscribe/3',
      '/initialEmitSpecificCorrectDepth/testsubscribe/3/4'
    ]);
  });

  it('should subscribe and get initial values emitted immediately, to the correct depth', async () => {

    this.timeout(10000);

    var caughtEmitted = [];

    await listenerclient.set('/initialCallbackCorrectDepth/testsubscribe/1', {
      "test": "data1"
    });

    await publisherclient.set('/initialCallbackCorrectDepth/testsubscribe/2', {
      "test": "data2"
    });

    await publisherclient.set('/initialCallbackCorrectDepth/testsubscribe/3', {
      "test": "data3"
    });

    await publisherclient.set('/initialCallbackCorrectDepth/testsubscribe/3/4', {
      "test": "data4"
    });

    await publisherclient.set('/initialCallbackCorrectDepth/testsubscribe/3/4/5', {
      "test": "data5"
    });

    await publisherclient.set('/initialCallbackCorrectDepth/testsubscribe/3/4/5/6', {
      "test": "data6"
    });

    var results = await new Promise(function(resolve, reject){
      listenerclient.on('/initialCallbackCorrectDepth/testsubscribe/**', {
        "event_type": "set",
        "initialCallback": true,
        depth:2
      }, function (message) {}, function (e, reference, response) {
        if (e) return reject(e);
        resolve(response.map(function(item){
          return item._meta.path;
        }).sort());
      });
    });

    expect(results).to.eql([
      '/initialCallbackCorrectDepth/testsubscribe/1',
      '/initialCallbackCorrectDepth/testsubscribe/2',
      '/initialCallbackCorrectDepth/testsubscribe/3',
      '/initialCallbackCorrectDepth/testsubscribe/3/4'
    ]);
  });

  it('does a normal subscription, initialEmit and initialCallback - checks the listener state, then unsubscribes by path and checks the listener state', function (done) {

    var eventData = [];

    var handleEvent = function(data){
      eventData.push(data);
    }

    var reference1;
    var reference2;
    var reference3;

    listenerclient.set('/initialEmitTest/path', {test:1})
    .then(function(){
      return listenerclient.onAsync('/initialEmitTest/path', {}, handleEvent);
    })
    .then(function(reference){
      reference1 = reference;
      expect(Object.keys(listenerclient.state.events).length).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/path","event_type":"all","count":0}']).to.be(1);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(1);
      return listenerclient.onAsync('/initialEmitTest/**', {initialEmit:true}, handleEvent);
    })
    .then(function(reference){
      reference2 = reference;
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(2);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**'].length).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/path","event_type":"all","count":0}']).to.be(1);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(2);
      return listenerclient.onAsync('/initialEmitTest/**', {initialCallback:true}, handleEvent);
    })
    .then(function(reference, items){
      reference3 = reference[0];
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(2);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**'].length).to.be(2);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialCallback":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true,"depth":5}']).to.be(1);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/path","event_type":"all","count":0}']).to.be(1);

      expect(happnInstance.services.subscription.allListeners(listenerclient.session.id).length).to.be(11);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(3);
      return listenerclient.offPath('/initialEmitTest/**');
    })
    .then(function(){
      expect(eventData.length).to.be(1);
      expect(Object.keys(listenerclient.state.events).length).to.be(0);
      expect(listenerclient.state.events['/ALL@/initialEmitTest/**']).to.be(undefined);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialCallback":true,"depth":5}']).to.be(undefined);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/**","event_type":"all","count":0,"initialEmit":true,"depth":5}']).to.be(undefined);
      expect(listenerclient.state.refCount['{"path":"/ALL@/initialEmitTest/path","event_type":"all","count":0}']).to.be(undefined);
      expect(happnInstance.services.subscription.allListeners(listenerclient.session.id).length).to.be(0);
      expect(Object.keys(listenerclient.state.listenerRefs).length).to.be(0);
      done();
    });
  });

  it('should correctly listen on overlapping variable depth subscriptions', async () => {

    var eventData = [];

    var handleEvent = function(data){
      eventData.push(data);
    }

    await listenerclient.onAsync('/overlap/**', {depth:3}, handleEvent);
    await listenerclient.onAsync('/overlap/**', {depth:5}, handleEvent);

    await publisherclient.set('/overlap/1/2/3', {
      "test": "data1"
    });

    await publisherclient.set('/overlap/1/2/3/4', {
      "test": "data2"
    });

    await publisherclient.set('/overlap/1/2/3/4/5', {
      "test": "data3"
    });

    expect(eventData).to.eql([
      {
        "test": "data1"
      },
      {
        "test": "data1"
      },
      {
        "test": "data2"
      },
      {
        "test": "data3"
      }
    ]);
  });

  it('should correctly listen on overlapping variable depth subscriptions - default depth', async () => {

    var eventData = [];

    var handleEvent = function(data){
      eventData.push(data);
    }

    await listenerclient.onAsync('/overlap-default/**', {depth:3}, handleEvent);
    await listenerclient.onAsync('/overlap-default/**', handleEvent);

    await publisherclient.set('/overlap-default/1/2/3', {
      "test": "data1"
    });

    await publisherclient.set('/overlap-default/1/2/3/4', {
      "test": "data2"
    });

    await publisherclient.set('/overlap-default/1/2/3/4/5', {
      "test": "data3"
    });

    await publisherclient.set('/overlap-default/1/2/3/4/5/6', {
      "test": "data3"
    });

    expect(eventData).to.eql([
      {
        "test": "data1"
      },
      {
        "test": "data1"
      },
      {
        "test": "data2"
      },
      {
        "test": "data3"
      }
    ]);

    defaultVariableDepth = 6;
  });

  it('should correctly listen on overlapping variable depth subscriptions - default depth, NB: relies on previous', async () => {

    var eventData = [];

    var handleEvent = function(data){
      eventData.push(data);
    }

    await listenerclient.onAsync('/overlap-default-specified/**', {depth:3}, handleEvent);
    await listenerclient.onAsync('/overlap-default-specified/**', handleEvent);

    await publisherclient.set('/overlap-default-specified/1/2/3', {
      "test": "data1"
    });

    await publisherclient.set('/overlap-default-specified/1/2/3/4', {
      "test": "data2"
    });

    await publisherclient.set('/overlap-default-specified/1/2/3/4/5', {
      "test": "data3"
    });

    await publisherclient.set('/overlap-default-specified/1/2/3/4/5/6', {
      "test": "data4"
    });

    expect(eventData).to.eql([
      {
        "test": "data1"
      },
      {
        "test": "data1"
      },
      {
        "test": "data2"
      },
      {
        "test": "data3"
      },
      {
        "test": "data4"
      }
    ]);
  });
});
