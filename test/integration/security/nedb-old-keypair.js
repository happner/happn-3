const test = require('../../__fixtures/utils/test_helper').create();
describe(test.testName(__filename, 3), function() {
  it('is able to startup an instance based on an old keypair (bitcore)', async () => {
    const filename = require('path').resolve(
      __dirname,
      '../../../__fixtures/test/integration/security/old-keypair.nedb'
    );
    const originalfilename = require('path').resolve(
      __dirname,
      '../../../__fixtures/test/integration/security/old-keypair-original.nedb'
    );
    test.fs.writeFileSync(filename, test.fs.readFileSync(originalfilename));
    const config = {
      secure: true,
      services: {
        data: {
          config: {
            autoUpdateDBVersion: true,
            filename
          }
        }
      }
    };
    //just create and destroy instance, startup should not be impacted
    await test.destroyInstance(await test.createInstance(config));
  });
});
