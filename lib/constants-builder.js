var constants = require('./constants');

Object.keys(constants).forEach(function(constantBranch) {
  constants[`${constantBranch}_COLLECTION`] = Object.values(constants[constantBranch]);
});

module.exports = constants;
