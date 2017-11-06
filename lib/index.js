var packager = require('./packager');

module.exports = {
  client: require('./client'),
  service: require('./service'),
  constants: require('./constants'),
  packager: require('./packager'),
  package: packager,
  protocol: packager.protocol,
  version: packager.version
};
