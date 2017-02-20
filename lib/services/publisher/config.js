
function PublisherConfig(){}

PublisherConfig.prototype.CONSISTENCY = {
  DEFERRED:0,//get a consistency report back after the subscribes have been notified
  QUEUED:1,//queues the publication, then calls back
  TRANSACTIONAL:2,//waits until all recipients have been written to
  ACKNOWLEDGED:3//waits until all recipients have acknowledged
};

PublisherConfig.prototype.setProperty = function(recipient, name, value){
  Object.defineProperty(recipient, name, {value:value});
};

module.exports = new PublisherConfig();
