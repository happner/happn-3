const test = require('../../__fixtures/utils/test_helper').create();

test.describe(__filename, function() {
  var expect = require('chai').expect;
  var happnInstance = null;

  before('should initialize the service', async () => {
    this.timeout(20000);
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

  it('reading after 10000 entries takes only 2 times as long as 10 entries and writing takes only 3 times as long as 10 entries', async function() {
    const itemCountFirstCheck = 10;
    const itemCount = 10000;
    let writeMultiplier = process.env.INTRAVENOUS ? 3 : 1.1;
    let readMultiplier = process.env.INTRAVENOUS ? 2 : 1.1;
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
      await setItem(test_base_url + (n + itemCountFirstCheck), test_string + n);
    });

    timeStart = process.hrtime.bigint();
    await setItem(test_base_url, test_string);
    timeLastSet = Number(process.hrtime.bigint() - timeStart) / 1e6;
    expect(timeLastSet).to.be.lt(timeFirstSet * writeMultiplier);

    await test.async.timesSeries(itemCount, async n => {
      timeStart = process.hrtime.bigint();
      expect((await getItem(test_base_url + (n + itemCountFirstCheck))).value).to.eql(
        test_string + n
      );
      timesGet.push(Number(process.hrtime.bigint() - timeStart) / 1e6);
    });

    expect(timesGet.reduce((result, value) => result + value / timesGet.length, 0)).to.be.lt(
      timeFirstGet * readMultiplier
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
});
