const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  this.timeout(15000);
  const HappnClient = require('../../../lib/client');
  const Constants = require('../../../lib/constants');
  const sinon = require('sinon');
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
    let happnClient = new HappnClient();

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

  context('__updateSecurityDirectory', () => {
    it('tests that __updateSecurityDirectory calls __reattachListenersOnPermissionChange on permission removal. on removed', done => {
      let happnClient = mockHappnClient();
      happnClient.__reattachListenersOnPermissionChange = sinon.stub();
      let message = {
        data: {
          changedData: {
            path: '/test/path',
            action: 'on'
          },
          whatHappnd: Constants.SECURITY_DIRECTORY_EVENTS.PERMISSION_REMOVED
        }
      };
      happnClient.__updateSecurityDirectory(message);
      test.expect(happnClient.__reattachListenersOnPermissionChange.calledOnce).to.be(true);
      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith({
            '/test/path': { actions: ['on'] }
          })
        )
        .to.be(true);
      done();
    });

    it('tests that __updateSecurityDirectory calls __reattachListenersOnPermissionChange on permission removal. * removed', done => {
      let happnClient = mockHappnClient();
      happnClient.__reattachListenersOnPermissionChange = sinon.stub();
      let message = {
        data: {
          changedData: {
            path: '/test/path',
            action: '*'
          },
          whatHappnd: Constants.SECURITY_DIRECTORY_EVENTS.PERMISSION_REMOVED
        }
      };
      happnClient.__updateSecurityDirectory(message);
      test.expect(happnClient.__reattachListenersOnPermissionChange.calledOnce).to.be(true);
      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith({
            '/test/path': { actions: ['*'] }
          })
        )
        .to.be(true);
      done();
    });

    it('tests that __updateSecurityDirectory calls __reattachListenersOnPermissionChange on group unlink', done => {
      let happnClient = mockHappnClient();
      happnClient.__reattachListenersOnPermissionChange = sinon.stub();
      let message = {
        data: {
          changedData: {
            permissions: {
              '/test/allowed': {
                actions: ['on', 'get', 'set']
              }, //won't call _reattach or remove
              '/test/prohibited': {
                prohibit: ['on']
              } //calls __clear
            }
          },
          whatHappnd: Constants.SECURITY_DIRECTORY_EVENTS.UNLINK_GROUP
        }
      };
      happnClient.__updateSecurityDirectory(message);
      test.expect(happnClient.__reattachListenersOnPermissionChange.calledOnce).to.be(true);
      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith(
            message.data.changedData.permissions
          )
        )
        .to.be(true);
      done();
    });

    it('tests that __updateSecurityDirectory calls __reattachListenersOnPermissionChange on group upsert, permission removed', done => {
      let happnClient = mockHappnClient();
      happnClient.__reattachListenersOnPermissionChange = sinon.stub();
      happnClient.__clearSecurityDirectorySubscriptions = sinon.stub();
      let message = {
        data: {
          changedData: {
            permissions: {
              '/test/added': {
                actions: ['on', 'get', 'set']
              }, //won't call _reattach or remove
              '/test/removedOn': {
                actions: ['on'],
                remove: true
              }, //calls __reattach
              '/test/removedAll': {
                actions: ['*'],
                remove: true
              }, //calls __reaytach
              '/test/prohibitOn': {
                prohibit: ['on']
              } //calls __clear
            }
          },
          whatHappnd: Constants.SECURITY_DIRECTORY_EVENTS.UPSERT_GROUP
        }
      };
      happnClient.__updateSecurityDirectory(message);
      test.expect(happnClient.__reattachListenersOnPermissionChange.callCount).to.be(2);
      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith({
            '/test/removedOn': { actions: ['on'], remove: true }
          })
        )
        .to.be(true);
      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith({
            '/test/removedAll': { actions: ['*'], remove: true }
          })
        )
        .to.be(true);

      test.expect(
        happnClient.__reattachListenersOnPermissionChange.calledWith({
          '/test/added': { actions: ['on', 'get', 'set'] }
        })
      );
      test.expect(happnClient.__clearSecurityDirectorySubscriptions.callCount).to.be(1);
      test
        .expect(happnClient.__clearSecurityDirectorySubscriptions.calledWith('/test/prohibitOn'))
        .to.be(true);
      done();
    });

    it('tests that __updateSecurityDirectory calls __reattachListenersOnPermissionChange on user upsert, permission removed', done => {
      let happnClient = mockHappnClient();
      happnClient.__reattachListenersOnPermissionChange = sinon.stub();
      happnClient.__clearSecurityDirectorySubscriptions = sinon.stub();
      let message = {
        data: {
          changedData: {
            permissions: {
              '/test/added': {
                actions: ['on', 'get', 'set']
              }, //won't call _reattach or remove
              '/test/removedOn': {
                actions: ['on'],
                remove: true
              }, //calls __reattach
              '/test/removedAll': {
                actions: ['*'],
                remove: true
              }, //calls __reattach
              '/test/prohibitOn': {
                prohibit: ['on']
              } //calls __clear
            }
          },
          whatHappnd: Constants.SECURITY_DIRECTORY_EVENTS.UPSERT_USER
        }
      };
      happnClient.__updateSecurityDirectory(message);
      test.expect(happnClient.__reattachListenersOnPermissionChange.callCount).to.be(2);
      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith({
            '/test/removedOn': { actions: ['on'], remove: true }
          })
        )
        .to.be(true);
      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith({
            '/test/removedAll': { actions: ['*'], remove: true }
          })
        )
        .to.be(true);

      test
        .expect(
          happnClient.__reattachListenersOnPermissionChange.calledWith({
            '/test/added': { actions: ['on', 'get', 'set'] }
          })
        )
        .to.be(false);
      test.expect(happnClient.__clearSecurityDirectorySubscriptions.callCount).to.be(1);
      test
        .expect(happnClient.__clearSecurityDirectorySubscriptions.calledWith('/test/prohibitOn'))
        .to.be(true);
      done();
    });
  });
  context('__reattachListenersOnPermissionChange', () => {
    it('tests that __reattachListenersOnPermissionChange returns early when there are no permissions, or no on/* permissions', done => {
      let happnClient = mockHappnClient();
      happnClient.__getChannelsFromPaths = sinon.stub();
      test.expect(happnClient.__reattachListenersOnPermissionChange()).to.be(undefined);
      test.expect(happnClient.__reattachListenersOnPermissionChange({})).to.be(undefined);
      let permissions = {
        '1/2/3/4': { actions: ['set', 'get'] },
        'web/2/3/4': { actions: ['put', 'post'] }
      }; // No "on" or "*"
      test.expect(happnClient.__reattachListenersOnPermissionChange(permissions)).to.be(undefined);
      test.expect(happnClient.__getChannelsFromPaths.notCalled).to.be(true);
      done();
    });

    it('tests that __reattachListenersOnPermissionChange only looks for channels on on or * permission changes', done => {
      let happnClient = mockHappnClient();
      happnClient.__getChannelsFromPaths = sinon.stub().returns(null);
      let permissions = {
        '1/2/3/4': { actions: ['set', 'get'] },
        'web/2/3/4': { actions: ['put', 'post'] },
        'subscribed/on': { actions: ['on'] },
        'subscribed/star': { actions: ['*'] },
        'subscribed/both': { actions: ['*', '|on'] }
      };
      test.expect(happnClient.__reattachListenersOnPermissionChange(permissions)).to.be(undefined); //getChannels passes back nothing, so undefined
      test.expect(happnClient.__getChannelsFromPaths.calledOnce).to.be(true);
      test
        .expect(
          happnClient.__getChannelsFromPaths.calledWith([
            'subscribed/on',
            'subscribed/star',
            'subscribed/both'
          ])
        )
        .to.be(true);
      done();
    });

    it('tests that __reattachListenersOnPermissionChange will reset listeners on all channels, and reattach listeners on each channel', done => {
      let happnClient = mockHappnClient();
      happnClient.__getChannelsFromPaths = sinon
        .stub()
        .returns(['channel1', 'channel2', 'channel3']);
      happnClient.__resetListenersRefsOnChannels = sinon.stub();
      happnClient.__reattachListenersOnChannel = sinon.stub();
      let permissions = {
        '1/2/3/4': { actions: ['set', 'get'] },
        'web/2/3/4': { actions: ['put', 'post'] },
        'subscribed/on': { actions: ['on'] }
      };
      test.expect(happnClient.__reattachListenersOnPermissionChange(permissions)).to.be(undefined); //getChannels passes back nothing, so undefined
      test.expect(happnClient.__getChannelsFromPaths.calledOnce).to.be(true);
      test.expect(happnClient.__getChannelsFromPaths.calledWith(['subscribed/on'])).to.be(true);
      test.expect(happnClient.__resetListenersRefsOnChannels.calledOnce).to.be(true);
      test
        .expect(
          happnClient.__resetListenersRefsOnChannels.calledWith([
            'channel1',
            'channel2',
            'channel3'
          ])
        )
        .to.be(true);
      test.expect(happnClient.__reattachListenersOnChannel.callCount).to.be(3);
      test.expect(happnClient.__reattachListenersOnChannel.calledWith('channel1')).to.be(true);
      test.expect(happnClient.__reattachListenersOnChannel.calledWith('channel2')).to.be(true);
      test.expect(happnClient.__reattachListenersOnChannel.calledWith('channel3')).to.be(true);
      done();
    });
  });

  context('__getChannelsFromPaths', () => {
    it('tests the __getChannelsFromPaths  method', done => {
      let happnClient = mockHappnClient();
      happnClient.state.events = {
        'ends/with/1/2/3': { some: 'object' },
        'ends/with/a/b': { some: 'object' },
        'nothing/to/see/here': {}
      };
      test.expect(happnClient.__getChannelsFromPaths()).to.be(undefined);
      test.expect(happnClient.__getChannelsFromPaths([])).to.eql([]);
      test
        .expect(happnClient.__getChannelsFromPaths(['1/2/3', '/a/b']))
        .to.eql(['ends/with/1/2/3', 'ends/with/a/b']);
      test.expect(happnClient.__getChannelsFromPaths(['1/2/3'])).to.eql(['ends/with/1/2/3']);
      test.expect(happnClient.__getChannelsFromPaths(['/a/b'])).to.eql(['ends/with/a/b']);
      //What about pathsa with *s and **s? can they exist in this.state.events? //To check
      done();
    });
  });
  context('__resetListenersRefsOnChannels', () => {
    it('tests the __resetListenersRefsOnChannels  method', done => {
      let happnClient = mockHappnClient();
      happnClient.state.events = {
        'ends/with/1/2/3': [{ eventKey: '1/2/3' }, { eventKey: 'b/1/2/3/' }],
        'ends/with/a/b': [{ eventKey: 'a/b' }, { eventKey: '2/a/b' }],
        'nothing/to/see/here': {}
      };
      let originalRefCount = {
        '1/2/3': 1,
        'a/b': 0,
        'c/d/e': 4
      };
      let setRefcount = () => (happnClient.state.refCount = { ...originalRefCount });
      setRefcount();
      happnClient.__resetListenersRefsOnChannels();
      test.expect(happnClient.state.refCount).to.eql(originalRefCount);
      setRefcount();
      happnClient.__resetListenersRefsOnChannels([]);
      test.expect(happnClient.state.refCount).to.eql(originalRefCount);
      setRefcount();
      happnClient.__resetListenersRefsOnChannels(['something/else/entirely']);
      test.expect(happnClient.state.refCount).to.eql(originalRefCount);
      setRefcount();
      happnClient.__resetListenersRefsOnChannels(['ends/with/1/2/3']);
      test.expect(happnClient.state.refCount).to.eql({
        '1/2/3': 0,
        'a/b': 0,
        'c/d/e': 4,
        'b/1/2/3/': 0
      });
      setRefcount();
      happnClient.__resetListenersRefsOnChannels(['ends/with/a/b']);
      test
        .expect(happnClient.state.refCount)
        .to.eql({ '1/2/3': 1, 'a/b': 0, 'c/d/e': 4, '2/a/b': 0 });
      setRefcount();
      happnClient.__resetListenersRefsOnChannels(['ends/with/a/b', 'ends/with/1/2/3']);
      test
        .expect(happnClient.state.refCount)
        .to.eql({ '1/2/3': 0, 'a/b': 0, 'c/d/e': 4, '2/a/b': 0, 'b/1/2/3/': 0 });
      done();
    });
  });

  context('__reattachListenersOnChannel', () => {
    it('tests that if there are listeners on a chanel, __reattachListenersOnChannel will call tryReattachListener on all of them', done => {
      let happnClient = mockHappnClient();
      happnClient.state.events = {
        channel1: [{ eventKey: '1/2/3' }, { eventKey: 'b/1/2/3/' }],
        channel2: [{ eventKey: 'a/b' }, { eventKey: '2/a/b' }],
        'nothing/to/see/here': {}
      };
      happnClient.__tryReattachListener = sinon.stub();
      happnClient.__testAndCleanupChannel = sinon.stub();
      happnClient.__reattachListenersOnChannel('channel1');
      test.expect(happnClient.__testAndCleanupChannel.notCalled).to.be(true);
      test.expect(happnClient.__tryReattachListener.callCount).to.be(2);
      test.expect(happnClient.__tryReattachListener.calledWith({ eventKey: '1/2/3' })).to.be(true);
      test
        .expect(happnClient.__tryReattachListener.calledWith({ eventKey: 'b/1/2/3/' }))
        .to.be(true);
      done();
    });

    it('tests that if there are no listeners on a chanel, __reattachListenersOnChannel will call __testAndCleanupChannel (once) ', done => {
      let happnClient = mockHappnClient();
      happnClient.state.events = {
        channel1: [{ eventKey: '1/2/3' }, { eventKey: 'b/1/2/3/' }],
        channel2: [{ eventKey: 'a/b' }, { eventKey: '2/a/b' }],
        noListeners1: [],
        noListeners2: undefined,
        'nothing/to/see/here': {}
      };
      happnClient.__tryReattachListener = sinon.stub();
      happnClient.__testAndCleanupChannel = sinon.stub();
      happnClient.__reattachListenersOnChannel('noListeners1');
      test.expect(happnClient.__tryReattachListener.notCalled).to.be(true);
      test.expect(happnClient.__testAndCleanupChannel.calledOnce).to.be(true);
      test.expect(happnClient.__testAndCleanupChannel.calledWith('noListeners1')).to.be(true);
      happnClient.__reattachListenersOnChannel('noListeners2');
      test.expect(happnClient.__tryReattachListener.notCalled).to.be(true);
      test.expect(happnClient.__testAndCleanupChannel.callCount).to.be(2);
      test.expect(happnClient.__testAndCleanupChannel.calledWith('noListeners2')).to.be(true);
      done();
    });
  });
  context('__tryReattachListener', () => {
    it('tests that __tryReattachListener returns clearListenerRef early if channel has been removed ', done => {
      let happnClient = mockHappnClient();
      happnClient.state.events = {};
      happnClient._offPath = sinon.stub();
      happnClient.__clearListenerRef = sinon.stub();

      happnClient.__tryReattachListener({ lost: 'listener' }, 'channel1');
      test.expect(happnClient._offPath.notCalled).to.be(true);
      test.expect(happnClient.__clearListenerRef.calledOnce).to.be(true);
      test.expect(happnClient.__clearListenerRef.calledWith({ lost: 'listener' })).to.be(true);

      done();
    });

    it('tests that __tryReattachListener returns early and increments refcount if there is already a listener on the eventKey ', done => {
      let happnClient = mockHappnClient();
      happnClient.state.events = { channel1: [{ eventKey: 'event1' }] };
      happnClient.state.refCount = { event1: 1 };
      happnClient._offPath = sinon.stub();
      happnClient.__tryReattachListener({ eventKey: 'event1' }, 'channel1');
      test.expect(happnClient._offPath.notCalled).to.be(true);
      test.expect(happnClient.state.refCount.event1).to.be(2);
      done();
    });

    it('tests that __tryReattachListener will call offPath once, and log an error warning if _offPath returns an error (still tries remoteOn', done => {
      let happnClient = mockHappnClient();
      happnClient.state.events = { channel1: [{ eventKey: 'event1' }] };
      happnClient.log.error = sinon.stub();
      happnClient._offPath = sinon.stub();
      let err = new Error('bad');
      happnClient._offPath.callsArgWith(1, err);
      happnClient._remoteOn = sinon.stub();

      happnClient.__tryReattachListener({ eventKey: 'event1' }, 'channel1');
      test.expect(happnClient._offPath.calledOnce).to.be(true);
      test.expect(happnClient._offPath.calledWith('channel1')).to.be(true);
      test.expect(happnClient.log.error.calledOnce).to.be(true);
      test
        .expect(
          happnClient.log.error.calledWith(
            'failed detaching listener to channel, on re-establishment: channel1',
            err
          )
        )
        .to.be(true);
      test.expect(happnClient._remoteOn.calledOnce).to.be(true);
      done();
    });

    it('tests that __tryReattachListener will clear events on 401 and 403 from _remoteOn', done => {
      let happnClient = mockHappnClient();
      happnClient._offPath = sinon.stub();
      happnClient._offPath.callsArg(1);
      happnClient.__clearListenerRef = sinon.stub();
      happnClient._remoteOn = sinon.stub();
      happnClient._remoteOn.callsArgWith(2, { code: 403 });
      happnClient.state.events = {
        403: [{ eventKey: 'event1' }, { eventKey: 'event2' }],
        401: [{ eventKey: 'eventA' }, { eventKey: 'eventB' }],
        anotherChannel: [{ eventKey: 'something' }]
      };

      happnClient.__tryReattachListener({ eventKey: 'event1' }, '403');
      test.expect(happnClient._remoteOn.callCount).to.be(1);
      test.expect(happnClient.state.events).to.eql({
        401: [{ eventKey: 'eventA' }, { eventKey: 'eventB' }],
        anotherChannel: [{ eventKey: 'something' }]
      });
      test.expect(happnClient.__clearListenerRef.calledOnce).to.be(true);
      test.expect(happnClient.__clearListenerRef.calledWith({ eventKey: 'event1' })).to.be(true);
      happnClient._remoteOn.callsArgWith(2, { code: 401 });
      happnClient.__tryReattachListener({ eventKey: 'eventB' }, '401');
      test.expect(happnClient._remoteOn.callCount).to.be(2);
      test.expect(happnClient.state.events).to.eql({
        anotherChannel: [{ eventKey: 'something' }]
      });
      test.expect(happnClient.__clearListenerRef.callCount).to.be(2);
      test.expect(happnClient.__clearListenerRef.calledWith({ eventKey: 'eventB' })).to.be(true);
      done();
    });

    it('tests that __tryReattachListener will log an error and removeListenerRef on other error response from _remoteOn', done => {
      let happnClient = mockHappnClient();
      happnClient._offPath = sinon.stub();
      happnClient._offPath.callsArg(1);
      happnClient._remoteOn = sinon.stub();
      happnClient._remoteOn.callsArgWith(2, { code: 501 });
      happnClient.__clearListenerRef = sinon.stub();
      happnClient.log.error = sinon.stub();
      happnClient.state.events = {
        testChannel: [{ eventKey: 'event1' }, { eventKey: 'event2' }]
      };
      happnClient.__tryReattachListener({ any: 'listener' }, 'testChannel');
      test.expect(happnClient._remoteOn.callCount).to.be(1);
      test.expect(happnClient.log.error.calledOnce).to.be(true);
      test
        .expect(
          happnClient.log.error.calledWith(
            'failed re-establishing listener to channel: testChannel',
            { code: 501 }
          )
        )
        .to.be(true);
      test.expect(happnClient.__clearListenerRef.calledOnce).to.be(true);
      test.expect(happnClient.__clearListenerRef.calledWith({ any: 'listener' })).to.be(true);
      done();
    });
  });

  context('__testAndCleanupChannel', () => {
    it('tests that __testAndCleanupChannel will delete state.events[channel] if it recieves a 401 or 403', done => {
      let happnClient = mockHappnClient();
      happnClient._remoteOn = sinon.stub();
      happnClient._remoteOn.callsArgWith(2, { code: 403 });
      happnClient.state.events = {
        403: [{ eventKey: 'event1' }, { eventKey: 'event2' }],
        401: [{ eventKey: 'eventA' }, { eventKey: 'eventB' }],
        anotherChannel: [{ eventKey: 'something' }]
      };
      happnClient.__testAndCleanupChannel('403');
      test.expect(happnClient._remoteOn.callCount).to.be(1);
      test.expect(happnClient.state.events).to.eql({
        401: [{ eventKey: 'eventA' }, { eventKey: 'eventB' }],
        anotherChannel: [{ eventKey: 'something' }]
      });
      happnClient._remoteOn.callsArgWith(2, { code: 401 });
      happnClient.__testAndCleanupChannel('401');
      test.expect(happnClient._remoteOn.callCount).to.be(2);
      test.expect(happnClient.state.events).to.eql({
        anotherChannel: [{ eventKey: 'something' }]
      });
      done();
    });

    it('tests that __testAndCleanupChannel will log an error if it recieves a non 401 or 403 error', done => {
      let happnClient = mockHappnClient();
      happnClient._remoteOn = sinon.stub();
      happnClient.log.error = sinon.stub();
      happnClient._remoteOn.callsArgWith(2, { code: 501 });
      happnClient.__testAndCleanupChannel('501');
      test.expect(happnClient._remoteOn.callCount).to.be(1);
      test.expect(happnClient.log.error.callCount).to.be(1);
      test
        .expect(
          happnClient.log.error.calledWith(
            'Error on channel cleanup after permissions change, channel: 501',
            { code: 501 }
          )
        )
        .to.be(true);
      done();
    });

    it('tests that __testAndCleanupChannel will unsubscribe if channel is still allowed', done => {
      let happnClient = mockHappnClient();
      happnClient._remoteOn = sinon.stub();
      happnClient._remoteOff = sinon.stub();
      happnClient._remoteOn.callsArgWith(2, null, { id: 'listenerId' });
      happnClient.__testAndCleanupChannel('allowedChannel');
      test.expect(happnClient._remoteOn.callCount).to.be(1);
      test.expect(happnClient._remoteOff.callCount).to.be(1);
      test.expect(happnClient._remoteOff.calledWith('allowedChannel', 'listenerId')).to.be(true);
      done();
    });
  });
});
