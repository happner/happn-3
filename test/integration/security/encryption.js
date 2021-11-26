describe(
  require('../../__fixtures/utils/test_helper')
    .create()
    .testName(__filename, 3),
  function() {
    var expect = require('expect.js');
    var async = require('async');
    var Logger = require('happn-logger');

    var testConfigs = {};

    testConfigs.data = {};

    testConfigs.crypto = {};

    var testServices = {};

    testServices.crypto = require('../../../lib/services/crypto/service');
    testServices.utils = require('../../../lib/services/utils/service');

    before('should initialize the service', function(callback) {
      var happnMock = {
        services: {
          system: {
            package: require('../../../package.json')
          }
        }
      };

      async.eachSeries(
        ['utils', 'crypto'],
        function(serviceName, eachServiceCB) {
          testServices[serviceName] = new testServices[serviceName]({
            logger: Logger
          });
          testServices[serviceName].happn = happnMock;

          happnMock.services[serviceName] = testServices[serviceName];

          if (!happnMock.services[serviceName].initialize) return eachServiceCB();
          else testServices[serviceName].initialize(happnMock.services[serviceName], eachServiceCB);
        },
        callback
      );
    });

    var generatedPrivateKey;
    var generatedPublicKey;

    it('should generate a keypair', function(callback) {
      var keyPair = testServices.crypto.createKeyPair();

      generatedPrivateKey = keyPair.privateKey;
      generatedPublicKey = keyPair.publicKey;

      callback();
    });

    it('should serialize and deserialize a keypair', function(callback) {
      var keyPair = testServices.crypto.createKeyPair();
      var keyPairSerialized = testServices.crypto.serializeKeyPair(keyPair);
      var keyPairDeserialized = testServices.crypto.deserializeKeyPair(keyPairSerialized);

      expect(typeof keyPairSerialized).to.be('string');
      expect(keyPairDeserialized.publicKey.toString()).to.be(keyPair.publicKey.toString());
      expect(keyPairDeserialized.privateKey.toString()).to.be(keyPair.privateKey.toString());

      callback();
    });

    it('should encrypt and decrypt data using the security layer', function(callback) {
      var message = 'this is a secret';

      var encrypted = testServices.crypto.asymmetricEncrypt(generatedPrivateKey, message);

      var decrypted = testServices.crypto.asymmetricDecrypt(generatedPublicKey, encrypted);

      if (message === encrypted) throw new Error('encrypted data matches secret message');
      if (message !== decrypted.toString())
        throw new Error('decrypted data does not match secret message');

      callback();
    });

    it('should encrypt and decrypt data using symmetric hashing in the security layer', function(callback) {
      var message = 'this is a secret';
      testServices.crypto.generateHash(message, function(e, hash) {
        if (e) return callback(e);

        testServices.crypto.verifyHash(message, hash, function(e, verified) {
          if (e) return callback(e);
          expect(verified).to.be(true);
          callback();
        });
      });
    });
  }
);
