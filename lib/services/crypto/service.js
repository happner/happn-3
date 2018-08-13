module.exports = CryptoService;

var uuid = require('uuid');

CryptoService.prototype.initialize = initialize;
CryptoService.prototype.verifyHash = verifyHash;
CryptoService.prototype.generateHash = generateHash;
CryptoService.prototype.symmetricEncrypt = symmetricEncrypt;
CryptoService.prototype.symmetricDecrypt = symmetricDecrypt;
CryptoService.prototype.asymmetricEncrypt = asymmetricEncrypt;
CryptoService.prototype.asymmetricDecrypt = asymmetricDecrypt;
CryptoService.prototype.symmetricEncryptObject = symmetricEncryptObject;
CryptoService.prototype.symmetricDecryptObject = symmetricDecryptObject;
CryptoService.prototype.sign = sign;
CryptoService.prototype.verify = verify;
CryptoService.prototype.validatePublicKey = validatePublicKey;
CryptoService.prototype.validatePrivateKey = validatePrivateKey;
CryptoService.prototype.createKeyPair = createKeyPair;
CryptoService.prototype.keyPairFromWIF = keyPairFromWIF;
CryptoService.prototype.keyPairToWIF = keyPairToWIF;
CryptoService.prototype.serializeKeyPair = serializeKeyPair;
CryptoService.prototype.deserializeKeyPair = deserializeKeyPair;
CryptoService.prototype.generateNonce = generateNonce;

function CryptoService(opts) {
  var Logger;

  if (opts && opts.logger) {
    Logger = opts.logger.createLogger('Crypto');
  } else {
    Logger = require('happn-logger');
    Logger.configure({
      logLevel: 'info'
    });
  }

  this.log = Logger.createLogger('Crypto');
  this.log.$$TRACE('construct(%j)', opts);
}

function initialize(config, callback) {
  this.config = config;

  var Crypto = require('happn-util-crypto');

  this.crypto = new Crypto();
  this.passwordHash = require('happn-password-hash-and-salt');

  callback();
}

function verifyHash(secret, hash, callback) {
  return this.passwordHash(secret).verifyAgainst(hash, callback);
}

function generateHash(secret, callback) {
  return this.passwordHash(secret).hash(callback);
}

function symmetricEncrypt(passphrase, salt, message) {
  return this.crypto.symmetricEncrypt(passphrase, salt, message);
}

function symmetricDecrypt(passphrase, salt, message) {
  return this.crypto.symmetricDecrypt(passphrase, salt, message);
}

function asymmetricEncrypt(publicKey, privateKey, message) {
  return this.crypto.asymmetricEncrypt(publicKey, privateKey, message);
}

function asymmetricDecrypt(publicKey, privateKey, message) {
  return this.crypto.asymmetricDecrypt(publicKey, privateKey, message);
}

function symmetricEncryptObject(obj, algorithm) {
  return this.crypto.symmetricEncryptObject(obj, algorithm);
}

function symmetricDecryptObject(encrypted, algorithm) {
  return this.crypto.symmetricDecryptObject(encrypted, algorithm);
}

function sign(hash, privateKey, hashEncoding) {
  return this.crypto.sign(hash, privateKey, hashEncoding);
}

function verify(hash, signature, publicKey, hashEncoding) {
  try {
    return this.crypto.verify(hash, signature, publicKey, hashEncoding);
  } catch (e) {
    return false;
  }
}

function validatePublicKey(publicKey, encoding) {
  return this.crypto.validatePublicKey(publicKey, encoding);
}

function validatePrivateKey(privateKey, encoding) {
  return this.crypto.validatePrivateKey(privateKey, encoding);
}

function createKeyPair() {
  return this.crypto.createKeyPair();
}

function keyPairFromWIF(wif) {
  return this.crypto.keyPairFromWIF(wif);
}

function keyPairToWIF(keyPair) {
  return this.crypto.keyPairToWIF(keyPair);
}

function serializeKeyPair(keypair, secret, salt) {
  var keyPairString = JSON.stringify(keypair);

  if (secret) return this.symmetricEncrypt(secret, keyPairString, salt);
  else return keyPairString;
}

function deserializeKeyPair(string, secret, salt) {
  var keyPairString = string;

  if (secret) keyPairString = this.symmetricDecrypt(secret, string, salt);

  return JSON.parse(keyPairString);
}

function generateNonce(randomValue) {
  return this.crypto.generateNonce(randomValue);
}
