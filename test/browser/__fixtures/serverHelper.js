var happn = require('../../../lib/index');
var service = happn.service;

class ServerHelper {

  constructor() {
    this.servers = [];
  }
  async killServers() {

    for (var serverIndex in this.servers)
      await this.killServer(this.servers[serverIndex]);
  }
  async killServer(server) {

    return new Promise((resolve, reject) => {

      server.stop(function(e) {
        if (e) return reject(e);
        resolve();
      });
    });
  }
  async createServer(config) {

    return new Promise((resolve, reject) => {

      service.create(config,
        (e, happnInst) => {
          if (e) return reject(e);
          this.servers.push(happnInst);
          resolve(happnInst);
        });
    });
  }
}

module.exports = ServerHelper;
