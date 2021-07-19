const request = require('request');
const _ = require('lodash');
const AuthProvider = require('./provider-base');

const summonConfig = {
  host: 'http://localhost:4201',
  route: '/api/auth/login',
  additionalHeaders: {
    app: 'summon-client'
  }
};
let requestOptions = {
    url: summonConfig.host + summonConfig.route,
    headers: summonConfig.additionalHeaders,
    json: true
}
module.exports = class Happn3AuthProvider extends AuthProvider {
  constructor(happn, config) {
    super(happn, config);
  }

  static create(happn, config) {
    return new Happn3AuthProvider(happn, config);
  }

  login(credentials, sessionId, request, callback) {
    let email = credentials.username ? credentials.username : '';
    let password = credentials.password || null;
    if (typeof sessionId === 'function') {
      callback = sessionId;
      sessionId = null;
    }
    let loginCreds = {
        email,
    }
requestOptions.body =  {email:"janco@tenacious.digital", password: "CunTjuggl4r"}
request.post(requestOptions, (e,r,b) => {
    console.log("Error", e)
    console.log(r.statusCode)
    console.log({b})
})

requestOptions.body =  {email:"janco@tenacious.digital", password: "wrong"}
request.post(requestOptions, (e,r,b) => {
    console.log("Error", e)
    console.log(r.statusCode)
    console.log({b})
})