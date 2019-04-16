describe(require('../../__fixtures/utils/test_helper').create().testName(__filename, 3), function () {

  this.timeout(30000);

  var expect = require('expect.js');
  var happn = require('../../../lib/index');
  var service = happn.service;
  var async = require('async');
  var happnInstance = null;
  var http = require('http');

  var initService = async function(config){
    return new Promise((resolve, reject) => {
      service.create(config, function (e, happnInst) {
        if (e) return reject(e);
        happnInstance = happnInst;
        resolve(happnInstance);
      });
    });
  }

  afterEach('should kill the service', function (done) {
    if (happnInstance) happnInstance.stop(done);
  });

  var addUser = async function(user){
    return new Promise((resolve, reject) => {
      happnInstance.services.security.users.upsertUser(user, {
        overwrite: false
      }, function (e, result) {
        if (e) return reject(e);
        resolve(result);
      });
    });
  }

  var getClient = async function (config) {

    return new Promise((resolve, reject) => {
      happn.client.create(config)
        .then(function (clientInstance) {
          resolve(clientInstance);
        })
        .catch(function (e) {
          reject(e);
        });
    });
  };

  var tryDisconnect = function (clientInstance, callback) {

    if (!clientInstance) return callback();

    try {
      clientInstance.disconnect(callback);
    } catch (e) {
      callback();
    }
  };

  it('we ensure the services is configured with the standard iterations', async () => {

    var service = await initService({
      secure:true,
      services:{
        security:{
          config:{
            pbkdf2Iterations:undefined
          }
        }
      }
    });

    expect(service.services.security.config.pbkdf2Iterations).to.be(10000);

    var testUser = {
      username: 'TEST USER@blah.com',
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    var addedUser = await addUser(testUser);
    var fetchedUser = await service.services.security.users.getUser(testUser.username);
    var fetchedUserPassword = service.services.security.users.__cache_passwords.getSync(testUser.username);
    var fetchedUserPasswordSplit = fetchedUserPassword.split('$');
    expect(fetchedUserPasswordSplit[1]).to.be('10000');

    var client = await getClient({config:{
      username: 'TEST USER@blah.com',
      password: 'TEST PWD'
    }});

    await client.disconnect();
  });

  it('we ensure the services is configured with the non-standard iterations', async () => {

    var service = await initService({
      secure:true,
      services:{
        security:{
          config:{
            pbkdf2Iterations:500
          }
        }
      }
    });

    expect(service.services.security.config.pbkdf2Iterations).to.be(500);

    var testUser = {
      username: 'TEST USER@blah.com',
      password: 'TEST PWD',
      custom_data: {
        something: 'usefull'
      }
    };

    var addedUser = await addUser(testUser);
    var fetchedUser = await service.services.security.users.getUser(testUser.username);
    var fetchedUserPassword = service.services.security.users.__cache_passwords.getSync(testUser.username);
    var fetchedUserPasswordSplit = fetchedUserPassword.split('$');
    expect(fetchedUserPasswordSplit[1]).to.be('500');

    var client = await getClient({config:{
      username: 'TEST USER@blah.com',
      password: 'TEST PWD'
    }});

    await client.disconnect();
  });
});
