describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  let happn = require('../../../lib/index');
  var resolved = require.resolve('happn-3');

  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports:happn
  };

  let expect = require('expect.js');
  let delay = require('await-delay');
  let clearMongo = require('../../__fixtures/utils/cluster/clear-mongodb');
  let getClusterConfig = require('../../__fixtures/utils/cluster/get-cluster-config');
  this.timeout(10000);
  let clusterServices = [];
  let mongoUrl = 'mongodb://127.0.0.1:27017';
  let mongoCollection = 'happn-cluster-test';
  let HappnCluster = require('happn-cluster');
  let getAddress = require('../../__fixtures/utils/cluster/get-address');

  this.timeout(20000);

  async function clearMongoDb() {
    await clearMongo(mongoUrl, mongoCollection);
  }

  async function stopCluster() {

    for (let i = 0;i < 2; i++)
      await clusterServices[i].stop();
  }

  async function startCluster() {
    //port, proxyPort, swimPort, swimHosts, mongoCollection, mongoUrl, clusterSize, seed, secure
    let clusterConfig1 = getClusterConfig(55000, 56000, 57000, [`${getAddress()}:57001`], mongoCollection, mongoUrl, 1, true, true, true);
    let clusterConfig2 = getClusterConfig(55001, 56001, 57001, [`${getAddress()}:57000`], mongoCollection, mongoUrl, 2, false, true, true);

    let clusterInstance1 = await HappnCluster.create(clusterConfig1);
    let clusterInstance2 = await HappnCluster.create(clusterConfig2);

    clusterServices.push(clusterInstance1);
    clusterServices.push(clusterInstance2);

    await delay(2000);
  }

  async function getClient(config){
    return happn.client.create({ config, secure: true});
  }

  async function doEventRoundTripClient(client) {
    return new Promise((resolve, reject) => {
      var timeout = this.setTimeout(()=>{
        reject(new Error('timed out'));
      }, 3000);
      client.on('client-revoke-session-sanity', (data) => {
        this.clearTimeout(timeout);
        expect(data).to.eql({test:'data'});
        resolve();
      }, (e) => {
        if (e) return reject(e);
        client.set('client-revoke-session-sanity', {test:'data'}, (e)=>{
          if (e) return reject(e);
        });
      });
    });
  }

  before('start cluster', async () => {

    await clearMongoDb();
    await startCluster();
  });

  after('stop cluster', async () => {
    await stopCluster();
    await clearMongoDb();
  });

  var testGroup = {
    name: 'TEST GROUP',
    permissions: {
      'client-revoke-session-sanity': {
        actions: ['*']
      },
      '/TEST/DATA/*': {
        actions: ['*']
      },
      '/@HTTP/TEST/WEB/ROUTE': {
        actions: ['get']
      }
    }
  };

  var testUser = {
    username: 'TEST_SESSION',
    password: 'TEST PWD'
  };

  var addedTestGroup;
  var addedTestuser;

  before('creates a group and a user, adds the group to the user, logs in with test user', function (done) {

    clusterServices[0].services.security.users.upsertGroup(testGroup, {
      overwrite: false
    }, function (e, result) {

      if (e) return done(e);
      addedTestGroup = result;

      clusterServices[0].services.security.users.upsertUser(testUser, {
        overwrite: false
      }, function (e, result) {

        if (e) return done(e);
        addedTestuser = result;

        clusterServices[0].services.security.users.linkGroup(addedTestGroup, addedTestuser, done);
      });
    });
  });

  it('ensures revoking a token on 1 client revokes the token on all clients using the token', async () => {
    let client1 = await getClient({username: testUser.username, password: 'TEST PWD', port:56000});
    let client2 = await getClient({token: client1.session.token, port:56001});
    await doEventRoundTripClient(client2);
    await client1.disconnect({revokeSession: true});
    try{
      await delay(5000);
      await doEventRoundTripClient(client2);
      throw new Error('was not meant to happen');
    }catch(e){
      expect(e.message).to.be('unauthorized');
      client2.disconnect();
    }
  });
});
