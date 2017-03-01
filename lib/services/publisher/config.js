function PublisherConfig() {
}

PublisherConfig.prototype.setProperty = function (recipient, name, value) {
  Object.defineProperty(recipient, name, {value: value});
};

module.exports = new PublisherConfig();
