module.exports = class PermissionsStore {
  constructor() {
    this.stored = {};
  }
  static create() {
    return new PermissionsStore();
  }
  getSync(permissionKey, userId) {
    return (this.stored[permissionKey] && this.stored[permissionKey][userId]) || null;
  }
  setSync(permissionKey, userId, data) {
    this.stored[permissionKey] = this.stored[permissionKey] || {};
    this.stored[permissionKey][userId] = data;
  }
  clear() {
    this.stored = {};
  }
};
