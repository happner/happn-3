const Happn = require('../../..'),
  expect = require('expect.js'),
  delay = require('await-delay'),
  HappnClient = Happn.client,
  ChildProcess = require('child_process'),
  path = require('path'),
  testHelper = require('../../__fixtures/utils/test_helper').create();

describe(testHelper.testName(__filename, 3), function() {
  this.timeout(120e3);

  it('test the client detects the end of the connection to the server', async () => {
    const service = await startHappnService();
    const proxy = await startProxyService();
    const client = await connectClient({
      port: 11235
    });
    await testClient(client);
    expect(client.socket.timers.timers['heartbeat'] != null).to.be(true);
    var pickedUpReconnectScheduled = false;
    client.onEvent('reconnect-scheduled', () => {
      pickedUpReconnectScheduled = true;
    });
    proxy.kill();
    await delay(2e3);
    //eslint-disable-next-line
    console.log('killed proxy wait 15 seconds..');
    await delay(15e3);
    expect(pickedUpReconnectScheduled).to.be(true);
    service.kill();
    await client.disconnect();
  });

  it('check there is no heartbeat interval on the client when pingTimeout is configured to false', async () => {
    const service = await startHappnService();
    const client = await connectClient({
      port: 55000,
      socket: {
        pingTimeout: false
      }
    });
    await testClient(client);
    expect(client.socket.timers.timers['heartbeat'] == null).to.be(true);
    await client.disconnect();
    await service.kill();
  });

  async function startHappnService() {
    let servicePath = path.resolve(__dirname, '../../__fixtures/utils/happn-server.js');
    let serviceProc = ChildProcess.fork(servicePath);
    await delay(2e3);
    return serviceProc;
  }

  async function startProxyService() {
    let proxyPath = path.resolve(__dirname, '../../__fixtures/node-proxy/proxy.js');
    let proxyProc = ChildProcess.fork(proxyPath);
    await delay(2e3);
    return proxyProc;
  }

  function testClient(client) {
    return new Promise((resolve, reject) => {
      client.on(
        'test/message',
        () => {
          resolve();
        },
        e => {
          if (e) return reject(e);
        }
      );
      client.set('test/message', {});
    });
  }

  function connectClient(opts) {
    return new Promise((resolve, reject) => {
      HappnClient.create(opts, function(e, instance) {
        if (e) return reject(e);
        return resolve(instance);
      });
    });
  }
});
