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

  it('can support concurrent subscriptions without counts', async () => {
    const updates = [];
    const sub1 = await listenerclient.on('/some/path/three', data =>
      updates.push({ name: 'sub1', data: data })
    );
    await publisherclient.set('/some/path/three', { key: 'VAL' });
    const sub2 = await listenerclient.on('/some/path/three', data =>
      updates.push({ name: 'sub2', data: data })
    );
    await publisherclient.set('/some/path/three', { key: 'VAL-2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    tests.expect(updates).eql([
      { name: 'sub1', data: { key: 'VAL' } },
      { name: 'sub1', data: { key: 'VAL-2' } },
      { name: 'sub2', data: { key: 'VAL-2' } }
    ]);
    await listenerclient.off(sub1);
    await listenerclient.off(sub2);
  });

  it('can support concurrent subscriptions with same expire counts expiry', async () => {
    const updates = [];
    await listenerclient.on('/some/path/three', { count: 1 }, data =>
      updates.push({ name: 'sub1', data: data })
    );
    await publisherclient.set('/some/path/three', { key: 'VAL' });
    await listenerclient.on('/some/path/three', { count: 1 }, data =>
      updates.push({ name: 'sub2', data: data })
    );
    await publisherclient.set('/some/path/three', { key: 'VAL-2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    tests.expect(updates).eql([
      { name: 'sub1', data: { key: 'VAL' } },
      { name: 'sub2', data: { key: 'VAL-2' } }
    ]);
  });

  it('can support concurrent subscriptions with differing expire counts', async () => {
    const updates = [];
    const handle1 = await listenerclient.on('/some/path/three', { count: 2 }, data =>
      updates.push({ name: 'sub1', data: data })
    );
    await publisherclient.set('/some/path/three', { key: 'VAL' });
    const handle2 = await listenerclient.on('/some/path/three', { count: 1 }, data =>
      updates.push({ name: 'sub2', data: data })
    );
    tests.expect(handle1).to.be.a('number');
    tests.expect(handle2).to.be.a('number');

    await publisherclient.set('/some/path/three', { key: 'VAL-2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    tests.expect(updates).eql([
      { name: 'sub1', data: { key: 'VAL' } },
      { name: 'sub1', data: { key: 'VAL-2' } },
      { name: 'sub2', data: { key: 'VAL-2' } }
    ]);

    const handle3 = await listenerclient.on('/some/path/four', { count: 2 }, data =>
      updates.push({ name: 'sub1', data: data })
    );

    tests.expect(listenerclient.state.events['/ALL@/some/path/four']).to.not.be.empty;
    await listenerclient.off(handle3);
    tests.expect(listenerclient.state.events['/ALL@/some/path/four']).to.be.empty;
  });

  it('once convenience method', async () => {
    const updates = [];
    const handle1 = await listenerclient.once('/some/path/five', { count: 2 }, data =>
      updates.push({ name: 'sub1', data: data })
    );
    const handle2 = await listenerclient.once('/some/path/five', { count: 1 }, data =>
      updates.push({ name: 'sub2', data: data })
    );
    const handle3 = await listenerclient.once('/some/path/five', data =>
      updates.push({ name: 'sub3', data: data })
    );
    tests.expect(handle1).to.be.a('number');
    tests.expect(handle2).to.be.a('number');
    tests.expect(handle3).to.be.a('number');

    tests.expect(listenerclient.state.events['/ALL@/some/path/five'].length).to.be(3);

    await publisherclient.set('/some/path/five', { key: 'VAL-2' });
    await tests.delay(1000);
    tests.expect(updates).eql([
      { name: 'sub1', data: { key: 'VAL-2' } },
      { name: 'sub2', data: { key: 'VAL-2' } },
      { name: 'sub3', data: { key: 'VAL-2' } }
    ]);
    tests.expect(listenerclient.state.events['/ALL@/some/path/five']).to.be.empty;

    // eslint-disable-next-line no-unused-vars
    const handle4 = await listenerclient.once('/some/path/five', data => {
      updates.push({ name: 'sub4', data: data });
    });

    tests.expect(listenerclient.state.events['/ALL@/some/path/five']).to.not.be.empty;
    await listenerclient.off(handle4);
    tests.expect(listenerclient.state.events['/ALL@/some/path/five']).to.be.empty;

    updates.splice(0, updates.length);

    await listenerclient.once('/some/path/five', { event_type: 'remove' }, data => {
      updates.push({ name: 'sub5', data: data });
    });
    await publisherclient.set('/some/path/five', { key: 'VAL-2' });
    await tests.delay(1000);
    tests.expect(listenerclient.state.events['/ALL@/some/path/five']).to.not.be.empty;
    tests.expect(updates).eql([]);
    await publisherclient.remove('/some/path/five');
    await tests.delay(1000);
    tests.expect(listenerclient.state.events['/ALL@/some/path/five']).to.be.empty;
    tests.expect(updates).eql([{ name: 'sub5', data: { removed: 1 } }]);
  });

  it('onAll and offAll convenience methods', async () => {
    const updates = [];
    const handle1 = await listenerclient.onAll(data => updates.push({ name: 'sub1', data: data }));
    const handle2 = await listenerclient.onAll(data => updates.push({ name: 'sub2', data: data }));
    tests.expect(listenerclient.state.events['/ALL@*']).to.not.be.empty;
    await listenerclient.off(handle1);
    tests.expect(listenerclient.state.events['/ALL@*']).to.not.be.empty;
    await listenerclient.off(handle2);
    tests.expect(listenerclient.state.events['/ALL@*']).to.be.empty;

    await listenerclient.onAll(data => updates.push({ name: 'sub3', data: data }));
    await listenerclient.onAll(data => updates.push({ name: 'sub4', data: data }));
    await publisherclient.set('/some/path/six', { key: 'VAL-2' });
    await tests.delay(1000);
    tests.expect(updates).eql([
      { name: 'sub3', data: { key: 'VAL-2' } },
      { name: 'sub4', data: { key: 'VAL-2' } }
    ]);
    tests.expect(listenerclient.state.events['/ALL@*']).to.not.be.empty;
    await listenerclient.offAll();
    await tests.delay(1000);
    tests.expect(listenerclient.state.events['/ALL@*']).to.be.empty;
  });
});
