//checks info is stored next to login
describe(require('path').basename(__filename), function () {

  var Happn = require('../');
  var expect = require('expect.js');
  var Promise = require('bluebird');
  var async = require('async');

  var service1Name;

  this.timeout(60000);

  var testPort = 55001;

  var server1;

  var activeClient;

  var testGroup2 = {
    name: 'TEST GROUP2',
    custom_data: {
      customString: 'custom2',
      customNumber: 0
    }
  };

  testGroup2.permissions = {
    '/@HTTP/secure/test/removed/user': {actions: ['get']},
    '/@HTTP/secure/test/not_removed/user': {actions: ['get']}
  };

  var testUser2 = {
    username: 'TEST USER2@blah.com',
    password: 'TEST PWD'
  };

  function linkUser() {
    return new Promise(function (resolve, reject) {
      var addedTestGroup2;
      var addedTestuser2;

      server1.services.security.users.upsertGroup(testGroup2, {overwrite: false}, function (e, result) {

        if (e) return reject(e);
        addedTestGroup2 = result;

        server1.services.security.users.upsertUser(testUser2, {overwrite: false}, function (e, result) {

          if (e) return reject(e);
          addedTestuser2 = result;

          server1.services.security.users.linkGroup(addedTestGroup2, addedTestuser2, function (e) {

            if (e) return reject(e);
            resolve();
          });
        });
      });
    });
  }

  function createService(config) {

    config.secure = true;
    config.port = testPort;

    return Happn.service.create(config)
      .then(function (server) {
        server1 = server;
        service1Name = server.name;
      })
      .then(linkUser);
  }

  function stopService() {
    return new Promise(function (resolve) {

      if (!server1) resolve();

      var stopService = function(clientE){

        if (clientE) console.warn('client disconnect failed:::', clientE);

        server1.stop(function (e) {
          if (e) {
            console.warn('failed to stop server1: ' + e.toString());
            reject(e);
            return;
          }
          resolve();
        });
      };

      if (activeClient) activeClient.disconnect(stopService);
      else stopService();
    });
  }

  xit('fails to login twice, we then get an account locked out, then login successfully after 3 seconds', function (done) {

    this.timeout(10000);

    activeClient = null;

    async.series([
      function(itemCB){
        createService(
          {
            services:{
              security:{
                config:{
                  accountLockout:{
                    enabled:true,
                    attempts:2,
                    retryInterval:3000
                  }
                }
              }
            }
          }
        )
          .then(function(){
            console.log('created service:::');
            itemCB();
          })
          .catch(function(e){
            itemCB(e);
          })
      },
      function(itemCB){

        console.log('trying login 1:::');

        Happn.client.create(
          {
            config: {
              username: testUser2.username,
              password: 'BAD...',
              port: testPort
            }
          })
          .catch(function(e){
            expect(e.toString()).to.be('AccessDenied: Invalid credentials');
            console.log('got expected error 1:::');
            itemCB();
          });
      },
      function(itemCB){

        console.log('trying login 2:::');

        Happn.client.create(
          {
            config: {
              username: testUser2.username,
              password: 'BAD...',
              port: testPort
            }
          })
          .catch(function(e){
            expect(e.toString()).to.be('AccessDenied: Invalid credentials');
            console.log('got expected error 2:::');
            itemCB();
          });
      },
      function(itemCB){

        console.log('trying login 3:::');

        Happn.client.create(
          {
            config: {
              username: testUser2.username,
              password: 'BAD...',
              port: testPort
            }
          })
          .catch(function(e){
            expect(e.toString()).to.be('AccessDenied: Account locked out');
            console.log('got expected error 3:::');
            setTimeout(itemCB, 3000);//wait 3 seconds
          });
      },
      function(itemCB){

        console.log('trying login 4:::');

        Happn.client.create(
          {
            config: {
              username: testUser2.username,
              password: testUser2.password,
              port: testPort
            }
          })
          .then(function(client){
            activeClient = client;
            console.log('succeeded login 4:::');
            itemCB();
          })
          .catch(function(e){
            itemCB(e);
          });
      },
      function(itemCB){
        stopService()
          .then(function(){
            itemCB();
          })
          .catch(function(e){
            itemCB(e);
          })
      }
    ], done);
  });

  xit('does 2 unsuccessful logins out of 3, we wait the ttl and we no longer have a lock record', function (done) {

    this.timeout(10000);

    activeClient = null;

    async.series([
      function(itemCB){
        createService(
          {
            services:{
              security:{
                config:{
                  accountLockout:{
                    enabled:true,
                    attempts:3,
                    retryInterval:3000
                  }
                }
              }
            }
          }
        )
          .then(function(){
            console.log('created service:::');
            itemCB();
          })
          .catch(function(e){
            itemCB(e);
          })
      },
      function(itemCB){

        console.log('trying login 1:::');

        Happn.client.create(
          {
            config: {
              username: testUser2.username,
              password: 'BAD...',
              port: testPort
            }
          })
          .catch(function(e){
            expect(e.toString()).to.be('AccessDenied: Invalid credentials');
            console.log('got expected error 1:::');
            itemCB();
          });
      },
      function(itemCB){

        console.log('trying login 2:::');

        Happn.client.create(
          {
            config: {
              username: testUser2.username,
              password: 'BAD...',
              port: testPort
            }
          })
          .catch(function(e){

            expect(e.toString()).to.be('AccessDenied: Invalid credentials');

            console.log('got expected error 2:::');

            server1.services.security.__locks.get(testUser2.username, function(e, lock){

              expect(lock.attempts).to.be(2);
              setTimeout(itemCB, 3000);
            });
          });
      },
      function(itemCB){

        server1.services.security.__locks.get(testUser2.username, function(e, lock){

          expect(e).to.be(null);

          expect(lock).to.be(null);

          itemCB();
        });
      },
      function(itemCB){

        console.log('trying login 3:::');

        Happn.client.create(
          {
            config: {
              username: testUser2.username,
              password: testUser2.password,
              port: testPort
            }
          })
          .then(function(client){
            activeClient = client;
            console.log('succeeded login 3:::');
            itemCB();
          })
          .catch(function(e){
            itemCB(e);
          });
      },
      function(itemCB){
        stopService()
          .then(function(){
            itemCB();
          })
          .catch(function(e){
            itemCB(e);
          })
      }
    ], done);

  });
});
