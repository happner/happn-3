describe('05 cookie login', function() {
  const HappnClient = window.HappnClient;
  const expect = window.expect;
  this.timeout(20e3);

  it('tests we are able to login with a cookie and not raise a runaway promise warning', function(done) {
    let opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    connectClientCookieNotPromise(opts, done);
  });

  it('tests the secure cookie can be grabbed if we are going directly to an https instance of happn', async () => {
    let opts = {
      port: 55003,
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    };
    let client = await HappnClient.create(opts);
    await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    client = await HappnClient.create(opts);
    await testClient(55003);
    await client.disconnect();
  });

  it('we fail to login with a cookie if it is not there', async () => {
    let opts = {
      port: 55003,
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    };
    let client = await HappnClient.create(opts);
    await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    document.cookie = 'happn_token_https=';
    try {
      await HappnClient.create(opts);
      throw new Error('should not connect');
    } catch (e) {
      expect(e.message).to.eql('happn server is secure, please specify a username or token');
    }
  });

  it('the cookie is removed if the right flag is passed', async () => {
    let opts = {
      port: 55003,
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    };
    let client = await HappnClient.create(opts);
    await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    // reconnect without deleting cookie.
    client = await HappnClient.create(opts);
    await testClient(55003);
    expect(document.cookie.indexOf('happn_token_https')).to.not.eql(-1);
    await client.disconnect({ deleteCookie: true });
    expect(document.cookie.indexOf('happn_token_https')).to.eql(-1);
    try {
      await HappnClient.create(opts);
      throw new Error('should not connect');
    } catch (e) {
      expect(e.message).to.eql('happn server is secure, please specify a username or token');
    }
  });

  it("can't log in with a cookie if the session is revoked", async () => {
    let opts = {
      port: 55003,
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    };
    let client = await HappnClient.create(opts);
    await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    // reconnect without deleting cookie.
    client = await HappnClient.create(opts);
    await testClient(55003);
    await client.disconnect({ revokeToken: true });
    try {
      await HappnClient.create(opts);
      throw new Error('should not connect');
    } catch (e) {
      expect(e.message).to.eql('token has been revoked');
    }
  });

  it('checks the cookie events', async () => {
    let cookieEvents = [];
    const cookieEventHandler1 = (event, cookie) => {
      cookieEvents.push({
        event: `${event}1`,
        cookie
      });
    };
    const cookieEventHandler2 = (event, cookie) => {
      cookieEvents.push({
        event: `${event}2`,
        cookie
      });
    };
    let opts1 = {
      port: 55003,
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn',
      deleteCookie: true,
      cookieEventHandler: cookieEventHandler1,
      cookieEventInterval: 750
    };
    let client1 = await HappnClient.create(opts1);
    await delay(3000);
    let client2 = await HappnClient.create({
      port: 55003,
      protocol: 'https',
      useCookie: true,
      cookieEventHandler: cookieEventHandler2
    });
    await delay(3000);
    await client1.disconnect({ deleteCookie: true });
    await delay(3000);
    client1 = await HappnClient.create(opts1); // we reconnect
    await delay(5000);
    const eventKeys = cookieEvents.map(evt => {
      return evt.event;
    });
    expect(eventKeys).to.eql([
      // client1 connects
      'cookie-write1',
      'cookie-created1',
      //client 2 connects with client1's cookie
      'cookie-write2',
      'cookie-created2',
      //client1 expires cookie on disconnection
      'cookie-expired1',
      'cookie-deleted1',
      //client2 detects missing cookie, disconnects and emits cookie deleted
      'cookie-deleted2',
      //client1 reconnects
      'cookie-write1',
      'cookie-created1',
      //client2 detects cookie - and emits cookie created
      'cookie-created2'
    ]);
    await client2.disconnect({ deleteCookie: true });
  });

  function doPost(path, port, callback) {
    const Http = new XMLHttpRequest();
    Http.open('POST', `https://localhost:${port || 55003}${path}`, true);
    Http.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    Http.send({ post: 'data' });
    Http.onreadystatechange = function() {
      // Call a function when the state changes.
      if (this.readyState === XMLHttpRequest.DONE) {
        callback(null, { statusCode: this.status });
      }
    };
  }

  function testClient(port) {
    return new Promise((resolve, reject) => {
      doPost('/test/web/route', port, function(error, response) {
        try {
          expect(error).to.eql(null);
          expect(response.statusCode).to.equal(200);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async function delay(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  function connectClientCookieNotPromise(opts, callback) {
    HappnClient.create(opts, callback);
  }
});
