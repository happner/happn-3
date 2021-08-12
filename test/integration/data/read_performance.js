describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('chai').expect;
    var happn = require('../../../lib/index');
    var service = happn.service;
    var default_timeout = 100000;
    var happnInstance = null;
    var test_id;
    var async = require('async');

    before('should initialize the service', function(callback) {
      this.timeout(20000);

      test_id = Date.now() + '_' + require('shortid').generate();

      try {
        service.create(function(e, happnInst) {
          if (e) return callback(e);

          happnInstance = happnInst;
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    after(function(done) {
      this.timeout(10000);
      happnInstance.stop(done);
    });

    var client;

    before('should initialize the clients', function(callback) {
      this.timeout(default_timeout);

      try {
        happnInstance.services.session.localClient(function(e, instance) {
          if (e) return callback(e);
          client = instance;
          callback();
        });
      } catch (e) {
        callback(e);
      }
    });

    it('reading after 10000 entries takes as long as 10 entries', async function() {
      this.timeout(default_timeout);
      const itemCountFirstCheck = 10;
      const itemCount = 10000;
      let timeFirstSet;
      let timeLastSet;
      let timeFirstGet;
      let timesGet = [];

      var test_string = require('shortid').generate();
      var test_base_url =
        '/a1_eventemitter_embedded_datatypes/' + test_id + '/set/string/' + test_string;

      await async.timesSeries(itemCountFirstCheck, async n => {
        await setItem(test_base_url + n, test_string + n);
      });

      let timeStart = process.hrtime.bigint();
      await setItem(test_base_url, test_string);
      timeFirstSet = Number(process.hrtime.bigint() - timeStart) / 1e6;

      timeStart = process.hrtime.bigint();
      expect((await getItem(test_base_url)).value).to.eql(test_string);
      timeFirstGet = Number(process.hrtime.bigint() - timeStart) / 1e6;

      await async.timesSeries(itemCount, async n => {
        await setItem(test_base_url + (n + itemCountFirstCheck), test_string + n);
      });

      timeStart = process.hrtime.bigint();
      await setItem(test_base_url, test_string);
      timeLastSet = Number(process.hrtime.bigint() - timeStart) / 1e6;
      expect(timeLastSet).to.be.lt(timeFirstSet + 1);

      await async.timesSeries(itemCount, async n => {
        timeStart = process.hrtime.bigint();
        expect((await getItem(test_base_url + (n + itemCountFirstCheck))).value).to.eql(
          test_string + n
        );
        timesGet.push(Number(process.hrtime.bigint() - timeStart) / 1e6);
      });

      expect(timesGet.reduce((result, value) => result + value / timesGet.length, 0)).to.be.lt(
        timeFirstGet + 1
      );

      function setItem(path, value) {
        return client.set(path, value, {
          noPublish: true
        });
      }

      function getItem(path) {
        return client.get(path);
      }
    });
  }
);
