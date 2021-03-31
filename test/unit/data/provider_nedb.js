const testName = require('../../__fixtures/utils/test_helper')
  .create()
  .testName(__filename, 3);

describe(testName, function() {
  this.timeout(60000);

  const fs = require('fs');
  const path = require('path');

  const sinon = require('sinon');
  const chai = require('chai');
  chai.use(require('sinon-chai'));
  const expect = chai.expect;
  const async = require('async');

  var dbFiles = [];

  function getNedbProvider(withCloning, withFsync) {
    return new Promise((res, rej) => {
      const NedbProvider = require('../../../lib/services/data/providers/nedb');
      const fileName = path.resolve(
        __dirname,
        '../../__fixtures/test/unit/data/' + testName.split('/')[2] + Date.now() + '.nedb'
      );

      dbFiles.push(fileName);

      const newProvider = new NedbProvider({
        filename: fileName,
        fsync: !!withFsync
        //compactInterval:5000 //enable to see the classic field names cannot contain . error
      });

      if (!withCloning)
        newProvider.utils = {
          clone: function(obj) {
            //eslint-disable-next-line no-console
            console.log('skipping clone...');
            return obj;
          }
        };

      newProvider.initialize(function(e) {
        if (e) return rej(e);
        return res(newProvider);
      });
    });
  }

  after('it deletes the db files', function() {
    dbFiles.forEach(function(fileName) {
      try {
        require('fs').unlinkSync(fileName);
      } catch (e) {
        //eslint-disable-next-line no-console
        console.log('error unlining file: ' + fileName);
      }
    });
  });

  it('tests data being saved by the provider is decoupled [non-fsync]', async function() {
    const provider = await getNedbProvider(true);
    let foundExternalData = false;

    await async.timesSeries(5, function(time, timeCB) {
      const setData = {
        data: {
          test: 1,
          testObject: {
            'test/1': 1,
            'test/2': 2
          }
        }
      };

      const decoupled = JSON.parse(JSON.stringify(setData.data.testObject));
      delete setData.data.testObject;
      //eslint-disable-next-line no-console
      console.log('upsert attempt ' + time);

      provider.upsert('/path/test', setData, {}, false, function(e) {
        if (e) return timeCB(e);
        setData.data.testObject = decoupled;
        provider.findOne(
          {
            path: '/path/test'
          },
          {},
          function(e, found) {
            if (e) return timeCB(e);
            if (found.data.testObject != null) {
              foundExternalData = true;
            }
            setTimeout(timeCB, 2000);
          }
        );
      });
    });

    expect(foundExternalData).to.be.false;
  });

  it('tests data being saved by the provider is decoupled, negative test [non-fsync]', async function() {
    const provider = await getNedbProvider(false);
    let foundExternalData = false;

    await async.timesSeries(5, function(time, timeCB) {
      const setData = {
        data: {
          test: 1,
          testObject: {
            'test/1': 1,
            'test/2': 2,
            'test.1': 3
          }
        }
      };

      const decoupled = JSON.parse(JSON.stringify(setData.data.testObject));
      delete setData.data.testObject;
      //eslint-disable-next-line no-console
      console.log('upsert attempt ' + time);

      provider.upsert('/path/test', setData, {}, false, function(e) {
        if (e) return timeCB(e);
        setData.data.testObject = decoupled;
        provider.findOne(
          {
            path: '/path/test'
          },
          {},
          function(e, found) {
            if (e) return timeCB(e);
            if (found.data.testObject != null) {
              //eslint-disable-next-line no-console
              console.log('found testObject in cached db!');
              foundExternalData = true;
            }
            setTimeout(timeCB, 2000);
          }
        );
      });
    });

    expect(foundExternalData).to.be.true;
  });

  it('tests data being saved by the provider is decoupled [fsync]', async function() {
    const fsyncSpy = sinon.spy(fs, 'fsync');

    const provider = await getNedbProvider(true, true);
    let foundExternalData = false;

    await async.timesSeries(5, function(time, timeCB) {
      const setData = {
        data: {
          test: 1,
          testObject: {
            'test/1': 1,
            'test/2': 2
          }
        }
      };

      const decoupled = JSON.parse(JSON.stringify(setData.data.testObject));
      delete setData.data.testObject;
      //eslint-disable-next-line no-console
      console.log('upsert attempt ' + time);

      provider.upsert('/path/test', setData, {}, false, function(e) {
        if (e) return timeCB(e);
        setData.data.testObject = decoupled;
        provider.findOne(
          {
            path: '/path/test'
          },
          {},
          function(e, found) {
            if (e) return timeCB(e);
            if (found.data.testObject != null) {
              foundExternalData = true;
            }
            setTimeout(timeCB, 2000);
          }
        );
      });
    });

    expect(foundExternalData).to.be.false;
    expect(fsyncSpy).to.have.been.called;

    fsyncSpy.restore();
  });

  it('tests data being saved by the provider is decoupled, negative test [fsync]', async function() {
    const fsyncSpy = sinon.spy(fs, 'fsync');

    const provider = await getNedbProvider(false, true);
    let foundExternalData = false;

    await async.timesSeries(5, function(time, timeCB) {
      const setData = {
        data: {
          test: 1,
          testObject: {
            'test/1': 1,
            'test/2': 2,
            'test.1': 3
          }
        }
      };

      const decoupled = JSON.parse(JSON.stringify(setData.data.testObject));
      delete setData.data.testObject;
      //eslint-disable-next-line no-console
      console.log('upsert attempt ' + time);

      provider.upsert('/path/test', setData, {}, false, function(e) {
        if (e) return timeCB(e);
        setData.data.testObject = decoupled;
        provider.findOne(
          {
            path: '/path/test'
          },
          {},
          function(e, found) {
            if (e) return timeCB(e);
            if (found.data.testObject != null) {
              //eslint-disable-next-line no-console
              console.log('found testObject in cached db!');
              foundExternalData = true;
            }
            setTimeout(timeCB, 2000);
          }
        );
      });
    });

    expect(foundExternalData).to.be.true;
    expect(fsyncSpy).to.have.been.called;

    fsyncSpy.restore();
  });
});
