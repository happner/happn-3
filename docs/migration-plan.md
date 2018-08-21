SERVER MIGRATION
-----------------

## configuration

### services 
*we have broken up services a bit more, and added some new ones, what follows are key services whoes config has changed from happn2*

#### database
*the database is now versioned in the package.json, if you try and run happn-3 on an old database (mongo or nedb) startup will fail, unless you configure the data service setting autoUpdateDBVersion:true*
```javascript
var config = {
  services: {
    database:{
      config:{
        autoUpdateDBVersion:true
      }
    }
  }
}
```
#### transport service
*of note here is how to now configure your server for https mode:*
```javascript
var config = {
  services: {
    transport:{
      config:{
        mode: 'https',
        cert: '-----BEGIN CERTIFICATE-----\nMIICpDCCAYwCCQDlN4Axwf2TVzANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDEwls\nb2NhbGhvc3QwHhcNMTYwMTAzMTE1NTIyWhcNMTcwMTAyMTE1NTIyWjAUMRIwEAYD\nVQQDEwlsb2NhbGhvc3QwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDc\nSceGloyefFtWgy8vC7o8w6BTaoXMc2jsvMOxT1pUHPX3jJn2bUOUC8wf3vTM8o4a\n0HY+w7cEZm/BuyTAV0dmS5SU43x9XlCF877jj5L6+ycZDncgyqW3WUWztYyqpQEz\nsMu76XvNEHW+jMMv2EGtze6k1zIcv4FiehVZR9doNOm+SilmmfVpmTmQk+E5z0Bl\n8CSnBECfvtkaYb4YqsV9dZXZcAm5xWdid7BUbqBh5w5XHz9L4aC9WiUEyMMUtwcm\n4lXDnlMkei4ixyz8oGSeOfpAP6Lp4mBjXaMFT6FalwCDAKh9rH2T3Eo9fUm18Dof\nFg4q7KcLPwd6mttP+dqvAgMBAAEwDQYJKoZIhvcNAQELBQADggEBABf8DZ+zv1P7\n8NnDZzuhif+4PveSfAMQrGR+4BS+0eisciif1idyjlxsPF28i82eJOBya4xotRlW\netAqSIjw8Osqxy4boQw3aa+RBtEAZR6Y/h3dvb8eI/jmFqJzmFjdGZzEMO7YlE1B\nxZIbA86dGled9kI1uuxUbWOZkXEdMgoUzM3W4M1ZkWH5WNyzIROvOGSSD73c1fAq\nkeC9MkofvTh3TO5UXFkLCaaPLiETZGI9BpF34Xm3NHS90Y7SUVdiawCVCz9wSuki\nD98bUTZYXu8dZxG6AdgAUEFnMuuwfznpdWQTUpp0k7jbsX/QTbFIjbI9lCZpP9k7\np07A5npzFVo=\n-----END CERTIFICATE-----',
        key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA3EnHhpaMnnxbVoMvLwu6PMOgU2qFzHNo7LzDsU9aVBz194yZ\n9m1DlAvMH970zPKOGtB2PsO3BGZvwbskwFdHZkuUlON8fV5QhfO+44+S+vsnGQ53\nIMqlt1lFs7WMqqUBM7DLu+l7zRB1vozDL9hBrc3upNcyHL+BYnoVWUfXaDTpvkop\nZpn1aZk5kJPhOc9AZfAkpwRAn77ZGmG+GKrFfXWV2XAJucVnYnewVG6gYecOVx8/\nS+GgvVolBMjDFLcHJuJVw55TJHouIscs/KBknjn6QD+i6eJgY12jBU+hWpcAgwCo\nfax9k9xKPX1JtfA6HxYOKuynCz8HeprbT/narwIDAQABAoIBADoWFk+t6PxtbCQ+\nyTVNkVkueFsmjotfrz4ldDCP7RCa5lzVLU/mddhW2AdbYg+csc3uRA++ycaWQEfE\nUieJnCEkMtSju5LPSMpZgG8+z5Hwodmgj9cMuG/FUXTWnXXttohryP0Ozv8+pN2O\n/nTiQEdVMuUyfVtJQBO4f2KgZ/No6uuSGhYEGFRTRUgdM1E1f2yTu82HIfETAbnW\nMHpdhQORQKmHr7cE9/sr7E+BhJPSQxGZKmgi+/8tiHXAW5MoZ4K88EO9V/BnVHcL\n/1uVUJOvcyf2mEtsQ22WCeelPChoE8TH1lf0HHadqse5+eu9l3LQWb4Z96fZRK7G\nesk+WAkCgYEA/ZueKDbiyT2i9pS1VDop9BLDaxC3GWwYAEU8At/KzXAfuKdzcduj\nZuMBecS5SgU3wW/1hqBJ2lQF8ifUzQUuyh1tydSnolafurvHDqkWzgbo6EbjjFro\nAyyHHtYRxo/f1TWWs6RpNjJ3hDCc3OpghkwkZkN9v9wd4RMCW2kdA2MCgYEA3l20\nhxpSTJffbKKQTAxURW9v+YUxNQFb74892AMlCnMiCppvS0it8wt0gJwnlNPV92no\nUVLZ+gVXdo8E+kKca4GW/TDgceDPqw2EbkTF1ZCxxy/kwgPWR471ku3Zyg6xel3Z\nMU67EriKz1zJaMjm7JmSjoz3+u8PbLYIf+fpm0UCgYAnkU0GtzGA9lXjpOX5oy2C\ngB7vKGd41u2TtTmctS/eB51bYPzZCcyfs9E6H2BNVS0SyBYFkCKVpsBavK4t4p4f\nOKI1eDFDWcKIDt4KwoTlVhymiNDdyB0kyaC3Rez2DuJ8UGUX2BH2O797513B9etj\naKPRNLx836nlwOKAQpEdQwKBgQCvV7io6CqJVyDI6w9ZyEcTUaI8YbjBkUbLimo7\n0Y79xHfNYKXt+WuhQSEm4PudMcWBCTQ2HFzh+CBVzsUgCjKJ23ASSt5RLfLTcR9C\nTFyr4SMubCe4jYoEd0hSCdg4qolscmB3rxt40agzh3kSdYkSfK7CVYqdhrDlCk19\nfoQI+QKBgQD9PIEvhEnQO0R1k3EzchRo67IkWLyR4uX4hXa7IOXppde9dAwhbZqP\nUkw8tqj7Cg02hfXq+KdRn+xfh6pc708RMqqdqNqSfL2PYedAR65hDKV4rL8PVmL9\n0P4j3FT1nwa/sHW5jLuO5TcevPrlhEQ9xVbKw7I7IJivKMamukskUA==\n-----END RSA PRIVATE KEY-----'
      }
    }
  }
}
```

