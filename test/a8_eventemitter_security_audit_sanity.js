describe('a8_eventemitter_security_audit', function () {

  //require('benchmarket').start();
  //after(//require('benchmarket').store());

  var happn = require('../lib/index');
  var serviceInstance;
  var adminClient;
  var expect = require('expect.js');
  var test_id = Date.now() + '_' + require('shortid').generate();

  var testClient;

  var getService = function (config, callback) {
    happn.service.create(config,
      callback
    );
  };

  before('it starts a secure service with auditing switched on', function (done) {

    this.timeout(15000);

    getService({
      secure: true,
      services:{
        security:{
          config:{
            audit:{
              paths:[
                '/TEST/a7_eventemitter_security_audit/*'
              ]
            }
          }
        }
      }
    },
    function (e, service) {

      if (e) return done(e);

      serviceInstance = service;

      serviceInstance.services.session.localClient({username: '_ADMIN', password: 'happn'})

      .then(function (clientInstance) {
        adminClient = clientInstance;
        done();
      })

      .catch(function (e) {
        done(e);
      });
    });
  });

  after('stop the service', function (callback) {

    this.timeout(15000);

    adminClient.disconnect(function(e){
      testClient.disconnect(function(e) {
        serviceInstance.stop(callback);
      });
    });
  });

  context('resources audit auditing', function () {

    var testGroup = {
      name: 'TEST GROUP' + test_id,
      custom_data: {
        customString: 'custom1',
        customNumber: 0
      }
    };

    testGroup.permissions = {};

    testGroup.permissions['/TEST/a7_eventemitter_security_audit/' + test_id + '/on'] = {actions: ['on']};
    testGroup.permissions['/TEST/a7_eventemitter_security_audit/' + test_id + '/set'] = {actions: ['set','get']};
    testGroup.permissions['/TEST/a7_eventemitter_security_audit/' + test_id + '/remove'] = {actions: ['set','remove']};
    testGroup.permissions['/TEST/a7_eventemitter_security_audit/' + test_id + '/remove_all/*'] = {actions: ['set','remove']};
    testGroup.permissions['/TEST/a7_eventemitter_security_audit/' + test_id + '/get_all/*'] = {actions: ['set', 'get']};


    var testUser = {
      username: 'AUDIT_USER',
      password: 'TEST PWD'
    };

    var addedTestGroup;
    var addedTestuser;

    before('creates a group and a user, adds the group to the user, logs in with test user', function (done) {

      serviceInstance.services.security.users.upsertGroup(testGroup, {overwrite: false}, function (e, result) {

        if (e) return done(e);
        addedTestGroup = result;

        serviceInstance.services.security.users.upsertUser(testUser, {overwrite: false}, function (e, result) {

          if (e) return done(e);
          addedTestuser = result;

          serviceInstance.services.security.users.linkGroup(addedTestGroup, addedTestuser, function (e) {

            if (e) return done(e);

            serviceInstance.services.session.localClient({username: testUser.username, password: 'TEST PWD'})

              .then(function (clientInstance) {
                testClient = clientInstance;
                done();
              })

              .catch(function (e) {
                done(e);
              });

          });
        });
      });
    });

    it('checks auditing on', function (done) {
                  // /TEST/a7_eventemitter_security_audit/
      testClient.on('/TEST/a7_eventemitter_security_audit/' + test_id + '/on', {}, function (message) {

      }, function (e, response) {

        if (e) return done(e);

        adminClient.get('/_AUDIT/TEST/a7_eventemitter_security_audit/' + test_id + '/*', function(e, auditData){

          if (e) return done(e);

          expect(auditData.length).to.be(1);
          expect(auditData[0].response._meta.status).to.be('ok');
          expect(auditData[0].session.username).to.be('AUDIT_USER');

          done();

        });
      });
    });

    it('checks auditing set and get', function (done) {

      testClient.set('/TEST/a7_eventemitter_security_audit/' + test_id + '/set', {test:"data"}, function(e){

        if (e) return done(e);

        testClient.get('/TEST/a7_eventemitter_security_audit/' + test_id + '/set', function (e, items){

          if (e) return done(e);

          adminClient.get('/_AUDIT/TEST/a7_eventemitter_security_audit/' + test_id + '/set/*', function(e, auditData){

            if (e) return done(e);

            expect(auditData.length).to.be(2);

            expect(auditData[0].response).to.be(1);
            expect(auditData[0].session.username).to.be('AUDIT_USER');

            expect(auditData[1].response._meta.published).to.be(true);
            expect(auditData[1].session.username).to.be('AUDIT_USER');

            done();

          });
        });
      });
    });

    it('checks auditing remove', function (done) {

      testClient.set('/TEST/a7_eventemitter_security_audit/' + test_id + '/remove', {test:"data"}, function(e){

        if (e) return done(e);

        testClient.remove('/TEST/a7_eventemitter_security_audit/' + test_id + '/remove', function (e){

          if (e) return done(e);

          adminClient.get('/_AUDIT/TEST/a7_eventemitter_security_audit/' + test_id + '/remove/*', function(e, auditData){

            if (e) return done(e);

            expect(auditData.length).to.be(2);

            expect(auditData[0].response.data.removed).to.be(1);
            expect(auditData[0].session.username).to.be('AUDIT_USER');

            expect(auditData[1].response._meta.published).to.be(true);
            expect(auditData[1].session.username).to.be('AUDIT_USER');

            done();

          });
        });
      });

    });

    it('checks auditing get all', function (done) {

      testClient.set('/TEST/a7_eventemitter_security_audit/' + test_id + '/get_all/1', {test:"data"}, function(e){

        if (e) return done(e);

        testClient.set('/TEST/a7_eventemitter_security_audit/' + test_id + '/get_all/2', {test:"data"}, function(e){

          if (e) return done(e);

          testClient.get('/TEST/a7_eventemitter_security_audit/' + test_id + '/get_all/*', function (e, items){

            if (e) return done(e);

            adminClient.get('/_AUDIT/TEST/a7_eventemitter_security_audit/' + test_id + '/get_all/*', function(e, auditData){

              if (e) return done(e);

              expect(auditData.length).to.be(3);

              expect(auditData[2].session.username).to.be('AUDIT_USER');
              expect(auditData[1].session.username).to.be('AUDIT_USER');
              expect(auditData[0].session.username).to.be('AUDIT_USER');

              done();

            });
          });
        });
      });
    });

    it('checks auditing remove all', function (done) {

      testClient.set('/TEST/a7_eventemitter_security_audit/' + test_id + '/remove_all/1', {test:"data"}, function(e){

        if (e) return done(e);

        testClient.set('/TEST/a7_eventemitter_security_audit/' + test_id + '/remove_all/2', {test:"data"}, function(e){

          if (e) return done(e);

          testClient.remove('/TEST/a7_eventemitter_security_audit/' + test_id + '/remove_all/*', function (e){

            if (e) return done(e);

            adminClient.get('/_AUDIT/TEST/a7_eventemitter_security_audit/' + test_id + '/remove_all/*', function(e, auditData){

              if (e) return done(e);

              expect(auditData.length).to.be(3);

              expect(auditData[2].session.username).to.be('AUDIT_USER');
              expect(auditData[1].session.username).to.be('AUDIT_USER');
              expect(auditData[0].session.username).to.be('AUDIT_USER');

              done();

            });
          });
        });
      });

    });

  });

  //require('benchmarket').stop();

});
