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

    var async = require('async');

    var config = {};

    before('should initialize the service', function(callback) {
      var UtilService = require('../../../lib/services/utils/service');
      var utilService = new UtilService();

      serviceInstance.happn = {
        services: {
          utils: utilService
        }
      };

      serviceInstance.initialize(config, callback);
    });

    after(function(done) {
      serviceInstance.stop(done);
    });

    it('sets data, ensures when we get a value back it is cloned by default', function(done) {
      var key = testId + 'test1';

      var data = { dkey: key };

      serviceInstance
        .set(key, data)

        .then(function(result) {
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

        .then(function(result) {
          serviceInstance
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

      var Cache = require('../../../lib/services/cache/cache_static');

      var cache = new Cache({});

      cache.utilities = require('../../../lib/services/utils/shared');

      cache
        .set(key, data)

        .then(function(result) {
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

      var Cache = require('../../../lib/services/cache/cache_static');

      var cache = new Cache({});

      cache
        .set(key, data, { clone: false })

        .then(function(result) {
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
  }
);
