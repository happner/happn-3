describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var happn = require('../../../lib/index');
    var service = happn.service;
    var happnInstance = null;
    this.timeout(10000);

    before('should initialize the service', function(done) {
      try {
        service.create(function(e, happnInst) {
          if (e) return done(e);
          happnInstance = happnInst;
          done();
        });
      } catch (e) {
        done(e);
      }
    });

    after(function(done) {
      this.timeout(20000);
      client.disconnect(
        {
          timeout: 2000
        },
        function() {
          happnInstance.stop(done);
        }
      );
    });

    var client;

    /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
    beforeEach('should initialize the client', function(done) {
      if (client)
        client.disconnect(function(e) {
          //eslint-disable-next-line no-console
          if (e) console.warn('disconnect failed: ', e);
        });
      setTimeout(function() {
        happnInstance.services.session.localClient(function(e, instance) {
          if (e) return done(e);
          client = instance;
          done();
        });
      }, 3000);
    });

    it('does a normal subscription, initialEmit and initialCallback - checks the listener state, then unsubscribes and checks the listener state', function(done) {
      var eventData = [];

      var handleEvent = function(data) {
        eventData.push(data);
      };

      var reference1;
      var reference2;
      var reference3;

      client
        .set('/test/path', { test: 1 })
        .then(function() {
          return client.on('/test/path', {}, handleEvent);
        })
        .then(function(reference) {
          reference1 = reference;
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(Object.keys(client.state.listenerRefs).length).to.be(1);
          return client.on('/test/path', { initialEmit: true }, handleEvent);
        })
        .then(function(reference) {
          reference2 = reference;
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(client.state.events['/ALL@/test/path'].length).to.be(2);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(Object.keys(client.state.listenerRefs).length).to.be(2);
          return client.on('/test/path', { initialCallback: true }, handleEvent);
        })
        .then(function(reference) {
          reference3 = reference;
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(client.state.events['/ALL@/test/path'].length).to.be(3);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            3
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(3);
          return client.off(reference1);
        })
        .then(function() {
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(client.state.events['/ALL@/test/path'].length).to.be(2);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(undefined);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            2
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(2);
          return client.off(reference2);
        })
        .then(function() {
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(client.state.events['/ALL@/test/path'].length).to.be(1);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(undefined);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(undefined);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            1
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(1);
          return client.off(reference3);
        })
        .then(function() {
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(0);
          expect(client.state.events['/ALL@/test/path']).to.be(undefined);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}'
            ]
          ).to.be(undefined);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(undefined);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(undefined);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            0
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(0);
          done();
        });
    });

    it('does 2 subscriptions, one with count of 1, we do an off and ensure both are no more in the listener state', function(done) {
      var eventData = [];

      var handleEvent = function(data) {
        eventData.push(data);
      };

      client
        .set('/test/path', { test: 1 })
        .then(function() {
          return client.on('/test/path', { count: 1 }, handleEvent);
        })
        .then(function() {
          return client.on('/test/path', {}, handleEvent);
        })
        .then(function() {
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":1}']
          ).to.be(1);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            2
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(2);
          return client.set('/test/path', { test: 2 });
        })
        .then(function() {
          return new Promise(function(resolve) {
            setTimeout(resolve, 2000);
          });
        })
        .then(function() {
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":1}']
          ).to.be(undefined);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            1
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(1);
          client.offAll(done);
        });
    });

    it('does a normal subscription, initialEmit and initialCallback - disconnects - check the listener state', function(done) {
      var eventData = [];

      var handleEvent = function(data) {
        eventData.push(data);
      };

      client
        .set('/test/path', { test: 1 })
        .then(function() {
          return client.on('/test/path', {}, handleEvent);
        })
        .then(function() {
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(Object.keys(client.state.listenerRefs).length).to.be(1);
          return client.on('/test/path', { initialEmit: true }, handleEvent);
        })
        .then(function() {
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(client.state.events['/ALL@/test/path'].length).to.be(2);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(Object.keys(client.state.listenerRefs).length).to.be(2);
          return client.on('/test/path', { initialCallback: true }, handleEvent);
        })
        .then(function() {
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(1);
          expect(client.state.events['/ALL@/test/path'].length).to.be(3);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(1);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(1);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            3
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(3);
          return client.disconnect();
        })
        .then(function() {
          return new Promise(function(resolve) {
            setTimeout(resolve, 2000);
          });
        })
        .then(function() {
          expect(eventData.length).to.be(1);
          expect(Object.keys(client.state.events).length).to.be(0);
          expect(client.state.events['/ALL@/test/path']).to.be(undefined);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialCallback":true}'
            ]
          ).to.be(undefined);
          expect(
            client.state.refCount[
              '{"path":"/ALL@/test/path","event_type":"all","count":0,"initialEmit":true}'
            ]
          ).to.be(undefined);
          expect(
            client.state.refCount['{"path":"/ALL@/test/path","event_type":"all","count":0}']
          ).to.be(undefined);
          expect(happnInstance.services.subscription.allListeners(client.session.id).length).to.be(
            0
          );
          expect(Object.keys(client.state.listenerRefs).length).to.be(0);
          done();
        });
    });
  }
);
