describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var path = require('path');
    var shortid = require('shortid');
    var expect = require('expect.js');
    var Transport = require('../../../lib/services/transport/service');
    var Utils = require('../../../lib/services/utils/service');

    function transportMock(createServerHttp, createServerHttps, fileExists) {
      var mockTransport = new Transport();

      mockTransport.http = {
        createServer:
          createServerHttp ||
          function(app) {
            return {
              app: app
            };
          }
      };

      mockTransport.https = {
        createServer:
          createServerHttps ||
          function(options, app) {
            return {
              app: app,
              options: options
            };
          }
      };

      mockTransport.happn = {
        services: {
          utils: {
            fileExists:
              fileExists ||
              function(filePath) {
                return true;
              }
          }
        }
      };

      return mockTransport;
    }

    function logMock(warn, info, error) {
      return {
        warn: warn || function() {},
        info: info || function() {},
        error: error || function() {}
      };
    }

    function appMock() {
      return { test: 'app' };
    }

    function fsMock(writeFileSync, readFileSync) {
      return {
        writeFileSync:
          writeFileSync ||
          function() {
            return {};
          },
        readFileSync:
          readFileSync ||
          function() {
            return {};
          }
      };
    }

    it('transport service createServer method, empty config', function(done) {
      //config, app, log, callback
      var transport = transportMock();

      var log = logMock();
      var app = appMock();

      var config = {};

      transport.createServer(config, app, log, done);
    });

    it('transport service createServer method, no cert file', function(done) {
      this.timeout(5000);

      //config, app, log, callback
      var transport = transportMock(null, null, function(path) {
        return path == 'key-file-path';
      });

      var log = logMock();
      var app = appMock();

      var config = {
        mode: 'https',
        keyPath: 'key-file-path'
      };

      transport.createServer(config, app, log, done);
    });

    it('transport service createServer method, no key file', function(done) {
      this.timeout(5000);

      //config, app, log, callback
      var transport = transportMock(null, null, function(path) {
        return path == 'cert-file-path';
      });

      var log = logMock();
      var app = appMock();

      var config = {
        mode: 'https',
        certPath: 'cert-file-path'
      };

      transport.createServer(config, app, log, function(e) {
        expect(e.message).to.be('missing key file: undefined');
        done();
      });
    });

    it('transport service createServer method, key file and cert file', function(done) {
      this.timeout(5000);

      //config, app, log, callback
      var transport = transportMock(null, null, function(path) {
        return path == 'cert-file-path' || path == 'key-file-path';
      });

      transport.fs = fsMock();

      var log = logMock();
      var app = appMock();

      var config = {
        mode: 'https',
        certPath: 'cert-file-path',
        keyPath: 'key-file-path'
      };

      transport.createServer(config, app, log, done);
    });

    it('transport service createServer method, key file and cert file dont exist', function(done) {
      this.timeout(5000);

      //config, app, log, callback
      var transport = transportMock(null, null, function(path) {
        return false;
      });

      transport.fs = fsMock();

      transportMock.createCertificate = function(keyPath, certPath, callback) {
        return callback();
      };

      var log = logMock(function(message) {
        expect(message).to.be('cert file cert-file-path is missing, trying to generate...');
        done();
      });

      var app = appMock();

      var config = {
        mode: 'https',
        certPath: 'cert-file-path',
        keyPath: 'key-file-path'
      };

      transport.createServer(config, app, log, function() {
        //do nothing
      });
    });

    it('fails to initialize the transport service, createCertificate method raises error', function(done) {
      var transportMock = new Transport();

      transportMock.happn = {
        services: {
          utils: new Utils()
        },
        connect: {},
        log: {
          warn: function() {}
        }
      };

      transportMock.createCertificate = function(keyPath, certPath, callback) {
        return callback(new Error('test error'));
      };

      transportMock.initialize(
        {
          mode: 'https',
          certPath:
            path.resolve(__dirname, '../../test-temp') +
            path.sep +
            'https_initialization' +
            shortid.generate() +
            '.pem',
          keyPath:
            path.resolve(__dirname, '../../test-temp') +
            path.sep +
            'https_initialization' +
            shortid.generate() +
            '.rsa'
        },
        function(e) {
          expect(e.toString()).to.be('Error: test error');
          done();
        }
      );
    });
  }
);
