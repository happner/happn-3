const happn = require('../../../..');
const service = happn.service;

class HappnTestHelper {
  constructor(serverConfig) {
    this.serverConfig = serverConfig;
  }

  static create(serverConfig) {
    return new HappnTestHelper(serverConfig);
  }

  async createService() {
    return new Promise((resolve, reject) => {
      service.create(this.serverConfig, (e, happnInst) => {
        if (e) return reject(e);
        resolve(happnInst);
      });
    });
  }

  createLocalClient() {
    if (this.serverConfig.secure)
      return new Promise((resolve, reject) => {
        this.service.services.session.localAdminClient((e, instance) => {
          if (e) return reject(e);
          resolve(instance);
        });
      });
    return new Promise((resolve, reject) => {
      this.service.services.session.localClient((e, instance) => {
        if (e) return reject(e);
        resolve(instance);
      });
    });
  }

  async initialize() {
    this.service = await this.createService();
    this.listenerclient = await this.createLocalClient();
    this.publisherclient = await this.createLocalClient();
  }

  tearDown() {
    return new Promise((resolve, reject) => {
      this.service.stop(function(e) {
        if (e) return reject(e);
        resolve();
      });
    });
  }
}

module.exports = HappnTestHelper;
