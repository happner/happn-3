var util = require('util'),
  EventEmitter = require('events').EventEmitter,
  async = require('async'),
  CONSTANTS = require('../..').constants,
  TameSearch = require('tame-search'),
  hyperid = require('happner-hyperid').create({
    urlSafe: true
  });
const _ = require('lodash');
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
SubscriptionService.prototype.processMultiSubscribe = processMultiSubscribe;

SubscriptionService.prototype.processUnsubscribe = processUnsubscribe;
SubscriptionService.prototype.getRecipients = getRecipients;
SubscriptionService.prototype.addListener = addListener;
SubscriptionService.prototype.removeListener = removeListener;
SubscriptionService.prototype.removeListenerExtended = removeListenerExtended;
SubscriptionService.prototype.clearSessionSubscriptions = clearSessionSubscriptions;
SubscriptionService.prototype.allListeners = allListeners;
SubscriptionService.prototype.securityDirectoryChanged = securityDirectoryChanged;

SubscriptionService.prototype.__filterTargetRecipients = __filterTargetRecipients;
SubscriptionService.prototype.__doSubscriptionCallback = __doSubscriptionCallback;
SubscriptionService.prototype.__stripOutVariableDepthExceeded = __stripOutVariableDepthExceeded;

SubscriptionService.prototype.getFilteredRecipients = getFilteredRecipients;
SubscriptionService.prototype.filterRecipients = filterRecipients;
SubscriptionService.prototype.__processChangedSubscriptions = __processChangedSubscriptions;
SubscriptionService.prototype.removeInvalidProhibitions = removeInvalidProhibitions;
SubscriptionService.prototype.removeInvalidSubscriptions = removeInvalidSubscriptions;
SubscriptionService.prototype.removeExplicitlyRevokedSubscriptions = removeExplicitlyRevokedSubscriptions;
SubscriptionService.prototype.addNewProhibitions = addNewProhibitions;
SubscriptionService.prototype.addNewSubscriptions = addNewSubscriptions;
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

function processMultiSubscribe(message, callback) {
  var reference = hyperid();
  let errors = [];
  let data = {
    options: message.request.options,
    session: {
      id: message.session.id,
      protocol: message.session.protocol,
      info: message.session.info
    },
    ref: reference
  };
  this.addListener(message.request.pathData.action, message.request.key, message.session.id, {
    ...data,
    options: {
      ...data.options,
      wild: true
    }
  });
  message.request.allowed.forEach(path => {
    try {
      if (path.endsWith('/*')) path += '*';
      this.addListener(
        message.request.pathData.action,
        path,
        message.session.id,
        data,
        message.request.key
      );
    } catch (e) {
      this.happn.services.error.handleSystem(
        e,
        'SubscriptionService',
        CONSTANTS.ERROR_SEVERITY.MEDIUM,
        () => {
          errors.push[e];
        }
      );
    }
  });
  message.request.prohibited.forEach(path => {
    let prohibitedData = { ...data, options: { ...data.options, prohibited: true } };
    try {
      if (path.endsWith('/*')) path += '*';
      this.addListener(
        message.request.pathData.action,
        path,
        message.session.id,
        prohibitedData,
        message.request.key
      );
    } catch (e) {
      this.happn.services.error.handleSystem(
        e,
        'SubscriptionService',
        CONSTANTS.ERROR_SEVERITY.MEDIUM,
        () => {
          errors.push[e];
        }
      );
    }
  });
  return this.__doSubscriptionCallback(
    message,
    reference,
    callback,
    errors && errors.length ? errors : null
  );
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

function __doSubscriptionCallback(message, reference, callback, errors) {
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
      return callback(errors && errors.length ? errors : null, message);
    }
  );
}

