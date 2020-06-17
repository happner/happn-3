describe('06_login_promise', function() {
  const HappnClient = window.HappnClient;
  this.timeout(60000);

  it('tests the browser promise warning - callback', function(done) {
    HappnClient.create(
      {
        port: 55002,
        config: {
          username: '_ADMIN',
          password: 'happn'
        }
      },
      function(e, instance) {
        if (e) return done(e);
        instance.disconnect(done);
      }
    );
  });

  it('tests the browser promise warning - no callback', function(done) {
    HappnClient.create({
      port: 55002,
      config: {
        username: '_ADMIN',
        password: 'happn'
      }
    });
    setTimeout(done, 5000);
  });
});
