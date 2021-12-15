module.exports = {
  ERROR_TYPE: {
    NOT_FOUND: 404,
    SYSTEM: 500,
    ACCESS_DENIED: 403,
    INVALID_CREDENTIALS: 401
  },
  CONSISTENCY: {
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
    CONNECT_ERROR: 8,
    RECONNECT_ACTIVE: 9
  },
  CONNECTION_POOL_TYPE: {
    ORDERED: 0,
    RANDOM: 1
  },
  UPSERT_TYPE: {
    UPSERT: 0,
    UPDATE: 1,
    INSERT: 2
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
  },
  AUTHORIZE_ACTIONS: {
    GET: 'get',
    SET: 'set',
    ON: 'on',
    REMOVE: 'remove'
  },
  UNAUTHORISED_REASONS: {
    EXPIRED_TOKEN: 'expired session token',
    INACTIVITY_THRESHOLD_REACHED: 'session inactivity threshold reached',
    SESSION_USAGE: 'session usage limit reached',
    NO_POLICY_SESSION: 'no policy attached to session',
    NO_POLICY_SESSION_TYPE: 'no policy for session type'
  },
  CLIENT_HEADERS: {
    X_FORWARDED_PROTO: 'x-forwarded-proto',
    X_FORWARDED_PORT: 'x-forwarded-port',
    X_FORWARDED_FOR: 'x-forwarded-for',
    HOST: 'host',
    SEC_WEBSOCKET_EXTENSIONS: 'sec-websocket-extensions',
    SEC_WEBSOCKET_KEY: 'sec-websocket-key',
    SEC_WEBSOCKET_VERSION: 'sec-websocket-version'
  },
  SECURITY_DIRECTORY_EVENTS: {
    LINK_GROUP: 'link-group',
    UNLINK_GROUP: 'unlink-group',
    DELETE_USER: 'delete-user',
    DELETE_GROUP: 'delete-group',
    UPSERT_GROUP: 'upsert-group',
    PERMISSION_REMOVED: 'permission-removed',
    PERMISSION_UPSERTED: 'permission-upserted',
    UPSERT_USER: 'upsert-user',
    TOKEN_REVOKED: 'token-revoked',
    TOKEN_RESTORED: 'token-restored',
    LOOKUP_TABLE_CHANGED: 'lookup-table-changed',
    LOOKUP_PERMISSION_CHANGED: 'lookup-permission-changed',
    LOOKUP_PERMISSION_UPSERTED: 'lookup-permission-upserted'
  },
  SECURITY_DIRECTORY_CHANGE_EVENTS: {
    LINK_GROUP: 'link-group',
    PERMISSION_REMOVED: 'permission-removed',
    PERMISSION_UPSERTED: 'permission-upserted',
    UNLINK_GROUP: 'unlink-group',
    DELETE_GROUP: 'delete-group',
    UPSERT_GROUP: 'upsert-group',
    UPSERT_USER: 'upsert-user'
  }
};
