describe(require('path').basename(__filename), function () {

  this.timeout(30000);

  var TestHelper = require('./lib/TestHelper');

  var helper = new TestHelper();

  before('should initialize the helper with services', function (done) {

    helper.startUp([
      {port:55001, name:'test_service1', secure:true},
      {port:55002, name:'test_service2', secure:true},
      {port:55003, name:'test_service3'}
    ], done);
  });

  after('tears down all services and clients', function (done) {

    helper.tearDown(done);
  });

  it('tests a secure service', function (done) {

    helper.testService('test_service2', done);

  });

  it('tests a insecure service', function (done) {

    helper.testService('test_service3', done);

  });

});
