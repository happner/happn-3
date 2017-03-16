var packager = require('./packager');

module.exports = {
  client: require('./client'),
  service: require('./service'),
  constants: require('./constants'),
  packager: require('./packager'),
  package: packager,
  protocol: packager.protocol,
  version: packager.version,
  bucket: require('./services/subscription/bucket'),
  bucketStrict: require('./services/subscription/bucket-strict')
};
