var Happn = require('../..')
  , expect = require('expect.js')
  , async = require('async')
  , shortid = require('shortid')
  ;

describe('functional subscription tree', function () {

  before('', function () {

  });

  after('', function () {

  });

  it('subscription tree, single record subscribe', function (done) {

    var SubscriptionTree = require('../../lib/services/subscription/subscription-tree');

    var subscriptionTree = new SubscriptionTree();

    //path, id, dataId, data, depth, originalPath
    subscriptionTree.addSubscription('/test/path/1', 1, 1, {test:1});

    var subscribers = subscriptionTree.search('/test/path/1');

    expect(subscribers.length).to.be(1);

    done();
  });

  it('subscription tree, multiple record subscribe, with wildcards', function (done) {

    var SubscriptionTree = require('../../lib/services/subscription/subscription-tree');

    var subscriptionTree = new SubscriptionTree();

    //path, id, dataId, data, depth, originalPath
    subscriptionTree.addSubscription('/test/path/1', 1, 1, {test:1});
    subscriptionTree.addSubscription('/test/path/1', 1, 2, {test:2});

    subscriptionTree.addSubscription('/test/path/2', 2, 1, {test:1});
    subscriptionTree.addSubscription('/test/path/2', 2, 2, {test:2});

    subscriptionTree.addSubscription('/test/path/3', 3, 1, {test:1});
    subscriptionTree.addSubscription('/test/path/3', 3, 2, {test:2});

    subscriptionTree.addSubscription('/test/path/*', 4, 1, {test:1});
    subscriptionTree.addSubscription('/test/path/*', 4, 2, {test:2});

    var subscribers = subscriptionTree.search('/test/path/1');

    expect(subscribers.length).to.be(2);

    done();

  });

  it('subscription tree, multiple record subscribe, multiple wildcards', function (done) {

    var SubscriptionTree = require('../../lib/services/subscription/subscription-tree');

    var subscriptionTree = new SubscriptionTree();

    //path, id, dataId, data, depth, originalPath
    subscriptionTree.addSubscription('/2/test/path/1', 1, 1, {test:1});
    subscriptionTree.addSubscription('/2/test/path/1', 1, 2, {test:2});

    subscriptionTree.addSubscription('/2/test/path/2', 2, 1, {test:1});
    subscriptionTree.addSubscription('/2/test/path/2', 2, 2, {test:2});

    subscriptionTree.addSubscription('/2/test/path/3', 3, 1, {test:1});
    subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});

    subscriptionTree.addSubscription('/2/test/path/*', 4, 1, {test:1});
    subscriptionTree.addSubscription('/2/test/path/*', 4, 2, {test:2});

    subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

    var subscribers = subscriptionTree.search('/2/test/path/3');

    expect(subscribers.length).to.be(3);

    done();
  });

  it('subscription tree, remove functionality', function (done) {

    var SubscriptionTree = require('../../lib/services/subscription/subscription-tree');

    var subscriptionTree = new SubscriptionTree();

    subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});
    subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

    var subscribers = subscriptionTree.search('/2/test/path/3');

    expect(subscribers.length).to.be(2);

    subscriptionTree.removeSubscription('/2/*/*/3', 3, 1, {test:3});

    subscribers = subscriptionTree.search('/2/test/path/3');

    expect(subscribers.length).to.be(1);

    done();
  });

  it('subscription tree, remove non-existing', function (done) {

    var SubscriptionTree = require('../../lib/services/subscription/subscription-tree');

    var subscriptionTree = new SubscriptionTree();

    subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});
    subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

    var subscribers = subscriptionTree.search('/2/test/path/3');

    expect(subscribers.length).to.be(2);

    subscriptionTree.removeSubscription('/4/1/1/3', 3, 1, {test:3});

    subscribers = subscriptionTree.search('/2/test/path/3');

    expect(subscribers.length).to.be(2);

    done();
  });

  it('subscription tree, cache', function (done) {

    var SubscriptionTree = require('../../lib/services/subscription/subscription-tree');

    var subscriptionTree = new SubscriptionTree();

    subscriptionTree.addSubscription('/2/test/path/3', 3, 2, {test:2});

    subscriptionTree.addSubscription('/2/*/*/3', 3, 1, {test:3});

    subscriptionTree.addSubscription('/2/test/*/4', 3, 1, {test:3});

    var subscribers1 = subscriptionTree.search('/2/test/path/3');

    var subscribers2 = subscriptionTree.search('/2/test/path/4');

    var subscribers3 = subscriptionTree.search('/2/test/path/3');

    expect(subscribers1.length).to.be(2);
    expect(subscribers2.length).to.be(1);
    expect(subscribers3.length).to.be(2);

    expect(subscriptionTree.__cache.values().length).to.be(2);

    var cachedSubs = subscriptionTree.__cache.get('/2/test/path/3>>>');

    cachedSubs[0].specialValue = 'test';

    subscriptionTree.__cache.set('/2/test/path/3>>>', cachedSubs);

    var subscribers1 = subscriptionTree.search('/2/test/path/3');

    expect(subscribers1[0].specialValue).to.be('test');

    done();
  });
});
