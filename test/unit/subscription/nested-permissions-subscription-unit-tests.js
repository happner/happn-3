const expect = require('expect.js');
const sinon = require('sinon');
describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const Subscription = require('../../../lib/services/subscription/service');
    const mockhappn = {
      connect: {},
      log: {
        warn: function() {}
      },
      services: {
        session: {
          on: function() {}
        },
        error: {
          handleSystem: function() {},
          SystemError: function(message) {
            done(new Error(message));
          }
        }
      }
    };
    let subscriptionMock = new Subscription({
      logger: {
        createLogger: function() {
          return {
            $$TRACE: function() {}
          };
        }
      }
    });

    it('tests the subscripition services __removeInvalidProhibitions method', done => {
      subscriptionMock.removeListenerExtended = sinon.stub();
      let effectedSession = { id: 'testSession' };
      let prohibitedPaths = {
        explicit: ['/1/2/3', '/4/5/*'],
        wild: ['/4/5/']
      };
      let prohibitedSubs = ['/1/2/3', '/4/5/6/5', '/1/3/5', '/2/3/4/5'].map(path => ({
        ...prohibitSubscriberTemplate,
        data: {
          ...prohibitSubscriberTemplate.data,
          searchPath: path
        }
      }));
      subscriptionMock.__removeInvalidProhibitions(
        effectedSession,
        prohibitedSubs,
        prohibitedPaths
      );
      expect(subscriptionMock.removeListenerExtended.callCount).to.be(2);
      expect(subscriptionMock.removeListenerExtended.args).to.eql(
        ['/1/3/5', '/2/3/4/5'].map(path => [...prohibitSubscriberArgs, path])
      );
      done();
    });

    it('tests the subscripition services __removeInvalidSubscriptions method', done => {
      subscriptionMock.removeListenerExtended = sinon.stub();
      let effectedSession = { id: 'testSession' };
      let allowedPaths = {
        explicit: ['/1/2/3', '/4/5/*'],
        wild: ['/4/5/']
      };
      let allowedSubs = ['/1/2/3', '/4/5/6/5', '/1/3/5', '/2/3/4/5'].map(path => ({
        ...standardSubscriberTemplate,
        data: {
          ...standardSubscriberTemplate.data,
          searchPath: path
        }
      }));
      subscriptionMock.__removeInvalidSubscriptions(effectedSession, allowedSubs, allowedPaths);
      expect(subscriptionMock.removeListenerExtended.callCount).to.be(2);
      expect(subscriptionMock.removeListenerExtended.args).to.eql(
        ['/1/3/5', '/2/3/4/5'].map(path => [...invalidSubscriberArgs, path])
      );
      done();
    });

    it('tests the subscripition services __removeExplicitlyRevokedSubscriptions method', done => {
      subscriptionMock.removeListener = sinon.stub();
      let effectedSession = { id: 'testSession' };
      let prohibitedPaths = {
        explicit: ['/1/2/3', '/4/5/*'],
        wild: ['/4/5/']
      };
      let allowedSubs = ['/1/2/3', '/4/5/6/5', '/1/3/5', '/2/3/4/5'].map(path => ({
        ...standardSubscriberTemplate,
        data: {
          ...standardSubscriberTemplate.data,
          searchPath: path
        }
      }));
      subscriptionMock.__removeExplicitlyRevokedSubscriptions(
        effectedSession,
        allowedSubs,
        prohibitedPaths
      );
      expect(subscriptionMock.removeListener.callCount).to.be(2);
      expect(subscriptionMock.removeListener.args).to.eql(
        ['/1/2/3', '/4/5/6/5'].map(path => [...revokedSubscriberArgs, path])
      );
      done();
    });

    it('tests the subscripition services __addNewProhibitions method', done => {
      //effectedSession, prohibitedPaths, wildSubPaths, prohibitedSubs)
      subscriptionMock.addListener = sinon.stub();
      let effectedSession = { id: 'testSession' };
      let prohibitedPaths = {
        explicit: ['/1/2/3', '/4/5/*', '/2/3/4/5', '/2/3/7/8'],
        wild: ['/4/5/']
      };
      let wildSubPaths = ['/2/3', '/1/2'];
      let prohibitedSubs = ['/2/3/7/8', '/1/2/3'].map(path => ({
        ...prohibitSubscriberTemplate,
        data: {
          ...prohibitSubscriberTemplate.data,
          searchPath: path
        }
      }));
      subscriptionMock.__addNewProhibitions(
        effectedSession,
        prohibitedPaths,
        wildSubPaths,
        prohibitedSubs
      );
      expect(subscriptionMock.addListener.callCount).to.be(1);
      expect(subscriptionMock.addListener.args).to.eql(
        ['/2/3/4/5'].map(path => ['ALL', path, ...addedProhibitionArgs])
      );
      done();
    });

    it('tests the subscripition services __addNewSubscriptions method', done => {
      //(effectedSession, allowedPaths, prohibitedPaths, allowedSubs, wildSubs, wildSubPaths)
      subscriptionMock.addListener = sinon.stub();
      let effectedSession = { id: 'testSession' };
      let allowedPaths = {
        explicit: ['/4/**', '/4/1', '/6/7/**', '/7/8/9', '/6/7/8/9'],
        wild: ['/4/', '/6/7/']
      };
      let prohibitedPaths = {
        explicit: ['/1/2/3', '/4/5/*', '/2/3/4/5', '/2/3/7/8'],
        wild: ['/4/5/']
      };
      let wildSubPaths = ['/4/', '/6/7/'];
      let allowedSubs = [
        { path: '/4/**', searchPath: '/4/**' },
        { path: '/4/**', searchPath: '/4/1' },
        { path: '/6/7/**', searchPath: '/6/7/**' },
        { path: '/7/8/9', searchPath: '/7/8/9' }
      ].map(path => ({
        ...standardSubscriberTemplate,
        data: {
          ...standardSubscriberTemplate.data,
          searchPath: path
        }
      }));
      let wildSubs = wildSubPaths.map(path => ({
        ...wildSubscriberTemplate,
        data: {
          ...wildSubscriberTemplate.data,
          searchPath: path + '**',
          path: path + '**'
        }
      }));
      subscriptionMock.__addNewSubscriptions(
        effectedSession,
        allowedPaths,
        prohibitedPaths,
        allowedSubs,
        wildSubs,
        wildSubPaths
      );
      expect(subscriptionMock.addListener.callCount).to.be(2);
      expect(subscriptionMock.addListener.args).to.eql(
        mapNewlistenerArgs([
          { searchPath: '/4/1', path: '/4/**' },
          { searchPath: '/6/7/8/9', path: '/6/7/**' }
        ])
      );
      done();
    });
  }
);

