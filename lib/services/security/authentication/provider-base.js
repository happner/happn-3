const jwt = require('jwt-simple'),
  sift = require('sift').default,
  uuidv1 = require('uuid/v1');

module.exports = class AuthProvider {
  constructor(happn, config) {
    this.happn = happn;
    this.cryptoService = this.happn.services.crypto;
    this.cacheService = this.happn.services.cache;
    this.sessionService = this.happn.services.session;
    this.securityService = this.happn.services.security;
    //Security service functions that couldn't be de-coupled;
    this.authorize = this.securityService.authorize.bind(this.securityService);
    this.generatePermissionSetKey = this.securityService.generatePermissionSetKey.bind(this.securityService);
    this.decodeToken = this.securityService.decodeToken.bind(this.securityService);
    this.__checkRevocations = this.securityService.__checkRevocations.bind(this.securityService);
    this.users = this.securityService.users;
    this.__initializeProfiles(config);
    this.config = config;
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

  login(credentials, sessionId, request, callback) {
    return this.__loginFailed(null, new Error('No authentication provider configured'), callback);
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

  __loginOK(credentials, user, sessionId, callback, tokenLogin) {
    delete user.password;
    if (this.__locks) this.__locks.removeSync(user.username); //remove previous locks
    callback(null, this.generateSession(user, sessionId, credentials, tokenLogin));
  }

  __loginFailed(specificMessage, e, callback) {
    let message = 'Invalid credentials';

    if (specificMessage) message = specificMessage;

    if (e) {
      if (e.message) message = message + ': ' + e.message;
      else message = message + ': ' + e.toString();
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

  __checkLockedOut() {
    return false;
  }

  generateSession(user, sessionId, credentials, tokenLogin) {
    let session = this.generateEmptySession(sessionId);
    session.httpsCookie = this.config.httpsCookie;
    session.info = credentials.info;
    if (tokenLogin) session.type = tokenLogin.session.type;
    else session.type = 1; //stateful
    session.user = user;
    session.timestamp = Date.now();
    if (tokenLogin) session.parentId = tokenLogin.session.id;
    else session.parentId = session.id;
    session.isEncrypted = credentials.isEncrypted ? true : false;
    session.origin = this.happn.services.system.name;

    this.__profileSession(session); //session ttl, activity threshold and user effective permissions are set here

    session.permissionSetKey = this.generatePermissionSetKey(session.user, session);

    if (tokenLogin) session.token = tokenLogin.token;
    else session.token = this.generateToken(session);

    // It is not possible for the login (websocket call) to assign the session token (cookie) server side,
    // so the cookie is therefore created in the browser upon login success.
    // It is necessary to include how to make the cookie in the login reply via this session object.
    session.cookieName = this.config.cookieName;
    //if we are logging in via websockets (and possibly the browser), we want to ensure the correct cookie name is used
    if (this.config.httpsCookie && sessionId) {
      let sessionInfo = this.sessionService.getSession(sessionId);
      if (
        sessionInfo.headers['x-forwarded-proto'] === 'https' ||
        sessionInfo.headers['x-forwarded-proto'] === 'wss' ||
        sessionInfo.encrypted
      )
        session.cookieName = `${this.config.cookieName}_https`;
    }
    if (this.config.cookieDomain) session.cookieDomain = this.config.cookieDomain;
    if (session.isEncrypted) session.secret = uuidv1().replace(/-/g, '');
    return session;
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

 checkTokenUserId(token, callback) {
    if (!this.config.lockTokenToUserId) return callback(null, true);
    this.users.getUser(token.username, (e, user) => {
      if (e) return callback(e);
      if (!user) return callback(null, true); //user doesnt exist, authorize fails at a later point
      if (!user.userid) return callback(null, true); //backward compatibility - old users
      callback(null, user.userid === token.userid);
    });
  }
};
