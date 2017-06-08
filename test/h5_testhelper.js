describe(require('path').basename(__filename), function () {

  this.timeout(60000);

  var expect = require('expect.js');

  var TestHelper = require('./helpers/test_helper');

  var helper = new TestHelper();

  before('should initialize the helper with services', function (done) {

    helper.startUp([
      {port:55008, name:'test_service1', secure:true},
      {port:55009, name:'test_service2', secure:true},
      {port:55010, name:'test_service3'}
    ], done);
  });

  after('tears down all services and clients', function (done) {

    helper.tearDown(done);
  });

  it('gets a client', function (done) {

    helper.getClient({name:'test_service1'}, function(e, client){

      if (e) return done(e);

      expect(client.instance.session.id).to.not.be(null);

      done();
    });
  });

  it('tests a secure service', function (done) {

    helper.testService('test_service2', done);
  });

  it('tests an insecure service', function (done) {

    helper.testService('test_service3', done);

  });

  it('creates a test file', function (done) {

    var testFile = helper.newTestFile();

    expect(testFile).to.not.be(null);

    done();

  });
});
