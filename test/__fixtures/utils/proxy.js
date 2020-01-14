const HttpProxy = require('http-proxy');
var program = require("commander");

program
  .option("-h, --host [host]", "Host")
  .option("-p, --port [port]", "Port")
  .option("-l, --listen [listen]", "Listen port")
  .parse(process.argv);

let host = program.host || 'localhost';
let port = program.port || 55000;
let listen = program.listen || 11235;

HttpProxy
  .createProxyServer({target:`ws://${host}:${port}`, ws: true})
  .listen(listen);
