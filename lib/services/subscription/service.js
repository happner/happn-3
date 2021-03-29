var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  async = require('async'),
  CONSTANTS = require('../..').constants,
  TameSearch = require('tame-search'),
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
SubscriptionService.prototype.processSubscribe = processSubscribe;
SubscriptionService.prototype.processUnsubscribe = processUnsubscribe;
SubscriptionService.prototype.getRecipients = getRecipients;
SubscriptionService.prototype.addListener = addListener;
SubscriptionService.prototype.removeListener = removeListener;
SubscriptionService.prototype.clearSessionSubscriptions = clearSessionSubscriptions;
SubscriptionService.prototype.allListeners = allListeners;
SubscriptionService.prototype.securityDirectoryChanged = securityDirectoryChanged;

SubscriptionService.prototype.__filterTargetRecipients = __filterTargetRecipients;
SubscriptionService.prototype.__doSubscriptionCallback = __doSubscriptionCallback;

SubscriptionService.prototype.__stripOutVariableDepthExceeded = __stripOutVariableDepthExceeded;

function initialize(config, callback) {
  try {
    if (!config) config = {};

    if (!config.subscriptionTree) config.subscriptionTree = {};

    if (!config.subscriptionTree.searchCache) config.subscriptionTree.searchCache = 2500; //size of LRU cache used to store search results, default 5000
    if (!config.subscriptionTree.permutationCache) config.subscriptionTree.permutationCache = 2500; //size of LRU cache to store path permutations, default 5000

    if (config.timeout) config.timeout = false;

    this.dataService = this.happn.services.data;
    this.securityService = this.happn.services.security;
    this.subscriptions = TameSearch.create(config.subscriptionTree);

    this.config = config;

    if (typeof this.config.filter === 'function') {
      Object.defineProperty(this, 'originalGetRecipients', {
        value: this.getRecipients
      });
      this.getRecipients = message => {
        return this.config.filter(message, this.originalGetRecipients(message));
      };
    }

    callback();
  } catch (e) {
    callback(e);
  }
}

function getSubscriptionPath(action, path) {
  var subscriptionAction = action === 'ALL' ? '*' : action.toUpperCase();
  if (path.substring(0, 1) === '/') return subscriptionAction + path;
  return subscriptionAction + '/' + path;
}

function stats() {
  return {};
}

function prepareSubscribeMessage(message) {
  message.request.pathData = {
    parts: message.request.path.split('@')
  };

  message.request.pathData.action = message.request.pathData.parts[0].replace('/', '');

  if (message.request.pathData.parts.length > 2)
    message.request.key = message.request.pathData.parts
      .slice(1, message.request.pathData.parts.length)
      .join('@');
  else if (message.request.pathData.parts.length === 1)
    message.request.key = message.request.pathData.parts[0];
  else message.request.key = message.request.pathData.parts[1];

  return message;
}

function processSubscribe(message, callback) {
  var reference = hyperid(); 
  try {
    this.addListener(message.request.pathData.action, message.request.key, message.session.id, {
      options: message.request.options,
      session: {
        id: message.session.id,
        protocol: message.session.protocol,
        info: message.session.info
      },
      ref: reference
    });
  } catch (e) {
    this.happn.services.error.handleSystem(
      e,
      'SubscriptionService',
      CONSTANTS.ERROR_SEVERITY.MEDIUM,
      () => {
        callback(e, message);
      }
    );
  }
  return this.__doSubscriptionCallback(message, reference, callback);
}

function processUnsubscribe(message, callback) {
  try {
    var referenceId = false;
    if (message.request.options && message.request.options.referenceId)
      referenceId = message.request.options.referenceId;
    var removedReference = this.removeListener(
      referenceId,
      message.session.id,
      message.request.pathData.action,
      message.request.key
    );
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
    callback(null, message);
  } catch (e) {
    callback(e);
  }
}

function __filterTargetRecipients(targetClients, recipients) {
  return recipients.filter(recipient => {
    return targetClients.indexOf(recipient.subscriberKey) > -1;
  });
}

