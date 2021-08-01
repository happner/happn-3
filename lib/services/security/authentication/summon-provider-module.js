const request = require('request');
const wait = require('await-delay');
const axios = require('axios');
const _ = require('lodash');
const AuthProvider = require('./provider-base');
let knownErrorMessages = ['Invalid credentials', 'User does not have access to fieldpop'];
const summonTestConfig = {
  host: 'http://localhost:4201',
  login: '/api/auth/login',
  verify: '/api/auth/verifyToken',
  refresh: '/api/auth/refreshTokens',
  additionalHeaders: {
    app: 'summon-client'
  }
};

module.exports = class SummonAuthProvider extends AuthProvider {
  constructor(happn, config) {
    super(happn, config);
    this.summonConfig = config.summon || summonTestConfig;
    this.summonRequests = axios.create({
      baseURL: summonConfig.host,
      headers: summonConfig.additionalHeaders
    });
    this.summonRequests.login = _.curry(this.summonRequests.post, 2)(summonConfig.login);
    this.summonRequests.verify = _.curry(this.summonRequests.post, 2)(summonConfig.verify);
    this.summonRequests.refresh = _.curry(this.summonRequests.post, 2)(summonConfig.refresh);
  }

  static create(happn, config) {
    return new SummonAuthProvider(happn, config);
  }

  async init() {}

  async __providerTokenLogin(credentials, previousSession, sessionId, callback) {
    try {
      if (!(await this.checkTokenUserId(previousSession)))
        return this.accessDenied(
          `token userid does not match userid for username: ${previousSession.username}`,
          callback
        );
      
      let { RefreshToken } = previousSession.AWS;
      let { AccessToken, IdToken } = await this.__refreshToken({ RefreshToken });  //Throws 'Error on refreshing token'

      let [authorized, reason] = await this.authorize(previousSession, null, 'login');
      if (!authorized) return this.invalidCredentials(reason, callback);

      let user = await this.users.getUser(previousSession.username);
      if (user == null) return this.invalidCredentials('Invalid credentials', callback);
      let session = {
        ...previousSession,
        AWS: {
          AccessToken,
          IdToken,
          RefreshToken
        }
      }
      let token = generateToken(session);
      return this.__loginOK(credentials, user, sessionId, callback, {
        session,
        token
      });
    } catch (e) {
      
    }
  }

  async __providerCredsLogin(credentials, sessionId, callback) {
    credentials = credentials || {};
    let username = credentials.username || credentials.email || '';
    try {
      let tokens = await this.__summonLogin(credentials);
      let userInfo = await this.__verifyToken(tokens.AccessToken);

      if (userInfo.email !== credentials.username && userInfo.email !== credentials.email)
        throw new Error('Invalid Credentials');
      if (!userInfo.roles.includes['fieldpop-user'] && !userInfo.roles.includes['fieldpop-OEM'])
        throw new Error('User does not have access to fieldpop');

      let storedUser = await this.users.getUser(username);
      if (userInfo.email === storedUser.email || userInfo.email === storedUser.username)
        return this.__loginOk();
      else throw new Error('Invalid Credentials');
    } catch (e) {
      if (e.toString() === 'Error: ' + username + ' does not exist in the system') {
        await this.createUser(credentials);
        return this.__loginOK();
      }
      let message = knownErrorMessages.includes(e.message) ? e.message : 'Internal Server Error';
      return this.__loginFailed(username, message, null, callback);
    }
  }

  async __summonLogin(credentials) {
    let email = credentials.email || credentials.username || '';
    let password = credentials.password || '';
    let response = await this.summonRequests.login({ email, password });
    if (response.status === 491) throw new Error('Invalid credentials');
    if (response.status !== 200 || response.data.data.errors)
      throw new Error('Internal Server Error');
    return response.data.data.tokens;
  }

  async __verifyToken(token) {
    try {
      let response = await this.summonRequests.verify({ AccessToken: token });
      if (response.status === 491) throw new Error('Invalid credentials');
      if (response.status !== 200 || response.data.data.errors)
        throw new Error('Internal Server Error');
      let email = response.data.data.email;
      let roles = response.data.data.userRoles.map(role => role.Name);
      return { email, roles };
    } catch (e) {
      throw new Error('Could not verify token');
    }
  }

  async __refreshToken(token) {
    let response = await this.summonRequests.verify({ AccessToken: token });
    if (response.status === 491) throw new Error('Error on refreshing token');
    if (response.status !== 200 || response.data.data.errors)
      throw new Error('Internal Server Error');
    let { AccessToken, IdToken } = response.data.data;
    return { AccessToken, IdToken };
  }
}