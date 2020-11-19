const test = require('../../__fixtures/utils/test_helper').create();

describe(test.testName(__filename, 3), function() {
  var happn = require('../../../lib/index');
  var service = happn.service;
  var happn_client = happn.client;

  var serviceConfig = {
    secure: true,
    services: {
      session: {}
    }
  };

  var serviceInstance;
  var clientInstance;

  this.timeout(25000);

  beforeEach('start the test service', function(done) {
    createService(function(e) {
      if (e) return done(e);
      happn_client
        .create({
          config: {
            username: '_ADMIN',
            password: 'happn'
          }
        })
        .then(function(client) {
          clientInstance = client;
          done();
        })
        .catch(done);
    });
  });

  it('it sends bad JSON via the client socket, we ensure we get the correct logs', function(done) {
    const CaptureStdout = require('capture-stdout');
    const captureStdout = new CaptureStdout();
    captureStdout.startCapture();
    serviceInstance.services.session.log.setLevel('debug');
    serviceInstance.services.session.on('client-socket-error', errorObj => {
      captureStdout.stopCapture();
      const arrJson = captureStdout.getCapturedText();
      serviceInstance.services.session.log.setLevel(process.env.LOG_LEVEL || 'off');
      try {
        test
          .expect(
            arrJson[0].indexOf(
              'socket warning: Invalid WebSocket frame: RSV2 and RSV3 must be clear'
            )
          )
          .to.be.greaterThan(-1);
        const logErrorObj = JSON.parse(arrJson[1]).data;
        delete errorObj.policy;
        delete logErrorObj.policy;
        delete errorObj.user.publicKey;
        delete logErrorObj.user.publicKey;
        test.expect(logErrorObj).to.eql(errorObj);
      } catch (e) {
        return done(e);
      }
      done();
    });
    clientInstance.socket.socket._socket._write('}', 'utf-8', () => {
      clientInstance.disconnect();
    });
  });

  afterEach('it stops the test service', function(done) {
    clientInstance.disconnect(function() {
      serviceInstance.stop(
        {
          reconnect: false
        },
        done
      );
    });
  });

  function createService(callback) {
    service.create(serviceConfig, function(e, happnInst) {
      if (e) return callback(e);
      serviceInstance = happnInst;
      callback();
    });
  }
});
