var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = StatsService;

function StatsService() {
  this.DEBUG = false;
}

util.inherits(StatsService, EventEmitter);

//how we collect stats from the various services and return them as a json object
StatsService.prototype.fetch = function(opts) {
  var stats = {};

  if (!opts) opts = {};

  for (var serviceName in this.happn.services) {
    stats[serviceName] = {};
    if (this.happn.services[serviceName].stats)
      stats[serviceName] = this.happn.services[serviceName].stats(opts[serviceName]);
  }

  return stats;
};

StatsService.prototype.initialize = function(config, callback) {
  if (!config) return callback();

  if (config.debug) this.DEBUG = true;

  if (config.statsServer) {
    this.__statsClient = new (require('happn-stats').StatsClient)({
      host: config.statsServer,
      port: config.statsPort,
      name: this.happn.services.system.config.name
    });
  }

  if (typeof config.interval !== 'number') config.interval = 10 * 1000; // every 10 seconds

  this.__interval = setInterval(
    function() {
      var stats = this.service.fetch(this.config.opts);

      this.service.__sendStats(stats);

      this.service.emit('system-stats', stats);

      // eslint-disable-next-line no-console
      if (this.config.print) console.log('SYSTEM STATS:::\r\n' + JSON.stringify(stats, null, 2));
    }.bind({ service: this, config: config }),
    config.interval
  );

  callback();
};

StatsService.prototype.stop = function(options, callback) {
  clearInterval(this.__statsInterval); // doesn't mattter if no interval there
  clearInterval(this.__interval);
  if (this.__statsClient) this.__statsClient.stop();
  callback();
};

StatsService.prototype.increment = function(counterName, value) {
  if (!this.__statsClient) return;
  this.__statsClient.increment(counterName, value);
};

StatsService.prototype.gauge = function(gaugeName, value) {
  if (!this.__statsClient) return;
  this.__statsClient.gauge(gaugeName, value);
};

StatsService.prototype.__sendStats = function(stats) {
  var statsClient = this.__statsClient;

  if (!statsClient) return;

  statsClient.gauge('happn.system.memory.rss', stats.system.memory.rss);
  statsClient.gauge('happn.system.memory.heapTotal', stats.system.memory.heapTotal);
  statsClient.gauge('happn.system.memory.heapUsed', stats.system.memory.heapUsed);
  statsClient.gauge('happn.system.memory.external', stats.system.memory.external);

  statsClient.gauge('happn.session.sessions', stats.session.sessions);
};