let prohibitSubscriberTemplate = {
  subscriberKey: 'testsubscriberKey',
  data: {
    options: {
      event_type: 'all',
      prohibited: true
    },
    session: {
      id: 'test-id',
      protocol: 'happn_4',
      info: {
        _browser: false,
        _local: true
      }
    },
    ref: 'test-ref',
    action: 'ALL'
  }
};
let prohibitSubscriberArgs = [
  {
    data: {
      ref: 'test-ref',
      options: {
        prohibited: true
      }
    }
  },
  'testSession',
  'ALL'
];

let standardSubscriberTemplate = {
  subscriberKey: 'testsubscriberKey',
  data: {
    options: {
      event_type: 'all'
    },
    session: {
      id: 'test-id',
      protocol: 'happn_4',
      info: {
        _browser: false,
        _local: true
      }
    },
    ref: 'test-ref',
    action: 'ALL'
  }
};

let wildSubscriberTemplate = {
  subscriberKey: 'testsubscriberKey',
  data: {
    options: {
      event_type: 'all',
      wild: true
    },
    session: {
      id: 'test-id',
      protocol: 'happn_4',
      info: {
        _browser: false,
        _local: true
      }
    },
    ref: 'test-ref',
    action: 'ALL'
  }
};

let invalidSubscriberArgs = [
  {
    data: {
      ref: 'test-ref',
      options: {
        prohibited: {
          $ne: true
        }
      }
    }
  },
  'testSession',
  'ALL'
];

let revokedSubscriberArgs = ['test-ref', 'testSession', 'ALL'];
let addedProhibitionArgs = [
  'testSession',
  { options: { prohibited: true }, session: { id: 'testSession' } }
];

let mapNewlistenerArgs = paths => {
  let argsArray = [];
  paths.forEach(({ path, searchPath }) => {
    let funcArguments = [...newListenerArgs];    
    funcArguments[1] = searchPath;
    funcArguments[3] = {
      ...funcArguments[3],
      searchPath,
      path
    };
    funcArguments[4] = path;
    argsArray.push(funcArguments);
  });
  return argsArray
};

let newListenerArgs = [
  'ALL',
  null,
  'testSession',
  {
    options: {
      event_type: 'all',
      wild: false
    },
    session: {
      id: 'test-id',
      protocol: 'happn_4',
      info: {
        _browser: false,
        _local: true
      }
    },
    ref: 'test-ref',
    action: 'ALL',
    searchPath: '',
    path: ''
  },
  null
];
