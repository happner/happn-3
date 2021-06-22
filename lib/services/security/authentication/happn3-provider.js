let AuthProvider = require('./provider-base');
module.exports = class Happn3AuthProvider extends AuthProvider {
  constructor(happn, config) {
    super(happn, config);
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
    return new Happn3AuthProvider(happn, config);
  }

  login(credentials, sessionId, request, callback) {
      console.log({credentials})
    let username = credentials.username ? credentials.username : '';

    if (typeof sessionId === 'function') {
      callback = sessionId;
      sessionId = null;
    }

    //default is a stateful login
    if (credentials.type == null) credentials.type = 1;

    if (
      !((credentials.username && (credentials.password || credentials.digest)) || credentials.token)
    )
      return callback(this.happn.services.error.InvalidCredentialsError('Invalid credentials'));

    if (!this.checkIPAddressWhitelistPolicy(credentials, sessionId, request))
      return callback(
        this.happn.services.error.InvalidCredentialsError('Source address access restricted')
      );

    if (this.checkDisableDefaultAdminNetworkConnections(credentials, request))
      return callback(
        this.happn.services.error.AccessDeniedError(
          'use of _ADMIN credentials over the network is disabled'
        )
      );

    if (credentials.token) {
      try {
        return this.__checkRevocations(credentials.token, (e, authorized, reason) => {
          if (e) return callback(e);
          if (!authorized) return callback(this.happn.services.error.AccessDeniedError(reason));
          let previousSession = this.decodeToken(credentials.token);

          if (previousSession == null)
            return this.__loginFailed(
              '[unknown]',
              'Invalid credentials',
              this.happn.services.error.InvalidCredentialsError('invalid session token'),
              callback,
              true
            );
          if (previousSession && previousSession.type != null && this.config.lockTokenToLoginType) {
            if (previousSession.type !== credentials.type)
              return callback(
                this.happn.services.error.AccessDeniedError(
                  `token was created using the login type ${previousSession.type},
                    which does not match how the new token is to be created`
                )
              );
          }

          if (this.checkDisableDefaultAdminNetworkConnections(previousSession, request))
            return callback(
              this.happn.services.error.AccessDeniedError(
                'use of _ADMIN credentials over the network is disabled'
              )
            );

          let previousPolicy = previousSession.policy[1]; //always the stateful policy
          username = previousSession.username;

          if (previousPolicy.disallowTokenLogins)
            return callback(
              this.happn.services.error.AccessDeniedError(
                `logins with this token are disallowed by policy`
              )
            );

          if (
            previousPolicy.lockTokenToOrigin &&
            previousSession.origin !== this.happn.services.system.name
          )
            return callback(
              this.happn.services.error.AccessDeniedError(
                `this token is locked to a different origin by policy`
              )
            );

          return this.checkTokenUserId(previousSession, (e, ok) => {
            if (e) return callback(e);

            if (!ok)
              return callback(
                this.happn.services.error.AccessDeniedError(
                  `token userid does not match userid for username: ${previousSession.username}`
                )
              );

            return this.authorize(previousSession, null, 'login', (e, authorized, reason) => {
              if (e)
                return this.__loginFailed(
                  previousSession.username,
                  'Invalid credentials',
                  e,
                  callback,
                  true
                );

              if (!authorized)
                return this.__loginFailed(previousSession.username, reason, null, callback, true);

              this.users.getUser(previousSession.username, (e, user) => {
                if (user == null)
                  return this.__loginFailed(
                    previousSession.username,
                    'Invalid credentials',
                    null,
                    callback,
                    true
                  );
                return this.__loginOK(credentials, user, sessionId, callback, {
                  session: previousSession,
                  token: credentials.token
                });
              });
            });
          });
        });
      } catch (e) {
        return this.__loginFailed(username, 'Invalid credentials', e, callback);
      }
    }
  }

  __loginFailed(username, specificMessage, e, callback, overrideLockout) {
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
    return super.__loginFailed(specificMessage, e, callback);
  }

  __checkLockedOut(username) {
    if (!username || !this.config.accountLockout || !this.config.accountLockout.enabled)
      return false;
    let existingLock = this.__locks.getSync(username);
    return existingLock != null && existingLock.attempts >= this.config.accountLockout.attempts;
  }
};
