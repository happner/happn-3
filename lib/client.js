/* eslint-disable no-console */
(function() {
  // begin enclosed

  var browser = false;
  var Promise;
  var Logger;
  var crypto;
  var Primus;

  var PROTOCOL = 'happn_{{protocol}}';
  var STATUS;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') browser = true;

  // allow require when module is defined (needed for NW.js)
  if (typeof module !== 'undefined') module.exports = HappnClient;

  if (!browser) {
    Promise = require('bluebird');

    Logger = require('happn-logger');
    PROTOCOL = 'happn_' + require('../package.json').protocol; //we can access our package
    Primus = require('happn-primus-wrapper');
  } else {
    window.HappnClient = HappnClient;

    Primus = window.Primus;

    //Promise polyfill
    if (!Promise || typeof Promise.promisify !== 'function') {
      Promise = Promise || {};
      Promise.promisify = function(fn) {
        return fn;
      };
    }
    // Object.assign polyfill for IE11 (from mozilla)
    if (typeof Object.assign !== 'function') {
      Object.defineProperty(Object, 'assign', {
        value: function assign(target) {
          'use strict';
          if (target === null || target === undefined) {
            throw new TypeError('Cannot convert undefined or null to object');
          }
          var to = Object(target);
          for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];

            if (nextSource !== null && nextSource !== undefined) {
              for (var nextKey in nextSource) {
                // Avoid bugs when hasOwnProperty is shadowed
                if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                  to[nextKey] = nextSource[nextKey];
                }
              }
            }
          }
          return to;
        },
        writable: true,
        configurable: true
      });
    }
  }

  var Promisify = function(originalFunction, opts) {
    return function() {
      var args = Array.prototype.slice.call(arguments);
      var _this = this;

      if (opts && opts.unshift) args.unshift(opts.unshift);

      // No promisify if last passed arg is function (ie callback)

      if (typeof args[args.length - 1] === 'function') {
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

  function HappnClient() {
    if (!browser) {
      this.constants = require('./constants');
      this.utils = require('./services/utils/shared');
    }

    //DO NOT DELETE
    //{{constants}}

    //DO NOT DELETE
    //{{utils}}

    STATUS = this.constants.CLIENT_STATE;
  }

  HappnClient.__instance = function(options) {
    return new HappnClient().client(options);
  };

  HappnClient.create = Promisify(function(connection, options, callback) {
    if (typeof connection === 'function') {
      callback = connection;
      options = {};
      connection = null;
    }

    if (typeof options === 'function') {
      callback = options;
      options = connection ? connection : {};
      connection = null;
    }

    if (!options) options = connection;

    var client = new HappnClient().client(options);

    if (options.testMode) HappnClient.lastClient = client;

    return client.initialize(function(err, createdClient) {
      if (!err) return callback(null, createdClient);

      if (client.state.clientType !== 'eventemitter')
        return client.disconnect(function() {
          callback(err);
        });

      client.socket.disconnect();
      callback(err);
    });
  });

  HappnClient.prototype.client = function(options) {
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
    this.__initializeState(); //local properties
    this.__prepareInstanceOptions(options);
    this.__initializeEvents(); //client events (connect/disconnect etc.)

    return this;
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

          _this.status = STATUS.ACTIVE;

          callback(null, _this);
        });
      });
    }

    _this.authenticate(function(e) {
      if (e) return callback(e);

      _this.status = STATUS.ACTIVE;

      callback(null, _this);
    });
  });

  HappnClient.prototype.__prepareSecurityOptions = function(options) {
    if (options.keyPair && options.keyPair.publicKey) options.publicKey = options.keyPair.publicKey;

    if (options.keyPair && options.keyPair.privateKey)
      options.privateKey = options.keyPair.privateKey;
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

    if (options.socket.reconnect.strategy)
      options.socket.strategy = options.socket.reconnect.strategy;

    if (!options.socket.strategy) options.socket.strategy = 'disconnect,online,timeout';
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

      if (options.protocol === 'http' && parseInt(options.port) === 80) {
        options.url = options.protocol + '://' + options.host;
      } else if (options.protocol === 'https' && parseInt(options.port) === 443) {
        options.url = options.protocol + '://' + options.host;
      } else {
        options.url = options.protocol + '://' + options.host + ':' + options.port;
      }
    }

    return options;
  };

  HappnClient.prototype.__prepareInstanceOptions = function(options) {
    var preparedOptions;

    if (options.config) {
      //we are going to standardise here, so no more config.config
      preparedOptions = options.config;

      for (var optionProperty in options) {
        if (optionProperty !== 'config' && !preparedOptions[optionProperty])
          preparedOptions[optionProperty] = options[optionProperty];
      }
    } else preparedOptions = options;

    if (!preparedOptions.callTimeout) preparedOptions.callTimeout = 60000; //1 minute

    //this is for local client connections
    if (preparedOptions.context)
      Object.defineProperty(this, 'context', {
        value: preparedOptions.context
      });

    //how we override methods
    if (preparedOptions.plugin) {
      for (var overrideName in preparedOptions.plugin) {
        // eslint-disable-next-line no-prototype-builtins
        if (preparedOptions.plugin.hasOwnProperty(overrideName)) {
          if (preparedOptions.plugin[overrideName].bind)
            this[overrideName] = preparedOptions.plugin[overrideName].bind(this);
          else this[overrideName] = preparedOptions.plugin[overrideName];
        }
      }
    }

    preparedOptions = this.__prepareConnectionOptions(preparedOptions);

    this.__prepareSecurityOptions(preparedOptions);

    if (preparedOptions.allowSelfSignedCerts) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    this.__prepareSocketOptions(preparedOptions);

    var info = preparedOptions.info != null ? preparedOptions.info : {};

    if (typeof info !== 'object')
      info = {
        data: info
      };

    preparedOptions.info = info;

    preparedOptions.info._browser = browser;

    if (preparedOptions.loginRetry == null) preparedOptions.loginRetry = 4; // will attempt to login to the same address 4 times

    if (preparedOptions.loginRetryInterval == null) preparedOptions.loginRetryInterval = 5000; // five seconds apart

    if (preparedOptions.loginTimeout == null)
      preparedOptions.loginTimeout = preparedOptions.callTimeout; // will wait a minute before failing the login

    if (preparedOptions.defaultVariableDepth == null) preparedOptions.defaultVariableDepth = 5;

    this.options = preparedOptions;
  };

  HappnClient.prototype.__updateOptions = function(possibility) {
    var _this = this;

    var syncOption = function(propertyName) {
      if (possibility[propertyName] != null)
        _this.options[propertyName] = possibility[propertyName];
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

  HappnClient.prototype.__getConnection = function(callback) {
    this.__connectionCleanup();
    this.options.socket.manual = true; //because we want to explicitly call open()
    this.__connectSocket(callback);
  };

  HappnClient.prototype.__connectSocket = function(callback) {
    var socket;

    var _this = this;

    _this.status = STATUS.CONNECTING;

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
      if (_this.status === STATUS.CONNECTING) {
        _this.status = STATUS.CONNECT_ERROR;
        return callback(new Error('connection timed out'));
      }
      _this.handle_error(new Error('connection timed out'));
    });

    socket.on('open', function waitForConnection() {
      if (_this.status === STATUS.CONNECTING) {
        _this.status = STATUS.ACTIVE;
        _this.serverDisconnected = false;
        socket.removeListener('open', waitForConnection);
        callback(null, socket);
      }
    });

    socket.on('error', function(e) {
      if (_this.status === STATUS.CONNECTING) {
        // ERROR before connected,
        // ECONNREFUSED etc. out as errors on callback
        _this.status = STATUS.CONNECT_ERROR;

        socket
          .once('close', function() {
            setTimeout(() => {
              socket.destroy();
              callback(e.error || e);
            }, 0);
          })
          .end();
      }
      _this.handle_error(e.error || e);
    });

    socket.open();
  };

  HappnClient.prototype.__initializeState = function() {
    this.state = {};

    this.state.events = {};
    this.state.refCount = {};
    this.state.listenerRefs = {};
    this.state.requestEvents = {};
    this.state.currentEventId = 0;
    this.state.currentListenerId = 0;
    this.state.errors = [];
    this.state.clientType = 'socket';
    this.state.systemMessageHandlers = [];
    this.status = STATUS.UNINITIALIZED;
    this.state.ackHandlers = {};
    this.state.eventHandlers = {};
  };

  HappnClient.prototype.__initializeEvents = function() {
    var _this = this;

    _this.onEvent = function(eventName, eventHandler) {
      if (!eventName) throw new Error('event name cannot be blank or null');

      if (typeof eventHandler !== 'function') throw new Error('event handler must be a function');

      if (!_this.state.eventHandlers[eventName]) _this.state.eventHandlers[eventName] = [];

      _this.state.eventHandlers[eventName].push(eventHandler);

      return eventName + '|' + (_this.state.eventHandlers[eventName].length - 1);
    };

    _this.offEvent = function(handlerId) {
      var eventName = handlerId.split('|')[0];

      var eventIndex = parseInt(handlerId.split('|')[1]);

      _this.state.eventHandlers[eventName][eventIndex] = null;
    };

    _this.emit = function(eventName, eventData) {
      if (_this.state.eventHandlers[eventName]) {
        _this.state.eventHandlers[eventName].forEach(function(handler) {
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
      if (
        !done &&
        (!this.readyState || this.readyState === 'loaded' || this.readyState === 'complete')
      ) {
        done = true;
        script.onload = script.onreadystatechange = null;
        head.removeChild(script);
        callback();
      }
    };

    head.appendChild(script);
  };

  HappnClient.prototype.getResources = function(callback) {
    if (typeof Primus !== 'undefined') return callback();

    this.getScript(this.options.url + '/browser_primus.js', function(e) {
      if (e) return callback(e);

      if (typeof Primus === 'undefined') {
        if (window && window.Primus) Primus = window.Primus;
        else if (document && document.Primus) Primus = document.Primus;
        else return callback(new Error('unable to fetch Primus library'));

        callback();
      }
    });
  };

  HappnClient.prototype.stop = Promisify(function(callback) {
    this.__connectionCleanup();
    callback();
  });

  HappnClient.prototype.__encryptLogin = function(parameters, publicKey) {
    return {
      encrypted: crypto.asymmetricEncrypt(
        publicKey,
        this.options.privateKey,
        JSON.stringify(parameters)
      ),
      publicKey: parameters.publicKey,
      loginType: parameters.loginType != null ? parameters.loginType : 'password'
    };
  };

  HappnClient.prototype.__decryptLogin = function(loginResult) {
    return JSON.parse(
      crypto.asymmetricDecrypt(
        this.serverInfo.publicKey,
        this.options.privateKey,
        loginResult.encrypted
      )
    );
  };

  HappnClient.prototype.__encryptPayload = function(message) {
    var payload = crypto.symmetricEncryptObjectiv(
      message,
      this.session.secret,
      this.utils.computeiv(this.session.secret)
    );

    return {
      sessionId: message.sessionId,
      eventId: message.eventId,
      encrypted: payload
    };
  };

  HappnClient.prototype.__decryptPayload = function(message) {
    var self = this;

    var payload = crypto.symmetricDecryptObjectiv(
      message,
      self.session.secret,
      self.utils.computeiv(self.session.secret)
    );

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
      if (this.options.protocol === 'https') cookie += ' Secure;';
      if (result.cookieDomain) cookie += ' domain=' + result.cookieDomain + ';';
      if (this.options.protocol === 'https') cookie += ' Secure;';
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
      _this.__performSystemRequest(
        'login',
        loginParameters,
        {
          timeout: _this.options.loginTimeout
        },
        function(e, result) {
          if (e) return cb(e);

          if (result._meta.status === 'ok') {
            _this.__attachSession(result);
            cb();
          } else cb(_this.__payloadToError(result.payload));
        }
      );
    };

    if (!_this.options.loginRetry) return login(callback);

    if (!_this.options.loginRetryInterval || typeof _this.options.loginRetryInterval !== 'number')
      _this.options.loginRetryInterval = 5000; //just in case, someone made it 0 or -1 or blah

    var currentAttempt = 0;

    var loggedIn = false;

    _this.utils.whilst(
      function() {
        return currentAttempt < _this.options.loginRetry && loggedIn === false;
      },
      function(attempt, next) {
        currentAttempt++;

        login(function(e) {
          if (e) {
            if ([403, 401].indexOf(e.code) > -1) return next(e); //access was denied

            if (currentAttempt === _this.options.loginRetry) return next(e);

            return setTimeout(next, _this.options.loginRetryInterval);
          }

          loggedIn = true;

          return next();
        });
      },
      callback
    );
  };

  HappnClient.prototype.__signNonce = function(nonce) {
    return crypto.sign(nonce, this.options.privateKey);
  };

  HappnClient.prototype.__prepareLogin = function(loginParameters, callback) {
    var _this = this;

    var prepareCallback = function(prepared) {
      if (_this.serverInfo.encryptPayloads)
        prepared = _this.__encryptLogin(prepared, _this.serverInfo.publicKey);
      callback(null, prepared);
    };

    if (loginParameters.loginType === 'digest') {
      _this.__performSystemRequest(
        'request-nonce',
        {
          publicKey: loginParameters.publicKey
        },
        null,
        function(e, response) {
          if (e) return callback(e);

          loginParameters.digest = _this.__signNonce(response.nonce);
          prepareCallback(loginParameters);
        }
      );
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

    _this.__performSystemRequest(
      'configure-session',
      {
        protocol: PROTOCOL
      },
      null,
      function(e) {
        if (e) return callback(e);

        _this.__performSystemRequest('describe', null, null, function(e, serverInfo) {
          if (e) return callback(e);

          _this.serverInfo = serverInfo;

          if (_this.serverInfo.secure) {
            if (!loginParameters.token && !loginParameters.username)
              return callback(
                new Error('happn server is secure, please specify a username or token')
              );

            if (!loginParameters.password && !loginParameters.token) {
              if (loginParameters.publicKey) loginParameters.loginType = 'digest';
              //we have a username, publicKey and password
              else return callback(new Error('happn server is secure, please specify a password'));
            }

            if (_this.serverInfo.encryptPayloads || loginParameters.loginType === 'digest') {
              _this.__ensureCryptoLibrary(function(e) {
                if (e) return callback(e);

                if (!_this.options.privateKey || !_this.options.publicKey) {
                  if (loginParameters.loginType === 'digest')
                    return callback(
                      new Error('login type is digest, but no privateKey and publicKey specified')
                    );

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
      }
    );
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
    this.status = STATUS.DISCONNECTED;
    if (this.session) return this.emit('connection-ended', this.session.id);
    this.emit('connection-ended');
  };

  HappnClient.prototype.handle_reconnect_timeout = function(err, opts) {
    this.status = STATUS.DISCONNECTED;

    this.emit('reconnect-timeout', {
      err: err,
      opts: opts
    });
  };

  HappnClient.prototype.handle_reconnect_scheduled = function(opts) {
    this.status = STATUS.RECONNECTING;
    this.__reconnectSuccessful = false;
    this.emit('reconnect-scheduled', opts);
  };

  HappnClient.prototype.getEventId = function() {
    return (this.state.currentEventId += 1);
  };

  HappnClient.prototype.__requestCallback = function(
    message,
    callback,
    options,
    eventId,
    path,
    action
  ) {
    var _this = this;

    var callbackHandler = {
      eventId: message.eventId
    };

    callbackHandler.handleResponse = function(e, response) {
      clearTimeout(callbackHandler.timedout);
      delete _this.state.requestEvents[callbackHandler.eventId];
      return callback(e, response);
    };

    callbackHandler.timedout = setTimeout(function() {
      delete _this.state.requestEvents[callbackHandler.eventId];
      var errorMessage = 'api request timed out';
      if (path) errorMessage += ' path: ' + path;
      if (action) errorMessage += ' action: ' + action;
      return callback(new Error(errorMessage));
    }, options.timeout);

    //we add our event handler to a queue, with the embedded timeout
    _this.state.requestEvents[eventId] = callbackHandler;
  };

  HappnClient.prototype.__asyncErrorCallback = function(error, callback) {
    if (!callback) {
      throw error;
    }
    setTimeout(function() {
      callback(error);
    }, 0);
  };

  HappnClient.prototype.__performDataRequest = function(path, action, data, options, callback) {
    if (this.status !== STATUS.ACTIVE) {
      var errorMessage = 'client not active';

      if (this.status === STATUS.CONNECT_ERROR) errorMessage = 'client in an error state';
      if (this.status === STATUS.UNINITIALIZED) errorMessage = 'client not initialized yet';
      if (this.status === STATUS.DISCONNECTED) errorMessage = 'client is disconnected';

      var errorDetail = 'action: ' + action + ', path: ' + path;

      var error = new Error(errorMessage);
      error.detail = errorDetail;

      return this.__asyncErrorCallback(error, callback);
    }

    var message = {
      action: action,
      eventId: this.getEventId(),
      path: path,
      data: data,
      sessionId: this.session.id
    };

    if (!options) options = {};
    else message.options = options; //else skip sending up the options

    if (['set', 'remove'].indexOf(action) >= 0) {
      if (
        options.consistency === this.constants.CONSISTENCY.DEFERRED ||
        options.consistency === this.constants.CONSISTENCY.ACKNOWLEDGED
      )
        this.__attachPublishedAck(options, message);
    }

    if (!options.timeout) options.timeout = this.options.callTimeout;
    if (this.serverInfo.encryptPayloads) message = this.__encryptPayload(message);
    if (callback) this.__requestCallback(message, callback, options, message.eventId, path, action); // if null we are firing and forgetting

    this.socket.write(message);
  };

  HappnClient.prototype.__performSystemRequest = function(action, data, options, callback) {
    var message = {
      action: action,
      eventId: this.getEventId()
    };

    if (data !== undefined) message.data = data;

    if (this.session) message.sessionId = this.session.id;

    if (!options) options = {};
    //skip sending up the options
    else message.options = options;

    if (!options.timeout) options.timeout = this.options.callTimeout; //this is not used on the server side

    this.__requestCallback(message, callback, options, message.eventId); // if null we are firing and forgetting

    this.socket.write(message);
  };

  HappnClient.prototype.getChannel = function(path, action) {
    this.utils.checkPath(path);
    return '/' + action.toUpperCase() + '@' + path;
  };

  HappnClient.prototype.get = Promisify(function(path, parameters, handler) {
    if (typeof parameters === 'function') {
      handler = parameters;
      parameters = {};
    }
    this.__performDataRequest(path, 'get', null, parameters, handler);
  });

  HappnClient.prototype.count = Promisify(function(path, parameters, handler) {
    if (typeof parameters === 'function') {
      handler = parameters;
      parameters = {};
    }
    this.__performDataRequest(path, 'count', null, parameters, handler);
  });

  HappnClient.prototype.getPaths = Promisify(function(path, opts, handler) {
    if (typeof opts === 'function') {
      handler = opts;
      opts = {};
    }

    opts.options = {
      path_only: true
    };

    this.get(path, opts, handler);
  });

  HappnClient.prototype.increment = Promisify(function(path, gauge, increment, opts, handler) {
    if (typeof opts === 'function') {
      handler = opts;
      opts = {};
    }

    if (typeof increment === 'function') {
      handler = increment;
      increment = gauge;
      gauge = 'counter';
      opts = {};
    }

    if (typeof gauge === 'function') {
      handler = gauge;
      increment = 1;
      gauge = 'counter';
      opts = {};
    }

    if (isNaN(increment)) return handler(new Error('increment must be a number'));

    opts.increment = increment;
    this.set(path, gauge, opts, handler);
  });

  HappnClient.prototype.set = Promisify(function(path, data, options, handler) {
    if (typeof options === 'function') {
      handler = options;
      options = {};
    }

    if (data === null) options.nullValue = true; //carry across the wire

    try {
      //in a try/catch to catch checkPath failure
      this.utils.checkPath(path, 'set');
      this.__performDataRequest(path, 'set', data, options, handler);
    } catch (e) {
      return handler(e);
    }
  });

  HappnClient.prototype.setSibling = Promisify(function(path, data, opts, handler) {
    if (typeof opts === 'function') {
      handler = opts;
      opts = {};
    }

    opts.set_type = 'sibling';
    this.set(path, data, opts, handler);
  });

  HappnClient.prototype.remove = Promisify(function(path, parameters, handler) {
    if (typeof parameters === 'function') {
      handler = parameters;
      parameters = {};
    }

    return this.__performDataRequest(path, 'remove', null, parameters, handler);
  });

  HappnClient.prototype.__updateListenerRef = function(listener, remoteRef) {
    if (listener.initialEmit || listener.initialCallback)
      this.state.listenerRefs[listener.id] = remoteRef;
    else this.state.listenerRefs[listener.eventKey] = remoteRef;
  };

  HappnClient.prototype.__clearListenerRef = function(listener) {
    if (listener.initialEmit || listener.initialCallback)
      return delete this.state.listenerRefs[listener.id];
    delete this.state.listenerRefs[listener.eventKey];
  };

  HappnClient.prototype.__getListenerRef = function(listener) {
    if (listener.initialEmit || listener.initialCallback)
      return this.state.listenerRefs[listener.id];
    return this.state.listenerRefs[listener.eventKey];
  };

  HappnClient.prototype.__reattachListeners = function(callback) {
    var _this = this;

    _this.utils.async(
      Object.keys(_this.state.events),
      function(eventPath, index, nextEvent) {
        var listeners = _this.state.events[eventPath];
        _this.state.refCount = {};

        // re-establish each listener individually to preserve original meta and listener id
        _this.utils.async(
          listeners,
          function(listener, index, nextListener) {
            if (_this.state.refCount[listener.eventKey]) {
              //we are already listening on this key
              _this.state.refCount[listener.eventKey]++;
              return nextListener();
            }

            // we don't pass any additional parameters like initialValueEmit and initialValueCallback
            var parameters = {};

            if (listener.meta) parameters.meta = listener.meta;

            _this._offPath(eventPath, function(e) {
              if (e)
                return nextListener(
                  new Error(
                    'failed detaching listener to path, on re-establishment: ' + eventPath,
                    e
                  )
                );

              _this._remoteOn(eventPath, parameters, function(e, response) {
                if (e) {
                  if ([403, 401].indexOf(e.code) > -1) {
                    //permissions may have changed regarding this path
                    delete _this.state.events[eventPath];
                    return nextListener();
                  }
                  return nextListener(
                    new Error('failed re-establishing listener to path: ' + eventPath, e)
                  );
                }

                //update our ref count so we dont subscribe again
                _this.state.refCount[listener.eventKey] = 1;
                //create our mapping between the listener id and
                _this.__updateListenerRef(listener, response.id);

                nextListener();
              });
            });
          },
          nextEvent
        );
      },
      callback
    );
  };

  HappnClient.prototype.reconnect = function(options) {
    var _this = this;

    _this.status = STATUS.ACTIVE;
    _this.emit('reconnect', options);

    _this.authenticate(function(e) {
      if (_this.__reconnectSuccessful) return;

      if (e) {
        _this.handle_error(e);
        return setTimeout(_this.reconnect.bind(_this), 3000);
      }

      _this.__reattachListeners(function(e) {
        if (e) {
          _this.handle_error(e);
          return setTimeout(_this.reconnect.bind(_this), 3000);
        }
        _this.__reconnectSuccessful = true;
        _this.emit('reconnect-successful', options);
      });
    });
  };

  HappnClient.prototype.handle_error = function(err) {
    var errLog = {
      timestamp: Date.now(),
      error: err
    };

    if (this.state.errors.length === 100) this.state.errors.shift();
    this.state.errors.push(errLog);

    this.emit('error', err);
    this.log.error('unhandled error', err);
  };

  HappnClient.prototype.__attachPublishedAck = function(options, message) {
    var _this = this;

    if (typeof options.onPublished !== 'function')
      throw new Error('onPublished handler in options is missing');

    var publishedTimeout = options.onPublishedTimeout || 60000; //default is one minute

    var ackHandler = {
      id: message.sessionId + '-' + message.eventId,
      onPublished: options.onPublished,

      handle: function(e, results) {
        clearTimeout(ackHandler.timeout);
        delete _this.state.ackHandlers[ackHandler.id];
        ackHandler.onPublished(e, results);
      },
      timedout: function() {
        ackHandler.handle(new Error('publish timed out'));
      }
    };

    ackHandler.timeout = setTimeout(ackHandler.timedout, publishedTimeout);
    _this.state.ackHandlers[ackHandler.id] = ackHandler;
  };

  HappnClient.prototype.handle_ack = function(message) {
    if (this.state.ackHandlers[message.id]) {
      if (message.status === 'error')
        return this.state.ackHandlers[message.id].handle(new Error(message.error), message.result);
      this.state.ackHandlers[message.id].handle(null, message.result);
    }
  };

  HappnClient.prototype.handle_publication = function(message) {
    if (message.encrypted) {
      if (message._meta && message._meta.type === 'login') message = this.__decryptLogin(message);
      else message = this.__decryptPayload(message.encrypted);
    }

    if (message._meta && message._meta.type === 'data')
      return this.handle_data(message._meta.channel, message);

    if (message._meta && message._meta.type === 'system')
      return this.__handleSystemMessage(message);

    if (message._meta && message._meta.type === 'ack') return this.handle_ack(message);

    if (Array.isArray(message)) return this.handle_response_array(null, message, message.pop());

    if (message._meta.status === 'error') {
      var error = message._meta.error;
      var e = new Error();
      e.name = error.name || error.message || error;
      Object.keys(error).forEach(function(key) {
        if (!e[key]) e[key] = error[key];
      });
      return this.handle_response(e, message);
    }

    var decoded;
    if (message.data) {
      var meta = message._meta;
      if (Array.isArray(message.data)) decoded = message.data.slice();
      else decoded = Object.assign({}, message.data);
      decoded._meta = meta;
    } else decoded = message;

    if (message.data === null) decoded._meta.nullData = true;
    this.handle_response(null, decoded);
  };

  HappnClient.prototype.handle_response_array = function(e, response, meta) {
    var responseHandler = this.state.requestEvents[meta.eventId];
    if (responseHandler) responseHandler.handleResponse(e, response);
  };

  HappnClient.prototype.handle_response = function(e, response) {
    var responseHandler = this.state.requestEvents[response._meta.eventId];
    if (responseHandler) {
      if (response._meta.nullData) return responseHandler.handleResponse(e, null);
      responseHandler.handleResponse(e, response);
    }
  };

  HappnClient.prototype.__acknowledge = function(message, callback) {
    if (message._meta.consistency !== this.constants.CONSISTENCY.ACKNOWLEDGED)
      return callback(message);

    this.__performDataRequest(message.path, 'ack', message._meta.publicationId, null, function(e) {
      if (e) {
        message._meta.acknowledged = false;
        message._meta.acknowledgedError = e;
      } else message._meta.acknowledged = true;

      callback(message);
    });
  };

  HappnClient.prototype.delegate_handover = function(data, meta, delegate) {
    if (delegate.variableDepth && delegate.depth < meta.depth) return;
    delegate.runcount++;

    if (delegate.count === delegate.runcount) {
      var _this = this;
      return _this._offListener(delegate.id, function(e) {
        if (e) return _this.handle_error(e);
        delegate.handler.call(_this, JSON.parse(data), meta);
      });
    }

    delegate.handler.call(this, JSON.parse(data), meta);
  };

  HappnClient.prototype.handle_data = function(path, message) {
    var _this = this;

    _this.__acknowledge(message, function(acknowledged) {
      if (!_this.state.events[path]) return;

      if (acknowledged._meta.acknowledgedError)
        _this.log.error(
          'acknowledgement failure: ',
          acknowledged._meta.acknowledgedError.toString(),
          acknowledged._meta.acknowledgedError
        );

      var intermediateData = JSON.stringify(acknowledged.data);

      function doHandover(delegate) {
        _this.delegate_handover(intermediateData, acknowledged._meta, delegate);
      }

      _this.state.events[path].forEach(doHandover);
    });
  };

  HappnClient.prototype.__clearSubscriptionsOnPath = function(eventListenerPath) {
    var _this = this;

    var listeners = this.state.events[eventListenerPath];
    listeners.forEach(function(listener) {
      _this.__clearListenerState(eventListenerPath, listener);
    });
  };

  HappnClient.prototype.__clearSecurityDirectorySubscriptions = function(path) {
    var _this = this;

    Object.keys(this.state.events).forEach(function(eventListenerPath) {
      if (path === eventListenerPath.substring(eventListenerPath.indexOf('@') + 1)) {
        _this.__clearSubscriptionsOnPath(eventListenerPath);
      }
    });
  };

  HappnClient.prototype.__updateSecurityDirectory = function(message) {
    var _this = this;

    if (message.data.whatHappnd === 'permission-removed') {
      if (['*', 'on'].indexOf(message.data.action))
        return this.__clearSecurityDirectorySubscriptions(message.data.changedData.path);
    }

    if (message.data.whatHappnd === 'upsert-group') {
      Object.keys(message.data.changedData.permissions).forEach(function(permissionPath) {
        var permission = message.data.changedData.permissions[permissionPath];
        if (
          permission.prohibit &&
          (permission.prohibit.indexOf('on') > -1 || permission.prohibit.indexOf('*') > -1)
        )
          return _this.__clearSecurityDirectorySubscriptions(permissionPath);
      });
    }
  };

  HappnClient.prototype.__handleSystemMessage = function(message) {
    if (message.eventKey === 'server-side-disconnect') this.status = STATUS.DISCONNECTED;

    if (message.eventKey === 'security-data-changed') this.__updateSecurityDirectory(message);

    this.state.systemMessageHandlers.every(function(messageHandler) {
      return messageHandler.apply(messageHandler, [message.eventKey, message.data]);
    });
  };

  HappnClient.prototype.offSystemMessage = function(index) {
    this.state.systemMessageHandlers.splice(index, 1);
  };

  HappnClient.prototype.onSystemMessage = function(handler) {
    this.state.systemMessageHandlers.push(handler);
    return this.state.systemMessageHandlers.length - 1;
  };

  HappnClient.prototype._remoteOn = function(path, parameters, callback) {
    this.__performDataRequest(path, 'on', null, parameters, callback);
  };

  HappnClient.prototype.__clearListenerState = function(path, listener) {
    this.state.events[path].splice(this.state.events[path].indexOf(listener), 1);
    if (this.state.events[path].length === 0) delete this.state.events[path];
    this.state.refCount[listener.eventKey]--;
    if (this.state.refCount[listener.eventKey] === 0) delete this.state.refCount[listener.eventKey];
    this.__clearListenerRef(listener);
  };

  HappnClient.prototype.__confirmRemoteOn = function(path, parameters, listener, callback) {
    var _this = this;

    _this._remoteOn(path, parameters, function(e, response) {
      if (e || response.status === 'error') {
        _this.__clearListenerState(path, listener);
        //TODO: do we want to return something that is not an error (response.payload)
        if (response && response.status === 'error') return callback(response.payload);
        return callback(e);
      }

      if (listener.initialEmit) {
        //emit data as events immediately
        response.forEach(function(message) {
          listener.handler(message);
        });
        _this.__updateListenerRef(listener, response._meta.referenceId);
      } else if (listener.initialCallback) {
        //emit the data in the callback
        _this.__updateListenerRef(listener, response._meta.referenceId);
      } else {
        _this.__updateListenerRef(listener, response.id);
      }

      if (parameters.onPublished) return callback(null, listener.id);
      if (listener.initialCallback) return callback(null, listener.id, response);

      callback(null, listener.id);
    });
  };

  HappnClient.prototype.__getListener = function(handler, parameters, path, variableDepth) {
    return {
      handler: handler,
      count: parameters.count,
      eventKey: JSON.stringify({
        path: path,
        event_type: parameters.event_type,
        count: parameters.count,
        initialEmit: parameters.initialEmit,
        initialCallback: parameters.initialCallback,
        meta: parameters.meta,
        depth: parameters.depth
      }),
      runcount: 0,
      meta: parameters.meta,
      id: this.state.currentListenerId++,
      initialEmit: parameters.initialEmit,
      initialCallback: parameters.initialCallback,
      depth: parameters.depth,
      variableDepth: variableDepth
    };
  };

  HappnClient.prototype.on = Promisify(function(path, parameters, handler, callback) {
    if (typeof parameters === 'function') {
      callback = handler;
      handler = parameters;
      parameters = {};
    }

    var variableDepth =
      typeof path === 'string' && (path === '**' || path.substring(path.length - 3) === '/**');

    if (!parameters) parameters = {};
    if (!parameters.event_type || parameters.event_type === '*') parameters.event_type = 'all';
    if (!parameters.count) parameters.count = 0;
    if (variableDepth && !parameters.depth) parameters.depth = this.options.defaultVariableDepth; //5 by default

    if (!callback) {
      if (typeof parameters.onPublished !== 'function')
        throw new Error('you cannot subscribe without passing in a subscription callback');
      if (typeof handler !== 'function')
        throw new Error('callback cannot be null when using the onPublished event handler');
      callback = handler;
      handler = parameters.onPublished;
    }

    path = this.getChannel(path, parameters.event_type);
    var listener = this.__getListener(handler, parameters, path, variableDepth);

    if (!this.state.events[path]) this.state.events[path] = [];
    if (!this.state.refCount[listener.eventKey]) this.state.refCount[listener.eventKey] = 0;

    this.state.events[path].push(listener);
    this.state.refCount[listener.eventKey]++;

    if (
      !(
        this.state.refCount[listener.eventKey] === 1 ||
        listener.initialCallback ||
        listener.initialEmit
      )
    )
      return callback(null, listener.id);

    this.__confirmRemoteOn(path, parameters, listener, callback);
  });

  HappnClient.prototype.onAll = Promisify(function(handler, callback) {
    this.on('*', null, handler, callback);
  });

  HappnClient.prototype._remoteOff = function(channel, listenerRef, callback) {
    if (typeof listenerRef === 'function') {
      callback = listenerRef;
      listenerRef = 0;
    }

    this.__performDataRequest(
      channel,
      'off',
      null,
      {
        referenceId: listenerRef
      },
      function(e, response) {
        if (e) return callback(e);
        if (response.status === 'error') return callback(response.payload);
        callback();
      }
    );
  };

  HappnClient.prototype._offListener = function(handle, callback) {
    var _this = this;

    if (!_this.state.events || _this.state.events.length === 0) return callback();
    var listenerFound = false;

    Object.keys(_this.state.events).every(function(channel) {
      var listeners = _this.state.events[channel];

      //use every here so we can exit early
      return listeners.every(function(listener) {
        if (listener.id !== handle) return true;

        listenerFound = true;

        var listenerRef = _this.__getListenerRef(listener);
        _this.__clearListenerState(channel, listener);

        //now unsubscribe if we are off
        if (
          !_this.state.refCount[listener.eventKey] ||
          listener.initialEmit ||
          listener.initialCallback
        )
          _this._remoteOff(channel, listenerRef, callback);
        else callback();

        return false;
      });
    });
    //in case a listener with that index does not exist
    if (!listenerFound) return callback();
  };

  HappnClient.prototype._offPath = function(path, callback) {
    var _this = this;
    var unsubscriptions = [];
    var channels = [];

    Object.keys(_this.state.events).forEach(function(channel) {
      var channelParts = channel.split('@');
      var channelPath = channelParts.slice(1, channelParts.length).join('@');

      if (_this.utils.wildcardMatch(path, channelPath)) {
        channels.push(channel);
        _this.state.events[channel].forEach(function(listener) {
          unsubscriptions.push(listener);
        });
      }
    });

    if (unsubscriptions.length === 0) return callback();

    _this.utils.async(
      unsubscriptions,
      function(listener, index, next) {
        _this._offListener(listener.id, next);
      },
      function(e) {
        if (e) return callback(e);
        channels.forEach(function(channel) {
          delete _this.state.events[channel];
        });
        callback();
      }
    );
  };

  HappnClient.prototype.offAll = Promisify(function(callback) {
    var _this = this;

    return _this._remoteOff('*', function(e) {
      if (e) return callback(e);

      _this.state.events = {};
      _this.state.refCount = {};
      _this.state.listenerRefs = {};

      callback();
    });
  });

  HappnClient.prototype.off = Promisify(function(handle, callback) {
    if (handle == null) return callback(new Error('handle cannot be null'));

    if (typeof handle !== 'number') return callback(new Error('handle must be a number'));

    this._offListener(handle, callback);
  });

  HappnClient.prototype.offPath = Promisify(function(path, callback) {
    if (typeof path === 'function') {
      callback = path;
      path = '*';
    }

    return this._offPath(path, callback);
  });

  HappnClient.prototype.clearTimeouts = function() {
    var _this = this;
    Object.keys(_this.state.ackHandlers).forEach(function(handlerKey) {
      clearTimeout(_this.state.ackHandlers[handlerKey].timedout);
    });
    Object.keys(_this.state.requestEvents).forEach(function(handlerKey) {
      clearTimeout(_this.state.requestEvents[handlerKey].timedout);
    });
  };

  HappnClient.prototype.__endSocket = function() {
    this.socket.removeAllListeners('end');
    this.socket.end();
    delete this.socket;
  };

  HappnClient.prototype.__connectionCleanup = function(options) {
    try {
      if (!this.socket) return;

      if (!options || !options.revokeSession) return this.__endSocket();

      var _this = this;

      this.revokeSession(function(e) {
        if (e)
          _this.log.warn('socket.end failed in client, revoke session failed: ' + e.toString());
        _this.__endSocket();
      });
    } catch (e) {
      this.log.warn('socket.end failed in client: ' + e.toString());
    }
  };

  HappnClient.prototype.revokeSession = Promisify(function(callback) {
    this.__performSystemRequest('revoke-session', null, null, callback);
  });

  HappnClient.prototype.disconnect = Promisify(function(options, callback) {
    try {
      if (typeof options === 'function') {
        callback = options;
        options = null;
      }

      if (!options) options = {};
      if (!callback) callback = function() {};

      this.clearTimeouts();
      this.__connectionCleanup(options);

      this.state.systemMessageHandlers = [];
      this.state.eventHandlers = {};
      this.state.events = {};
      this.state.refCount = {};
      this.state.listenerRefs = {};
      this.status = STATUS.DISCONNECTED;

      callback();
    } catch (e) {
      callback(e);
    }
  });
})(); // end enclosed
