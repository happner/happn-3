
describe('02_security_hsts_cookie', function () {

  var expect, happn_client;

  if (typeof window == 'undefined') {
    var chai = require('chai');
    var happn = require('../../lib/index');
    expect = chai.expect;
    happn_client = happn.client;
  }
  else {
    expect = window.expect;
    happn_client = window.HappnClient;
  }

  after(function (done) {

    if (socketClient) {
      socketClient.disconnect(done);
    } else done();
  });

  var socketClient;
  var default_timeout = 10000;

  /*
   We are initializing 2 clients to test saving data against the database, one client will push data into the
   database whilst another listens for changes.
   */
  before('should initialize the client', function (callback) {
    this.timeout(default_timeout);

    try {
      happn_client.create({
        config: {
          port: 55001,
          username: '_ADMIN',
          password: 'happn'
        }
      }, function (e, instance) {

        if (e) return callback(e);

        socketClient = instance;
        callback();

      });
    } catch (e) {
      callback(e);
    }
  });

  //  We set the listener client to listen for a PUT event according to a path, then we set a value with the publisher client.

  it('checks our cookie is set to secure', function (done) {

    this.timeout(default_timeout);
    done(new Error('not implemented'));
  });

  it('checks for the hsts headers', function (done) {

    this.timeout(default_timeout);
    done(new Error('not implemented'));
  });
});
