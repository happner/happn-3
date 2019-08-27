module.exports = function(port, proxyPort, swimPort, swimHosts, mongoCollection, mongoUrl, clusterSize, seed, secure, activateSessionManagement){
  let config = {
    port,
    services: {
      data: {
        config: {
          datastores: [
            {
              name: 'mongo',
              provider: 'happn-service-mongo-2',
              isDefault: true,
              settings: {
                collection: mongoCollection,
                database: mongoCollection,
                url: mongoUrl
              }
            }
          ]
        }
      },
      orchestrator: {
        config: {
          minimumPeers: clusterSize
        }
      },
      membership: {
        config: {
          clusterName: 'cluster1',
          seed: seed,
          seedWait: 2000,
          joinType: 'static',
          host: '0.0.0.0',
          port: swimPort,
          hosts: swimHosts,
          joinTimeout: 2000,
          pingInterval: 1000,
          pingTimeout: 200,
          pingReqTimeout: 600
        }
      },
      proxy: {
        config: {
          host: '0.0.0.0',
          port: proxyPort,
          allowSelfSignedCerts: true
        }
      }
    }
  };

  if (secure) {
    config.secure = true;
    config.services.security = {
      config: {
        activateSessionManagement:activateSessionManagement,
        sessionTokenSecret:'sessionTokenSecret',
        adminUser: {
          username: '_ADMIN',
          password: 'secret'
        }
      }
    };
  }

  return config;
};
