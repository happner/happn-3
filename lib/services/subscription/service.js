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

SubscriptionService.prototype.initialize = function(config, callback) {

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

    _this.subscriptions = {
      'set': TameSearch.create(config.subscriptionTree),
      'remove': TameSearch.create(config.subscriptionTree),
      'all': TameSearch.create(config.subscriptionTree)
    };

    _this.config = config;

    if (typeof _this.config.filter == 'function') {

      Object.defineProperty(_this, 'originalGetRecipients', {
        value: _this.getRecipients
      });

      _this.getRecipients = function(message, getRecipientsCallback) {

        _this.originalGetRecipients(message, function(e, recipients) {

          if (e) return getRecipientsCallback(e);

          _this.config.filter(message, recipients, getRecipientsCallback);
        });
      };
    }

    callback();

  } catch (e) {

    callback(e);
  }
};

SubscriptionService.prototype.stats = function(opts) {

  var stats = {};

  return stats;
};

SubscriptionService.prototype.prepareSubscribeMessage = function(message, callback) {

  try {

    message.request.pathData = {
      parts: message.request.path.split('@')
    };

    message.request.pathData.action = message.request.pathData.parts[0].replace('/', '');

    if (message.request.pathData.parts.length > 2)
      message.request.key = message.request.pathData.parts.slice(1, message.request.pathData.parts.length).join('@');
    else if (message.request.pathData.parts.length == 1)
      message.request.key = message.request.pathData.parts[0];
    else message.request.key = message.request.pathData.parts[1];

    callback(null, message);

  } catch (e) {
    callback(e);
  }
};

SubscriptionService.prototype.processSubscribe = function(message, callback) {

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
};

SubscriptionService.prototype.processUnsubscribe = function(message, callback) {

  try {
    var referenceId = false;
    if (message.request.options && message.request.options.referenceId) referenceId = message.request.options.referenceId;
    var removedReference = this.removeListener(referenceId, message.session.id, message.request.pathData.action, message.request.key);
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
    return callback(null, message);
  } catch (e) {
    this.happn.services.error.handleSystem(new Error('unsubscribe failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.HIGH, function(e) {
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.processGetRecipients = function(message, callback) {

  try {

    var _this = this;

    _this.getRecipients(message, function(e, recipients) {

      if (e) return _this.happn.services.error.handleSystem(new Error('get recipients failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e) {
        callback(e, message);
      });

      message.recipients = recipients;

      return callback(null, message);
    });

  } catch (e) {

    this.happn.services.error.handleSystem(new Error('get recipients failed', e), 'SubscriptionService', constants.ERROR_SEVERITY.MEDIUM, function(e) {
      callback(e, message);
    });
  }
};

SubscriptionService.prototype.__filterTargetRecipients = function(targetClients, recipients, callback) {

  try {
    callback(null, recipients.filter(function(recipient) {
      return targetClients.indexOf(recipient.key) > -1;
    }));
  } catch (e) {
    callback(e);
  }
};

SubscriptionService.prototype.getRecipients = function(message, callback) {

  try {
    var recipients;
    var actionRecipients = this.subscriptions[message.request.action.toLowerCase()].search(message.request.path);
    var allRecipients = this.subscriptions.all.search(message.request.path);
    var combined = actionRecipients.concat(allRecipients);

    if (message.request.options && message.request.options.targetClients)
      return this.__filterTargetRecipients(message.request.options.targetClients, combined, callback);

    callback(null, combined);
  } catch (e) {
    callback(e);
  }
};

SubscriptionService.prototype.__doSubscriptionCallback = function(message, reference, callback) {

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

      data.initialValues = initialItems;

      doCallback();
    });

  } else doCallback();
};

SubscriptionService.prototype.addListener = function(action, path, sessionId, data) {
  data.action = action;
  data.path = path;

  var subscriptionDb = this.subscriptions[action.toLowerCase()];

  if (path == '*') return subscriptionDb.subscribeAny({
    key: sessionId,
    data: data
  });

  subscriptionDb.subscribe(path, {
    key: sessionId,
    data: data
  });
};

SubscriptionService.prototype.removeListener = function(referenceId, sessionId, action, path) {

  if (action == '*' && path == '*') return this.clearSessionSubscriptions(sessionId);

  var subscriptionDb = this.subscriptions[action.toLowerCase()];

  var unsubOpts = {
    filter: {
      key: sessionId
    },
    returnRemoved:true
  };

  if (referenceId) unsubOpts.filter.data = {
    ref: referenceId
  };

  if (path == '*') return subscriptionDb.unsubscribeAll(path, unsubOpts);

  return subscriptionDb.unsubscribe(path, unsubOpts);
};

SubscriptionService.prototype.clearSessionSubscriptions = function(sessionId) {

  var removedReferences = this.subscriptions.all.unsubscribeAll({
    filter: {
      key: sessionId
    },
    returnRemoved:true
  })
  .concat(this.subscriptions.set.unsubscribeAll({
    filter: {
      key: sessionId
    },
    returnRemoved:true
  }))
  .concat(this.subscriptions.remove.unsubscribeAll({
    filter: {
      key: sessionId
    },
    returnRemoved:true
  }));

  this.emit('session-subscriptions-cleared', {
    sessionId: sessionId,
    references: removedReferences
  });

  return removedReferences;
};

SubscriptionService.prototype.allListeners = function(sessionId) {

  return this.subscriptions.all.searchAll({
    filter: {
      "key": sessionId
    }
  })
  .concat(this.subscriptions.set.searchAll({
    filter: {
      "key": sessionId
    }
  }))
  .concat(this.subscriptions.remove.searchAll({
    filter: {
      "key": sessionId
    }
  }));
};

SubscriptionService.prototype.securityDirectoryChanged = function(whatHappnd, changedData, effectedSessions) {

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
};
