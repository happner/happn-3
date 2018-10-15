var https = require('https');
var fs = require('fs');
var path = require('path');
var version = require('../../../package.json').version;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var tcpPortUsed = require('happn-tcp-port-used');

module.exports = TransportService;

function TransportService() {
  this.__listenRetries = 0;
  EventEmitter.call(this);
}

util.inherits(TransportService, EventEmitter);

TransportService.prototype.checkFileExists = function (path) {
  try {
    var fileStats = fs.statSync(path);

    if (fileStats.isFile()) return true;
    else return false;

  } catch (e) {
    return false;
  }
};

TransportService.prototype.createCertificate = function (keyPath, certPath, callback) {

  var pem = require('pem');

  pem.createCertificate({
    selfSigned: true
  }, function (err, keys) {

    if (err) return callback(err);

    fs.writeFileSync(keyPath, keys.serviceKey);
    fs.writeFileSync(certPath, keys.certificate);

    callback(null, {
      cert: keys.certificate,
      key: keys.serviceKey
    });

  });
};

TransportService.prototype.__createHttpsServer = function (options, app, callback) {

  try {

    var server = https.createServer(options, app);

    callback(null, server);
  } catch (e) {
    callback(new Error('error creating server: ' + e.message));
  }

};

TransportService.prototype.createServer = function (config, app, log, callback) {

  if (!config) config = {};

  this.config = config;

  if (!config.mode) config.mode = 'http';

  if (config.mode == 'http') return callback(null, require('http').createServer(app));

  else if (config.mode == 'https') {

    var options = {};

    if (config.cert && !config.key) return callback(new Error('key file missing for cert'));

    if (config.key && !config.cert) return callback(new Error('cert file missing key'));

    if (config.cert) {

      options.key = config.key;
      options.cert = config.cert;

    } else {

      if (!config.certPath) {

        var userHome = require('user-home');

        config.certPath = userHome + require('path').sep + '.happn-https-cert';
        config.keyPath = userHome + require('path').sep + '.happn-https-key';
      }

      var certFileExists = this.checkFileExists(config.certPath);
      var keyFileExists = this.checkFileExists(config.keyPath);

      if (certFileExists) {

        options.cert = fs.readFileSync(config.certPath);

        if (keyFileExists) options.key = fs.readFileSync(config.keyPath);

        else return callback(new Error('missing key file: ' + config.keyPath));

      } else {

        if (keyFileExists) return callback(new Error('missing cert file: ' + config.certPath));

        log.warn('cert file ' + config.certPath + ' is missing, trying to generate...');

        return this.createCertificate(config.keyPath, config.certPath, (e, keys) => {
          if (e) return callback(e);
          options = keys;
          this.__createHttpsServer(options, app, callback);
        });
      }
    }

    this.__createHttpsServer(options, app, callback);

  } else throw new Error('unknown transport mode: ' + config.mode + ' can only be http or https');

};

TransportService.prototype.listen = function (host, port, options, callback) {

  this.happn.__listening = false;
  this.happn.__erroredOnStart = false;
  this.happn.__listeningOn = false;
  this.happn.__errorOn = false;

  if (this.happn.__listening) return callback(new Error('already listening'));
  if (!this.happn.__factory.__initialized) return callback(new Error('main happn service not initialized'));

  if (typeof host == 'function') {
    callback = host;
    host = null;
    port = null;
  }

  if (typeof port == 'function') {
    callback = port;
    port = null;
  }

  if (typeof options === 'function') {
    callback = options;
    options = null;
  }

  // preserve zero as valid port number
  port = port !== 'undefined' ? port : this.happn.__defaultPort;

  //nulls aren't provided for in the above
  if (port == null) port = this.happn.__defaultPort;

  //default host is local/any
  host = host || this.happn.__defaultHost;

  this.happn.__done = callback;

  if (!options) options = {};
  if (!options.listenRetries) options.listenRetries = 4;
  if (!options.listenRetryInterval) options.listenRetryInterval = 2000;

  this.__listenRetries = 0;

  if (!this.happn.__errorOn) {

    this.happn.server.on('error', (e) => {

      //_this.emit('error');
      this.happn._lastError = e;
      this.happn.services.log.warn('http server error', e);

      if ((e.code && e.code == 'EADDRINUSE') && this.__listenRetries < options.listenRetries) {

        this.__listenRetries++;

        return setTimeout(() => {
          //_this.emit('listen-retry', _this.__listenRetries);
          this.__tryListen(host, port);
        }, options.listenRetryInterval);
      }

      if (this.happn.__done) {
        this.happn.__done(e, this.happn);
        this.happn.__done = null; //we only want this to be called once per call to listen
      }
    });

    this.happn.__errorOn = true;
  }

  this.__tryListen({
    port: port,
    host: host
  });

};

TransportService.prototype.__tryListen = function (options) {

  this.happn.log.$$TRACE('listen()');

  if (!this.happn.__listeningOn) {

    this.happn.server.on('listening', () => {

      this.happn.__info = this.happn.server.address();
      this.happn.__listening = true;

      this.happn.log.info('listening at ' + this.happn.__info.address + ':' + this.happn.__info.port);
      this.happn.log.info('this.happn version ' + version);

      if (this.happn.__done) {
        this.happn.__done(null, this.happn); // <--- good, created a _this.happn
        this.happn.__done = null; //we only want this to be called once per call to listen
      }

    });

    this.happn.__listeningOn = true;
  }

  if (!options.portAvailablePingInterval) options.portAvailablePingInterval = 500;
  if (!options.portAvailablePingTimeout) options.portAvailablePingTimeout = 20000; //20 seconds

  tcpPortUsed.waitUntilFree(options.port, options.portAvailablePingInterval, options.portAvailablePingTimeout)
    .then(() => {
      this.happn.server.listen(options.port, options.host);
    }, e => {
      this.happn.__done(e);
    });
};

TransportService.prototype.stop = function (options, callback) {

  //drop all connections
  this.happn.dropConnections();
  callback();
};

TransportService.prototype.initialize = function (config, callback) {

  this.createServer(config, this.happn.connect, this.happn.log, (e, server) => {

    if (e) return callback(e);

    this.happn.server = server;

    Object.defineProperty(this.happn.server, 'listening', {
      get: () => {
        return this.happn.__listening;
      },
      enumerable: 'true'
    });

    this.happn.dropConnections = () => {
      //drop all connections
      for (var key in this.happn.connections) {

        var socket = this.happn.connections[key];

        if (!socket.destroyed) {
          this.happn.log.$$TRACE('killing connection', key);
          socket.destroy();
        } else {
          this.happn.log.$$TRACE('connection killed already', key);
        }

        delete this.happn.connections[key];
      }

      this.happn.log.$$TRACE('killed connections');
    };

    this.happn.server.on('connection', (conn)  => {

      var key = conn.remoteAddress + ':' + conn.remotePort;
      this.happn.connections[key] = conn;

      conn.on('close', () => {
        delete this.happn.connections[key];
      });

    });

    this.happn.server.on('error', (e) => {
      this.happn.log.warn('server error', e);
    });

    this.happn.server.on('close', msg => {

      if (this.happn.__info) this.happn.log.info('released ' + this.happn.__info.address + ':' + this.happn.__info.port);
      else this.happn.log.info('released, no info');
    });

    callback();

  });

};
