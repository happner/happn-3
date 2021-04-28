const happn = require('../../../lib/index');
module.exports = class ServerHelper {
    static create () {
        return new ServerHelper();
    }
    async createServer(config) {
        return await happn.service.create(config);
    }
}