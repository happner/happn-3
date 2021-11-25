const constants = require('../../../lib/constants');
require('../../__fixtures/utils/test_helper').describe(__filename, 120000, function(test) {
  var expect = require('chai').expect;
  var happnInstance = null;

  before('should initialize the service', async () => {
    happnInstance = await test.createInstance();
  });

  after(async () => {
    await test.destroyInstance(happnInstance);
  });

  var client;

  before('should initialize the clients', function(callback) {
    happnInstance.services.session.localClient(function(e, instance) {
      if (e) return callback(e);
      client = instance;
      callback();
    });
  });

  const ITEM_COUNT = 10000;
  const READ_MULTIPLIER = 2;
  const WRITE_MULTIPLIER = 15;

  it(`reading after ${ITEM_COUNT} entries takes only ${READ_MULTIPLIER} times as long as 10 entries and writing takes only ${WRITE_MULTIPLIER} times as long as 10 entries`, async function() {
    const itemCountFirstCheck = 10;
    const itemCount = 10000;

    let writeMultiplier = WRITE_MULTIPLIER;
    let readMultiplier = READ_MULTIPLIER;
    let timeFirstSet;
    let timeLastSet;
    let timeFirstGet;
    let timesGet = [];

    var test_string = `${test.shortid()}/`;
    var test_base_url = `${test.shortid()}/`;

    await test.async.timesSeries(itemCountFirstCheck, async n => {
      await setItem(test_base_url + n, test_string + n);
    });

    let timeStart = process.hrtime.bigint();
    await setItem(test_base_url, test_string);
    timeFirstSet = Number(process.hrtime.bigint() - timeStart) / 1e6;

    timeStart = process.hrtime.bigint();
    expect((await getItem(test_base_url)).value).to.eql(test_string);
    timeFirstGet = Number(process.hrtime.bigint() - timeStart) / 1e6;

    await test.async.timesSeries(itemCount, async n => {
      await setItem(test_base_url + (n + itemCountFirstCheck), test_string + n, true);
    });

    timeStart = process.hrtime.bigint();
    await setItem(test_base_url, test_string);
    timeLastSet = Number(process.hrtime.bigint() - timeStart) / 1e6;
    test.log(`timeLastSet: ${timeLastSet}`);
    test.log(`timeFirstSet: ${timeFirstSet}`);
    expect(timeLastSet).to.be.lt(timeFirstSet * writeMultiplier);

    await test.async.timesSeries(itemCount, async n => {
      timeStart = process.hrtime.bigint();
      expect((await getItem(test_base_url + (n + itemCountFirstCheck))).value).to.eql(
        test_string + n
      );
      timesGet.push(Number(process.hrtime.bigint() - timeStart) / 1e6);
    });

    const timeLastGet = timesGet.reduce((result, value) => result + value / timesGet.length, 0);
    test.log(`timeFirstGet: ${timeFirstGet}`);
    test.log(`timeLastGet: ${timeLastGet}`);

    expect(timeLastGet).to.be.lt(timeFirstGet * readMultiplier);

    function setItem(path, value, insert) {
      return client.set(path, value, {
        noPublish: true,
        upsertType: insert
          ? constants.DATA_OPERATION_TYPES.INSERT
          : constants.DATA_OPERATION_TYPES.UPSERT
      });
    }

    function getItem(path) {
      return client.get(path);
    }
  });
});
