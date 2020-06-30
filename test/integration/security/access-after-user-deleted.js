const tests = require('../../__fixtures/utils/test_helper').create();
const happn = require('../../../lib/index');
const request = require('request');

describe(tests.testName(__filename, 3), function() {
  this.timeout(5000);
  beforeEach('creates a secure instance', createInstance);
  beforeEach('creates a user', createUser);
  afterEach('destroys secure instance', destroyInstance);
  it(
    'logs in with the user, performs a successful operation, deletes the user - tries another operation',
    performOperationAndDeleteTest
  );
  it(
    'logs in with the user, performs a successful web operation, deletes the user - tries another operation',
    performWebOperationAndDeleteTest
  );

  async function createUser() {
    const addedTestGroup = await happnInstance.services.security.users.upsertGroup({
      name: 'test-group',
      permissions: {
        'test/path/1': { actions: ['*'] },
        '/@HTTP/test/path/1': { actions: ['get'] }
      }
    });
    const addedTestuser = await happnInstance.services.security.users.upsertUser({
      username: 'test',
      password: 'test'
    });
    await happnInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser);
    testClient = await happn.client.create({ username: 'test', password: 'test' });
  }

  var deleteUser = async () => {
    await happnInstance.services.security.users.deleteUser({ username: 'test' });
  };

  var performOperation = async client => {
    await client.set('test/path/1', { data: 'test' });
  };

  var performWebOperation = async client => {
    return await doRequest('test/path/1', client.session.token);
  };

  async function performOperationAndDeleteTest() {
    await performOperation(testClient);
    await deleteUser();
    await tests.delay(1000);
    try {
      await performOperation(testClient);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e.message);
    }
  }

  async function performWebOperationAndDeleteTest() {
    var response1 = await performWebOperation(testClient);
    await deleteUser();
    await tests.delay(1000);
    var response2 = await performWebOperation(testClient);
    tests.expect(response1.statusCode).to.be(200);
    tests.expect(response2.statusCode).to.be(403);
  }

  var happnInstance, testClient;

  async function createInstance() {
    await getService({ secure: true });
  }

  async function destroyInstance() {
    if (happnInstance) await happnInstance.stop();
    happnInstance = null;
  }

  function getService(config) {
    return new Promise((resolve, reject) => {
      happn.service.create(config, (e, inst) => {
        if (e) reject(e);
        happnInstance = inst;
        happnInstance.connect.use('/test/path/1', function(req, res) {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              secure: 'value'
            })
          );
        });
        resolve();
      });
    });
  }

  function doRequest(path, token) {
    return new Promise((resolve, reject) => {
      let options = {
        url: 'http://127.0.0.1:55000/' + path
      };
      options.headers = {
        Cookie: ['happn_token=' + token]
      };
      request(options, function(error, response) {
        if (error) return reject(error);
        resolve(response);
      });
    });
  }
});
