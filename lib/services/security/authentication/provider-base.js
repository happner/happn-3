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
    this.generateToken = this.securityService.generateToken.bind(this.securityService);
    this.generateSession = this.securityService.generateSession.bind(this.securityService);
    this.decodeToken = this.securityService.decodeToken.bind(this.securityService);
    this.checkTokenUserId = this.securityService.checkTokenUserId.bind(this.securityService);
    this.__checkRevocations = this.securityService.__checkRevocations.bind(this.securityService);
    this.checkIPAddressWhitelistPolicy = this.securityService.checkIPAddressWhitelistPolicy.bind(
      this.securityService
    );
    this.verifyAuthenticationDigest = this.securityService.verifyAuthenticationDigest.bind(
      this.securityService
    );
    this.matchPassword = this.securityService.matchPassword.bind(this.securityService);
    this.config = config;
    if (typeof this.config.accountLockout !== 'object') this.config.accountLockout = {};
    if (this.config.accountLockout.enabled == null) this.config.accountLockout.enabled = true;
    if (this.config.accountLockout.enabled) {
      this.__locks =
        this.cacheService.getIfExisting('security_account_lockout') ||
        this.cacheService.new('security_account_lockout');
      if (!this.config.accountLockout.attempts) this.config.accountLockout.attempts = 4;
      if (!this.config.accountLockout.retryInterval)
        this.config.accountLockout.retryInterval = 60 * 1000 * 10; //10 minutes
    }
  }

  static create(happn, config, requiredModule) {
    if (requiredModule) {
      try {
        let SpecificProvider = require(requiredModule)(AuthProvider);
        return SpecificProvider.create(happn, config);
      } catch (e) {
        happn.services.security.log.error(
          `Could not configure auth provider ${requiredModule}, returning base auth provider with limited functionality. ${e.toString()}`
        );
        return new AuthProvider(happn, config);
      }
    }
    return new AuthProvider(happn, config);
  }

  accessDenied(errorMessage, callback) {
    return callback(this.happn.services.error.AccessDeniedError(errorMessage));
  }

  invalidCredentials(errorMessage, callback) {
    return callback(this.happn.services.error.InvalidCredentialsError(errorMessage));
  }

  coerceArray(possibleArray) {
    let first = possibleArray,
      rest = [null];
    if (Array.isArray(possibleArray)) {
      [first, ...rest] = possibleArray;
    }
    return [first, ...rest];
  }

  login(credentials, sessionId, request, callback) {
    if (typeof sessionId === 'function') {
      callback = sessionId;
      sessionId = null;
    }

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

    if (credentials.token) return this.tokenLogin(credentials, sessionId, request, callback);
    else return this.userCredsLogin(credentials, sessionId, callback);
  }

  async tokenLogin(credentials, sessionId, request, callback) {
    let username;
    try {
      let [authorized, reason] = this.coerceArray(await this.__checkRevocations(credentials.token));

      if (!authorized) return this.accessDenied(reason, callback);
      let previousSession = this.decodeToken(credentials.token);
      if (previousSession == null)
        return this.invalidCredentials('Invalid credentials: invalid session token', callback);
      username = previousSession.username;

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

  __providerTokenLogin(username, credentials, callback) {
    return this.accessDenied('Authentication Provider not set up correctly.', callback);
  }

  userCredsLogin(credentials, sessionId, callback) {
    if (this.__checkLockedOut(credentials.username))
      return this.accessDenied('Account locked out', callback);
    return this.__providerCredsLogin(credentials, sessionId, callback);
  }

  __providerCredsLogin(credentials, sessionId, callback) {
    return this.accessDenied('Authentication Provider not set up correctly.', callback);
  }

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

    return this.invalidCredentials(message, callback);
  }

  __loginOK(credentials, user, sessionId, callback, tokenLogin, additionalInfo) {
    delete user.password;
    if (this.__locks) this.__locks.removeSync(user.username); //remove previous locks
    callback(null, this.generateSession(user, sessionId, credentials, tokenLogin, additionalInfo));
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
};