function getRecipients(message) {
  var recipients = this.subscriptions.search(
    this.getSubscriptionPath(message.request.action, message.request.path)
  );

  if (message.request.options && message.request.options.targetClients)
    return this.__filterTargetRecipients(message.request.options.targetClients, recipients);

  return recipients;
}

function __stripOutVariableDepthExceeded(dataPath, message, items) {
  var depth = message.request.options.depth;

  return items.filter(function(item) {
    return item._meta.path.substring(dataPath.length - 2).split('/').length <= depth ? item : null;
  });
}

function __doSubscriptionCallback(message, reference, callback) {
  var data = {
    data: {
      id: reference
    },
    _meta: {
      status: 'ok'
    }
  };

  message.response = data;

  if (
    !message.request.options ||
    (!message.request.options.initialCallback && !message.request.options.initialEmit)
  )
    return callback(null, message);

  var dataPath = message.request.path.split('@')[1];

  this.dataService.get(
    dataPath,
    {
      sort: {
        modified: 1
      }
    },
    (e, initialItems) => {
      if (e) {
        data._meta.status = 'error';
        data.data = e.toString();
        return callback(null, message);
      }

      if (!initialItems) initialItems = [];

      if (initialItems && !Array.isArray(initialItems)) initialItems = [initialItems];

      data._meta.referenceId = reference;

      //strip out items that exceed the depth for variable depth subscriptions
      if (dataPath.substring(dataPath.length - 3) === '/**')
        data.initialValues = this.__stripOutVariableDepthExceeded(dataPath, message, initialItems);
      else data.initialValues = initialItems;

      return callback(null, message);
    }
  );
}

function addListener(action, path, sessionId, data) {
  data.action = action;
  data.path = path;

  if (path === '*')
    return this.subscriptions.subscribeAny(sessionId, {
      data: data
    });

  this.subscriptions.subscribe(
    sessionId,
    this.getSubscriptionPath(action, path),
    {
      data: data
    },
    data.options
  );
}

function removeListener(referenceId, sessionId, action, path) {
  if (action === '*' && path === '*') return this.clearSessionSubscriptions(sessionId);

  const unsubOpts = {
    returnRemoved: true
  };

  if (referenceId)
    unsubOpts.filter = {
      data: { ref: referenceId }
    };

  if (path === '*') return this.subscriptions.unsubscribeAll(sessionId, unsubOpts);

  return this.subscriptions.unsubscribe(
    sessionId,
    this.getSubscriptionPath(action, path),
    unsubOpts
  );
}

function clearSessionSubscriptions(sessionId) {
  const references = this.subscriptions.unsubscribeAll(sessionId, {
    returnRemoved: true
  });

  this.emit('session-subscriptions-cleared', {
    sessionId: sessionId,
    references
  });

  return references;
}

function allListeners(sessionId) {
  return this.subscriptions.searchAll({
    filter: {
      subscriberKey: sessionId
    }
  });
}

function securityDirectoryChanged(whatHappnd, _changedData, effectedSessions) {
  return new Promise((resolve, reject) => {
    if (
      effectedSessions == null ||
      effectedSessions.length === 0 ||
      CONSTANTS.SECURITY_DIRECTORY_CHANGE_EVENTS_COLLECTION.indexOf(whatHappnd) === -1
    )
      return resolve(effectedSessions);

    async.eachSeries(
      effectedSessions,
      (effectedSession, sessionCB) => {
        //did not result in the need to recheck subscriptions
        if (!effectedSession.causeSubscriptionsRefresh) return sessionCB();

        try {
          //TODO: filter out salient paths here
          var references = this.allListeners(effectedSession.id);
          async.eachSeries(
            references,
            (reference, referenceCallback) => {
              this.securityService.checkpoint._authorizeUser(
                effectedSession,
                reference.data.path,
                'on',
                (e, authorized) => {
                  if (e) return referenceCallback(e);
                  if (!authorized)
                    this.removeListener(
                      reference.data.ref,
                      effectedSession.id,
                      reference.data.action,
                      reference.data.path
                    );
                  referenceCallback();
                }
              );
            },
            sessionCB
          );
        } catch (e) {
          sessionCB(e);
        }
      },
      e => {
        if (e) return reject(e);
        resolve(effectedSessions);
      }
    );
  });
}
