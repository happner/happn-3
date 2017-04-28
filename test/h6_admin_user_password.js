describe(require('path').basename(__filename), function () {

  this.timeout(30000);

  var expect = require('expect.js');

  var TestHelper = require('./helpers/test_helper');

  var helper = new TestHelper();

  var __testFileName = helper.newTestFile({name:'h6_admin_user_password'});

  var config = {
    port:55001,
    name:'h6_admin_user_password_service',
    secure:true,
    services:{
      security:{
        config:{
          adminUser:{
            password:'initialPassword'
          }
        }
      },
      data:{
        config:{
          filename:__testFileName
        }
      }
    },
    __testOptions:{
      getClient:true
    }
  };

  before('should initialize the helper with services', function (done) {

    helper.startUp([
      config
    ], done);
  });

  after('tears down all services and clients', function (done) {

    helper.tearDown(done);
  });

  it('changes the admin password, then restarts the service - we check the new admin password is still in place', function (done) {

    helper.getClient({name:'h6_admin_user_password_service'}, function(e, client){

      if (e) return done(e);

      helper.disconnectClient(client.id, function(e){

        if (e) return done(e);

        helper.findService({id:'h6_admin_user_password_service'})
          .instance.services.security.users.upsertUser({username:'_ADMIN', password:'modifiedPassword'}, function(e){

          if (e) return done(e);

          helper.restartService({id:'h6_admin_user_password_service'}, function(e){

            expect(e.toString()).to.be('Error: started service ok but failed to get client: AccessDenied: Invalid credentials');

            done();
          });
        });
      });
    });
  });
});
