var Logger = require('happn-logger'),
  Services = require('./services/manager'),
  Promise = require('bluebird');

module.exports = {
  initialize: function(config, done) {
    console.warn(
      'use of initialize when creating happn service is deprecated. use happn.service.create'
    );
    return this.create(config, done);
  },

  create: Promise.promisify(function(config, done) {
    if (typeof config === 'function') {
      done = config;
      config = {};
    }

    if (!config.Logger && !Logger.configured) Logger.configure(config.utils);
    if (config.port == null) config.port = 55000;
    if (config.host == null) config.host = '0.0.0.0';

    var happn = {
      services: {},
      config: config,
      connections: {},
      __initialized: false
    };

    var log = (config.Logger || Logger).createLogger('HappnServer');
    log.context = happn.config.name;

    happn.log = log;

    happn.services = new Services();

    happn.stop = Promise.promisify(function(options, stopCB) {
      if (!happn.__initialized)
        log.warn('not initialized yet, trying to stop services nevertheless');

      log.$$DEBUG('stopping happn');

      if (typeof options === 'function') {
        stopCB = options;
        options = {};
      }

      return happn.services.stop(options, e => {
        if (e) return stopCB(e); // not stopping network
        log.$$DEBUG('stopped services');
        return stopCB();
      });
    });

    happn.listen = function(host, port, options, listenCB) {
      if (typeof options === 'function') {
        listenCB = options;
        options = null;
      }

      if (typeof port === 'function') {
        listenCB = port;
        port = null;
        options = null;
      }

      if (typeof host === 'function') {
        listenCB = host;
        host = null;
        options = null;
      }

      if (!host) host = happn.config.host;
      if (!port) port = happn.config.port;

      if (!happn.__initialized) return listenCB(new Error('not initialized yet'));
      return happn.services.transport.listen(host, port, options, listenCB);
    };

    happn.services.initialize(config, happn, function(e) {
      if (e) {
        console.log('Failed to initialize services', e);
        return done(e);
      }

      happn.__initialized = true;
      if (!config.deferListen) happn.listen(happn.config.host, happn.config.port, done);
      else done(null, happn);
    });
  })
};
