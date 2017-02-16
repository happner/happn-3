
function PublisherConfig(){}

PublisherConfig.prototype.CONSISTENCY = {
  OPTIMISTIC:0,
  QUEUED:1,
  TRANSACTIONAL:2,
  ACKNOWLEDGED:3
};

PublisherConfig.prototype.setProperty = function(recipient, name, value){
  Object.defineProperty(recipient, name, {value:value});
};

module.exports = new PublisherConfig();
