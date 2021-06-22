function login(credentials, sessionId, request, callback) {
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

function checkIPAddressWhitelistPolicy(credentials, sessionId, request) {
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

function checkDisableDefaultAdminNetworkConnections(credentials, request) {
  return (
    credentials.username === '_ADMIN' &&
    this.config.disableDefaultAdminNetworkConnections === true &&
    request &&
    request.data &&
    request.data.info &&
    request.data.info._local === false
  );
}

function __checkRevocations(token, callback) {
  if (!this.__cache_revoked_tokens) return callback(null, true);
  this.__cache_revoked_tokens.get(token, function(e, item) {
    if (e) return callback(e);
    if (item == null) return callback(null, true);
    callback(null, false, `token has been revoked`);
  });
}

function decodeToken(token) {
  try {
    if (!token) throw new Error('missing session token');

    let decoded = jwt.decode(token, this.config.sessionTokenSecret);
    let unpacked = require('jsonpack').unpack(decoded);

    return unpacked;
  } catch (e) {
    this.log.warn(`invalid session token: ${e.message}`);
    return null;
  }
}
