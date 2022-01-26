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
SubscriptionService.prototype.parseSubscribeMessage = parseSubscribeMessage;
SubscriptionService.prototype.processSubscribe = processSubscribe;
SubscriptionService.prototype.processMultiSubscribe = processMultiSubscribe;

SubscriptionService.prototype.processUnsubscribe = processUnsubscribe;
SubscriptionService.prototype.getRecipients = getFilteredRecipients;
SubscriptionService.prototype.__getRecipients = __getRecipients;
SubscriptionService.prototype.getFilteredRecipients = getFilteredRecipients;
SubscriptionService.prototype.filterRecipients = filterRecipients;

SubscriptionService.prototype.addListener = addListener;
SubscriptionService.prototype.removeListener = removeListener;
SubscriptionService.prototype.removeListenerExtended = removeListenerExtended;
SubscriptionService.prototype.clearSessionSubscriptions = clearSessionSubscriptions;
SubscriptionService.prototype.allListeners = allListeners;
SubscriptionService.prototype.securityDirectoryChanged = securityDirectoryChanged;

SubscriptionService.prototype.__filterTargetRecipients = __filterTargetRecipients;
SubscriptionService.prototype.__doSubscriptionCallback = __doSubscriptionCallback;
SubscriptionService.prototype.__stripOutVariableDepthExceeded = __stripOutVariableDepthExceeded;

SubscriptionService.prototype.__processChangedSubscriptions = __processChangedSubscriptions;
SubscriptionService.prototype.__removeInvalidProhibitions = __removeInvalidProhibitions;
SubscriptionService.prototype.__removeInvalidSubscriptions = __removeInvalidSubscriptions;
SubscriptionService.prototype.__removeExplicitlyRevokedSubscriptions = __removeExplicitlyRevokedSubscriptions;
SubscriptionService.prototype.__addNewProhibitions = __addNewProhibitions;
SubscriptionService.prototype.__addNewSubscriptions = __addNewSubscriptions;
SubscriptionService.prototype.__processUnnestedSubscriptions = __processUnnestedSubscriptions;
SubscriptionService.prototype.__startsWithMask = __startsWithMask;

