describe('name', function() {
  //   .testName(__filename, 3), //   .create() // require('../../__fixtures/utils/test_helper')
  var expect = require('expect.js');
  var fs = require('fs');
  var happn = require('../../../lib/index');
  var happnClient = happn.client;
  var default_timeout = 10000;
  var tmpFile = __dirname + '/tmp/testdata_' + require('shortid').generate() + '.db';
  var currentService = null;
  var happnPort = 55505;
  var happnPassword = 'password';

  function stopService() {
    return new Promise((resolve, reject) => {
      if (currentService) {
        currentService.stop(function(e) {
          if (e && e.toString() !== 'Error: Not running') return reject(e);
          resolve();
        });
      } else resolve();
    });
  }

  async function initService(filename, name, sessionTokenSecret, persistPermissions) {
    await stopService();
    currentService = await happn.service.create({
      port: happnPort,
      name: name,
      services: {
        security: {
          config: {
            adminUser: {
              password: happnPassword
            },
            sessionTokenSecret,
            persistPermissions
          }
        },
        data: {
          config: {
            filename: filename
          }
        }
      },
      secure: true
    });
  }

  const testGroup = {
    name: 'TEST-GROUP',
    custom_data: {
      customString: 'customGroupString'
    },
    permissions: {
      '/permission/1': {
        actions: ['*']
      },
      '/permission/2': {
        actions: ['on']
      },
      '/permission/3': {
        actions: ['set']
      }
    }
  };

  const adminGroup = {
    name: 'TEST-GROUP',
    custom_data: {
      customString: 'customGroupString'
    },
    permissions: {
      '/permission/1': {
        actions: ['*']
      },
      '/permission/2': {
        actions: ['on']
      },
      '/permission/3': {
        actions: ['set']
      }
    }
  };

  const testUser = {
    username: 'TEST-USER',
    password: 'TEST_PWD',
    custom_data: {
      customString: 'customUserString'
    }
  };

  async function addPermissions() {
    let addedTestGroup = await currentService.services.security.users.upsertGroup(testGroup);
    let addedTestuser = await currentService.services.security.users.upsertUser(testUser);
    await currentService.services.security.users.linkGroup(addedTestGroup, addedTestuser);
  }

  async function checkUsersAndGroupsExist() {
    let user = await currentService.services.security.users.getUser('TEST-USER');
    let group = await currentService.services.security.groups.getGroup('TEST-GROUP');
    return user != null && group != null;
  }

  async function checkPermissionsExist() {
    try {
      let group = await currentService.services.security.groups.getGroup('TEST-GROUP');
      expect(group.permissions).to.eql({
        '/permission/1': {
          actions: ['*']
        },
        '/permission/2': {
          actions: ['on']
        },
        '/permission/3': {
          actions: ['set']
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  after('should delete the temp data file', async () => {
    this.timeout(20000);
    await stopService();
    fs.unlinkSync(tmpFile);
  });

  it('restarts the service, we ensure our users, groups and permissions are not persisted', async () => {
    this.timeout(default_timeout);
    await initService(tmpFile, 'admin_login', 'test_secret', false);
    let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;

    await addPermissions();
    let initialPermissionsExist = await checkPermissionsExist();
    expect(initialPermissionsExist).to.be(true);
    //restart service
    await initService(tmpFile, 'admin_login', undefined, false);

    let usersGroupsExistAfterRestart = await checkUsersAndGroupsExist();

    expect(usersGroupsExistAfterRestart).to.be(true);

    let initialPermissionsExistAfterRestart = await checkPermissionsExist();
    //must not exist after restart
    expect(initialPermissionsExistAfterRestart).to.be(false);

    //the session token secret must still be persisted
    expect(previousSessionTokenSecret).to.be(
      currentService.services.security.config.sessionTokenSecret
    );
    expect(previousSessionTokenSecret.length).to.be(11);
  });

  it('restarts the service, we ensure our users, groups and permissions are not persisted, negative test', async () => {
    this.timeout(default_timeout);
    await initService(tmpFile, 'admin_login', 'test_secret', true);
    let previousSessionTokenSecret = currentService.services.security.config.sessionTokenSecret;

    await addPermissions();
    let initialPermissionsExist = await checkPermissionsExist();
    expect(initialPermissionsExist).to.be(true);
    //restart service
    await initService(tmpFile, 'admin_login', undefined, true);

    let usersGroupsExistAfterRestart = await checkUsersAndGroupsExist();

    expect(usersGroupsExistAfterRestart).to.be(true);

    let initialPermissionsExistAfterRestart = await checkPermissionsExist();
    //must not exist after restart
    expect(initialPermissionsExistAfterRestart).to.be(true);

    //the session token secret must still be persisted
    expect(previousSessionTokenSecret).to.be(
      currentService.services.security.config.sessionTokenSecret
    );
    expect(previousSessionTokenSecret.length).to.be(11);
  });

  it('after restarting the mesh the _ADMIN can still log in', async () => {
    await initService(tmpFile, 'admin_login', 'test_secret', false);

    //restart service
    await initService(tmpFile, 'admin_login', undefined, false);

    var client = await happnClient.create({
      port: happnPort,
      username: '_ADMIN',
      password: happnPassword
    });

    await client.set('/test/write', { hello: 'world' });
  });
});
