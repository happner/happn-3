describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    this.timeout(20000);

    var expect = require('expect.js');

    var service = require('../../../lib/services/cache/service');
    var serviceInstance = new service();

    var testId = require('shortid').generate();

    var lru_config = {
      defaultCacheOpts: {
        type: 'LRU',
        cache: {
          max: 300,
          maxAge: 0
        }
      }
    };

    before('should initialize the service', function(callback) {
      var UtilService = require('../../../lib/services/utils/service');
      var utilService = new UtilService();

      serviceInstance.happn = {
        services: {
          utils: utilService
        }
      };

      serviceInstance.initialize(lru_config, callback);
    });

    after(function(done) {
      serviceInstance.stop(done);
    });

    it('sets data, ensures when we get a value back it is cloned by default', function(done) {
      var key = testId + 'test1';

      var data = { dkey: key };

      serviceInstance
        .set(key, data)

        .then(function() {
          serviceInstance.__defaultCache
            .get(key)
            .then(function(result) {
              expect(result === data).to.be(false);
              done();
            })
            .catch(done);
        })

        .catch(done);
    });

    it('sets data with clone: false, ensures when we get a value back it is not cloned', function(done) {
      var key = testId + 'test1';

      var data = { dkey: key };

      serviceInstance
        .set(key, data, { clone: false })

        .then(function() {
          serviceInstance.__defaultCache
            .get(key)
            .then(function(result) {
              expect(result === data).to.be(true);
              done();
            })
            .catch(done);
        })

        .catch(done);
    });

    it('specific cache, sets data, ensures when we get a value back it is cloned by default', function(done) {
      var key = testId + 'test1';

      var data = { dkey: key };

      var Cache = require('../../../lib/services/cache/cache_lru');

      var cache = new Cache();

      cache.utilities = require('../../../lib/services/utils/shared');

      cache
        .set(key, data)

        .then(function() {
          cache
            .get(key)
            .then(function(result) {
              expect(result === data).to.be(false);
              done();
            })
            .catch(done);
        })

        .catch(done);
    });

    it('specific cache, sets data with clone: false, ensures when we get a value back it is not cloned', function(done) {
      var key = testId + 'test1';

      var data = { dkey: key };

      var Cache = require('../../../lib/services/cache/cache_lru');

      var cache = new Cache();

      cache
        .set(key, data, { clone: false })

        .then(function() {
          cache
            .get(key)
            .then(function(result) {
              expect(result === data).to.be(true);
              done();
            })
            .catch(done);
        })

        .catch(done);
    });

    it('gets the cache keys', function() {
      var key = testId + 'test1';

      var data = { dkey: key };

      var Cache = require('../../../lib/services/cache/cache_lru');

      var cache = new Cache();
      cache.setSync(key + '1', data, { clone: false });
      cache.setSync(key + '2', data, { clone: false });
      cache.setSync(key + '3', data, { clone: false });
      expect(cache.keys().sort()).to.eql([key + '1', key + '2', key + '3']);
    });
  }
);
