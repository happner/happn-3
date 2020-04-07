const HttpProxy = require("http-proxy");
const program = require("commander");
const fs = require("fs");

program
  .option("-h, --host [host]", "Host")
  .option("-p, --port [port]", "Port")
  .option("-l, --listen [listen]", "Listen port")
  .option("-s, --secure [secure]", "Secure")
  .parse(process.argv);

let host = program.host || 'localhost';
let port = program.port || 55000;
let listen = program.listen || 11235;
let secure = program.secure || false;

const proxyConfig = {target:`ws://${host}:${port}`, ws: true, xfwd: true};

if (secure) {
  proxyConfig.ssl = {
    key: fs.readFileSync(`${__dirname}/key.rsa`, 'utf8'),
    cert: fs.readFileSync(`${__dirname}/cert.pem`, 'utf8')
  }
}

let proxy = HttpProxy
  .createProxyServer(proxyConfig);

proxy.listen(listen);
