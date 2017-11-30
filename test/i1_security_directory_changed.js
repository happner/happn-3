describe(require('./__fixtures/utils/test_helper').create().testName(__filename), function () {

  var expect = require('expect.js');
  var happn = require('../lib/index');
  var service = happn.service;

  var test_secret = 'test_secret';
  var serviceInstance = null;
  var test_id;
  var shortid = require('shortid');
  var currentClient;

  this.timeout(5000);

  var serviceConfig = {
    secure:true
  };

  before('should initialize the service', function (callback) {

    test_id = Date.now() + '_' + shortid.generate();

    try {
      service.create(serviceConfig, function (e, happnInst) {

        if (e) return callback(e);

        serviceInstance = happnInst;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  var disconnectClients = function (options, callback) {
    if (currentClient) currentClient.disconnect({
      timeout: 2000
    }, callback);
  };

  var createdCounter = 0;

  function createTestClient(callback){

    var testGroup = {
      name: 'TEST GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup.permissions = {};

    testGroup.permissions['/security_directory_changed/' + test_id + '/testsubscribe/data/all/*'] = {
      actions: ['*']
    };
    testGroup.permissions['/security_directory_changed/' + test_id + '/testsubscribe/data/remove/*'] = {
      actions: ['remove','set', 'on']
    };
    testGroup.permissions['/security_directory_changed/' + test_id + '/testsubscribe/data/get/2'] = {
      actions: ['get', 'set']
    };
    testGroup.permissions['/security_directory_changed/' + test_id + '/testsubscribe/data/set/*'] = {
      actions: ['set']
    };
    testGroup.permissions['/TEST/a7_eventemitter_security_access/' + test_id + '/on'] = {
      actions: ['on', 'set']
    };

    var testUser = {
      username: 'TEST USER@blah.com' + createdCounter++,
      password: 'TEST PWD'
    };

    var addedTestGroup;
    var addedTestuser;

    serviceInstance.services.security.users.upsertGroup(testGroup, {
      overwrite: true
    }, function (e, result) {

      if (e) return callback(e);
      addedTestGroup = result;

      serviceInstance.services.security.users.upsertUser(testUser, {
        overwrite: false
      }, function (e, result) {

        if (e) return callback(e);
        addedTestuser = result;

        serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function (e) {

          if (e) return callback(e);

          serviceInstance.services.session.localClient({
              username: testUser.username,
              password: 'TEST PWD'
            })

            .then(function (clientInstance) {
              callback(null, clientInstance);
            })

            .catch(function (e) {
              callback(e);
            });
        });
      });
    });
  }

  var removeGroup = function(client, updateSecurityDirectory, callback){

    serviceInstance.services.data.remove('/_SYSTEM/_SECURITY/_USER/' + client.session.user.username + '/_USER_GROUP/TEST GROUP' + test_id, function(e){

      if (e) return callback(e);

      if (updateSecurityDirectory) serviceInstance.services.data.upsert('/_SYSTEM/_SECURITY/DIRECTORY_CHANGED', shortid.generate(), null, callback);

      else callback();
    });
  };

  var removePermission = function(permissionPath, updateSecurityDirectory, callback){

    serviceInstance.services.data.get('/_SYSTEM/_SECURITY/_GROUP/' + 'TEST GROUP' + test_id, function(e, group){

      if (e) return callback(e);

      delete group.data.permissions[permissionPath];

      serviceInstance.services.data.upsert('/_SYSTEM/_SECURITY/_GROUP/' + 'TEST GROUP' + test_id, group.data, null, function(e, upserted){

        if (e) return callback(e);

        if (updateSecurityDirectory) serviceInstance.services.data.upsert('/_SYSTEM/_SECURITY/DIRECTORY_CHANGED', shortid.generate(), null, callback);

        else callback();
      });
    });
  };

  var doOperations = function (client, options, callback) {

    var listenerId1;
    var listenerId2;

    //first listen for the change
    client.on('/security_directory_changed/' + test_id + '/testsubscribe/data/remove/*', {
      event_type: 'set',
      count: 1
    }, function (message) {

      client.on('/security_directory_changed/' + test_id + '/testsubscribe/data/all/*', {
        event_type: 'set',
        count: 1
      }, function (message) {

        client.off(listenerId1, function (e) {

          if (e) return callback(e);

          client.off(listenerId2, function (e) {

            if (e) return callback(e);

            client.offPath('/security_directory_changed/*', callback);
          });
        });

      }, function (e, listenerId) {

        if (!e) {

          listenerId2 = listenerId;
          //then make the change
          client.set('/security_directory_changed/' + test_id + '/testsubscribe/data/all/1', {
            property1: 'property1',
            property2: 'property2',
            property3: 'property3'
          }, null, function (e) {

            if (e) return callback(e);
          });
        } else callback(e);
      });

    }, function (e, listenerId) {

      if (!e) {

        listenerId1 = listenerId;
        //then make the change
        client.set('/security_directory_changed/' + test_id + '/testsubscribe/data/remove/1', {
          property1: 'property1',
          property2: 'property2',
          property3: 'property3'
        }, null, function (e, result) {

          if (e) return callback(e);
        });
      } else callback(e);
    });
  };

  var doSetOperation = function (client, options, callback) {

    client.set('/security_directory_changed/' + test_id + '/testsubscribe/data/set/1', {
      property1: 'property1',
      property2: 'property2',
      property3: 'property3'
    }, options, callback);
  };

  it('should do a bunch of operations, remove the the group from a client, wait a sec and see we are unable to perform operations', function (done) {

    this.timeout(15000);

    createTestClient(function (e, client) {

      if (e) return done(e);

      currentClient = client;

      doOperations(client, null, function (e) {

        if (e) return done(e);

        removeGroup(client, true, function(e){

          if (e) return done(e);

          setTimeout(function(){

            doOperations(client, null, function (e) {

              expect(e.toString()).to.be('AccessDenied: unauthorized');

              done();
            });
          }, 3000);
        });
      });
    });
  });

  it('should do a set operations, modify the set permission, wait a sec and see we are unable to perform the set operation', function (done) {

    this.timeout(15000);

    createTestClient(function (e, client) {

      if (e) return done(e);

      currentClient = client;

      doSetOperation(client, null, function (e) {

        if (e) return done(e);

        removePermission('/security_directory_changed/' + test_id + '/testsubscribe/data/set/*', true, function(e){

          if (e) return done(e);

          setTimeout(function(){

            doSetOperation(client, null, function (e) {

              expect(e.toString()).to.be('AccessDenied: unauthorized');

              done();
            });
          }, 3000);
        });
      });
    });
  });

  it('should do a bunch of operations, remove the the group from a client, wait a sec and see we are unable to perform operations, negative test', function (done) {

    this.timeout(15000);

    createTestClient(function (e, client) {

      if (e) return done(e);

      currentClient = client;

      doOperations(client, null, function (e) {

        if (e) return done(e);

        removeGroup(client, false, function(e){

          if (e) return done(e);

          setTimeout(function(){

            doOperations(client, null, done);
          }, 3000);
        });
      });
    });
  });

  it('should do a set operations, modify the set permission, wait a sec and see we are unable to perform the set operation, negative test', function (done) {

    this.timeout(15000);

    createTestClient(function (e, client) {

      if (e) return done(e);

      currentClient = client;

      doSetOperation(client, null, function (e) {

        if (e) return done(e);

        removePermission('/security_directory_changed/' + test_id + '/testsubscribe/data/set/*', false, function(e){

          if (e) return done(e);

          setTimeout(function(){

            doSetOperation(client, null, done);
          }, 3000);
        });
      });
    });
  });

  after(function (done) {

    this.timeout(20000);

    disconnectClients(null, function () {
      serviceInstance.stop(done);
    });
  });
});
