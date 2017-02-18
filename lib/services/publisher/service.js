var path = require('path')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , async = require('async')
  , Promise = require('bluebird')
  , configurator = require('./config')
  ;

module.exports = PublisherService;

function PublisherService(opts) {

  this.log = opts.logger.createLogger('Publisher');

  this.log.$$TRACE('construct(%j)', opts);

  this.__reservedMetaKeys = [
    'created',
    'modified',
    'path',
    'action',
    'type',
    'published',
    'status',
    'eventId',
    'sessionId'
  ];

}

PublisherService.prototype.CONSISTENCY = require('./config').CONSISTENCY;

// Enable subscription to key lifecycle events
util.inherits(PublisherService, EventEmitter);

PublisherService.prototype.stats = function (opts) {
  return {}
};

PublisherService.prototype.processPublish = Promise.promisify(function(message, callback){

  try{

    return this.publish(message, function(e){
      callback(e, message);
    });

  }catch(e){
    callback(e);
  }
});

PublisherService.prototype.initialize = function (config, callback) {
  var _this = this;

  try {

    if (!config) config = {};

    if (config.timeout) config.timeout = false;

    _this.dataService = _this.happn.services.data;

    _this.securityService = _this.happn.services.security;

    _this.config = config;

  } catch (e) {
    callback(e);
  }

  callback();
};

PublisherService.prototype.__emitInitialValues = function (eventId, channel, sessionId, initialItems, protocol, callback) {

  var _this = this;

  async.eachSeries(initialItems, function(item, itemCallback){

    item._meta.action = channel.toString();
    item._meta.type = 'data';
    item._meta.status = 'ok';
    item._meta.published = false;

    _this.__emitPublication(item, channel, {clone:true, protocol:protocol}, sessionId, itemCallback);

  }, callback);
};

PublisherService.prototype.getAudienceGroup = function (channel, opts) {

  if (channel == '/ALL@*') return this.__listeners_ONALL; //listeners subscribed to everything

  if (!opts) {
    // opts is missing in calls from addListener() and removeListener()
    opts = {
      hasWildcard: channel.indexOf('*') > -1,
      targetAction: channel.split('@')[0].replace('/', '')
    }
  }

  if (opts.hasWildcard) return this['__listeners_wildcard_' + opts.targetAction];
  return this['__listeners_' + opts.targetAction];

};

PublisherService.prototype.__emitPublication = function (publication, channel, opts, sessionId, callback){

  var _this = this;

  var session = _this.happn.services.session.getSession(sessionId);

  if (opts.noCluster && session.info && session.info.clusterName)
    return callback();

  delete publication._meta.status;
  delete publication._meta.published;
  delete publication._meta.eventId;
  delete publication._meta._id;

  publication._meta.channel = channel;
  publication._meta.sessionId = sessionId;
  publication.__outbound = true;

  if (typeof opts.meta == 'object') {
    Object.keys(opts.meta).forEach(function (key) {
      if (_this.__reservedMetaKeys.indexOf(key) >= 0) return;
      publication._meta[key] = opts.meta[key];
    });
  }

  _this.happn.services.queue.pushOutbound(
    {
      raw:{
        publication:publication,
        channel:channel,
        opts:opts,
        action:'emit'
      },
      session: session
    },
    callback);

};

PublisherService.prototype.getAudienceSessions = function(sessions, opts){

  var sessionIds = Object.keys(sessions);

  if (!opts.targetClients) return sessionIds;

  return sessionIds.reduce(function(matchingSessionIds, sessionId){

    if (opts.targetClients.indexOf(sessionId) > -1) matchingSessionIds.push(sessionId);

    return matchingSessionIds;

  }, []);
};

PublisherService.prototype.emitToAudience = function (publication, recipients, opts, callback) {

  var _this = this;

  var serialized;

  async.each(audienceSessions, function(sessionId, emitCallback){
    //only JSON can make it over the wire, use JSON, more economical
    if (!serialized) serialized = JSON.stringify(publication);

    // still requires a separate copy per subscriber
    _this.__emitPublication(JSON.parse(serialized), channel, {clone:false, noCluster:opts.noCluster, meta: opts.meta}, sessionId, emitCallback);

  }, callback);

};

PublisherService.prototype.performPublication = function (publication, callback) {


};

PublisherService.prototype.publish = function (message, callback) {

  var _this = this;

  try{

    var publication = new Publication(message);

    message.publication = {
      id:publication.id
    };

    if (publication.consistency == configurator.CONSISTENCY.QUEUED){

      _this.happn.services.queue.pushPublication(publication);
      return callback(null, message);

    } else {

      //all other types of publications get processed up to whatever point consistency is set to - then response happens
      _this.happn.services.queue.pushPublication(publication, function(e){

        if (e) return callback(e);

      });
    }

  }catch(e){
    callback(e);
  }
};
