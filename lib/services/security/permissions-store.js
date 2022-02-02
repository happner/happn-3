module.exports = class PermissionsStore {
  constructor() {}
  static create() {
    return new PermissionsStore();
  }
  getSync(permissionKey, userId) {
    return (this[permissionKey] && this[permissionKey][userId]) || null;
  }
  setSync(permissionKey, userId, data) {
    this[permissionKey] = this[permissionKey] || {};
    this[permissionKey][userId] = data;
  }
  clear() {
    for (let key of Object.keys(this)) {
      if (typeof this[key] !== 'function') {
        delete this[key];
      }
    }
  }
};