function addListener(action, path, sessionId, data, wildPath) {
  data.action = action;
  data.searchPath = path;
  data.path = wildPath || path;
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
    // return Promise.All
    async.eachSeries(
      effectedSessions,
      (effectedSession, sessionCB) => {
        //did not result in the need to recheck subscriptions
        if (!effectedSession.causeSubscriptionsRefresh) return sessionCB();
        return this.__processChangedSubscriptions(effectedSession, sessionCB);
      },
      e => {
        if (e) return reject(e);
        resolve(effectedSessions);
      }
    );
  });
}
function removeListenerExtended(filter, sessionId, action, path) {
  if (action === '*' && path === '*') return this.clearSessionSubscriptions(sessionId);

  const unsubOpts = {
    returnRemoved: true
  };

  unsubOpts.filter = filter;

  if (path === '*') return this.subscriptions.unsubscribeAll(sessionId, unsubOpts);

  return this.subscriptions.unsubscribe(
    sessionId,
    this.getSubscriptionPath(action, path),
    unsubOpts
  );
}

function getFilteredRecipients(message) {
  let recipients = this.getRecipients(message);
  return this.filterRecipients(message, recipients);
}

function filterRecipients(message, recipients) {
  recipients = recipients.filter(rec => !(rec.data.options && rec.data.options.wild === true));
  let prohibited;

  [prohibited, recipients] = _.partition(recipients, ['data.options.prohibited', true]);
  if (prohibited.length === 0) return recipients;
  let prohibitionsDict = prohibited
    .map(rec => rec.data)
    .reduce((prohibitedLists, current) => {
      prohibitedLists[current.session.id] = prohibitedLists[current.session.id] || {};
      if (current.searchPath.endsWith('*')) {
        prohibitedLists[current.session.id].wild = prohibitedLists[current.session.id].wild || [];
        prohibitedLists[current.session.id].wild.push(current.searchPath.replace(/\/\*+$/, '/'));
      }
      //We add wildcard paths to the explict list as well as there is a possibility,
      // with changing permissions, that may match a searchPath exactly.
      prohibitedLists[current.session.id].explicit =
        prohibitedLists[current.session.id].explicit || [];
      prohibitedLists[current.session.id].explicit.push(current.searchPath);
      return prohibitedLists;
    }, {});

  recipients = recipients.filter(rec => {
    let sessionList = prohibitionsDict[rec.data.session.id];
    if (!sessionList) return true;
    if (
      sessionList.explicit &&
      (sessionList.explicit.includes(rec.data.searchPath) ||
        sessionList.explicit.includes(message.request.path))
    )
      return false;
    if (
      sessionList.wild &&
      sessionList.wild.some(
        path =>
          (rec.data.searchPath.startsWith(path) && rec.data.searchPath !== path) ||
          (message.request.path.startsWith(path) && message.request.path !== path)
      )
    )
      return false;
    return true;
  });

  return recipients;
}
function __processChangedSubscriptions(effectedSession, callback) {
  try {
    let references = this.allListeners(effectedSession.id);
    this.securityService.checkpoint.listRelevantPermissions(
      effectedSession,
      '/**',
      'on',
      (e, relevantPaths) => {
        let prohibitedPaths = {
          explicit: relevantPaths.prohibited,
          wild: relevantPaths.prohibited
            .filter(path => path.endsWith('*'))
            .map(path => path.replace(/\/\*+$/, '/'))
        };

        let allowedPaths = {
          explicit: relevantPaths.allowed,
          wild: relevantPaths.allowed
            .filter(path => path.endsWith('/*'))
            .map(path => path.replace(/\/\*+$/, '/'))
        };
        let prohibitedSubs, allowedSubs;
        [prohibitedSubs, allowedSubs] = _.partition(references, ['data.options.prohibited', true]);
        let wildSubs = allowedSubs.filter(sub => _.get(sub, 'data.options.wild') === true);
        let wildSubPaths = wildSubs.map(sub => sub.data.path.replace(/\/\*+$/, '/'));
        this.removeInvalidProhibitions(effectedSession, prohibitedSubs, prohibitedPaths);
        this.removeInvalidSubscriptions(effectedSession, allowedSubs, allowedPaths);
        this.removeExplicitlyRevokedSubscriptions(effectedSession, allowedSubs, prohibitedPaths);
        this.addNewProhibitions(effectedSession, prohibitedPaths, wildSubPaths);
        this.addNewSubscriptions(
          effectedSession,
          allowedPaths,
          prohibitedPaths,
          allowedSubs,
          wildSubs,
          wildSubPaths
        );
        callback();
      }
    );
  } catch (e) {
    callback(e);
  }
}

