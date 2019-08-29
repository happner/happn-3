// return first external ipv4 address

var os = require('os');

module.exports = function () {
  var interfaces = os.networkInterfaces();
  var keys = Object.keys(interfaces);
  var iface, address;
  for (var i = 0; i < keys.length; i++) {
    iface = interfaces[keys[i]];
    for (var j = 0; j < iface.length; j++) {
      address = iface[j];
      if (address.internal) continue;
      if (address.family !== 'IPv4') continue;
      return address.address;
    }
  }
};
