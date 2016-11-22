var async = require('async');

function ServiceManager(){

}

ServiceManager.prototype.initialize = function (config, happn, callback) {

  this.happn = happn;

  if (!config.services) config.services = {};

  if (!config.services.system) config.services.system = {};

  if (!config.services.system.config) config.services.system.config = {};

  if (config.name) config.services.system.config.name = config.name;

  var loadService = function (serviceName, serviceLoaded) {

    happn.log.$$TRACE('loadService( ' + serviceName);

    if (!config.services[serviceName]) config.services[serviceName] = {};
    if (!config.services[serviceName].path) config.services[serviceName].path = './' + serviceName + '/service.js';
    if (!config.services[serviceName].config) config.services[serviceName].config = {};

    var ServiceDefinition, serviceInstance, serviceConfig;

    serviceConfig = config.services[serviceName];

    function doServiceLoaded(e){

      if (e) {
        happn.log.error('Failed to instantiate service: ' + serviceName, e);
        return serviceLoaded(e);
      }

      happn.log.info(serviceName + ' service loaded.');

      _this.__loaded.push(serviceName);

      serviceLoaded();
    }

    if (!serviceConfig.instance) {

      try {

        ServiceDefinition = require(serviceConfig.path);
        serviceInstance = new ServiceDefinition({logger: happn.log});

      } catch (e) {

        return doServiceLoaded(e);
      }
    } else serviceInstance = serviceConfig.instance;

    serviceInstance.happn = happn;

    happn.services[serviceName] = serviceInstance;

    if (!serviceConfig.config) serviceConfig.config = {};

    if (config.secure) serviceConfig.config.secure = true;

    if (serviceInstance['initialize']) return serviceInstance.initialize(serviceConfig.config, doServiceLoaded);

    else doServiceLoaded();

  };

  var _this = this;

  _this.__loaded = [];

  var systemServices = [
    'utils',
    'error',
    'log',
    'data',
    'system',
    'cache',
    'connect',
    'crypto',
    'transport',
    'session',
    'protocol',
    'security',
    'pubsub',
    'queue',
    'layer',
    'stats'
  ];

  //these are supplementary services defiend in app-land, will always start after system services
  var appServices = [];

  Object.keys(config.services).forEach(function(serviceName){
    if (systemServices.indexOf(serviceName) == -1) appServices.push(serviceName);
  });

  async.eachSeries(systemServices, loadService,
    function(e){
      if (e) return callback(e);
      async.eachSeries(appServices, loadService, callback);
    });
};

ServiceManager.prototype.stop = function(options, callback){

  var _this = this;

  if (typeof options === 'function'){
    callback = options;
    options = {};
  }

  if (options.kill && !options.wait) options.wait = 10000;

  var kill = function () {
    process.exit(options.exitCode || 1);
  };

  if (options.kill) {
    setTimeout(function () {
      _this.happn.services.log.error('failed to stop happn, force true');
      kill();
    }, options.wait);
  }

  //we stop everything in reverse, that way primus (session service) is able to say goodbye properly before transport service
  async.eachSeries(_this.__loaded.reverse(),

    function (serviceName, stopServiceCB) {

      var serviceInstance = _this.happn.services[serviceName];

      if (serviceInstance.stop) serviceInstance.stop(options, stopServiceCB);

      else stopServiceCB();
    },
    callback
  );
};

module.exports = ServiceManager;
