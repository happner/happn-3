var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = StatsService;

function StatsService() {}

util.inherits(StatsService, EventEmitter);

//how we collect stats from the various services and return them as a json object
StatsService.prototype.fetch = function (opts) {

  var stats = {};

  if (!opts) opts = {};

  for (var serviceName in this.happn.services) {
    stats[serviceName] = {};
    if (this.happn.services[serviceName].stats) stats[serviceName] = this.happn.services[serviceName].stats(opts[serviceName]);
  }

  return stats;
};

StatsService.prototype.initialize = function (config, callback) {

  if (!config) return callback();

  if (config.emit || config.print){

    if (!config.interval) config.interval = 10000 * 60;//every 10 minutes

    this.__interval = setInterval(function(){

      var stats = this.service.fetch(this.config.opts);

      if (this.config.emit) this.service.emit('system-stats', stats);

      if (this.config.print) console.log('SYSTEM STATS:::\r\n' + JSON.stringify(stats, null, 2));

      //path, data, options, callback
      if (this.config.db) this.service.happn.services.data.upsert('/_SYSTEM/_STATS', stats, {}, function(e){
        if (e) return console.warn('failed saving stats to db: ' + e.toString());
      })

    }.bind({service:this, config:config}), config.interval)
  }
  callback();
};

StatsService.prototype.stop = function (options, callback) {

  if (this.__interval != null) clearInterval(this.__interval);
  callback();
};
