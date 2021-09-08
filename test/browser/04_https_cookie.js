describe('04 https cookie', function() {
  const HappnClient = window.HappnClient,
    expect = window.expect;
  this.timeout(120e3);

  it('tests the secure cookie can be grabbed if we are going directly to an https instance of happn', async () => {
    const client = await connectClient({
      port: 55003,
      protocol: 'https',
      username: '_ADMIN',
      password: 'happn'
    });
    await testClient(55003);
    await client.disconnect({ deleteCookie: true });
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
});
