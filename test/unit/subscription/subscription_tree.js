var expect = require('expect.js'),
  async = require('async'),
  shortid = require('shortid');

describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    context('functional subscription tree', function() {
      it('subscription tree, single record subscribe', function(done) {
        var subscriptionTree = require('tame-search').create();

        //path, id, dataId, data, depth, originalPath
        subscriptionTree.subscribe('/test/path/1', {
          key: '1',
          data: {
            test: 1
          }
        });

        var subscribers = subscriptionTree.search('/test/path/1');

        expect(subscribers.length).to.be(1);

        done();
      });

      it('subscription tree, multiple record subscribe, with wildcards', function(done) {
        var subscriptionTree = require('tame-search').create();

        //path, id, dataId, data, depth, originalPath
        subscriptionTree.subscribe('/test/path/1', {
          key: '1',
          data: {
            test: 1
          }
        });
        subscriptionTree.subscribe('/test/path/1', {
          key: '1',
          data: {
            test: 2
          }
        });
        subscriptionTree.subscribe('/test/path/2', {
          key: '1',
          data: {
            test: 3
          }
        });
        subscriptionTree.subscribe('/test/path/2', {
          key: '1',
          data: {
            test: 4
          }
        });

        subscriptionTree.subscribe('/test/path/3', {
          key: '1',
          data: {
            test: 5
          }
        });
        subscriptionTree.subscribe('/test/path/3', {
          key: '1',
          data: {
            test: 6
          }
        });

        subscriptionTree.subscribe('/test/path/*', {
          key: '1',
          data: {
            test: 7
          }
        });
        subscriptionTree.subscribe('/test/path/*', {
          key: '1',
          data: {
            test: 8
          }
        });

        var subscribers = subscriptionTree.search('/test/path/1');

        expect(subscribers.length).to.be(4);

        done();
      });

      it('subscription tree, multiple record subscribe, multiple wildcards', function(done) {
        var subscriptionTree = require('tame-search').create();

        //path, id, dataId, data, depth, originalPath
        subscriptionTree.subscribe('/2/test/path/1', {
          key: '1',
          data: {
            test: 1
          }
        });
        subscriptionTree.subscribe('/2/test/path/1', {
          key: '1',
          data: {
            test: 2
          }
        });

        subscriptionTree.subscribe('/2/test/path/2', {
          key: '1',
          data: {
            test: 1
          }
        });
        subscriptionTree.subscribe('/2/test/path/2', {
          key: '1',
          data: {
            test: 2
          }
        });

        subscriptionTree.subscribe('/2/test/path/3', {
          key: '1',
          data: {
            test: 1
          }
        });
        subscriptionTree.subscribe('/2/test/path/3', {
          key: '1',
          data: {
            test: 2
          }
        });

        subscriptionTree.subscribe('/2/test/path/*', {
          key: '1',
          data: {
            test: 1
          }
        });
        subscriptionTree.subscribe('/2/test/path/*', {
          key: '1',
          data: {
            test: 2
          }
        });

        subscriptionTree.subscribe('/2/*/*/3', {
          key: '1',
          data: {
            test: 3
          }
        });

        var subscribers = subscriptionTree.search('/2/test/path/3');

        expect(subscribers.length).to.be(5);

        done();
      });

      it('subscription tree, remove functionality', function(done) {
        var subscriptionTree = require('tame-search').create();

        subscriptionTree.subscribe('/2/test/path/3', {
          key: '1',
          data: {
            test: 3
          }
        });
        subscriptionTree.subscribe('/2/*/*/3', {
          key: '1',
          data: {
            test: 3
          }
        });

        var subscribers = subscriptionTree.search('/2/test/path/3');

        expect(subscribers.length).to.be(2);

        subscriptionTree.unsubscribe('/2/*/*/3');

        subscribers = subscriptionTree.search('/2/test/path/3');

        expect(subscribers.length).to.be(1);

        done();
      });

      it('subscription tree, remove non-existing', function(done) {
        var subscriptionTree = require('tame-search').create();

        subscriptionTree.subscribe('/2/test/path/3', {
          key: '1',
          data: {
            test: 3
          }
        });
        subscriptionTree.subscribe('/2/*/*/3', {
          key: '1',
          data: {
            test: 3
          }
        });

        var subscribers = subscriptionTree.search('/2/test/path/3');

        expect(subscribers.length).to.be(2);

        subscriptionTree.unsubscribe('/4/1/1/3');

        subscribers = subscriptionTree.search('/2/test/path/3');

        expect(subscribers.length).to.be(2);

        done();
      });
    });
  }
);
