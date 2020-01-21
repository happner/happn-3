const Happn = require('../../../lib/index');
const Service = Happn.service;
const port = 55555;
const testHelper = require('../../__fixtures/utils/test_helper').create();

describe(
  testHelper.testName(__filename, 3),
  function() {
    this.timeout(20000);
    let blocker;

    before('starts the service that blocks the port', async () => {
      blocker = await Service.create({port});
    });

    it('attempts to start a server on the same port, gets the correct error message', async () => {
      try{
        await Service.create({port});
      }catch(e){
        testHelper.expect(e.message).to.be(`timeout`);
      }
    });

    after('stops the service that blocks the port', async () => {
      await blocker.stop();
      // issue with blocked service holding on to resources, leaving in for reference
      //await testHelper.printOpenHandles(2000);
    });
});
