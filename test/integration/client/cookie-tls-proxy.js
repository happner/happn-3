const Happn = require('../../..'),
  delay = require('await-delay'),
  HappnClient = Happn.client,
  ChildProcess = require('child_process'),
  path = require('path'),
  testHelper = require('../../__fixtures/utils/test_helper').create(),
  request = require('request');

describe.only(testHelper.testName(__filename, 3), function() {
  this.timeout(120e3);

  it('tests the secure cookie can be grabbed based on the proxies forward headers', async () => {
    const service = await startHappnService(undefined, true);
    const proxy = await startProxyService();
    const client = await connectClient({
      protocol: 'https',
      port: 11235,
      username: '_ADMIN',
      password: 'happn'
    });
    await testClient(client.session.token);
    await client.disconnect();
    proxy.kill();
    service.kill();
  });

  it('tests the secure cookie can be grabbed if we are going directly to an https instance of happn', async () => {
    const service = await startHappnService('https', true);
    const client = await connectClient({
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    });
    await testClient(client.session.token, 55000);
    await client.disconnect();
    service.kill();
  });

  it('tests the secure cookie can be grabbed if we are going directly to an https instance of happn', async () => {
    const service = await startHappnService('https', true);
    const client = await connectClient({
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    });
    await testClient(client.session.token, 55000);
    await client.disconnect();
    service.kill();
  });

  it('tests the secure cookie can be grabbed if we are going directly to an https instance of happn, negative', async () => {
    const service = await startHappnService('https', false);
    const client = await connectClient({
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    });
    let errorHappened = false;
    try {
      await testClient(client.session.token, 55000);
    } catch (e) {
      testHelper.expect(e.message).to.be('expected 401 to equal 200');
      errorHappened = true;
    }
    testHelper.expect(errorHappened).to.be(true);
    await client.disconnect();
    service.kill();
  });

  it('we can only useCookie in browser', async () => {
    const service = await startHappnService('https', true);
    try {
      await connectClient({
        protocol: 'https',
        useCookie: true
      });
    } catch (e) {
      testHelper.expect(e.message).to.eql('Logging in with cookie only valid in browser');
    }

    service.kill();
  });

  function doPost(path, token, port, callback) {
    var options = {
      url: `https://127.0.0.1:${port || 11235}` + path,
      method: 'POST',
      data: { post: 'data' }
    };

    options.headers = {
      Cookie: ['happn_token_https=' + token]
    };

    request(options, callback);
  }

  async function startHappnService(protocol, httpsCookie) {
    let servicePath = path.resolve(__dirname, '../../__fixtures/utils/happn-server.js');
    let serviceProc = ChildProcess.fork(servicePath, [
      '-s',
      'true',
      '-h',
      protocol,
      '-c',
      httpsCookie ? 'true' : 'false'
    ]);
    await delay(2e3);
    return serviceProc;
  }

  async function startProxyService() {
    let proxyPath = path.resolve(__dirname, '../../__fixtures/node-proxy/proxy.js');
    let proxyProc = ChildProcess.fork(proxyPath, ['-s', 'true']);
    await delay(2e3);
    return proxyProc;
  }

  function testClient(token, port) {
    return new Promise((resolve, reject) => {
      doPost('/test/web/route', token, port, function(error, response) {
        try {
          testHelper.expect(error).to.eql(null);
          testHelper.expect(response.statusCode).to.equal(200);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  function connectClient(opts) {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
    return new Promise((resolve, reject) => {
      HappnClient.create(opts, function(e, instance) {
        if (e) return reject(e);
        return resolve(instance);
      });
    });
  }
});