function removeInvalidProhibitions(effectedSession, prohibitedSubs, prohibitedPaths) {
  let removeProhibitions = prohibitedSubs.filter(
    ref =>
      !(
        prohibitedPaths.explicit.includes(ref.data.searchPath) ||
        prohibitedPaths.wild.some(
          path => ref.data.searchPath.startsWith(path) && path !== ref.data.searchPath
        )
      )
  );
  removeProhibitions.forEach(reference => {
    this.removeListenerExtended(
      { data: { ref: reference.data.ref, options: { prohibited: true } } },
      effectedSession.id,
      reference.data.action,
      reference.data.searchPath
    );
  });
}

function removeInvalidSubscriptions(effectedSession, allowedSubs, allowedPaths) {
  let noLongerValidSubs = allowedSubs.filter(
    ref =>
      allowedPaths.explicit.indexOf(ref.data.searchPath) < 0 &&
      !allowedPaths.wild.some(wildPath => ref.data.searchPath.startsWith(wildPath))
  );
  noLongerValidSubs.forEach(reference => {
    this.removeListenerExtended(
      { data: { ref: reference.data.ref, options: { prohibited: { $ne: true } } } },
      effectedSession.id,
      reference.data.action,
      reference.data.searchPath
    );
  });
}

function removeExplicitlyRevokedSubscriptions(effectedSession, allowedSubs, prohibitedPaths) {
  let revoked = allowedSubs.filter(
    ref =>
      prohibitedPaths.explicit.includes(ref.data.searchPath) ||
      prohibitedPaths.wild.some(
        path => ref.data.searchPath.startsWith(path) && path !== ref.data.searchPath
      )
  );
  revoked.forEach(reference => {
    this.removeListener(
      reference.data.ref,
      effectedSession.id,
      reference.data.action,
      reference.data.searchPath
    );
  });
}

function addNewProhibitions(effectedSession, prohibitedPaths, wildSubPaths) {
  let newProhibitions = prohibitedPaths.explicit.filter(prohibitPath =>
    wildSubPaths.some(subPath => prohibitPath.startsWith(subPath)))  
  newProhibitions.forEach(path => {
    this.addListener('ALL', path, effectedSession.id, {
      options: { prohibited: true },
      session: effectedSession
    });
  });
}

function addNewSubscriptions(effectedSession, allowedPaths, prohibitedPaths, allowedSubs, wildSubs, wildSubPaths) {
  //Add subscriptions on paths where we have a wild subscription further up the tree, and now have a permission
  let allowedSubPaths = allowedSubs.map(sub => sub.data.searchPath);
  let newSubPaths = allowedPaths.explicit.filter(
    allowedPath =>
      allowedSubPaths.indexOf(allowedPath) < 0 &&
      wildSubPaths.some(subPath => allowedPath.startsWith(subPath)) &&
      prohibitedPaths.explicit.indexOf(allowedPath) < 0 &&
      !prohibitedPaths.wild.some(prohibitedPath => allowedPath.startsWith(prohibitedPath))
  );
  newSubPaths.forEach(newPath => {
    wildSubs
      .filter(wildSub => newPath.startsWith(wildSub.data.path.replace(/\/\*+$/, '/'))
      )
      .forEach(sub => {
        let action = sub.data.action
        this.addListener(
          action,
          newPath,
          effectedSession.id,
          {
            ...sub.data,
            options: {
              ...sub.data.options,
              wild: false
            }
          },
          sub.data.path
        );
      });
  });
}
