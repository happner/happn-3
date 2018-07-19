(function() { // begin enclosed

  var browser = false;
  var Promise;
  var Logger;
  var crypto;
  var Primus;

  var PROTOCOL = "happn_{{protocol}}";

  var STATE;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') browser = true;

  // allow require when module is defined (needed for NW.js)
  if (typeof module !== 'undefined') module.exports = HappnClient;

  if (!browser) {

    Promise = require('bluebird');

    Logger = require('happn-logger');
    PROTOCOL = 'happn_' + require('../package.json').protocol; //we can access our package
    Primus = require('happn-primus');

  } else {

    window.HappnClient = HappnClient;

    Primus = window.Primus;

    if (!Promise || typeof Promise.promisify !== 'function') {
      Promise = Promise || {};
      Promise.promisify = function(fn) {
        return fn;
      };
    }
  }

  var Promisify = function(originalFunction, opts) {

    return function() {

      var args = Array.prototype.slice.call(arguments);
      var _this = this;

      if (opts && opts.unshift) args.unshift(opts.unshift);

      // No promisify if last passed arg is function (ie callback)

      if (typeof args[args.length - 1] == 'function') {
        return originalFunction.apply(this, args);
      }

      return new Promise(function(resolve, reject) {
        // push false callback into arguments
        args.push(function(error, result, more) {
          if (error) return reject(error);
          if (more) {
            var args = Array.prototype.slice.call(arguments);
            args.shift(); // toss undefined error
            return resolve(args); // resolve array of args passed to callback
          }
          return resolve(result);
        });
        try {
          return originalFunction.apply(_this, args);
        } catch (error) {
          return reject(error);
        }
      });
    };
  };

  var __isRanged = function(connection) {

    if (connection == null) return false;

    var checkConnection = connection.config ? connection.config : connection;

    var hostRanged = false,
      portRanged = false;

    if (checkConnection.host && checkConnection.host.range != null) {

      if (!Array.isArray(checkConnection.host.range) || checkConnection.host.range.length != 2)
        throw new Error('invalid range option, range must be an array or length must be 2');

      hostRanged = true;
    }

    if (checkConnection.port && checkConnection.port.range != null) {

      if (!Array.isArray(checkConnection.port.range) || checkConnection.port.range.length != 2)
        throw new Error('invalid range option, range must be an array or length must be 2');

      portRanged = true;
    }

    if (hostRanged && portRanged) throw new Error('invalid range option, range can only be by host or port, not both');

    if (hostRanged || portRanged) return true;

    return false;
  };

  var __getRange = function(connection) {

    var connectionRange = [];

    var rangeConnection = connection.config ? connection.config : connection;

    var serializedOptions = JSON.stringify(rangeConnection);

    if (!rangeConnection.port) rangeConnection.port = 55000;

    if (!rangeConnection.host) rangeConnection.host = '127.0.0.1';

    var appendConnectionOptions = function(host, port) {

      var options = JSON.parse(serializedOptions);

      options.host = host;
      options.port = port;

      connectionRange.push(options);
    };

    if (rangeConnection.host.range != null) {

      var fromOctet = rangeConnection.host.range[0].split('.');

      var toOctet = rangeConnection.host.range[1].split('.');

      var first = fromOctet[3];

      var last = toOctet[3];

      for (var i = first; i <= last; i++) {
        if (i < 256) appendConnectionOptions(fromOctet.slice(0, 3).join('.') + '.' + i, rangeConnection.port);
      }
    }

    if (rangeConnection.port.range != null) {

      for (var i = rangeConnection.port.range[0]; i <= rangeConnection.port.range[1]; i++) {
        appendConnectionOptions(rangeConnection.host, i);
      }
    }

    return connectionRange;
  };

  function HappnClient() {

    var _this = this;

    if (!browser) {
      _this.constants = require('./constants');
      _this.utils = require('./services/utils/shared');
    }

    //DO NOT DELETE
    //{{constants}}

    //DO NOT DELETE
    //{{utils}}

    STATE = _this.constants.CLIENT_STATE;
  }

  HappnClient.__instance = function(options) {
    return new HappnClient().client(options);
  };

  var __prepareOptions = function(connection, options) {

    if (options == null) options = {};

    if (Array.isArray(connection)) options.pool = connection;

    if (__isRanged(connection)) options.pool = __getRange(connection);

    try {
      if (connection != null && JSON.stringify(options) == '{}') //empty object
        options = connection;
    } catch (e) {
      //do nothing
    }

    return options;
  };

  //make __prepareOptions testable
  HappnClient.__prepareOptions = __prepareOptions;

  HappnClient.create = Promisify(function(connection, options, callback) {

    if (typeof connection == 'function') {

      callback = connection;

      options = {};

      connection = null;
    }

    if (typeof options == 'function') {

      callback = options;

      options = connection ? connection : {};

      connection = null;
    }

    var clientOptions;

    try {
      clientOptions = __prepareOptions(connection, options);
    } catch (e) {
      return callback(e);
    }

    var client = new HappnClient().client(clientOptions);

    if (clientOptions.testMode) HappnClient.lastClient = client;

    return client.initialize(function(err, createdClient) {

      if (!err) return callback(null, createdClient);

      if (client.clientType === 'eventemitter') {
        client.socket.disconnect();
        return callback(err);
      }

      client.disconnect(function() {
        callback(err);
      });
    });
  });

  HappnClient.prototype.client = function(options) {

    var _this = this;

    options = options || {};

    if (options.Logger && options.Logger.createLogger) {

      this.log = options.Logger.createLogger('HappnClient');

    } else if (Logger) {

      if (!Logger.configured) Logger.configure(options.utils);

      this.log = Logger.createLogger('HappnClient');

    } else {

      this.log = {
        $$TRACE: function(msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        $$DEBUG: function(msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        trace: function(msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        debug: function(msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        info: function(msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        warn: function(msg, obj) {
          if (obj) return console.warn('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        error: function(msg, obj) {
          if (obj) return console.error('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        fatal: function(msg, obj) {
          if (obj) return console.error('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        }
      };
    }

    this.log.$$TRACE('new client()');

    this.__initializeProperties(); //local properties

    this.__initializeConnectivity(); //setup of the socket methods and events

    this.__prepareOptions(options);

    this.__initializeEvents(); //client events (connect/disconnect etc.)

    return _this;
  };

  HappnClient.prototype.initialize = Promisify(function(callback) {

    var _this = this;

    //ensure session scope is not on the prototype
    _this.session = null;

    if (browser) {

      return _this.getResources(function(e) {

        if (e) return callback(e);

        _this.authenticate(function(e) {

          if (e) return callback(e);

          _this.state = STATE.ACTIVE;

          callback(null, _this);
        });
      });
    }

    _this.authenticate(function(e) {

      if (e) return callback(e);

      _this.state = STATE.ACTIVE;

      callback(null, _this);
    });
  });

  HappnClient.prototype.__prepareSecurityOptions = function(options) {

    if (options.keyPair && options.keyPair.publicKey) options.publicKey = options.keyPair.publicKey;

    if (options.keyPair && options.keyPair.privateKey) options.privateKey = options.keyPair.privateKey;

  };

  HappnClient.prototype.__prepareSocketOptions = function(options) {

    //backward compatibility

    if (!options.socket) options.socket = {};

    if (!options.socket.reconnect) options.socket.reconnect = {};

    if (options.reconnect) options.socket.reconnect = options.reconnect; //override, above config is very convoluted

    if (!options.socket.reconnect.retries) options.socket.reconnect.retries = Infinity;

    if (!options.socket.reconnect.max) options.socket.reconnect.max = 180000; //3 minutes

    options.socket.timeout = options.connectTimeout ? options.connectTimeout : 30000; //default is 30 seconds

    if (!options.socket.timeout) options.socket.timeout = 10000; //default

    if (options.socket.reconnect.strategy) options.socket.strategy = options.socket.reconnect.strategy;

    if (!options.socket.strategy) options.socket.strategy = "disconnect,online,timeout";

  };

  HappnClient.prototype.__prepareConnectionOptions = function(options, defaults) {

    var setDefaults = function(propertyName) {

      if (!options[propertyName] && defaults[propertyName] != null)
        options[propertyName] = defaults[propertyName];
    };

    if (defaults) {

      setDefaults('host');
      setDefaults('port');
      setDefaults('url');
      setDefaults('protocol');
      setDefaults('allowSelfSignedCerts');
      setDefaults('username');
      setDefaults('password');
      setDefaults('publicKey');
      setDefaults('privateKey');
      setDefaults('token');
    }


    if (!options.host) options.host = '127.0.0.1';

    if (!options.port) options.port = 55000;

    if (!options.url) {

      options.protocol = options.protocol || 'http';

      if (options.protocol == 'http' && parseInt(options.port) == 80) {
        options.url = options.protocol + '://' + options.host;
      } else if (options.protocol == 'https' && parseInt(options.port) == 443) {

        options.url = options.protocol + '://' + options.host;

      } else {

        options.url = options.protocol + '://' + options.host + ':' + options.port;
      }
    }

    return options;
  };

  HappnClient.prototype.__prepareOptions = function(options) {

    var preparedOptions;

    if (options.config) {
      //we are going to standardise here, so no more config.config
      preparedOptions = options.config;

      for (var optionProperty in options) {
        if (optionProperty != 'config' && !preparedOptions[optionProperty]) preparedOptions[optionProperty] = options[optionProperty];
      }
    } else preparedOptions = options;

    if (!preparedOptions.callTimeout) preparedOptions.callTimeout = 60000; //1 minute

    //this is for local client connections
    if (preparedOptions.context) Object.defineProperty(this, 'context', {
      value: preparedOptions.context
    });

    //how we override methods
    if (preparedOptions.plugin) {

      for (var overrideName in preparedOptions.plugin) {

        if (preparedOptions.plugin.hasOwnProperty(overrideName)) {

          if (preparedOptions.plugin[overrideName].bind) this[overrideName] = preparedOptions.plugin[overrideName].bind(this);

          else this[overrideName] = preparedOptions.plugin[overrideName];
        }
      }
    }

    if (preparedOptions.pool) {

      var _this = this;

      if (!preparedOptions.poolReconnectDelay) preparedOptions.poolReconnectDelay = 0; //no delay by default

      if (preparedOptions.poolType == null) preparedOptions.poolType = _this.constants.CONNECTION_POOL_TYPE.RANDOM;

      if (preparedOptions.poolReconnectAttempts == null) preparedOptions.poolReconnectAttempts = 4;

      preparedOptions.pool = preparedOptions.pool.map(function(connection) {

        return _this.__prepareConnectionOptions(connection.config ? connection.config : connection, preparedOptions);
      });

    } else preparedOptions = this.__prepareConnectionOptions(preparedOptions);

    this.__prepareSecurityOptions(preparedOptions);

    if (preparedOptions.allowSelfSignedCerts) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    this.__prepareSocketOptions(preparedOptions);

    var info = preparedOptions.info != null ? preparedOptions.info : {};

    if (typeof info != 'object') info = {
      data: info
    };

    preparedOptions.info = info;

    preparedOptions.info._browser = browser;

    if (preparedOptions.loginRetry == null) preparedOptions.loginRetry = 4; // will attempt to login to the same address 4 times

    if (preparedOptions.loginRetryInterval == null) preparedOptions.loginRetryInterval = 5000; // five seconds apart

    if (preparedOptions.loginTimeout == null) preparedOptions.loginTimeout = preparedOptions.callTimeout; // will wait a minute before failing the login

    this.options = preparedOptions;
  };

  HappnClient.prototype.__updateOptions = function(possibility) {

    var _this = this;

    var syncOption = function(propertyName) {
      if (possibility[propertyName] != null) _this.options[propertyName] = possibility[propertyName];
    };

    syncOption('url');
    syncOption('host');
    syncOption('port');
    syncOption('protocol');
    syncOption('allowSelfSignedCerts');
    syncOption('username');
    syncOption('password');
    syncOption('publicKey');
    syncOption('privateKey');
    syncOption('token');

  };

  HappnClient.prototype.__initializeConnectivity = function() {

    var _this = this;

    _this.initializeConnectionPool = function(resetAttempts) {

      _this.__tried = [];

      _this.__possible = _this.options.pool.map(function(connection) {
        return connection;
      });

      if (resetAttempts) _this.__poolAttempts = 0;
    };

    _this.__getConnection = function(callback) {

      _this.__connectionCleanup();

      _this.options.socket.manual = true; //because we want to explicitly call open()

      try {

        if (_this.options.pool) {

          var delayConnection = false;

          if (!_this.__tried) _this.initializeConnectionPool(true);

          else _this.__poolAttempts++;

          if (_this.options.poolReconnectAttempts > 0 && (_this.__poolAttempts > _this.options.poolReconnectAttempts)) {
            return callback(new Error('pool reconnection attempts exceeded'));
          }

          if (_this.__possible.length == 0) { //what is possible is now zero, start all over again until we get a connection or we have reconnected successfully
            _this.initializeConnectionPool();
            delayConnection = true;
          }

          var possibleIndex;

          if (_this.options.poolType == _this.constants.CONNECTION_POOL_TYPE.RANDOM)
            possibleIndex = Math.floor(Math.random() * _this.__possible.length);

          if (_this.options.poolType == _this.constants.CONNECTION_POOL_TYPE.ORDERED)
            possibleIndex = 0;

          _this.__updateOptions(_this.__possible[possibleIndex]);

          _this.__tried.push(_this.__possible[possibleIndex]);

          _this.__possible.splice(possibleIndex, 1); //remove from the list of possibilities

          if (delayConnection) return setTimeout(function() {

            _this.__connectSocket(callback);
          }, _this.options.poolReconnectDelay);

          _this.__connectSocket(callback);

        } else _this.__connectSocket(callback);

      } catch (e) {
        callback(e);
      }
    };
  };

  HappnClient.prototype.__connectSocket = function(callback) {

    var socket;

    var _this = this;

    _this.state = STATE.CONNECTING;

    if (browser) socket = new Primus(_this.options.url, _this.options.socket);

    else {

      var Socket = Primus.createSocket({
        transformer: _this.options.transformer,
        parser: _this.options.parser,
        manual: true
      });

      socket = new Socket(_this.options.url, _this.options.socket);
    }

    socket.on('timeout', function() {

      if (_this.state === STATE.CONNECTING) {

        if (_this.options.pool) return _this.__getConnection(callback);

        _this.state = STATE.CONNECT_ERROR;

        return callback(new Error('connection timed out'));
      }

      _this.handle_error(new Error('connection timed out'));
    });

    socket.on('open', function waitForConnection() {

      if (_this.state === STATE.CONNECTING) {

        _this.state = STATE.ACTIVE;

        _this.serverDisconnected = false;

        socket.removeListener('open', waitForConnection);

        if (_this.options.pool) _this.initializeConnectionPool(true);

        callback(null, socket);
      }
    });

    socket.on('error', function(e) {

      if (_this.state === STATE.CONNECTING) {

        if (_this.options.pool) return _this.__getConnection(callback);

        // ERROR before connected,
        // ECONNREFUSED etc. out as errors on callback
        _this.state = STATE.CONNECT_ERROR;

        callback(e);
      }

      _this.handle_error(e);
    });

    socket.open();
  };

  HappnClient.prototype.__initializeProperties = function() {

    var _this = this;

    _this.events = {};
    _this.messageEvents = {};
    _this.requestEvents = {};
    _this.currentEventId = 0;
    _this.currentListenerId = 0;
    _this.errors = [];
    _this.clientType = 'socket';
    _this.__systemMessageHandlers = [];
    _this.state = STATE.UNINITIALIZED;
    _this.__ackHandlers = {};
    _this.eventHandlers = {};

  };

  HappnClient.prototype.__initializeEvents = function() {

    var _this = this;

    _this.onEvent = function(eventName, eventHandler) {

      if (!eventName) throw new Error('event name cannot be blank or null');

      if (typeof eventHandler != 'function') throw new Error('event handler must be a function');

      if (!_this.eventHandlers[eventName]) _this.eventHandlers[eventName] = [];

      _this.eventHandlers[eventName].push(eventHandler);

      return eventName + '|' + (_this.eventHandlers[eventName].length - 1);
    };

    _this.offEvent = function(handlerId) {

      var eventName = handlerId.split('|')[0];

      var eventIndex = parseInt(handlerId.split('|')[1]);

      _this.eventHandlers[eventName][eventIndex] = null;

    };

    _this.emit = function(eventName, eventData) {

      if (_this.eventHandlers[eventName]) {
        _this.eventHandlers[eventName].map(function(handler) {
          if (!handler) return;
          handler.call(handler, eventData);
        });
      }
    };
  };

  HappnClient.prototype.getScript = function(url, callback) {

    if (!browser) return callback(new Error('only for browser'));

    var script = document.createElement('script');
    script.src = url;
    var head = document.getElementsByTagName('head')[0];
    var done = false;

    // Attach handlers for all browsers
    script.onload = script.onreadystatechange = function() {
      if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
        done = true;
        script.onload = script.onreadystatechange = null;
        head.removeChild(script);
        callback();
      }
    };

    head.appendChild(script);
  };

  HappnClient.prototype.getResources = function(callback) {

    var _this = this;

    if (typeof Primus == 'undefined') _this.getScript(_this.options.url + '/browser_primus.js', function(e) {
      if (e) return callback(e);

      if (typeof Primus == 'undefined') {

        if (window && window.Primus) Primus = window.Primus;
        else if (document && document.Primus) Primus = document.Primus;
        else return callback(new Error('unable to fetch Primus library'));

        callback();
      }
    });

    else callback();
  };


  HappnClient.prototype.stop = Promisify(function(callback) {
    this.socket.on('end', callback);
    this.socket.end();
  });

  HappnClient.prototype.__encryptLogin = function(parameters, publicKey) {

    return {
      encrypted: crypto.asymmetricEncrypt(publicKey, this.options.privateKey, JSON.stringify(parameters)),
      publicKey: parameters.publicKey,
      loginType: parameters.loginType != null ? parameters.loginType : 'password'
    };
  };

  HappnClient.prototype.__decryptLogin = function(loginResult) {

    try {
      return JSON.parse(crypto.asymmetricDecrypt(this.serverInfo.publicKey, this.options.privateKey, loginResult.encrypted));
    } catch (e) {
      throw e;
    }
  };

  HappnClient.prototype.__encryptPayload = function(message) {
    return {
      sessionId: message.sessionId,
      encrypted: crypto.symmetricEncryptObject(message, this.session.secret)
    };
  };

  HappnClient.prototype.__decryptPayload = function(message) {

    var payload = crypto.symmetricDecryptObject(message, this.session.secret);
    return payload;
  };

  HappnClient.prototype.__ensureCryptoLibrary = Promisify(function(callback) {

    if (crypto) return callback();

    if (browser) {
      this.getScript(this.options.url + '/browser_crypto.js', function(e) {
        if (e) return callback(e);
        crypto = new window.Crypto();
        callback();
      });
    } else {
      Crypto = require('happn-util-crypto');
      crypto = new Crypto();
      callback();
    }
  });


  HappnClient.prototype.__attachSession = function(result) {

    delete result._meta;
    this.session = result;

    //write our session cookie
    if (browser) {
      var cookie = (result.cookieName || 'happn_token') + '=' + this.session.token + '; path=/;';
      if (result.cookieDomain) cookie += ' domain=' + result.cookieDomain + ';';
      document.cookie = cookie;
    }
  };

  HappnClient.prototype.__payloadToError = function(payload) {

    var err = new Error(payload.toString());

    if (payload.message) err.message = payload.message;

    return err;
  };

  HappnClient.prototype.__doLogin = function(loginParameters, callback) {

    var _this = this;

    var login = function(cb) {

      _this.__performSystemRequest('login', loginParameters, {
        timeout: _this.options.loginTimeout
      }, function(e, result) {

        if (e) return cb(e);

        if (result._meta.status == 'ok') {
          _this.__attachSession(result);
          cb();
        } else cb(_this.__payloadToError(result.payload));
      });
    };

    if (!_this.options.loginRetry) return login(callback);

    if (!_this.options.loginRetryInterval || typeof _this.options.loginRetryInterval != 'number') _this.options.loginRetryInterval = 5000; //just in case, someone made it 0 or -1 or blah

    var currentAttempt = 0;

    var loggedIn = false;

    _this.utils.whilst(
      function() {
        return currentAttempt < _this.options.loginRetry && loggedIn == false;
      },
      function(attempt, next) {

        currentAttempt++;

        login(function(e) {

          if (e) {

            if ([403, 401].indexOf(e.code) > -1) return next(e); //access was denied

            if (currentAttempt == _this.options.loginRetry) return next(e);

            return setTimeout(next, _this.options.loginRetryInterval);
          }

          loggedIn = true;

          return next();
        });
      }, callback);
  };

  HappnClient.prototype.__signNonce = function(nonce) {
    return crypto.sign(nonce, this.options.privateKey);
  };

  HappnClient.prototype.__prepareLogin = function(loginParameters, callback) {

    var _this = this;

    var prepareCallback = function(prepared) {

      if (_this.serverInfo.encryptPayloads) prepared = _this.__encryptLogin(prepared, _this.serverInfo.publicKey);
      callback(null, prepared);
    };

    if (loginParameters.loginType == 'digest') {

      _this.__performSystemRequest('request-nonce', {
        publicKey: loginParameters.publicKey
      }, null, function(e, response) {

        if (e) return callback(e);

        loginParameters.digest = _this.__signNonce(response.nonce);
        prepareCallback(loginParameters);

      });

    } else prepareCallback(loginParameters);
  };

  HappnClient.prototype.login = Promisify(function(callback) {

    var _this = this;

    var loginParameters = {
      username: this.options.username,
      info: this.options.info,
      protocol: PROTOCOL
    };

    loginParameters.info._browser = browser;
    loginParameters.info._local = _this.socket._local ? true : false;

    if (this.options.password) loginParameters.password = this.options.password;

    if (this.options.publicKey) loginParameters.publicKey = this.options.publicKey;

    if (this.options.token) loginParameters.token = this.options.token;

    if (PROTOCOL === 'happn_{{protocol}}') PROTOCOL = 'happn'; //if this file is being used without a replace on the protocol

    _this.__performSystemRequest('configure-session', {
      protocol: PROTOCOL
    }, null, function(e) {

      if (e) return callback(e);

      _this.__performSystemRequest('describe', null, null, function(e, serverInfo) {

        if (e) return callback(e);

        _this.serverInfo = serverInfo;

        if (_this.serverInfo.secure) {

          if (!loginParameters.token && !loginParameters.username) return callback(new Error('happn server is secure, please specify a username or token'));

          if (!loginParameters.password && !loginParameters.token) {

            if (loginParameters.publicKey) loginParameters.loginType = 'digest'; //we have a username, publicKey and password

            else return callback(new Error('happn server is secure, please specify a password'));
          }

          if (_this.serverInfo.encryptPayloads || loginParameters.loginType === 'digest') {

            _this.__ensureCryptoLibrary(function(e) {

              if (e) return callback(e);

              if (!_this.options.privateKey || !_this.options.publicKey) {

                if (loginParameters.loginType === 'digest') return callback(new Error('login type is digest, but no privateKey and publicKey specified'));

                //We generate one
                var keyPair = crypto.createKeyPair();

                _this.options.publicKey = keyPair.publicKey;
                _this.options.privateKey = keyPair.privateKey;
              }

              loginParameters.publicKey = _this.options.publicKey;

              _this.__prepareLogin(loginParameters, function(e, preparedParameters) {

                if (e) return callback(e);
                _this.__doLogin(preparedParameters, callback);
              });
            });

          } else _this.__doLogin(loginParameters, callback);

        } else _this.__doLogin(loginParameters, callback);

      });
    });
  });

  HappnClient.prototype.authenticate = Promisify(function(callback) {

    var _this = this;

    if (_this.socket) {

      // handle_reconnection also call through here to 're-authenticate'.
      // This is that happending. Don't make new socket.
      //
      // TODO: What happnes if this reconnection login fails?
      //       Who gets told?
      //       How?
      _this.login(callback);

      return;
    }

    _this.__getConnection(function(e, socket) {

      if (e) return callback(e);

      _this.socket = socket;

      _this.socket.on('data', _this.handle_publication.bind(_this));

      _this.socket.on('reconnected', _this.reconnect.bind(_this));

      _this.socket.on('end', _this.handle_end.bind(_this));

      _this.socket.on('close', _this.handle_end.bind(_this));

      _this.socket.on('reconnect timeout', _this.handle_reconnect_timeout.bind(_this));

      _this.socket.on('reconnect scheduled', _this.handle_reconnect_scheduled.bind(_this));

      // login is called before socket connection established...
      // seems ok (streams must be paused till open)
      _this.login(callback);
    });
  });

  HappnClient.prototype.handle_end = function() {

    this.state = STATE.DISCONNECTED;

    if (this.session) this.emit('connection-ended', this.session.id);

    else this.emit('connection-ended');
  };

  HappnClient.prototype.handle_reconnect_timeout = function(err, opts) {

    this.state = STATE.DISCONNECTED;

    this.emit('reconnect-timeout', {
      err: err,
      opts: opts
    });
  };

  HappnClient.prototype.handle_reconnect_scheduled = function(opts) {

    var _this = this;

    _this.state = STATE.RECONNECTING;

    _this.__reconnectSuccessful = false;

    _this.emit('reconnect-scheduled', opts);

    if (_this.options.pool) { //we have options

      _this.socket = null; //reconnect will now get a connection

      _this.reconnect(function(e) {

        if (e) _this.handle_error(new Error('pooled subscription reconnection failed', e));
      });
    }
  };

  HappnClient.prototype.getEventId = function() {

    return this.currentEventId += 1;
  };

  HappnClient.prototype.__requestCallback = function(message, callback, options, eventId, path, action) {

    var _this = this;

    var callbackHandler = {
      eventId: message.eventId
    };

    callbackHandler.handleResponse = function(e, response) {

      clearTimeout(callbackHandler.timedout);

      delete _this.requestEvents[callbackHandler.eventId];

      return callback(e, response);
    };

    callbackHandler.timedout = setTimeout(function() {

      delete _this.requestEvents[callbackHandler.eventId];

      var errorMessage = 'api request timed out';

      if (path) errorMessage += ' path: ' + path;

      if (action) errorMessage += ' action: ' + action;

      return callback(new Error(errorMessage));

    }, options.timeout);

    //we add our event handler to a queue, with the embedded timeout
    _this.requestEvents[eventId] = callbackHandler;
  };

  HappnClient.prototype.__performDataRequest = function(path, action, data, options, callback) {

    if (this.state != STATE.ACTIVE) {

      var errorMessage = 'client not active';

      if (this.state === STATE.CONNECT_ERROR) errorMessage = 'client in an error state';
      if (this.state === STATE.ERROR) errorMessage = 'client in an error state';
      if (this.state === STATE.UNINITIALIZED) errorMessage = 'client not initialized yet';
      if (this.state === STATE.DISCONNECTED) errorMessage = 'client is disconnected';

      var errorDetail = 'action: ' + action + ', path: ' + path;

      var error = new Error(errorMessage);
      error.detail = errorDetail;

      if (callback) return callback(error);
      throw error;
    }

    var eventId = this.getEventId();

    var message = {
      action: action,
      eventId: eventId,
      path: path,
      data: data,
      sessionId: this.session.id
    };

    if (!options) options = {};

    else message.options = options;//else skip sending up the options

    if (['set', 'remove'].indexOf(action) >= 0) {
      if (options.consistency == this.constants.CONSISTENCY.DEFERRED || options.consistency == this.constants.CONSISTENCY.ACKNOWLEDGED) this.__attachPublishedAck(options, message);
    }

    if (!options.timeout) options.timeout = this.options.callTimeout;

    if (this.serverInfo.encryptPayloads) message = this.__encryptPayload(message);

    if (callback) this.__requestCallback(message, callback, options, eventId, path, action); // if null we are firing and forgetting

    this.socket.write(message);
  };

  HappnClient.prototype.__performSystemRequest = function(action, data, options, callback) {

    //'login', 'describe', 'request-nonce','configure-session'

    var eventId = this.getEventId();

    var message = {
      'action': action,
      'eventId': eventId
    };

    if (data != undefined) message.data = data;

    if (this.session) message.sessionId = this.session.id;

    if (!options) options = {}; //skip sending up the options

    else message.options = options;

    if (!options.timeout) options.timeout = this.options.callTimeout; //this is not used on the server side

    if (callback) this.__requestCallback(message, callback, options, eventId); // if null we are firing and forgetting

    this.socket.write(message);
  };

  HappnClient.prototype.getChannel = function(path, action) {
    this.utils.checkPath(path, 'on');

    return '/' + action.toUpperCase() + '@' + path;
  };

  HappnClient.prototype.get = Promisify(function(path, parameters, handler) {
    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }
    this.__performDataRequest(path, 'get', null, parameters, handler);
  });

  HappnClient.prototype.getPaths = Promisify(function(path, handler) {
    this.get(path, {
      options: {
        path_only: true
      }
    }, handler);
  });

  HappnClient.prototype.increment = Promisify(function(path, gauge, increment, handler) {

    if (typeof increment == 'function') {
      handler = increment;
      increment = gauge;
      gauge = 'counter';
    }

    if (typeof gauge == 'function') {
      handler = gauge;
      increment = 1;
      gauge = 'counter';
    }

    if (isNaN(increment)) return handler(new Error('increment must be a number'));

    this.set(path, gauge, {
      increment: increment
    }, handler);
  });

  HappnClient.prototype.set = Promisify(function(path, data, options, handler) {

    if (typeof options == 'function') {
      handler = options;
      options = {};
    }

    if (data === null) options.nullValue = true; //carry across the wire

    try{//in a try/catch to catch checkPath failure
      this.utils.checkPath(path, 'set');
      this.__performDataRequest(path, 'set', data, options, handler);
    }catch(e){
      return handler(e);
    }
  });

  HappnClient.prototype.setSibling = Promisify(function(path, data, handler) {
    this.set(path, data, {
      set_type: 'sibling'
    }, handler);
  });

  HappnClient.prototype.remove = Promisify(function(path, parameters, handler) {

    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }

    return this.__performDataRequest(path, 'remove', null, parameters, handler);
  });

  HappnClient.prototype.__reattachListeners = function(callback) {

    var _this = this;

    _this.utils.async(Object.keys(_this.events), function(eventPath, index, next1) {

      var listeners = _this.events[eventPath];

      // re-establish each listener individually to preserve original meta and listenerId

      _this.utils.async(listeners, function(listener, index, next2) {

        // we don't pass any additional parameters like initialValueEmit and initialValueCallback
        var parameters = {
          refCount: 1,
          listenerId: listener.id
        };

        if (listener.meta) parameters.meta = listener.meta;

        _this._remoteOn(eventPath, parameters, function(e, response) {
          if (e) return next2(new Error('failed re-establishing listener to path: ' + eventPath, e));
          listener.referenceId = response.id;
          next2();
        });

      }, next1);

    }, callback);
  };

  HappnClient.prototype.reconnect = function(options) {

    var _this = this;

    _this.state = STATE.ACTIVE;

    _this.emit('reconnect', options);

    _this.authenticate(function(e) {

      if (_this.__reconnectSuccessful) return;

      if (e) {
        if (e.message && e.message.indexOf('api request timed out') == 0) return _this.reconnect();
        return _this.handle_error(e, true);
      }

      _this.__reattachListeners(function(e) {

        if (e) return _this.handle_error(e, true);

        _this.__reconnectSuccessful = true;

        _this.emit('reconnect-successful', options);
      });
    });
  };

  HappnClient.prototype.handle_error = function(err, fatal) {

    if (fatal == true) this.state = STATE.ERROR; //no more requests will be serviced

    var errLog = {
      timestamp: Date.now(),
      error: err,
      fatal: fatal || false
    };

    if (this.errors.length == 100) this.errors.shift();
    this.errors.push(errLog);

    this.log.error('unhandled error', err);
    this.emit('error', err);
    this.emit('fatal-error', err);
  };

  HappnClient.prototype.__attachPublishedAck = function(options, message) {

    var _this = this;

    if (typeof options.onPublished != 'function') throw new Error('onPublish handler in options is missing');

    var publishedTimeout = options.onPublishedTimeout || 60000; //default is one minute

    var ackHandler = {

      id: message.sessionId + '-' + message.eventId,

      onPublished: options.onPublished,

      handle: function(e, results) {

        clearTimeout(ackHandler.timeout);

        delete _this.__ackHandlers[ackHandler.id];

        ackHandler.onPublished(e, results);
      },

      timedOut: function() {

        ackHandler.handle(new Error('publish timed out'));
      }
    };

    ackHandler.timeout = setTimeout(ackHandler.timedOut, publishedTimeout);

    _this.__ackHandlers[ackHandler.id] = ackHandler;
  };

  HappnClient.prototype.handle_ack = function(message) {

    var _this = this;

    if (_this.__ackHandlers[message.id]) {

      if (message.status == 'error') return _this.__ackHandlers[message.id].handle(new Error(message.error), message.result);

      _this.__ackHandlers[message.id].handle(null, message.result);
    }
  };

  HappnClient.prototype.handle_publication = function(message) {

    if (message.encrypted) {

      if (message._meta && message._meta.type == 'login') message = this.__decryptLogin(message);

      else message = this.__decryptPayload(message.encrypted);
    }

    if (message._meta && message._meta.type == 'system') return this.__handleSystemMessage(message);

    if (message._meta && message._meta.type == 'data') return this.handle_data(message._meta.channel, message);

    if (message._meta && message._meta.type == 'ack') return this.handle_ack(message);

    if (Array.isArray(message)) this.handle_response_array(null, message, message.pop());

    else if (message._meta.status == 'error') {

      var error = message._meta.error;

      var e = new Error();

      e.name = error.name || error.message || error;

      Object.keys(error).forEach(function(key) {
        if (!e[key]) e[key] = error[key];
      });

      this.handle_response(e, message);
    } else {

      var decoded;

      if (message.data) {

        decoded = message.data;
        decoded._meta = message._meta;

      } else decoded = message;

      if (message.data === null) decoded._meta.nullData = true;

      this.handle_response(null, decoded);
    }
  };

  HappnClient.prototype.handle_response_array = function(e, response, meta) {

    var responseHandler = this.requestEvents[meta.eventId];
    if (responseHandler) responseHandler.handleResponse(e, response);
  };

  HappnClient.prototype.handle_response = function(e, response) {

    var responseHandler = this.requestEvents[response._meta.eventId];

    if (responseHandler) {

      if (response._meta.nullData) return responseHandler.handleResponse(e, null);

      responseHandler.handleResponse(e, response);
    }
  };

  HappnClient.prototype.__acknowledge = function(message, callback) {

    if (message._meta.consistency === this.constants.CONSISTENCY.ACKNOWLEDGED) {

      message._meta.acknowledged = true;

      return this.__performDataRequest(message.path, 'ack', message._meta.publicationId, null, function(e) {

        if (e) {
          message._meta.acknowledged = false;
          message._meta.acknowledgedError = e;
        }
        if (callback) callback(message);
      });
    }

    if (callback) callback(message);
  };

  HappnClient.prototype.delegate_handover = function(message, delegate) {

    var _this = this;

    if (delegate.count > 0 && delegate.runcount >= delegate.count) return _this.__acknowledge(message);

    delegate.runcount++;

    //consistency 3 is acknowledged
    _this.__acknowledge(message, function(acknowledged) {

      if (delegate.count > 0 && delegate.count == delegate.runcount) {

        return _this._offListener(delegate.id, function(e) {

          if (e) return _this.handle_error(e);
          delegate.handler.call(_this, acknowledged.data, acknowledged._meta);
        });
      }

      delegate.handler.call(_this, acknowledged.data, acknowledged._meta);

    }); //let the server know we received the message
  };

  HappnClient.prototype.handle_data = function(path, message) {

    var _this = this;

    if (_this.events[path]) {

      if (_this.events[path].length == 1) {
        //only one delegate - no cloning necessary
        return _this.delegate_handover(message, _this.events[path][0]);
      }

      //cloning output
      if (_this.events[path].length > 1) {
        var serializedMessage = JSON.stringify(message);

        _this.events[path].map(function(delegate) {
          _this.delegate_handover(JSON.parse(serializedMessage), delegate);
        });
      }
    }
  };

  HappnClient.prototype.__handleSystemMessage = function(message) {

    if (message.eventKey == 'server-side-disconnect') this.state = STATE.DISCONNECTED;

    this.__systemMessageHandlers.every(function(messageHandler) {
      return messageHandler.apply(messageHandler, [message.eventKey, message.data]);
    });
  };

  HappnClient.prototype.offSystemMessage = function(index) {
    this.__systemMessageHandlers.splice(index, 1);
  };

  HappnClient.prototype.onSystemMessage = function(handler) {
    this.__systemMessageHandlers.push(handler);
    return this.__systemMessageHandlers.length - 1;
  };

  HappnClient.prototype._remoteOn = function(path, parameters, callback) {
    this.__performDataRequest(path, 'on', null, parameters, callback);
  };

  HappnClient.prototype.on = Promisify(function(path, parameters, handler, callback) {

    var _this = this;

    if (typeof parameters == 'function') {
      callback = handler;
      handler = parameters;
      parameters = {};
    }

    if (!parameters) parameters = {};
    if (!parameters.event_type || parameters.event_type == '*') parameters.event_type = 'all';
    if (!parameters.count) parameters.count = 0;

    parameters.listenerId = _this.currentListenerId++;

    if (!callback) {

      if (typeof parameters.onPublished == 'function') {

        if (typeof handler != 'function') throw new Error('callback cannot be null when using the onPublished event handler');

        callback = handler;

        handler = parameters.onPublished;

      } else throw new Error('you cannot subscribe without passing in a subscription callback');
    }

    path = _this.getChannel(path, parameters.event_type);

    if (!_this.events[path]) _this.events[path] = [];

    _this._remoteOn(path, parameters, function(e, response) {

      if (e) return callback(e);

      if (response.status == 'error') return callback(response.payload);

      var listener = {
        handler: handler,
        count: parameters.count,
        id: parameters.listenerId,
        referenceId: response.id,
        runcount: 0,
        meta: parameters.meta
      };

      _this.events[path].push(listener);

      if (parameters.initialEmit && response.length > 0) {

        response.forEach(function(message, messageIndex) {
          if (messageIndex < response.length) listener.handler(message);
        });
      }

      if (parameters.onPublished) return callback(null, parameters.listenerId);

      callback(null, parameters.listenerId, response);

    });
  });

  HappnClient.prototype.onAll = Promisify(function(handler, callback) {
    this.on('*', null, handler, callback);
  });

  HappnClient.prototype._remoteOff = function(channel, referenceId, callback) {

    if (typeof referenceId == 'function') {
      callback = referenceId;
      referenceId = 0;
    }

    this.__performDataRequest(channel, 'off', null, {
      referenceId: referenceId
    }, function(e, response) {

      if (e) return callback(e);

      if (response.status == 'error') return callback(response.payload);

      callback();
    });
  };

  HappnClient.prototype._offListener = function(handle, callback) {

    var _this = this;

    if (!_this.events || _this.events.length == 0) return callback();

    var listenerFound = false;

    for (var channel in _this.events) {

      var listeners = _this.events[channel];

      if (!listeners) return callback();

      listeners.every(function(listener) {

        if (listener.id == handle) {

          listenerFound = true;
          // do a function call to create a new closure with the correct references
          doRemoteOff(channel, listeners, listener);

          return false;

        } else return true;
      });
    }

    function doRemoteOff(channel, listeners, listener) {

      _this._remoteOff(channel, listener.referenceId, function(e) {
        if (e) return callback(e);
        // Find the correct listener at the time of splice as the array could have changed.
        listeners.splice(listeners.indexOf(listener), 1);
        callback();
      });
    }

    //in case a listener with that index does not exist
    if (!listenerFound) return callback();
  };

  HappnClient.prototype._offPath = function(path, callback) {

    var _this = this;

    var listenersFound = false;

    var unsubscriptions = [];

    for (var channel in _this.events) {

      var channelParts = channel.split('@');
      var channelPath = channelParts.slice(1, channelParts.length).join('@');

      if (_this.utils.wildcardMatch(path, channelPath)) {
        listenersFound = true;
        unsubscriptions.push(channel);
      }
    }

    if (!listenersFound) return callback();

    _this.utils.async(unsubscriptions, function(channel, index, next) {
      _this._remoteOff(channel, function(e) {
        if (e) return next(e);
        delete _this.events[channel];
        next();
      });
    }, callback);

  };

  HappnClient.prototype.offAll = Promisify(function(callback) {
    var _this = this;

    return _this._remoteOff('*', function(e) {

      if (e) return callback(e);

      _this.events = {};

      callback();
    });
  });

  HappnClient.prototype.off = Promisify(function(handle, callback) {

    if (handle == null) return callback(new Error('handle cannot be null'));

    if (typeof handle != 'number') return callback(new Error('handle must be a number'));

    this._offListener(handle, callback);
  });

  HappnClient.prototype.offPath = Promisify(function(path, callback) {

    if (typeof path == 'function') {
      callback = path;
      path = '*';
    }

    return this._offPath(path, callback);
  });

  HappnClient.prototype.__connectionCleanup = function() {

    try {

      if (this.socket) this.socket.end();

    } catch (e) {
      this.log.warn('socket.end failed in client: ' + e.toString());
    }
  };

  HappnClient.prototype.revokeSession = Promisify(function(callback) {

    this.__performSystemRequest('revoke-session', null, null, callback);
  });

  HappnClient.prototype.disconnect = Promisify(function(options, callback) {

    if (typeof options === 'function') {
      callback = options;
      options = null;
    }

    if (!options) options = {};

    if (!options.timeout) options.timeout = 60000; //one minute to disconnect

    if (!callback) callback = function() {};

    var _this = this;

    if (_this.disconnectTimeout) clearTimeout(_this.disconnectTimeout);

    if (_this.state == STATE.DISCONNECTED || _this.state == STATE.CONNECTING || _this.state == STATE.CONNECT_ERROR) {
      _this.__connectionCleanup(); // end() anyway to ensure reconnect loop is stopped
      return callback();
    }

    _this.disconnectTimeout = setTimeout(function() {

      _this.log.warn('disconnect timeout hit');

      if (_this.state !== STATE.DISCONNECTING && _this.socket != null) _this.__connectionCleanup(); //try again, the disconnect call never came back

      if (callback) callback(new Error('disconnect timed out'));

    }, options.timeout);

    _this.__systemMessageHandlers = [];

    _this.eventHandlers = {};

    if (_this.socket != null) {

      _this.socket.removeAllListeners('end');

      _this.socket.once('end', function() {

        clearTimeout(_this.disconnectTimeout);

        _this.state = STATE.DISCONNECTED;

        return callback();
      });

      if (_this.state !== STATE.ACTIVE && _this.state !== STATE.CONNECTED) {

        // only performSystemRequest('disconnect' if connected
        _this.state = STATE.DISCONNECTING;

        _this.__connectionCleanup();

        return;
      }

      //notify the server that we are willfully disconnecting
      _this.__performSystemRequest('disconnect', null, options, function(e) {

        if (e) _this.log.warn('disconnect call failed');

        _this.state = STATE.DISCONNECTING;

        _this.__connectionCleanup(); //we stop reconnecting

      });

    } else _this.state = STATE.DISCONNECTED;

  });

})(); // end enclosed
