var Promise = require('bluebird')
  , async = require('async')
  , Happn = require('../..')
  , HappnService = Happn.service
  , HappnClient = Happn.client
  , sillyname = require('sillyname')
  , uuid = require('uuid')
  ;

var happn = require('../lib/index');


function TestHelper(){

}

TestHelper.prototype.startUp = Promise.promisify(function(configs, callback){

  this.__activeServices = {};

  if (typeof configs == 'function'){
    callback = configs;
    configs = null;
  }

  if (configs == null) return callback();

  if (!Array.isArray(configs)) return callback(new Error('configs not an Array, please pass in Array'));

  var _this = this;

  async.eachSeries(configs, function(config, configCB){
    _this.getService(config, configCB);
  }, callback);
});

TestHelper.prototype.__serviceExists = function(config){

  var nameExists = false;

  if (config.__isRemote) nameExists = this.__activeServices[config.name] != null;

  else nameExists = this.__activeServices[config.name] != null;

  if (nameExists) return true;

  for (var serviceName in this.__activeServices){
    var service = this.__activeServices[serviceName];
    if (service.config.port == config.port) return true;
  }

  return false;
};

TestHelper.prototype.getClient = Promise.promisify(function(config, callback){

  if (typeof config != 'object') return callback('cannot get a client without a config');

  if (!config.name) return callback('cannot get a client for unknown service name');

  if (!config.__testOptions) config.__testOptions = {};

  if (!config.__testOptions.clientKey) config.__testOptions.clientKey = uuid.v4();

  var _this = this;

  if (config.__testOptions.clientType == 'local') {

    if (config.__testOptions.isRemote) return new Error('you cannot have a local client with a remote service');

    var serviceInstance = _this.__activeServices[config.name].instance;

    return serviceInstance.services.session.localClient(function(e, instance){

      if (e) return callback(e);

      if (_this.__activeServices[config.name].clients) _this.__activeServices[config.name].clients = [];

      _this.__activeServices[config.name].clients.push(instance);

      callback(null, instance);
    });
  }

  var clientConfig = {port:_this.__activeServices[config.name].config.port};

  if (_this.__activeServices[config.name].config.secure){

    clientConfig.username = config.username || config.__testOptions.username || '_ADMIN';
    clientConfig.password = config.password || config.__testOptions.password || 'happn';
  }

  HappnClient.create(clientConfig, function (e, instance) {

    if (e) return callback(e);

    if (_this.__activeServices[config.name].clients) _this.__activeServices[config.name].clients = [];

    _this.__activeServices[config.name].clients.push(instance);

    callback(null, instance);
  });
});

TestHelper.prototype.getService = Promise.promisify(function(config, callback){

  var _this = this;

  if (typeof config == 'function'){
    callback = config;
    config = {};
  }

  if (!config.name) config.name = sillyname();

  if (!config.port) config.port = 55000;

  if (!config.__testOptions) config.__testOptions = {};

  if (_this.__serviceExists(config)) return callback(new Error('service by the name ' + config.name + ' or port ' + config.port + ' already exists'));

  if (config.__testOptions.isRemote) return _this.startRemoteService(config, function(e, process){

    if (e) return callback(e);

    _this.__activeServices[config.name] = {instance:process, config:config};

    if (config.__testOptions.getClient) return _this.getClient(config, function(e, client){

      if (e) return callback(new Error('started service ok but failed to get client: ' + e.toString()));

      callback({config:config, instance:process, client:client});
    });

    callback({config:config, instance:process});
  });

  Happner.create(config, function(e, instance){

    if (e) return callback(e);

    _this.__activeServices[config.name] = {instance:instance, config:config};

    if (config.__testOptions.getClient) return _this.getClient(config, function(e, client){

      if (e) return callback(new Error('started service ok but failed to get client: ' + e.toString()));

      callback({config:config, instance:instance, client:client});
    });

    callback({config:config, instance:instance});
  });
});

TestHelper.prototype.stopService = Promise.promisify(function(id, callback){

  if (typeof id == 'function') return id(new Error('id is necessary to stop a service.'));

  if (typeof id != 'string' && typeof id != 'number') return callback(new Error('id must be a string or number.'));

  var _this = this;

  for (var serviceId in _this.__activeServices){

    if (serviceId == id){

      var activeService = _this.__activeServices[serviceId];

      var completeStopService = function(){

        if (activeService.config.__testOptions.isRemote) {
          activeService.instance.kill();
          return callback();
        }

        return activeService.instance.stop(callback);
      };

      if (activeService.clients && activeService.clients.length > 0){

        async.eachSeries(activeService.clients, function(activeServiceClient, activeServiceClientCB){
          activeServiceClient.disconnect(activeServiceClientCB);
        }, function(e){

          if (e) {
            console.warn('unable to disconnect clients for service: ' + activeService.config.name);
          }

          completeStopService();
        })
      }

      return completeStopService();
    }
  }

  return callback(new Error('service with id ' + id + ' not found.'));
});

TestHelper.prototype.tearDown = Promise.promisify(function(options, callback){

  if (typeof options == 'function'){
    callback = options;
    options = {};
  }

  var timeout = (this.__activeServices.length + this.__activeServices.length) * 10000;

  var timedOut = false;

  if (options.ttl) {
    if (typeof options.ttl != 'number')
    timeout = options.ttl;
  }

  var timeoutHandle = setTimeout(function(){
    timedOut = true;
    return callback(new Error('tearDown timed out'));
  }, timeout);

  var _this = this;

  async.eachSeries(Object.keys(_this.__activeServices), function(activeServiceId, activeServiceId){

    if (timedOut) return activeServiceCB(new Error('timed out'));

    _this.stopService(activeServiceId, activeServiceId);

  }, function(e){

    if (!timedOut) clearTimeout(timeoutHandle);

    callback(e);
  });

});

module.exports = TestHelper;
