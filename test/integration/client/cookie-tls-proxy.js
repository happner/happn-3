const Happn = require('../../..'),
  delay = require('await-delay'),
  HappnClient = Happn.client,
  ChildProcess = require('child_process'),
  path = require('path'),
  testHelper = require('../../__fixtures/utils/test_helper').create(),
  request = require('request');

describe(testHelper.testName(__filename, 3), function() {
  this.timeout(120e3);

  it('tests the secure cookie can be grabbed based on the proxies forward headers', async () => {
    const service = await startHappnService();
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

  function doPost(path, token, query, callback, excludeToken) {
    var options = {
      url: 'https://127.0.0.1:11235' + path,
      method: 'POST',
      data: { post: 'data' }
    };

    if (!excludeToken) {
      if (!query)
        options.headers = {
          Cookie: ['happn_token_https=' + token]
        };
      else options.url += '?happn_token=' + token;
    }

    request(options, callback);
  }

  async function startHappnService() {
    let servicePath = path.resolve(__dirname, '../../__fixtures/utils/happn-server.js');
    let serviceProc = ChildProcess.fork(servicePath, ['-s', 'true']);
    await delay(2e3);
    return serviceProc;
  }

  async function startProxyService() {
    let proxyPath = path.resolve(__dirname, '../../__fixtures/node-proxy/proxy.js');
    let proxyProc = ChildProcess.fork(proxyPath, ['-s', 'true']);
    await delay(2e3);
    return proxyProc;
  }

  function testClient(token) {
    return new Promise((resolve, reject) => {
      doPost('/test/web/route', token, false, function(error, response) {
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
