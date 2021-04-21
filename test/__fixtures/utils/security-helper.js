const Happn = require('happn-3');
module.exports = class SecurityHelper {
    static create () {
        return new SecurityHelper();
    }

    async upsertUser(user, happnInstance) {
        return await happnInstance.services.security.users.upsertUser(user);
    }

    async createGroup(group, happnInstance) {
        return await happnInstance.services.security.groups.upsertGroup(group);
    }

    async linkGroup(group, user, happnInstance) {
        return await happnInstance.services.security.groups.linkGroup(group, user);
    }

    async createClient(credentials) {
        return await Happn.client.create(credentials);
    }
}