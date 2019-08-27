var MongoClient = require('mongodb').MongoClient;

module.exports = function (url, collectionName) {
  return new Promise((resolve, reject) => {
    MongoClient.connect(url, function (err, client) {
      if (err) return reject(err);
      let db = client.db(collectionName);
      db.collection(collectionName).drop(function (err) {
        client.close();
        if (err && err.message == 'ns not found') {
          return resolve(); // no such collection to delete
        }
        if (err) return reject(err);
        resolve();
      });
    });
  });
};
