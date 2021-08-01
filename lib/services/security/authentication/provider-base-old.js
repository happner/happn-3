const jwt = require('jwt-simple'),
  sift = require('sift').default,
  uuid = require('uuid'),
  uuidv1 = require('uuid/v1');

module.exports = class AuthProvider {
  constructor(happn, config) {
    this.happn = happn;
    this.cryptoService = this.happn.services.crypto;
    this.cacheService = this.happn.services.cache;
    this.sessionService = this.happn.services.session;
    this.securityService = this.happn.services.security;
    this.users = this.securityService.users;
    //Security service functions that couldn't be de-coupled;
    this.authorize = this.securityService.authorize.bind(this.securityService);
    this.generatePermissionSetKey = this.securityService.generatePermissionSetKey.bind(
      this.securityService
    );
    this.generateSession = this.securityService.generateSession.bind(this.securityService);
    this.decodeToken = this.securityService.decodeToken.bind(this.securityService);
    this.__checkRevocations = this.securityService.__checkRevocations.bind(this.securityService);
    this.__loginOk = this.securityService.__loginOk.bind(this.securityService);

    this.__initializeProfiles(config);
    this.config = config;
    if (typeof this.config.accountLockout !== 'object') this.config.accountLockout = {};
    if (this.config.accountLockout.enabled == null) this.config.accountLockout.enabled = true;
    if (this.config.accountLockout.enabled) {
      this.__locks = this.happn.services.cache.new('security_account_lockout');
      if (!this.config.accountLockout.attempts) this.config.accountLockout.attempts = 4;
      if (!this.config.accountLockout.retryInterval)
        this.config.accountLockout.retryInterval = 60 * 1000 * 10; //10 minutes
    }
  }

  static create(happn, config) {
    return new AuthProvider(happn, config);
  }

  __initializeProfiles(config) {
    if (!config.profiles) config.profiles = [];

    config.profiles.push({
      name: 'default-browser', // this is the default underlying profile for stateful sessions
      session: {
        $and: [
          {
            info: {
              _browser: {
                $eq: true
              }
            }
          }
        ]
      },
      policy: {
        ttl: '7 days', //a week
        inactivity_threshold: '1 hour'
      }
    });

    config.profiles.push({
      name: 'default-stateful', // this is the default underlying profile for stateful sessions
      session: {
        $and: [
          {
            type: {
              $eq: 1
            }
          }
        ]
      },
      policy: {
        ttl: 0, //session never goes stale
        inactivity_threshold: Infinity
      }
    });

    config.profiles.push({
      name: 'default-stateless', // this is the default underlying profile for stateless sessions (REST)
      session: {
        $and: [
          {
            type: {
              $eq: 0
            }
          }
        ]
      },
      policy: {
        ttl: 0, //session never goes stale
        inactivity_threshold: Infinity
      }
    });

    config.profiles.forEach(profile => {
      if (profile.policy.ttl && profile.policy.ttl !== Infinity)
        profile.policy.ttl = this.happn.services.utils.toMilliseconds(profile.policy.ttl);
      if (profile.policy.inactivity_threshold && profile.policy.ttl !== Infinity)
        profile.policy.inactivity_threshold = this.happn.services.utils.toMilliseconds(
          profile.policy.inactivity_threshold
        );
    });

    this.__cache_Profiles = config.profiles;
  }

  accessDenied(errorMessage, callback) {
    return callback(this.happn.services.error.AccessDeniedError(errorMessage));
  }

  invalidCredentials(errorMessage, callback) {
    return callback(this.happn.services.error.InvalidCredentialsError(errorMessage));
  }

  login(credentials, sessionId, request, callback) {
    if (typeof sessionId === 'function') {
      callback = sessionId;
      sessionId = null;
    }
    // let username = credentials.username || '';
    //default is a stateful login
    if (credentials.type == null) credentials.type = 1;

    if (
      !((credentials.username && (credentials.password || credentials.digest)) || credentials.token)
    )
      return this.invalidCredentials('Invalid credentials', callback);

    if (!this.checkIPAddressWhitelistPolicy(credentials, sessionId, request))
      return this.invalidCredentials('Source address access restricted', callback);

    if (this.checkDisableDefaultAdminNetworkConnections(credentials, request))
      return this.accessDenied('use of _ADMIN credentials over the network is disabled', callback);

    if (credentials.token) return this.tokenLogin(credentials, sessionId, callback);
    else return this.userCredsLogin(credentials, sessionId, callback);
  }

  async tokenLogin(credentials, sessionId, callback) {
    let previousSession = this.decodeToken(credentials.token);
    let username = previousSession.username;
    try {
      let [authorized, reason] = await this.__checkRevocations(credentials.token);
      if (!authorized) return this.accessDenied(callback, reason);

      // let previousSession = this.decodeToken(credentials.token);

      if (previousSession == null)
        return this.invalidCredentials('Invalid credentials: invalid session token', callback);

      let errorMessage;
      if (previousSession && previousSession.type != null && this.config.lockTokenToLoginType) {
        if (previousSession.type !== credentials.type)
          errorMessage = `token was created using the login type ${previousSession.type},
                  which does not match how the new token is to be created`;
      }

      if (this.checkDisableDefaultAdminNetworkConnections(previousSession, request))
        errorMessage = 'use of _ADMIN credentials over the network is disabled';

      let previousPolicy = previousSession.policy[1]; //always the stateful policy

      if (previousPolicy.disallowTokenLogins)
        errorMessage = `logins with this token are disallowed by policy`;

      if (
        previousPolicy.lockTokenToOrigin &&
        previousSession.origin !== this.happn.services.system.name
      )
        errorMessage = `this token is locked to a different origin by policy`;

      if (errorMessage) return this.accessDenied(errorMessage, callback);

      //Anything further is dealt with in the specific provider
      return this.__providerTokenLogin(credentials, previousSession, sessionId, callback);
    } catch (e) {
      return this.__loginFailed(username, 'Invalid credentials', e, callback);
    }
  }

  userCredsLogin(credentials, sessionId, callback) {
    if (this.__checkLockedOut(credentials.username))
      return this.accessDenied('Account locked out', callback);
    return this.__providerCredsLogin(credentials, sessionId, callback);
  }

  adminLogin(sessionId, callback) {
    let credentials = { username: '_ADMIN' };
    this.users.getUser(credentials.username, (e, adminUser) => {
      if (e) return callback(e);
      return this.__loginOK(credentials, adminUser, sessionId, callback);
    });
  }

  processUnsecureLogin(message, callback) {
    let session = this.generateEmptySession(message.session.id);
    session.info = message.request.data.info;
    message.response = {
      data: this.happn.services.session.attachSession(message.session.id, session)
    };
    return callback(null, message);
  }

  // __loginOK(credentials, user, sessionId, callback, tokenLogin) {
  //   delete user.password;
  //   if (this.__locks) this.__locks.removeSync(user.username); //remove previous locks
  //   callback(null, this.generateSession(user, sessionId, credentials, tokenLogin));
  // }

  __loginFailed(username, specificMessage, e, callback, overrideLockout) {
    let message = 'Invalid credentials';
    if (specificMessage) message = specificMessage;

    if (e) {
      if (e.message) message = message + ': ' + e.message;
      else message = message + ': ' + e.toString();
    }

    if (this.config.accountLockout && this.config.accountLockout.enabled && !overrideLockout) {
      let currentLock = this.__locks.getSync(username);

      if (!currentLock)
        currentLock = {
          attempts: 0
        };

      currentLock.attempts++;

      this.__locks.setSync(username, currentLock, {
        ttl: this.config.accountLockout.retryInterval
      });
    }

    return callback(this.happn.services.error.InvalidCredentialsError(message));
  }

  checkIPAddressWhitelistPolicy(credentials, sessionId, request) {
    return this.__cache_Profiles.every(profile => {
      if (profile.policy.sourceIPWhitelist == null || profile.policy.sourceIPWhitelist.length === 0)
        return true;
      if (sift(profile.session, [{ user: credentials }]).length === 0) return true;
      if (sessionId) {
        const session = this.sessionService.getSession(sessionId);
        if (!session) return false;
        return profile.policy.sourceIPWhitelist.indexOf(session.address.ip) > -1;
      }
      return profile.policy.sourceIPWhitelist.indexOf(request.address.ip) > -1;
    });
  }

  checkDisableDefaultAdminNetworkConnections(credentials, request) {
    return (
      credentials.username === '_ADMIN' &&
      this.config.disableDefaultAdminNetworkConnections === true &&
      request &&
      request.data &&
      request.data.info &&
      request.data.info._local === false
    );
  }

  __checkLockedOut(username) {
    if (!username || !this.config.accountLockout || !this.config.accountLockout.enabled)
      return false;
    let existingLock = this.__locks.getSync(username);
    return existingLock != null && existingLock.attempts >= this.config.accountLockout.attempts;
  }

  generateToken(session, type) {
    let decoupledSession = this.happn.services.utils.clone(session);

    if (type == null) decoupledSession.type = 1; //session based type if  not specified
    decoupledSession.isToken = true;

    delete decoupledSession.permissionSetKey; //this should never be used as it may get out of sync
    delete decoupledSession.user; //also not to be used later on as it may go out of sync

    if (session.user && session.user.username) {
      decoupledSession.username = session.user.username;
      decoupledSession.userid = session.user.userid;
    }

    let packed = require('jsonpack').pack(decoupledSession);
    return jwt.encode(packed, this.config.sessionTokenSecret);
  }

  generateEmptySession(id) {
    return { id: id || uuid.v4() };
  }

  __profileSession(session) {
    session.policy = {
      0: null,
      1: null
    };
    //we dont want to mess around with the actual sessions type
    //it is an unknown at this point
    let decoupledSession = this.happn.services.utils.clone(session);
    this.__cache_Profiles.forEach(profile => {
      let filter = profile.session;
      [0, 1].forEach(function(sessionType) {
        if (session.policy[sessionType] != null) return;
        decoupledSession.type = sessionType;
        if (sift(filter, [decoupledSession]).length === 1) {
          session.policy[sessionType] = profile.policy;
        }
      });
    });

    if (session.policy[0] == null && session.policy[1] == null)
      throw new Error('unable to match session with a profile'); //this should never happen
  }

  verifyAuthenticationDigest(request, callback) {
    if (!request.publicKey) return callback(new Error('no publicKey in request'));
    if (!request.digest) return callback(new Error('no digest in request'));

    this.cacheService.get(
      request.publicKey,
      {
        cache: 'security_authentication_nonce'
      },
      (e, nonce) => {
        if (e) return callback(e);
        if (!nonce) return callback(new Error('nonce expired or public key invalid'));

        try {
          let verified = this.cryptoService.verify(nonce, request.digest, request.publicKey);
          callback(null, verified);
        } catch (verifyFailed) {
          callback(verifyFailed);
        }
      }
    );
  }

  async checkTokenUserId(token, callback) {
    if (!this.config.lockTokenToUserId) return callback(null, true);
    let user = await this.users.getUser(token.username);
    // , (e, user) => {
    // if (e) return callback(e);
    if (!user || !user.userid) return true;
    //  return tcallback(null, true); //user doesnt exist, authorize fails at a later point
    // if (!user.userid) return callback(null, true); //backward compatibility - old users
    return user.userid === token.userid;
    // });
  }

  matchPassword(password, hash, callback) {
    this.cryptoService.verifyHash(password, hash, this.config.pbkdf2Iterations, callback);
  }
};
