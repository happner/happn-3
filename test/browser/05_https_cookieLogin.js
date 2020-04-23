describe.only('05 cookie login', function() {
  const HappnClient = window.HappnClient;
  const expect = window.expect;
  this.timeout(120e3);

  it('tests the secure cookie can be grabbed if we are going directly to an https instance of happn', async () => {
    let opts = {
      port: 55003,
      protocol: 'http',
      username: '_ADMIN',
      password: 'happn'
    };
    let client = await connectClient(opts);
    // await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'http',
      useCookie: true
    };
    client = await connectClientCookie(opts);
    // await testClient(55003);
    await client.disconnect();
    await new Promise(resolve => setTimeout(resolve, 10000));
  });

  it('we fail to login with a cookie if it is not there', async () => {
    let opts = {
      port: 55003,
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    };
    let client = await connectClient(opts);
    await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    document.cookie = 'happn_token_https=';
    try {
      await connectClientCookie(opts);
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
    let client = await connectClient(opts);
    await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    // reconnect without deleting cookie.
    client = await connectClientCookie(opts);
    await testClient(55003);
    await client.disconnect({ deleteCookie: true });
    try {
      await connectClientCookie(opts);
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
    let client = await connectClient(opts);
    await testClient(55003);
    await client.disconnect();
    opts = {
      port: 55003,
      protocol: 'https',
      useCookie: true
    };
    // reconnect without deleting cookie.
    client = await connectClientCookie(opts);
    await testClient(55003);
    await client.disconnect({ revokeToken: true });
    try {
      await connectClientCookie(opts);
      throw new Error('should not connect');
    } catch (e) {
      expect(e.message).to.eql('token has been revoked');
    }
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

  function connectClient(opts) {
    return new Promise((resolve, reject) => {
      HappnClient.create(opts, function(e, instance) {
        if (e) return reject(e);
        return resolve(instance);
      });
    });
  }

  function connectClientCookie(opts) {
    return new Promise((resolve, reject) => {
      HappnClient.create(opts, function(e, instance) {
        if (e) return reject(e);
        return resolve(instance);
      });
    });
  }
});
