function PublisherConfig() {
}

PublisherConfig.prototype.setProperty = function (recipient, name, value) {
  Object.defineProperty(recipient, name, {value: value, writable: true});
};

module.exports = new PublisherConfig();
