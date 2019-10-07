module.exports = BatchDataItem;

BatchDataItem.prototype.initialize = initialize;
BatchDataItem.prototype.insert = insert;
BatchDataItem.prototype.empty = empty;

function BatchDataItem(options, db) {
  this.options = options;
  this.queued = [];
  this.callbacks = [];
  this.db = db;
}

function initialize() {
  //empty our batch based on the timeout
  this.timeout = setTimeout(this.empty.bind(this), this.options.batchTimeout);
}

function insert(data, callback) {
  this.queued.push(data);

  this.callbacks.push(callback);

  //empty the queue when we have reached our batch size
  if (this.queued.length >= this.options.batchSize) return this.empty();

  //as soon as something lands up in the queue we start up a timer to ensure it is emptied even when there is a drop in activity
  if (this.queued.length === 1) this.initialize(); //we start the timer now
}

function empty() {
  clearTimeout(this.timeout);

  var opIndex = 0;

  var _this = this;

  var emptyQueued = [];

  var callbackQueued = [];

  //copy our insertion data to local scope

  emptyQueued.push.apply(emptyQueued, this.queued);

  callbackQueued.push.apply(callbackQueued, this.callbacks);

  //reset our queues
  this.queued = [];

  this.callbacks = [];

  //insert everything in the queue then loop through the results
  _this.db.insert(
    emptyQueued,
    this.options,
    function(e, response) {
      // do callbacks for all inserted items
      callbackQueued.forEach(function(cb) {
        if (e) return cb.call(cb, e);

        cb.call(cb, null, {
          ops: [response.ops[opIndex]]
        });

        opIndex++;
      });
    }.bind(this)
  );
}