####protocol service
*the protocol service is what controls the http/s server, this is where you can inject inbound and outbound message handlers:*
```javascript
var inboundLayers = [
  function(message, cb){
    layerLog3.push(message);
    return cb(null, message);
  },
  function(message, cb){
    layerLog4.push(message);
    return cb(null, message);
  }
];

var outboundLayers = [
  function(message, cb){
    layerLog1.push(message);
    return cb(null, message);
  },
  function(message, cb){
    layerLog2.push(message);
    return cb(null, message);
  }
];

var serviceConfig = {
  secure: true,
  services:{
    protocol:{
      config:{
        outboundLayers:outboundLayers,
        inboundLayers:inboundLayers
      }
    }
  }
};
```

####security service
*the security service, and its attendant utility helpers, users and checkpoint, manages users and groups, and via the checkpoint performs authentication and authorization functions, user and group management has changed as we now have a users helper*

```

//old happn
myInstance.services.security.upsertUser(...
myInstance.services.security.upsertGroup(...
myInstance.services.security.listGroups...
myInstance.services.security.liunkGroup...

//new happn
myInstance.services.security.users.upsertUser(...
myInstance.services.security.users.upsertGroup(...
myInstance.services.security.users.listGroups...
myInstance.services.security.users.liunkGroup...

```

####session service
*the session service controls primus, and also manages client sessions*



####pubsub service
*in happn v2, this service what effectively doing everything from managing sessions to starting up the http/s server and finally what it was meant to, manage subsriptions, now all it does is manage subscriptions*


CLIENT MIGRATION:
-----------------

##configuration
 
###no more config.config
*the client config is simpler, just key value pairs, instead of a .config branch, this is backwards compatible still, but it is recommended to change your configs if possible*

```javascript

//OLD
var clientConfig = {config:{username:'simon', port:10000}}
//
//
//NEW
var clientConfig = {username:'simon', port:10000}

```

##intra-proc client
*the intra-proc client is now instantiated via the session service:*

```javascript


//OLD
 happn_client.create({
        plugin: happn.client_plugins.intra_process,
        context: happnInstance
      }, function (e, instance) { ...
//
//
//NEW
 happnInstance.services.session.localClient(function(e, instance){...

```
##protocol changes:
*the happn protocol has changed in 3 places:*

###disconnect message form server:
*the server will warn all clients that they are about to be diconnected from the server side:*
```javascript

```

###disconnect message from client:
*to disconnect the client form the server properly, post a disconnect message*
```javascript

```

###error message

```javascript
OLD: {error:{name:'AccessDenied: unauthorized'}}

NEW: {error:{name:'AccessDenied', message:'unauthorized'}}

```
