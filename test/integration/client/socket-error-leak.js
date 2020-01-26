const Happn = require('../../../');
const testHelper = require('../../__fixtures/utils/test_helper').create();
// fails when run in debug
describe(testHelper.testName(__filename, 3), function() {
  this.timeout(120000);
  var server;

  var startServer = function(callback) {
    Happn.service
      .create()
      .then(function(_server) {
        server = _server;
      })
      .then(callback)
      .catch(callback);
  };

  var stopServerDisconnect = function(callback) {
    if (!server) return callback();
    server.stop(
      {
        reconnect: false
      },
      function(e) {
        if (e) return callback(e);
        server = undefined;
        callback();
      }
    );
  };

  before('start server', startServer);
  after('stop server', stopServerDisconnect);

  it('failed login-memory leak', function(done) {
    if (testHelper.semver.gte(process.version, '12.0.0')) {
      //eslint-disable-next-line
      console.warn('this test only works with node version < 12');
      return done();
    }
    let moduleDir = testHelper.path.resolve(__dirname, '../../..');
    testHelper.npm
      .install(['leakage'], {
        cwd: moduleDir,
        save: false
      })
      .then(() => {
        const leakage = require('leakage');
        leakage.iterate
          .async(() => {
            return Happn.client.create({ port: 55001 }).catch(function(e) {
              testHelper.expect(e.stack).to.not.be(null);
              testHelper.expect(e.stack).to.not.be(undefined);
              testHelper.expect(e.message).to.be('connect ECONNREFUSED 127.0.0.1:55001');
              testHelper.expect(e.code).to.be('ECONNREFUSED');
              testHelper.expect(e.errno).to.be('ECONNREFUSED');
              testHelper.expect(e.syscall).to.be('connect');
              testHelper.expect(e.address).to.be('127.0.0.1');
              testHelper.expect(e.port).to.be(55001);
            });
          })
          .then(() => done())
          .catch(err => {
            console.log(err); // eslint-disable-line no-console
            err.message.includes('MB.') ? done('Memory Leakage too large') : done(); // fails when run in debug
          });
      })
      .catch(done);
  });
});
