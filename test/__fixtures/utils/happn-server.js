const Happn = require('../../..'),
      HappnService = Happn.service;
const program = require("commander");

program
  .option("-p, --port [port]", "Port")
  .option("-s, --secure [secure]", "start secure")
  .parse(process.argv);

const port = program.port || 55000;
const config = {port};
if (program.secure === "true") config.secure = true;
HappnService.create(config, function(e, instance) {
  //eslint-disable-next-line
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
