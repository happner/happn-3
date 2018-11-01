
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

  var socketClient;
  var socketClientHttp;

  it('should initialize the https client', function (callback) {
    this.timeout(default_timeout);

    try {
      happn_client.create({
        config: {
          username: '_ADMIN',
          password: 'happn',
          port:55001,
          protocol:'https'
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

  it('checks our cookie is set to secure on socket login', function (done) {
    if (document.cookie != '') return done(new Error('cookie should be blank as it is secure'));
    done();
  });

  it('should initialize the http client', function (callback) {
    this.timeout(default_timeout);

    try {
      happn_client.create({
        config: {
          username: '_ADMIN',
          password: 'happn',
          keyPair: {
            publicKey: 'AjN7wyfbEdI2LzWyFo6n31hvOrlYvkeHad9xGqOXTm1K',
            privateKey: 'y5RTfdnn21OvbQrnBMiKBP9DURduo0aijMIGyLJFuJQ='
          },
          port:55000
        }
      }, function (e, instance) {

        if (e) return callback(e);

        socketClientHttp = instance;
        callback();
      });
    } catch (e) {
      callback(e);
    }
  });

  it('checks our cookie is not set to secure on socket login', function (done) {
    if (!document.cookie) return done(new Error('cookie should not be blank'));
    done();
  });

  after(function (done) {

    this.timeout(10000);

    if (socketClient) socketClient.disconnect(function(){});
    if (socketClientHttp) socketClientHttp.disconnect(function(){});

    setTimeout(done, 5000);
  });

  var default_timeout = 10000;

  it('checks for the hsts headers', function (done) {

    this.timeout(default_timeout);

    var oReq = new XMLHttpRequest();

    oReq.addEventListener("progress", updateProgress);
    oReq.addEventListener("load", transferComplete);
    oReq.addEventListener("error", transferFailed);
    oReq.addEventListener("abort", transferCanceled);

    oReq.open("GET", 'https://localhost:55001/auth/login?username=_ADMIN&password=happn', true);
    oReq.setRequestHeader('Content-Type', 'application/json');

    // progress on transfers from the server to the client (downloads)
    function updateProgress (evt) {
      //console.log("updateProgress...", evt);
    }

    function transferComplete(evt) {
      expect(oReq.getAllResponseHeaders().indexOf('strict-transport-security: max-age=15552000; includeSubDomains') > -1).to.equal(true);
      done();
    }

    function transferFailed(evt) {
      //console.log("An error occurred while transferring the file.", evt);
    }

    function transferCanceled(evt) {
      //console.log("The transfer has been canceled by the user.", evt);
    }

    oReq.send();
  });
});
