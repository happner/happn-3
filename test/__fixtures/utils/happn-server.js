const Happn = require('../../..'),
      HappnService = Happn.service;
const program = require("commander");

program
  .option("-p, --port [port]", "Port")
  .option("-s, --secure [secure]", "start secure")
  .option("-h, --protocol [protocol]", "protocol")
  .option("-c, --cookie [cookie]", "https cookie")
  .parse(process.argv);

const port = program.port || 55000;
const config = {port, services:{}};
if (program.secure === "true") config.secure = true;

if (program.protocol === "https") {
  config.services.transport = {
    config:{
      mode: 'https'
    }
  }
}
if (program.cookie === "true") {
  config.services.security = {
    config:{
      httpsCookie: true
    }
  }
}
HappnService.create(config, function(e, instance) {
  //eslint-disable-next-lines
  if (e) console.log(`error:::${e.message}`);
  instance.connect.use('/test/web/route', function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        received: 1
      })
    );
  });
});