function initialize(config, callback) {
  try {
    if (!config) config = {};
    if (!config.allowNestedPermissions) config.allowNestedPermissions = false;
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
        value: this.getFilteredRecipients
      });
      this.getFilteredRecipients = message => {
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

function parseSubscribeMessage(message) {
  const parsed = { ...message.session, ...message.request };
  const parts = parsed.path.split('@');
  parsed.action = parts[0].replace('/', '');

  if (parts.length > 2) {
    parsed.key = parts.slice(1).join('@');
  } else if (parts.length === 1) {
    parsed.key = parts[0];
  } else {
    parsed.key = parts[1];
  }
  return parsed;
}

function processSubscribe(message, callback) {
  const ref = hyperid();
  const parsed = this.parseSubscribeMessage(message);
  try {
    this.addListener(parsed.action, parsed.key, parsed.id, {
      options: parsed.options,
      session: {
        id: parsed.id,
        protocol: parsed.protocol,
        info: parsed.info
      },
      ref
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
    return;
  }
  return this.__doSubscriptionCallback(message, ref, callback);
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
      let searchPath;
      if (path.endsWith('/*')) {
        searchPath = path;
        path += '*';
      }
      this.addListener(
        message.request.pathData.action,
        path,
        message.session.id,
        data,
        message.request.key,
        searchPath
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

function __getRecipients(message) {
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
      return callback(errors, message);
    }
  );
}

function addListener(action, path, sessionId, data, wildPath, searchPath) {
  data.action = action;
  data.searchPath = searchPath || path;
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
    async.eachSeries(
      effectedSessions,
      (effectedSession, sessionCB) => {
        //did not result in the need to recheck subscriptions
        if (!effectedSession.causeSubscriptionsRefresh) return sessionCB();
        return this.config.allowNestedPermissions
          ? this.__processChangedSubscriptions(effectedSession, sessionCB)
          : this.__processUnnestedSubscriptions(effectedSession, sessionCB);
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
  let recipients = this.__getRecipients(message);
  return this.config.allowNestedPermissions
    ? this.filterRecipients(message, recipients)
    : recipients;
}

function filterRecipients(message, recipients) {
  recipients = recipients.filter(rec => !(rec.data.options && rec.data.options.wild === true));
  // recipients with options.wild = true are just place-holders in case of security directory changes
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
          this.__startsWithMask(rec.data.searchPath, path) ||
          this.__startsWithMask(message.request.path, path)
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
            .filter(path => path.endsWith('*'))
            .map(path => path.replace(/\/\*+$/, '/'))
        };
        let prohibitedSubs, allowedSubs, wildSubs;
        [prohibitedSubs, allowedSubs] = _.partition(references, ['data.options.prohibited', true]);
        [wildSubs, allowedSubs] = _.partition(allowedSubs, ['data.options.wild', true]);

        let nestedWildSubs = wildSubs.filter(sub => sub.data.path.endsWith('/**'));
        let wildSubPaths = wildSubs.map(sub => sub.data.path.replace(/\/\*+$/, '/'));
        let nestedWildSubPaths = nestedWildSubs.map(sub => sub.data.path.replace(/\/\*+$/, '/'));

        this.__removeInvalidProhibitions(effectedSession, prohibitedSubs, prohibitedPaths);
        this.__removeInvalidSubscriptions(effectedSession, allowedSubs, allowedPaths);
        this.__removeExplicitlyRevokedSubscriptions(effectedSession, allowedSubs, prohibitedPaths);
        this.__addNewProhibitions(effectedSession, prohibitedSubs, prohibitedPaths, wildSubPaths);
        this.__addNewSubscriptions(
          effectedSession,
          allowedSubs,
          nestedWildSubs,
          allowedPaths,
          prohibitedPaths,
          nestedWildSubPaths
        );
        callback();
      }
    );
  } catch (e) {
    callback(e);
  }
}

function __removeInvalidProhibitions(effectedSession, prohibitedSubs, prohibitedPaths) {
  let removeProhibitions = prohibitedSubs.filter(
    sub =>
      !(
        prohibitedPaths.explicit.includes(sub.data.searchPath) ||
        prohibitedPaths.wild.some(path => this.__startsWithMask(sub.data.searchPath, path))
      )
  );
  removeProhibitions.forEach(sub => {
    this.removeListenerExtended(
      { data: { ref: sub.data.ref, options: { prohibited: true } } },
      effectedSession.id,
      sub.data.action,
      sub.data.searchPath
    );
  });
}

function __removeInvalidSubscriptions(effectedSession, allowedSubs, allowedPaths) {
  let noLongerValidSubs = allowedSubs.filter(
    sub =>
      allowedPaths.explicit.indexOf(sub.data.searchPath) < 0 &&
      !allowedPaths.wild.some(wildPath => this.__startsWithMask(sub.data.searchPath, wildPath))
  );
  noLongerValidSubs.forEach(sub => {
    this.removeListenerExtended(
      {
        data: {
          ref: sub.data.ref,
          options: { prohibited: { $ne: true } },
          searchPath: sub.data.searchPath
        }
      },
      effectedSession.id,
      sub.data.action,
      '*' // sub.data.searchPath'*'
    );
  });
}

function __removeExplicitlyRevokedSubscriptions(effectedSession, allowedSubs, prohibitedPaths) {
  let revoked = allowedSubs.filter(
    sub =>
      prohibitedPaths.explicit.includes(sub.data.searchPath) ||
      prohibitedPaths.wild.some(path => this.__startsWithMask(sub.data.searchPath, path))
  );
  revoked.forEach(sub => {
    this.removeListenerExtended(
      {
        data: {
          ref: sub.data.ref,
          options: { prohibited: { $ne: true } },
          searchPath: sub.data.searchPath
        }
      },
      effectedSession.id,
      sub.data.action,
      '*' // sub.data.searchPath
    );
  });
}

function __addNewProhibitions(effectedSession, prohibitedSubs, prohibitedPaths, wildSubPaths) {
  let wildProhibitedSubsPaths = prohibitedSubs
    .filter(sub => sub.data.searchPath.endsWith('*'))
    .map(sub => sub.data.searchPath.replace(/\*+$/, ''));
  let newProhibitions = prohibitedPaths.explicit.filter(
    prohibitPath =>
      wildSubPaths.some(subPath => this.__startsWithMask(prohibitPath, subPath)) &&
      !prohibitedSubs.some(sub => sub.data.searchPath === prohibitPath) &&
      !wildProhibitedSubsPaths.some(path => this.__startsWithMask(prohibitPath, path))
  );
  //Need to add a reference for these prohibitions (?)
  newProhibitions.forEach(path => {
    this.addListener('ALL', path, effectedSession.id, {
      options: { prohibited: true },
      session: effectedSession
    });
  });
}

function __addNewSubscriptions(
  effectedSession,
  allowedSubs,
  wildSubs,
  allowedPaths,
  prohibitedPaths,
  wildSubPaths
) {
  //Add subscriptions on paths where we have a wild subscription further up the tree, and now have a permission
  let allowedSubPaths = allowedSubs.map(sub => sub.data.searchPath);
  let subscriptionsOnStarPermission = allowedSubPaths.filter(path => path.endsWith('/*'));
  let newSubPaths = allowedPaths.explicit.filter(
    allowedPath =>
      !allowedPath.endsWith('*') &&
      allowedSubPaths.indexOf(allowedPath) < 0 &&
      wildSubPaths.some(subPath => this.__startsWithMask(allowedPath, subPath)) &&
      !subscriptionsOnStarPermission.some(subPath => this.__startsWithMask(allowedPath, subPath)) &&
      prohibitedPaths.explicit.indexOf(allowedPath) < 0 &&
      !prohibitedPaths.wild.some(prohibitedPath =>
        this.__startsWithMask(allowedPath, prohibitedPath)
      )
  );
  newSubPaths.forEach(newPath => {
    wildSubs
      .filter(wildSub => this.__startsWithMask(newPath, wildSub.data.path.replace(/\/\*+$/, '/')))
      .forEach(sub => {
        let action = sub.data.action;
        this.addListener(
          action,
          newPath,
          effectedSession.id,
          {
            ...sub.data,
            options: {
              ...sub.data.options,
              wild: false
            },
            searchPath: newPath
          },
          sub.data.path
        );
      });
  });
}

function __processUnnestedSubscriptions(effectedSession, sessionCB) {
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
}

function __startsWithMask(first, second) {
  if (first.indexOf('*') === -1 && second.indexOf('*') === -1) return first.startsWith(second);
  let firstArray = first.split('/');
  let secondArray = second.split('/');
  if (secondArray.length > firstArray.length) return false;
  for (let [index] of secondArray.entries()) {
    if (firstArray[index] === '*') firstArray[index] = secondArray[index];
    if (secondArray[index] === '*') secondArray[index] = firstArray[index];
  }
  return firstArray.join('/').startsWith(secondArray.join('/'));
}
