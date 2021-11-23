module.exports = function(ParentClass) {
  return class TestAuthProvider extends ParentClass {
    constructor(happn, config) {
      super(happn, config);
    }

    static create(happn, config) {
      return new TestAuthProvider(happn, config);
    }
   __providerCredsLogin(credentials, sessionId, callback) {      
      if (credentials.username === "secondTestuser@somewhere.com" && credentials.password === "secondPass") {        
        let user = {username: "secondTestuser@somewhere.com", groups:[]}
        return this.__loginOK(credentials, user, sessionId, callback);
      }
      return this.__loginFailed(credentials.username, 'Invalid credentials', null, callback);
      }
  };
};
