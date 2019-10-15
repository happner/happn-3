module.exports = function(name) {
  return new Promise((resolve, reject) => {
    let MongoClient = require('mongodb').MongoClient;
    MongoClient.connect(
      'mongodb://127.0.0.1:27017',
      { useNewUrlParser: true, useUnifiedTopology: true },
      function(err, client) {
        if (err) return reject(err);
        var db = client.db(name);

        db.dropDatabase(function(err) {
          if (err) return reject(err);
          client.close(resolve);
        });
      }
    );
  });
};
