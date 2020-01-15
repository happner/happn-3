const Happn = require('../../..'),
      HappnService = Happn.service;
const program = require("commander");

program
  .option("-p, --port [port]", "Port")
  .parse(process.argv);

const port = program.port || 55000;

HappnService.create({port}, function(e) {
  //eslint-disable-next-line
  if (e) console.log(`error:::${e.message}`);
});
