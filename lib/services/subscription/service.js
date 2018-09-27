var path = require('path'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter,
  async = require('async'),
  constants = require('../../constants'),
  TameSearch = require('tame-search'),
  Promise = require('bluebird'),
  hyperid = require('happner-hyperid').create({
    urlSafe: true
  });

module.exports = SubscriptionService;

function SubscriptionService(opts) {

  this.log = opts.logger.createLogger('Subscription');
  this.log.$$TRACE('construct(%j)', opts);
}

// Enable subscription to key lifecycle events
util.inherits(SubscriptionService, EventEmitter);

SubscriptionService.prototype.initialize = initialize;
SubscriptionService.prototype.getSubscriptionPath = getSubscriptionPath;
SubscriptionService.prototype.stats = stats;
SubscriptionService.prototype.prepareSubscribeMessage = prepareSubscribeMessage;
SubscriptionService.prototype.processSubscribe = Promise.promisify(processSubscribe);
SubscriptionService.prototype.processUnsubscribe = processUnsubscribe;
SubscriptionService.prototype.processGetRecipients = Promise.promisify(processGetRecipients);
SubscriptionService.prototype.getRecipients = getRecipients;
SubscriptionService.prototype.addListener = addListener;
SubscriptionService.prototype.removeListener = removeListener;
SubscriptionService.prototype.clearSessionSubscriptions = clearSessionSubscriptions;
SubscriptionService.prototype.allListeners = allListeners;
SubscriptionService.prototype.securityDirectoryChanged = securityDirectoryChanged;

SubscriptionService.prototype.__filterTargetRecipients = __filterTargetRecipients;
SubscriptionService.prototype.__doSubscriptionCallback = __doSubscriptionCallback;

function initialize(config, callback) {

  var _this = this;

  try {

    if (!config) config = {};

    if (!config.subscriptionTree) config.subscriptionTree = {
      searchCache: 2500, //size of LRU cache used to store search results, default 5000
      permutationCache: 2500 //size of LRU cache to store path permutations, default 5000
    };

    if (config.timeout) config.timeout = false;

    _this.dataService = _this.happn.services.data;
    _this.securityService = _this.happn.services.security;
    _this.subscriptions = TameSearch.create(config.subscriptionTree);

    _this.config = config;

    if (typeof _this.config.filter == 'function') {
      Object.defineProperty(_this, 'originalGetRecipients', {
        value: _this.getRecipients
      });
      _this.getRecipients = function(message) {
        return _this.config.filter(message, _this.originalGetRecipients(message));
      };
    }

    callback();
  } catch (e) {
    callback(e);
  }
}

function getSubscriptionPath(action, path){
  var subscriptionAction = action == 'ALL'?'*':action.toUpperCase();
  if (path.substring(0,1) == '/') return subscriptionAction + path;
  return subscriptionAction + '/' + path;
}

function stats(opts) {
  return {};
}

function prepareSubscribeMessage(message) {

  message.request.pathData = {
    parts: message.request.path.split('@')
  };

  message.request.pathData.action = message.request.pathData.parts[0].replace('/', '');

  if (message.request.pathData.parts.length > 2)
    message.request.key = message.request.pathData.parts.slice(1, message.request.pathData.parts.length).join('@');
  else if (message.request.pathData.parts.length == 1)
    message.request.key = message.request.pathData.parts[0];
  else message.request.key = message.request.pathData.parts[1];

  return message;
}

function processSubscribe(message, callback) {

  try {

    var reference = hyperid();

    this.addListener(message.request.pathData.action, message.request.key, message.session.id, {
      options: message.request.options,
      session: {
        id: message.session.id,
        protocol: message.session.protocol,
        info: message.session.info
      },
      ref: reference
    });

    return this.__doSubscriptionCallback(message, reference, callback);

  } catch (e) {
    if (e) return this.happn.services.error.handleSystem(new Error('subscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e) {
      callback(e, message);
    });
  }
}

function processUnsubscribe(message) {

  var _this = this;

  return new Promise(function(resolve, reject){
    try {
      var referenceId = false;
      if (message.request.options && message.request.options.referenceId) referenceId = message.request.options.referenceId;
      var removedReference = _this.removeListener(referenceId, message.session.id, message.request.pathData.action, message.request.key);
      message.response = {
        data: {
          id: referenceId,
          removed: removedReference
        },
        _meta: {
          status: 'ok',
          type: 'response'
        }
      };
      resolve(message);
    } catch (e) {
      _this.happn.services.error.handleSystem(new Error('unsubscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.HIGH, function(e) {
        reject(e);
      });
    }
  });
}

function processGetRecipients(message, callback) {

  try {
    message.recipients = this.getRecipients(message);
    return callback(null, message);
  } catch (e) {
    this.happn.services.error.handleSystem(new Error('get recipients failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e) {
      callback(e, message);
    });
  }
}

function __filterTargetRecipients(targetClients, recipients) {

  return recipients.filter(function(recipient) {
    return targetClients.indexOf(recipient.key) > -1;
  });
}

function getRecipients(message) {

  var recipients = this.subscriptions.search(this.getSubscriptionPath(message.request.action, message.request.path));

  if (message.request.options && message.request.options.targetClients)
    return this.__filterTargetRecipients(message.request.options.targetClients, recipients);

  return recipients;
}

function __doSubscriptionCallback(message, reference, callback) {

  var _this = this;

  var data = {
    data: {
      id: reference
    },
    _meta: {
      status: 'ok'
    }
  };

  var doCallback = function() {

    message.response = data;
    callback(null, message);
  };

  var dataPath = message.request.path.split('@')[1];

  if (message.request.options && (message.request.options.initialCallback || message.request.options.initialEmit)) {

    _this.dataService.get(dataPath, {
      sort: {
        'modified': 1
      }
    }, function(e, initialItems) {

      if (e) {
        data._meta.status = 'error';
        data.data = e.toString();
        return doCallback();
      }

      if (!initialItems) initialItems = [];

      if (initialItems && !Array.isArray(initialItems)) initialItems = [initialItems];

      data._meta.referenceId = reference;
      data.initialValues = initialItems;

      doCallback();
    });

  } else doCallback();
}

function addListener(action, path, sessionId, data) {
  data.action = action;
  data.path = path;

  if (path == '*') return this.subscriptions.subscribeAny({
    key: sessionId,
    data: data
  });

  this.subscriptions.subscribe(this.getSubscriptionPath(action, path), {
    key: sessionId,
    data: data
  });
}

function removeListener(referenceId, sessionId, action, path) {

  if (action == '*' && path == '*') return this.clearSessionSubscriptions(sessionId);

  var unsubOpts = {
    filter: {
      key: sessionId
    },
    returnRemoved:true
  };

  if (referenceId) unsubOpts.filter.data = {
    ref: referenceId
  };

  if (path == '*') return this.subscriptions.unsubscribeAll(this.getSubscriptionPath(action, path), unsubOpts);

  return this.subscriptions.unsubscribe(this.getSubscriptionPath(action, path), unsubOpts);
}

function clearSessionSubscriptions(sessionId) {

  var removedReferences = this.subscriptions.unsubscribeAll({
    filter: {
      key: sessionId
    },
    returnRemoved:true
  });

  this.emit('session-subscriptions-cleared', {
    sessionId: sessionId,
    references: removedReferences
  });

  return removedReferences;
}

function allListeners(sessionId) {

  return this.subscriptions.searchAll({
    filter: {
      "key": sessionId
    }
  });
}

function securityDirectoryChanged(whatHappnd, changedData, effectedSessions) {

  var _this = this;

  return new Promise(function(resolve, reject) {

    if (effectedSessions == null || effectedSessions.length == 0 || ['permission-removed', 'permission-upserted', 'unlink-group', 'delete-group', 'upsert-group', 'upsert-user'].indexOf(whatHappnd) == -1) return resolve(effectedSessions);

    async.each(effectedSessions, function(effectedSession, sessionCB) {
      try{
        var references = _this.allListeners(effectedSession.id);
        async.eachSeries(references, function(reference, referenceCallback) {
          _this.securityService.checkpoint._authorizeUser(effectedSession, reference.data.path, 'on', function(e, authorized) {
            if (e) return referenceCallback(e);
            if (authorized) return referenceCallback();
            referenceCallback(null, _this.removeListener(reference.data.ref, effectedSession.id, reference.data.action, reference.data.path));
          });
        }, sessionCB);
      }catch(e){
        sessionCB(e);
      }
    }, function(e) {
      if (e) return reject(e);
      resolve(effectedSessions);
    });
  });
}
