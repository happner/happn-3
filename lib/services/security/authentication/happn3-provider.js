let AuthProvider = require('./provider-base');
module.exports = class Happn3AuthProvider extends AuthProvider {
  constructor(happn, config) {
    super(happn, config);
  }

  static create(happn, config) {
    return new Happn3AuthProvider(happn, config);
  }

  async __providerTokenLogin(credentials, previousSession, sessionId, callback) {
    try {

      let ok = await this.checkTokenUserId(previousSession);
      if (!ok)
        return this.accessDenied(
          `token userid does not match userid for username: ${previousSession.username}`,
          callback
        );
      let [authorized, reason] = this.coerceArray(
        await this.authorize(previousSession, null, 'login')
      );

      if (!authorized) return this.invalidCredentials(reason, callback);
      let user = await this.users.getUser(previousSession.username);
      if (user == null) return this.invalidCredentials('Invalid credentials', callback);

      return this.__loginOK(credentials, user, sessionId, callback, {
        session: previousSession,
        token: credentials.token
      });
    } catch (e) {
      return this.invalidCredentials('Invalid credentials', callback);
    }
  }

  __digestLogin(user, credentials, sessionId, callback) {
    if (user.publicKey !== credentials.publicKey)
      return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

    return this.verifyAuthenticationDigest(credentials, (e, valid) => {
      if (e) return callback(e);

      if (!valid)
        return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

      return this.__loginOK(credentials, user, sessionId, callback);
    });
  }

  __providerCredsLogin(credentials, sessionId, callback) {
    return this.users.getUser(credentials.username, (e, user) => {
      if (e) return callback(e);

      if (user == null)
        return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);

      if (credentials.digest) return this.__digestLogin(user, credentials, sessionId, callback);

      return this.users.getPasswordHash(credentials.username, (e, hash) => {
        if (e) {
          if (e.toString() === 'Error: ' + credentials.username + ' does not exist in the system')
            return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);
          return callback(e);
        }
        this.matchPassword(credentials.password, hash, (e, match) => {
          if (e) return callback(e);
          if (!match)
            return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);
          return this.__loginOK(credentials, user, sessionId, callback);
        });
      });
    });
  }
};
