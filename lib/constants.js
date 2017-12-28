  module.exports = {
    ERROR_TYPE: {
      NOT_FOUND: 404,
      SYSTEM: 500,
      ACCESS_DENIED: 403,
      INVALID_CREDENTIALS: 401
    },
    CONSISTENCY: {
      QUEUED: 0, //get a consistency report back after the subscribes have been notified
      DEFERRED: 1, //queues the publication, then calls back
      TRANSACTIONAL: 2, //waits until all recipients have been written to
      ACKNOWLEDGED: 3 //waits until all recipients have acknowledged
    },
    CLIENT_STATE: {
      UNINITIALIZED: 0,
      ACTIVE: 1,
      DISCONNECTED: 2,
      ERROR: 3,
      RECONNECTING: 4,
      CONNECTING: 5,
      CONNECTED: 6,
      DISCONNECTING: 7,
      CONNECT_ERROR: 8
    },
    CONNECTION_POOL_TYPE: {
      ORDERED: 0,
      RANDOM: 1
    },
    SYSTEM_HEALTH: {
      EXCELLENT: 0,
      FAIR: 1,
      TAKING_STRAIN: 2,
      POOR: 3
    },
    ERROR_SEVERITY: {
      LOW: 0,
      MEDIUM: 1,
      HIGH: 2,
      FATAL: 3
    }
  };
