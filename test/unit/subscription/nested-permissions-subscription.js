const expect = require('expect.js');
const sinon = require('sinon');
describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    const Subscription = require('../../../lib/services/subscription/service');
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
        prohibitedSubs,
        prohibitedPaths,
        wildSubPaths
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
        { path: '/6/7/**', searchPath: '/6/7/**' },
        { path: '/7/8/9', searchPath: '/7/8/9' }
      ].map(({ path, searchPath }) => ({
        ...standardSubscriberTemplate,
        data: {
          ...standardSubscriberTemplate.data,
          path,
          searchPath
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
        allowedSubs,
        wildSubs,
        allowedPaths,
        prohibitedPaths,
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

    it('tests the __processChangedSubscriptions method partitions data correctly, and calls the correct methods', done => {
      subscriptionMock.allListeners = sinon.stub().callsFake(getFakeListeners);
      subscriptionMock.securityService = {
        checkpoint: {
          listRelevantPermissions: sinon.stub().callsArgWith(3, null, returnPaths)
        }
      };
      subscriptionMock.__removeInvalidProhibitions = sinon.stub();
      subscriptionMock.__removeInvalidSubscriptions = sinon.stub();
      subscriptionMock.__removeExplicitlyRevokedSubscriptions = sinon.stub();
      subscriptionMock.__addNewProhibitions = sinon.stub();
      subscriptionMock.__addNewSubscriptions = sinon.stub();
      subscriptionMock.__processChangedSubscriptions({ id: 'test-session' }, () => {
        expect(subscriptionMock.__removeInvalidProhibitions.calledOnce).to.be(true);
        expect(subscriptionMock.__removeInvalidSubscriptions.calledOnce).to.be(true);
        expect(subscriptionMock.__removeExplicitlyRevokedSubscriptions.calledOnce).to.be(true);
        expect(subscriptionMock.__addNewProhibitions.calledOnce).to.be(true);
        expect(subscriptionMock.__addNewSubscriptions.calledOnce).to.be(true);

        expect(subscriptionMock.__removeInvalidProhibitions.args[0].slice(1)).to.eql([
          getProhibitedSubs(),
          returnProhibitedPaths
        ]);
        expect(subscriptionMock.__removeInvalidSubscriptions.args[0].slice(1)).to.eql([
          getAllowedSubs(),
          returnAllowedPaths
        ]);
        expect(subscriptionMock.__removeExplicitlyRevokedSubscriptions.args[0].slice(1)).to.eql([
          getAllowedSubs(),
          returnProhibitedPaths
        ]);
        expect(subscriptionMock.__addNewProhibitions.args[0].slice(1)).to.eql([
          getProhibitedSubs(),
          returnProhibitedPaths,
          returnWildPaths
        ]);
        expect(subscriptionMock.__addNewSubscriptions.args[0].slice(1)).to.eql([
          getAllowedSubs(),
          getNestedWildSubs(),
          returnAllowedPaths,
          returnProhibitedPaths,
          returnNestedWildPaths
        ]);
        done();
      });
    });

    it('tests the __filterRecipients method', done => {
      let allowedSubs1 = ['/1/2', '/3/4/*', '/3/4/7/8', '/5/6/7'];
      let prohibitedSubs1 = ['/3/4/5/6', '/3/4/7/*'];
      let wildSubs = ['3/4/*'];
      let allowedSubs2 = ['/8/9/*', '/3/4/*'];
      let prohibitedSubs2 = ['/8/9/10/11', '/8/9/12/13'];
      let recipients1 = mapRecipients('test-session1', allowedSubs1, prohibitedSubs1, wildSubs);
      let recipients2 = mapRecipients('test-session2', allowedSubs2, prohibitedSubs2, wildSubs);
      let recipients = [...recipients1, ...recipients2];
      let message = { request: { path: '/1/2' } };
      let filtered = subscriptionMock.filterRecipients(message, recipients);
      expect(filtered.every(item => item.data.options === undefined)).to.be(true); //i.e none are prohibited or wild
      expect(
        filtered
          .filter(rec => rec.data.session.id === 'test-session1')
          .map(rec => rec.data.path)
          .sort()
      ).to.eql(['/1/2', '/3/4/*', '/5/6/7'].sort()); //allowedSubs1 - '/3/4/7/8' - filtered because of prohibitions
      expect(
        filtered
          .filter(rec => rec.data.session.id === 'test-session2')
          .map(rec => rec.data.path)
          .sort()
      ).to.eql(allowedSubs2.sort());

      message = { request: { path: '/8/9/10/11' } };
      filtered = subscriptionMock.filterRecipients(message, recipients);
      expect(filtered.every(item => item.data.options === undefined)).to.be(true); //i.e none are prohibited or wild
      expect(
        filtered
          .filter(rec => rec.data.session.id === 'test-session1')
          .map(rec => rec.data.path)
          .sort()
      ).to.eql(['/1/2', '/3/4/*', '/5/6/7'].sort()); //allowedSubs1 - '/3/4/7/8'
      expect(
        filtered
          .filter(rec => rec.data.session.id === 'test-session2')
          .map(rec => rec.data.path)
          .sort()
      ).to.eql([]); //Filtered because of message.request.path being prohibited
      done();
    });

    // function filterRecipients(message, recipients) {
    //   recipients = recipients.filter(rec => !(rec.data.options && rec.data.options.wild === true));
    //   let prohibited;

    //   [prohibited, recipients] = _.partition(recipients, ['data.options.prohibited', true]);
    //   if (prohibited.length === 0) return recipients;
    //   let prohibitionsDict = prohibited
    //     .map(rec => rec.data)
    //     .reduce((prohibitedLists, current) => {
    //       prohibitedLists[current.session.id] = prohibitedLists[current.session.id] || {};
    //       if (current.searchPath.endsWith('*')) {
    //         prohibitedLists[current.session.id].wild = prohibitedLists[current.session.id].wild || [];
    //         prohibitedLists[current.session.id].wild.push(current.searchPath.replace(/\/\*+$/, '/'));
    //       }
    //       //We add wildcard paths to the explict list as well as there is a possibility,
    //       // with changing permissions, that may match a searchPath exactly.
    //       prohibitedLists[current.session.id].explicit =
    //         prohibitedLists[current.session.id].explicit || [];
    //       prohibitedLists[current.session.id].explicit.push(current.searchPath);
    //       return prohibitedLists;
    //     }, {});

    //   recipients = recipients.filter(rec => {
    //     let sessionList = prohibitionsDict[rec.data.session.id];
    //     if (!sessionList) return true;
    //     if (
    //       sessionList.explicit &&
    //       (sessionList.explicit.includes(rec.data.searchPath) ||
    //         sessionList.explicit.includes(message.request.path))
    //     )
    //       return false;
    //     if (
    //       sessionList.wild &&
    //       sessionList.wild.some(
    //         path =>
    //           (rec.data.searchPath.startsWith(path) ||
    //           message.request.path.startsWith(path)
    //       )
    //     ))
    //       return false;
    //     return true;
    //   });
    //   return recipients;
    // }
  }
);

let getFakeListeners = function() {
  return [...getAllowedSubs(), ...getWildSubs(), ...getProhibitedSubs()];
};

let getProhibitedSubs = () => {
  return ['/5/6/7', '5/1/2', '5/2/*'].map(path => ({
    ...prohibitSubscriberTemplate,
    data: {
      ...prohibitSubscriberTemplate.data,
      searchPath: path
    }
  }));
};
let getAllowedSubs = () => {
  return [
    { path: '/4/**', searchPath: '/4/**' },
    { path: '/4/**', searchPath: '/4/1' },
    { path: '/5/*', searchPath: '/5/*' },
    { path: '/6/7/**', searchPath: '/6/7/**' },
    { path: '/7/8/9', searchPath: '/7/8/9' }
  ].map(({ path, searchPath }) => ({
    ...standardSubscriberTemplate,
    data: {
      ...standardSubscriberTemplate.data,
      path,
      searchPath
    }
  }));
};

let getWildSubs = () => {
  return ['/4/**', '/6/7/**', '/5/*'].map(path => ({
    ...wildSubscriberTemplate,
    data: {
      ...wildSubscriberTemplate.data,
      searchPath: path,
      path: path
    }
  }));
};

let getNestedWildSubs = () => {
  return ['/4/**', '/6/7/**'].map(path => ({
    ...wildSubscriberTemplate,
    data: {
      ...wildSubscriberTemplate.data,
      searchPath: path,
      path: path
    }
  }));
};

let returnPaths = {
  allowed: ['/4/1', '/5/*', '/7/8/9'],
  prohibited: ['/5/6/7', '/5/1/2', '/5/2/*']
};

let returnAllowedPaths = {
  explicit: ['/4/1', '/5/*', '/7/8/9'],
  wild: ['/5/']
};

let returnProhibitedPaths = {
  explicit: ['/5/6/7', '/5/1/2', '/5/2/*'],
  wild: ['/5/2/']
};

let returnWildPaths = ['/4/', '/6/7/', '/5/'];
let returnNestedWildPaths = ['/4/', '/6/7/'];

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
  return argsArray;
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

let mapRecipients = (sessionId, allowed, prohibited, wild) => {
  let allowedSubs = allowed.map(path => ({
    data: {
      session: { id: sessionId },
      searchPath: path,
      path
    }
  }));
  let prohibitedSubs = prohibited.map(path => ({
    data: {
      session: { id: sessionId },
      searchPath: path,
      path,
      options: {
        prohibited: true
      }
    }
  }));
  let wildSubs = wild.map(path => ({
    data: {
      session: { id: sessionId },
      searchPath: path,
      path,
      options: {
        wild: true
      }
    }
  }));
  return [...allowedSubs, ...prohibitedSubs, ...wildSubs];
};
