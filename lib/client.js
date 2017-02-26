(function () { // begin enclosed

  var browser = false;
  var Promise;
  var Logger;
  var crypto;
  var Primus;

  var PROTOCOL = "happn_{{protocol}}";

  var STATE = {
    uninitialized:0,
    active:1,
    disconnected:2,
    error:3,
    reconnecting:4,
    connecting:5,
    connected:6,
    disconnecting:7
  };

  if (typeof window !== 'undefined' && typeof document !== 'undefined') browser = true;

  // allow require when module is defined (needed for NW.js)
  if (typeof module !== 'undefined') module.exports = HappnClient;

  if (!browser) {

    Promise = require('bluebird');
    Logger = require('happn-logger');
    PROTOCOL = 'happn_' + require('../package.json').protocol;//we can access our package
    Primus = require('primus');

  } else {

    window.HappnClient = HappnClient;
    if (!Promise || typeof Promise.promisify !== 'function') {
      Promise = Promise || {};
      Promise.promisify = function (fn) {
        return fn
      };
    }
  }

  var Promisify = function (originalFunction, opts) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var _this = this;

      if (opts && opts.unshift) args.unshift(opts.unshift);

      // No promisify if last passed arg is function (ie callback)

      if (typeof args[args.length - 1] == 'function') {
        return originalFunction.apply(this, args);
      }

      return new Promise(function (resolve, reject) {
        // push false callback into arguments
        args.push(function (error, result, more) {
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
    }
  };

  function HappnClient() {

    var _this = this;

    _this.events = {};
    _this.messageEvents = {};
    _this.requestEvents = {};
    _this.currentEventId = 0;
    _this.currentListenerId = 0;
    _this.errors = [];
    _this.clientType = 'socket';
    _this.__systemMessageHandlers = [];
    _this.state = STATE.uninitialized;

    _this.eventHandlers = {};

    _this.__ackHandlers = {};

    _this.onEvent = function (eventName, eventHandler) {

      if (!eventName) throw new Error('event name cannot be blank or null');

      if (typeof eventHandler != 'function') throw new Error('event handler must be a function');

      if (!_this.eventHandlers[eventName]) _this.eventHandlers[eventName] = [];

      _this.eventHandlers[eventName].push(eventHandler);

      return eventName + '|' + (_this.eventHandlers[eventName].length - 1);
    };

    _this.offEvent = function (handlerId) {

      var eventName = handlerId.split('|')[0];

      var eventIndex = parseInt(handlerId.split('|')[1]);

      _this.eventHandlers[eventName][eventIndex] = null;

    };

    _this.emit = function (eventName, eventData) {

      if (_this.eventHandlers[eventName]) {
        _this.eventHandlers[eventName].map(function (handler) {
          if (!handler) return;
          handler.call(handler, eventData);
        });
      }
    };

    _this.__getConnection = function(callback){

      var socket;

      _this.STATE = STATE.connecting;
      _this.options.socket.manual = true;//because we want to explicitly call open()

      try{

        if (browser) socket = new Primus(_this.options.url, _this.options.socket);

        else {

            var Socket = Primus.createSocket({
              transformer: _this.options.transformer,
              parser: _this.options.parser,
              manual: true
            });

          socket = new Socket(_this.options.url, _this.options.socket);
        }

        socket.on('timeout', function () {

          if (_this.STATE === STATE.connecting) {

            _this.STATE = STATE.error;
            return callback(new Error('connection timed out'));
          }

          _this.handle_error(new Error('connection timed out'));
        });

        socket.on('open', function () {

          if (_this.STATE === STATE.connecting) {

            _this.STATE = STATE.connected;
            _this.serverDisconnected = false;

            callback(null, socket);
          }
        });

        socket.on('error', function (e) {

          if (_this.STATE === STATE.connecting) {
            // ERROR before connected,
            // ECONNREFUSED etc. out as errors on callback
            _this.STATE = STATE.error;
            return callback(e);
          }

          _this.handle_error(e);
        });

        socket.open();

      }catch(e){
        callback(e);
      }
    };
  }

  //TODO: create a shared library
  HappnClient.prototype.utils = {
    //NB: this must also change in ../utils
    wildcardMatch: function (pattern, matchTo) {

      var regex = new RegExp(pattern.replace(/[*]/g, '.*'));
      var matchResult = matchTo.match(regex);

      if (matchResult) return true;
      return false;
    },
    //taken from https://github.com/alessioalex/tiny-each-async
    async: function (arr, parallelLimit, iteratorFn, cb) {

      var pending = 0;
      var index = 0;
      var lastIndex = arr.length - 1;
      var called = false;
      var limit;
      var callback;
      var iterate;

      if (typeof parallelLimit === 'number') {
        limit = parallelLimit;
        iterate = iteratorFn;
        callback = cb || function noop() {
          };
      } else {
        iterate = parallelLimit;
        callback = iteratorFn || function noop() {
          };
        limit = arr.length;
      }

      if (!arr.length) {
        return callback();
      }

      var iteratorLength = iterate.length;

      var shouldCallNextIterator = function shouldCallNextIterator() {
        return (!called && (pending < limit) && (index < lastIndex));
      };

      var iteratorCallback = function iteratorCallback(err) {
        if (called) {
          return;
        }

        pending--;

        if (err || (index === lastIndex && !pending)) {
          called = true;

          callback(err);
        } else if (shouldCallNextIterator()) {
          processIterator(++index);
        }
      };

      var processIterator = function processIterator() {
        pending++;

        var args = (iteratorLength === 2) ? [arr[index], iteratorCallback]
          : [arr[index], index, iteratorCallback];

        iterate.apply(null, args);

        if (shouldCallNextIterator()) {
          processIterator(++index);
        }
      };

      processIterator();
    },
    clone: function (obj) {
      return JSON.parse(JSON.stringify(obj));
    },
    checkPath:function (path) {
      if (path.match(/^[a-zA-Z0-9@.//_*/-\s]+$/) == null)
        throw 'Bad path, can only contain alphanumeric characters, forward slashes, underscores @ and minus signs, and the * wildcard character ie: /this/is/an/example/of/1/with/an/_*-12hello';
    }
  };

  HappnClient.__instance = function(options){
    return new HappnClient().client(options);
  };

  HappnClient.create = Promisify(function (options, callback) {

    if (typeof options == 'function') {
      callback = options;
      options = {};
    }

    return new HappnClient().client(options).initialize(callback);
  });

  HappnClient.prototype.__prepareSecurityOptions = function(options){

    if (options.keyPair && options.keyPair.publicKey) options.publicKey = options.keyPair.publicKey;

    if (options.keyPair && options.keyPair.privateKey) options.privateKey = options.keyPair.privateKey;

  };

  HappnClient.prototype.__prepareSocketOptions = function(options){

    //backward compatibility

    if (!options.socket) options.socket = {};

    if (!options.socket.reconnect) options.socket.reconnect = {};

    if (options.reconnect) options.socket.reconnect = options.reconnect;//override, above config is very convoluted

    if (!options.socket.reconnect.retries) options.socket.reconnect.retries = Infinity;

    if (!options.socket.reconnect.max) options.socket.reconnect.max = 180000;//3 minutes

    if (options.connectTimeout) options.socket.timeout = options.connectTimeout;//default is 15 seconds

    if (!options.socket.timeout) options.socket.timeout = 10000;//default

    if (options.socket.reconnect.strategy) options.socket.strategy = options.socket.reconnect.strategy;

    if (!options.socket.strategy) options.socket.strategy = "disconnect,online,timeout";

  };

  HappnClient.prototype.__prepareOptions = function(options){

    var preparedOptions;

    if (options.config){
      //we are going to standardise here, so no more config.config
      preparedOptions = options.config;

      for (var optionProperty in options){
        if (optionProperty != 'config' && !preparedOptions[optionProperty]) preparedOptions[optionProperty] = options[optionProperty];
      }
    } else preparedOptions = options;

    if (!preparedOptions.host) preparedOptions.host = '127.0.0.1';

    if (!preparedOptions.port) preparedOptions.port = 55000;

    if (!preparedOptions.callTimeout) preparedOptions.callTimeout = 30000;//half a minute

    //this is for local client connections
    if (preparedOptions.context) Object.defineProperty(this, 'context', {value:preparedOptions.context});

    //how we override methods
    if (preparedOptions.plugin) {

      for (var overrideName in preparedOptions.plugin) {

        if (preparedOptions.plugin.hasOwnProperty(overrideName)) {

          if (preparedOptions.plugin[overrideName].bind) this[overrideName] = preparedOptions.plugin[overrideName].bind(this);

          else this[overrideName] = preparedOptions.plugin[overrideName];
        }
      }
    }

    if (!preparedOptions.url) {

      preparedOptions.protocol = preparedOptions.protocol || 'http';

      if (preparedOptions.protocol == 'http' && parseInt(preparedOptions.port) == 80) {
        preparedOptions.url = preparedOptions.protocol + '://' + preparedOptions.host;
      }
      else if (preparedOptions.protocol == 'https' && parseInt(preparedOptions.port) == 443) {

        preparedOptions.url = preparedOptions.protocol + '://' + preparedOptions.host;
      } else {

        preparedOptions.url = preparedOptions.protocol + '://' + preparedOptions.host + ':' + preparedOptions.port;
      }
    }

    this.__prepareSecurityOptions(preparedOptions);

    if (preparedOptions.allowSelfSignedCerts) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    this.__prepareSocketOptions(preparedOptions);

    if (!preparedOptions.info) preparedOptions.info = {};

    preparedOptions.info._browser = browser;

    this.options = preparedOptions;

  };

  HappnClient.prototype.client = function (options) {

    var _this = this;
    // var credentials;
    options = options || {};

    if (options.Logger && options.Logger.createLogger) {

      this.log = options.Logger.createLogger('HappnClient');
    } else if (Logger) {

      if (!Logger.configured) {
        Logger.configure(options.utils);
      }
      this.log = Logger.createLogger('HappnClient');
    } else {

      this.log = {
        $$TRACE: function (msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        $$DEBUG: function (msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        trace: function (msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        debug: function (msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        info: function (msg, obj) {
          if (obj) return console.info('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        warn: function (msg, obj) {
          if (obj) return console.warn('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        error: function (msg, obj) {
          if (obj) return console.error('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        },
        fatal: function (msg, obj) {
          if (obj) return console.error('HappnClient', msg, obj);
          console.info('HappnClient', msg);
        }
      }
    }

    this.log.$$TRACE('new client()');

    this.__prepareOptions(options);

    return _this;
  };

  HappnClient.prototype.getScript = function (url, callback) {

    if (!browser) return callback(new Error('only for browser'));

    var script = document.createElement('script');
    script.src = url;
    var head = document.getElementsByTagName('head')[0];
    var done = false;

    // Attach handlers for all browsers
    script.onload = script.onreadystatechange = function () {
      if (!done && (!this.readyState || this.readyState == 'loaded' || this.readyState == 'complete')) {
        done = true;
        script.onload = script.onreadystatechange = null;
        head.removeChild(script);
        callback();
      }
    };

    head.appendChild(script);
  };

  HappnClient.prototype.getResources = function (callback) {

    var _this = this;

    if (typeof Primus == 'undefined') _this.getScript(_this.options.url + '/browser_primus.js', function(e){
      if (e) return callback(e);

      if (typeof Primus == 'undefined'){

        if (window && window.Primus) Primus = window.Primus;
        else if (document && document.Primus) Primus = document.Primus;
        else return callback(new Error('unable to fetch Primus library'));

        callback();
      }
    });

    else callback();

  };

  HappnClient.prototype.initialize = Promisify(function (callback) {

    var _this = this;

    if (browser) {

      return _this.getResources(function (e) {

        if (e) return callback(e);

        _this.authenticate(function (e) {

          if (e) return callback(e);

          _this.state = STATE.active;

          callback(null, _this);
        });
      });
    }

    _this.authenticate(function (e) {
      if (e) return callback(e);

      _this.state = STATE.active;

      callback(null, _this);
    });
  });


  HappnClient.prototype.stop = Promisify(function (callback) {
    this.socket.on('end', callback);
    this.socket.end();
  });

  HappnClient.prototype.__encryptLogin = function (parameters, publicKey) {

    return {
      encrypted: crypto.asymmetricEncrypt(publicKey, this.options.privateKey, JSON.stringify(parameters)),
      publicKey: parameters.publicKey,
      loginType: parameters.loginType != null?parameters.loginType:'password'
    }
  };

  HappnClient.prototype.__decryptLogin = function (loginResult) {

    try {
      return JSON.parse(crypto.asymmetricDecrypt(this.serverInfo.publicKey, this.options.privateKey, loginResult.encrypted));
    } catch (e) {
      throw e;
    }
  };

  HappnClient.prototype.__encryptPayload = function (message) {
    return {
      sessionId: message.sessionId,
      encrypted: crypto.symmetricEncryptObject(message, this.session.secret)
    }
  };

  HappnClient.prototype.__decryptPayload = function (message) {

    var payload =  crypto.symmetricDecryptObject(message, this.session.secret);
    return payload;
  };

  HappnClient.prototype.__ensureCryptoLibrary = Promisify(function (callback) {

    if (crypto) return callback();

    if (browser) {
      this.getScript(this.options.url + '/browser_crypto.js', function (e) {
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


  HappnClient.prototype.__attachSession = function(result){

    delete result._meta;
    this.session = result;

    //write our session cookie
    if (browser) {
      var cookie = (result.cookieName || 'happn_token') + '=' + this.session.token + '; path=/;';
      if (result.cookieDomain) cookie += ' domain=' + result.cookieDomain + ';';
      document.cookie = cookie;
    }

  };

  HappnClient.prototype.__doLogin = function(loginParameters, callback){

    var _this = this;

    _this.__performSystemRequest('login', loginParameters, null, function (e, result) {

      if (e) return callback(e);

      if (result._meta.status == 'ok') {
        _this.__attachSession(result);
        callback();
      } else callback(result.payload); // TODO: make into instanceof Error

    });
  };

  HappnClient.prototype.__signNonce = function(nonce){
    return crypto.sign(nonce, this.options.privateKey);
  };

  HappnClient.prototype.__prepareLogin = function(loginParameters, callback){

    var _this = this;

    var prepareCallback = function(prepared){

      if (_this.serverInfo.encryptPayloads) prepared = _this.__encryptLogin(prepared, _this.serverInfo.publicKey);
      callback(null, prepared);
    };

    if (loginParameters.loginType == 'digest'){

      _this.__performSystemRequest('request-nonce', {publicKey:loginParameters.publicKey}, null, function (e, response) {

        if (e) return callback(e);

        loginParameters.digest = _this.__signNonce(response.nonce);
        prepareCallback(loginParameters);

      });

    } else prepareCallback(loginParameters);


  };

  HappnClient.prototype.login = Promisify(function (callback) {

    var _this = this;

    var loginParameters = {
      username: this.options.username,
      info: this.options.info,
      protocol:PROTOCOL
    };

    loginParameters.info._browser = browser;
    loginParameters.info._local = _this.socket._local?true:false;

    if (this.options.password) loginParameters.password = this.options.password;

    if (this.options.publicKey) loginParameters.publicKey = this.options.publicKey;

    if (this.options.token) loginParameters.token = this.options.token;

    if (PROTOCOL === 'happn_{{protocol}}') PROTOCOL = 'happn';//if this file is being used without a replace on the protocol

    _this.__performSystemRequest('configure-session', {protocol:PROTOCOL}, null, function (e) {

      if (e) return callback(e);

      _this.__performSystemRequest('describe', null, null, function (e, serverInfo) {

        if (e) return callback(e);

        _this.serverInfo = serverInfo;

        if (_this.serverInfo.secure) {

          if (!loginParameters.username) return callback(new Error('happn server is secure, please specify a username'));

          if (!loginParameters.password && !loginParameters.token) {

            if (loginParameters.publicKey) loginParameters.loginType = 'digest';//we have a username, publicKey and password

            else return callback(new Error('happn server is secure, please specify a password'));
          }

          _this.__ensureCryptoLibrary(function (e) {

            if (e) return callback(e);

            if (!_this.options.privateKey || !_this.options.publicKey) {

              if (loginParameters.loginType === 'digest') return callback(new Error('login type is digest, but no privateKey and publicKey specified'));

              //We generate one
              var keyPair = crypto.createKeyPair();

              _this.options.publicKey = keyPair.publicKey;
              _this.options.privateKey = keyPair.privateKey;
            }

            loginParameters.publicKey = _this.options.publicKey;

            _this.__prepareLogin(loginParameters, function(e, preparedParameters){

              if (e) return callback(e);

              _this.__doLogin(preparedParameters, callback);
            });
          });

        } else _this.__doLogin(loginParameters, callback);

      });
    });
  });

  HappnClient.prototype.authenticate = Promisify(function (callback) {

    var _this = this;

    if (_this.socket) {
      // handle_reconnection also call through here to 're-authenticate'.
      // This is that happending. Don't make new soket.
      //
      // TODO: What happnes if this reconnection login fails?
      //       Who gets told?
      //       How?
      _this.login(callback);
      return;
    }

    _this.__getConnection(function(e, socket){

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

  HappnClient.prototype.handle_end = function () {

    this.state = STATE.disconnected;

    if (this.session) this.emit('connection-ended', this.session.id);
    else this.emit('connection-ended');
  };

  HappnClient.prototype.handle_reconnect_timeout = function (err, opts) {

    this.state = STATE.disconnected;
    this.emit('reconnect-timeout', {err: err, opts: opts});
  };

  HappnClient.prototype.handle_reconnect_scheduled = function (opts) {

    this.state = STATE.reconnecting;
    this.emit('reconnect-scheduled', opts)
  };

  HappnClient.prototype.getEventId = function () {

    return this.currentEventId += 1;
  };

  HappnClient.prototype.__requestCallback = function(message, callback, options, eventId, path, action){

    var callbackHandler = {
      eventId: message.eventId,
      client: this,
      handler: callback
    };

    callbackHandler.handleResponse = function (e, response) {

      clearTimeout(this.timedout);
      delete this.client.requestEvents[this.eventId];
      return this.handler(e, response);

    }.bind(callbackHandler);

    callbackHandler.timedout = setTimeout(function () {

      delete this.client.requestEvents[this.eventId];

      var errorMessage = 'api request timed out';

      if (path) errorMessage += ' path: ' + path;

      if (action) errorMessage += ' action: ' + action;

      return this.handler(new Error(errorMessage));

    }.bind(callbackHandler), options.timeout);

    //we add our event handler to a queue, with the embedded timeout
    this.requestEvents[eventId] = callbackHandler;
  };

  HappnClient.prototype.__performDataRequest = function (path, action, data, options, callback) {

    if (this.state != STATE.active){

      if (this.state === STATE.error) return callback(new Error('client in an error state.'));
      if (this.state === STATE.uninitialized) return callback(new Error('client not initialized yet.'));
      if (this.state === STATE.disconnected) return callback(new Error('client is disconnected'));

      return callback(new Error('client not active'));
    }

    var eventId = this.getEventId();

    var message = {
      action: action,
      eventId: eventId,
      path: path,
      data: data,
      sessionId: this.session.id
    };

    if (!options) options = {};//skip sending up the options

    else message.options = options;

    if (['set','remove'].indexOf(action) >= 0 && options.consistency == 0) this.__attachPublishedAck(options, message);

    if (!options.timeout) options.timeout = this.options.callTimeout;

    if (this.serverInfo.encryptPayloads) message = this.__encryptPayload(message);

    if (callback) this.__requestCallback(message, callback, options, eventId, path, action);// if null we are firing and forgetting

    this.socket.write(message);

  };

  HappnClient.prototype.__performSystemRequest = function (action, data, options, callback) {

    //'login', 'describe', 'request-nonce','configure-session'

    var eventId = this.getEventId();

    var message = {'action': action, 'eventId': eventId};

    if (data != undefined) message.data = data;

    if (this.session) message.sessionId = this.session.id;

    if (!options) options = {};//skip sending up the options

    else message.options = options;

    if (!options.timeout) options.timeout = this.options.callTimeout;//this is not used on the server side

    if (callback) this.__requestCallback(message, callback, options, eventId);// if null we are firing and forgetting

    this.socket.write(message);
  };

  HappnClient.prototype.getChannel = function (path, action) {
    this.utils.checkPath(path);

    return '/' + action.toUpperCase() + '@' + path;
  };

  HappnClient.prototype.get = Promisify(function (path, parameters, handler) {
    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }
    this.__performDataRequest(path, 'get', null, parameters, handler);
  });

  HappnClient.prototype.getPaths = Promisify(function (path, handler) {
    this.get(path, {options: {path_only: true}}, handler);
  });

  HappnClient.prototype.set = Promisify(function (path, data, options, handler) {

    if (typeof options == 'function') {
      handler = options;
      options = {};
    }

    if (data === null) options.nullValue = true; //carry across the wire

    this.__performDataRequest(path, 'set', data, options, handler);
  });

  HappnClient.prototype.setSibling = Promisify(function (path, data, handler) {
    this.set(path, data, {set_type: 'sibling'}, handler);
  });

  HappnClient.prototype.remove = Promisify(function (path, parameters, handler) {
    //path, action, data, parameters, callback
    if (typeof parameters == 'function') {
      handler = parameters;
      parameters = {};
    }
    return this.__performDataRequest(path, 'remove', null, parameters, handler);
  });

  HappnClient.prototype.reconnect = function (options) {
    var _this = this;

    _this.state = STATE.active;

    _this.authenticate(function (e) {

      if (e) return _this.handle_error(e, 3);

      Object.keys(_this.events).forEach(function (eventPath) {
        var listeners = _this.events[eventPath];
        //only refCount - so we not passing any additional parameters like initialValueEmit and initialValueCallback
        _this._remoteOn(eventPath, {'refCount': listeners.length}, function (e) {
          if (e) _this.handle_error(e, 3);
        });
      });

      _this.emit('reconnect-successful', options)
    });
  };

  HappnClient.prototype.handle_error = function (err, severity) {

    if (!severity) severity = 1;

    if (this.errors.length >= 100) this.errors.splice(err, this.errors.length - 1, 1)
    else this.errors.push(err);

    this.log.error('unhandled error', err);
    this.state = STATE.error;

  };

  HappnClient.prototype.__attachPublishedAck = function(options, message){

    var _this = this;

    if (typeof options.onPublished != 'function') throw new Error('onPublish handler in options is missing');

    var publishedTimeout = options.onPublishedTimeout || 60000; //default is one minute

    var ackHandler = {

      id: message.sessionId + '-' + message.eventId,

      onPublished: options.onPublished,

      handle: function (e, results) {

        clearTimeout(this.timeout);

        delete _this.__ackHandlers[this.id];

        this.onPublished(e, results);
      },

      timedOut: function () {

        this.handle(new Error('publish timed out'));
      }
    };

    ackHandler.timeout = setTimeout(ackHandler.timedOut.bind(ackHandler), publishedTimeout);

    _this.__ackHandlers[ackHandler.id] = ackHandler;
  };

  HappnClient.prototype.handle_ack = function(message){

    var _this = this;

    if (_this.__ackHandlers[message.id]){

      // _this.__ackHandlers[message.id].timedOut = _this.__ackHandlers[message.id].timedOut.bind(_this.__ackHandlers[message.id]);
      // _this.__ackHandlers[message.id].handle = _this.__ackHandlers[message.id].handle.bind(_this.__ackHandlers[message.id]);

      if (message.status == 'error'){
        _this.__ackHandlers[message.id].handle(new Error(message.error), message.result);
      } else {
        _this.__ackHandlers[message.id].handle(null, message.result);
      }
    }
  };

  HappnClient.prototype.handle_publication = function (message) {

    if (message.encrypted){

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

      Object.keys(error).forEach(function (key) {
        if (!e[key]) e[key] = error[key];
      });

      this.handle_response(e, message);
    }

    else {

      var decoded;

      if (message.data) {

        decoded = message.data;
        decoded._meta = message._meta;

      } else decoded = message;

      if (message.data === null) decoded._meta.nullData = true;

      this.handle_response(null, decoded);
    }
  };

  HappnClient.prototype.handle_response_array = function (e, response, meta) {

    var responseHandler = this.requestEvents[meta.eventId];
    if (responseHandler) responseHandler.handleResponse(e, response);
  };

  HappnClient.prototype.handle_response = function (e, response) {

    var responseHandler = this.requestEvents[response._meta.eventId];

    if (responseHandler) {

      if (response._meta.nullData) return responseHandler.handleResponse(e, null);

      responseHandler.handleResponse(e, response);
    }
  };

  HappnClient.prototype.delegate_handover = function (message, delegate) {

    var _this = this;

    delegate.runcount++;

    if (delegate.count > 0 && delegate.count == delegate.runcount) {
      return _this._offListener(delegate.id, function (e) {

        if (e) return _this.handle_error(e);
        delegate.handler.call(_this, message.data, message._meta);
      });
    }

    delegate.handler.call(_this, message.data, message._meta);
  };

  HappnClient.prototype.handle_data = function (path, message) {

    var _this = this;

    if (_this.events[path]) {

      if (_this.events[path].length == 1) {
        //only one delegate - no cloning necessary
        return _this.delegate_handover(message, _this.events[path][0]);
      }

      if (_this.events[path].length > 1) {
        var serializedMessage = JSON.stringify(message);

        _this.events[path].map(function (delegate) {
          _this.delegate_handover(JSON.parse(serializedMessage), delegate);
        });
      }
    }
  };

  HappnClient.prototype.__handleSystemMessage = function (message) {

    if (message.eventKey == 'server-side-disconnect'){
      this.state = STATE.disconnected;
    }

    this.__systemMessageHandlers.every(function (messageHandler) {
      return messageHandler.apply(messageHandler, [message.eventKey, message.data]);
    });
  };

  HappnClient.prototype.offSystemMessage = function (index) {
    this.__systemMessageHandlers.splice(index, 1);
  };

  HappnClient.prototype.onSystemMessage = function (handler) {
    this.__systemMessageHandlers.push(handler);
    return this.__systemMessageHandlers.length - 1;
  };

  HappnClient.prototype._remoteOn = function (path, parameters, callback) {
    this.__performDataRequest(path, 'on', null, parameters, callback);
  };

  HappnClient.prototype.on = Promisify(function (path, parameters, handler, callback) {

    var _this = this;

    if (typeof parameters == 'function') {
      callback = handler;
      handler = parameters;
      parameters = {};
    }

    if (!parameters) parameters = {};
    if (!parameters.event_type || parameters.event_type == '*') parameters.event_type = 'all';
    if (!parameters.count) parameters.count = 0;

    if (!callback) {

      if (typeof parameters.onPublished == 'function'){

        if (typeof handler != 'function') throw new Error('callback cannot be null when using the onPublished event handler');

        callback = handler;

        handler = parameters.onPublished;

      } else throw new Error('you cannot subscribe without passing in a subscription callback');
    }

    path = _this.getChannel(path, parameters.event_type);

    parameters.listenerId = _this.currentListenerId++;

    parameters.refCount = 1;//this should always be 1 for a single subscription

    if (!_this.events[path]) _this.events[path] = [];

    var listener = {handler: handler, count: parameters.count, id: parameters.listenerId, runcount: 0};

    _this.events[path].push(listener);

    _this._remoteOn(path, parameters, function (e, response) {

      if (e) {

        //if the remote subscription fails, we need to remove the subscription

        for (var listenerIndex in _this.events[path]){

          var listenerToRemove = _this.events[path][listenerIndex];

          if (listenerToRemove.id == parameters.listenerId){
            _this.events[path].splice(listenerIndex, 1);
            break;
          }
        }

        if (_this.events[path].length == 0) delete _this.events[path];

        return callback(e);
      }

      if (response.status == 'error') return callback(response.payload);

      if (parameters.onPublished) return callback(null, parameters.listenerId);

      callback(null, parameters.listenerId, response);

    });
  });

  HappnClient.prototype.onAll = Promisify(function (handler, callback) {
    this.on('*', null, handler, callback);
  });

  HappnClient.prototype._remoteOff = function (channel, refCount, listenerId, callback) {

    if (typeof listenerId == 'function'){
      callback = listenerId;
      listenerId = -1;
    }

    this.__performDataRequest(channel, 'off', null, {'refCount': refCount, listenerId:listenerId}, function (e, response) {

      if (e) return callback(e);

      if (response.status == 'error') return callback(response.payload);

      callback();
    });
  };

  HappnClient.prototype._offListener = function (listenerId, callback) {
    var _this = this;

    if (!_this.events || _this.events.length == 0) return callback();

    var listenerFound = false;

    for (var channel in _this.events) {
      var listeners = _this.events[channel];

      if (!listeners) return callback();

      listeners.every(function (listener) {
        if (listener.id == listenerId) {
          listenerFound = true;
          // do a function call to create a new closure with the correct references
          doRemoteOff(channel, listeners, listener);
          return false;
        } else return true;
      });
    }

    function doRemoteOff(channel, listeners, listener) {

      _this._remoteOff(channel, 1, listener.id, function (e) {
        if (e)
          return callback(e);
        // Find the correct listener at the time of splice as the array could have changed.
        listeners.splice(listeners.indexOf(listener), 1);
        callback();
      });
    }

    //in case a listener with that index does not exist
    if (!listenerFound) return callback();
  };

  HappnClient.prototype._offPath = function (path, callback) {
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
      _this._remoteOff(channel, _this.events[channel].length, function (e) {
        if (e)
          return next(e);
        delete _this.events[channel];
        next();
      });
    }, callback);

  };

  HappnClient.prototype.offAll = Promisify(function (callback) {
    var _this = this;

    return _this._remoteOff('*', 0, function (e) {
      if (e)
        return callback(e);

      _this.events = {};
      callback();
    });
  });

  HappnClient.prototype.off = Promisify(function (handle, callback) {

    if (handle == null || handle == undefined) return callback(new Error('handle or callback cannot be null'));

    if (typeof handle == 'function') return this.offPath(handle);

    if (typeof handle == 'number') return this._offListener(handle, callback);

    console.warn('.off with a path is deprecated, please use the offPath method for a path based unsubscribe');

    return this._offPath(handle, callback);
  });

  HappnClient.prototype.offPath = Promisify(function (path, callback) {

    if (typeof path == 'function') {
      callback = path;
      path = '*';
    }

    return this._offPath(path, callback);
  });

  HappnClient.prototype.disconnect = Promisify(function (options, callback) {

    if (typeof options === 'function'){
      callback = options;
      options = null;
    }

    if (!options) options = {};

    if (!options.timeout) options.timeout = 60000;//one minute to disconnect

    if (!callback) callback = function(){};

    var _this = this;

    if (_this.disconnectTimeout) clearTimeout(_this.disconnectTimeout);

    _this.disconnectTimeout = setTimeout(function(){

      _this.log.warn('disconnect timeout hit');

      if (_this.state !== STATE.disconnecting) _this.socket.end();//try again, the disconnect call never came back

      if (callback) callback(new Error('disconnect timed out'));

    }, options.timeout);

    _this.__systemMessageHandlers = [];

    _this.eventHandlers = {};

    _this.socket.removeAllListeners('end');

    _this.socket.on('end', function () {

      clearTimeout(_this.disconnectTimeout);

      _this.state = STATE.disconnected;

      return callback();
    });

    _this.__performSystemRequest('disconnect', null, null, function (e) {

      if (e) _this.log.warn('disconnect call failed');

      _this.state = STATE.disconnecting;
      _this.socket.end();//we stop reconnecting

    });
  });

})(); // end enclosed

