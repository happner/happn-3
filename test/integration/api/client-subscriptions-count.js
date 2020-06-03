const tests = require('../../__fixtures/utils/test_helper').create();

describe(tests.testName(__filename, 3), function() {
  const happn = require('../../../lib/index');
  const service = happn.service;
  const happn_client = happn.client;
  var happnInstance = null;
  const util = require('util');
  this.timeout(60000);

  before('should initialize the service', function(callback) {
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
    this.timeout(20000);

    publisherclient.disconnect(
      {
        timeout: 2000
      },
      function(e) {
        //eslint-disable-next-line no-console
        if (e) console.warn('failed disconnecting publisher client');
        listenerclient.disconnect(
          {
            timeout: 2000
          },
          function(e) {
            //eslint-disable-next-line no-console
            if (e) console.warn('failed disconnecting listener client');
            happnInstance.stop(done);
          }
        );
      }
    );
  });

  var publisherclient;
  var listenerclient;

  /*
     We are initializing 2 clients to test saving data against the database, one client will push data into the
     database whilst another listens for changes.
     */
  before('should initialize the clients', function(callback) {
    try {
      happn_client.create(function(e, instance) {
        if (e) return callback(e);
        publisherclient = instance;

        happn_client.create(function(e, instance) {
          if (e) return callback(e);
          listenerclient = instance;
          callback();
        });
      });
    } catch (e) {
      callback(e);
    }
  });

  it('can support concurrent subscriptions without counts - works', async () => {
    const updates = [];
    const on = util.promisify(listenerclient.on).bind(listenerclient);
    const off = util.promisify(listenerclient.off).bind(listenerclient);
    const sub1 = await on('/some/path/three', data => updates.push({ name: 'sub1', data: data }));
    await publisherclient.set('/some/path/three', { key: 'VAL' });
    const sub2 = await on('/some/path/three', data => updates.push({ name: 'sub2', data: data }));
    await publisherclient.set('/some/path/three', { key: 'VAL-2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    tests.expect(updates).eql([
      { name: 'sub1', data: { key: 'VAL' } },
      { name: 'sub1', data: { key: 'VAL-2' } },
      { name: 'sub2', data: { key: 'VAL-2' } }
    ]);
    await off(sub1);
    await off(sub2);
  });

  it('can support concurrent subscriptions with count expiry - works', async () => {
    const updates = [];
    const on = util.promisify(listenerclient.on).bind(listenerclient);
    await on('/some/path/three', { count: 1 }, data => updates.push({ name: 'sub1', data: data }));
    await publisherclient.set('/some/path/three', { key: 'VAL' });
    await on('/some/path/three', { count: 1 }, data => updates.push({ name: 'sub2', data: data }));
    await publisherclient.set('/some/path/three', { key: 'VAL-2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    tests.expect(updates).eql([
      { name: 'sub1', data: { key: 'VAL' } },
      { name: 'sub2', data: { key: 'VAL-2' } }
    ]);
  });

  it('can support concurrent subscriptions with count expiry - broken', async () => {
    const updates = [];
    const on = util.promisify(listenerclient.on).bind(listenerclient);
    await on('/some/path/three', { count: 2 }, data => updates.push({ name: 'sub1', data: data }));
    await publisherclient.set('/some/path/three', { key: 'VAL' });
    await on('/some/path/three', { count: 1 }, data => updates.push({ name: 'sub2', data: data }));
    await publisherclient.set('/some/path/three', { key: 'VAL-2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    tests.expect(updates).eql([
      { name: 'sub1', data: { key: 'VAL' } },
      { name: 'sub1', data: { key: 'VAL-2' } },
      { name: 'sub2', data: { key: 'VAL-2' } }
    ]);
  });
});
