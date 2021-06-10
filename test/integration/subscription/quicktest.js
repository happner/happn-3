const { performance } = require("perf_hooks");
const fs = require("fs");
const path = require('path')
const wait = require("await-delay");
// var heapdump = require('heapdump');
/*arguments happnVersion, 
nestedAllowed
pathsFile
permissionsFile
testType
iterations
*/
//Process env Arguments:\

let permissions = {}
for (let i = 1; i<2; i++) {          
  permissions['/TEST/'+ i.toString() + '/*'] = {actions: ["on", "get"]};
}

let testType = 'memory'
const happn = require('../../../lib');
let paths = ['/TEST/1/1'] //  , '/TEST/1/2', '/TEST/1/3', '/TEST/1/4', '/TEST/1/5', '/TEST/1/6'] 
var test_dbfile = path.resolve(__dirname, "../../__fixtures/tmp/testdb.test");
if (fs.existsSync(test_dbfile)) fs.unlinkSync(test_dbfile);

let config ={
        secure: true,
        allowNestedPermissions: true,
        services: {
          data: {
            config: {
              filename: test_dbfile,
            },
          },
        },
      }

var service = happn.service;
var happn_client = happn.client;
let happnInstance;

happn.service.create(config, async (e, service) => {
  if (e) throw e;
  let serviceInstance = service;

  let testGroup = {
    name: "TEST GROUP",
    permissions,
  };

  let addedTestGroup =
    await serviceInstance.services.security.users.upsertGroup(testGroup, {
      overwrite: false,
    });

  const testUser = {
    username: "TEST",
    password: "TEST PWD",
    permissions: {},
  };

  let addedTestuser = await serviceInstance.services.security.users.upsertUser(
    testUser,
    {
      overwrite: false,
    }
  );

  await serviceInstance.services.security.users.linkGroup(
    addedTestGroup,
    addedTestuser
  );

  let testClient = await happn_client.create({
    username: testUser.username,
    password: "TEST PWD",
  });

  let adminClient = await serviceInstance.services.session.localClient({
    username: "_ADMIN",
    password: "happn",
  });
  let t0, t1;
  let heapDiff;

  let eventCount = 0;
  let handler = (data) => {
    console.log("HAndler called")
  };
  for (i = 1; i < 2; i++) {
    await testClient.on("/TEST/" + i.toString() + "/**", handler);
  }
  let subs = await serviceInstance.services.subscription.subscriptions.search('/*/TEST/1/1')
  console.log(JSON.stringify(subs, null,2))
  console.log("SUBS 1")
  // if (testType == "memory") {
  //   memwatch.gc();
  //   heapdump.writeSnapshot(test_preoutfile);


  //   // heapDiff = new memwatch.HeapDiff();
  // }
  // if (testType == "time") {
  // //   t0 = performance.now();
  // // }
  // for (let random of paths) {
  //   await serviceInstance.services.security.groups.upsertPermission(
  //     addedTestGroup.name,
  //     random,
  //     "on"
  //   );
  // }

  // subs = await serviceInstance.services.subscription.subscriptions.search('/*/TEST/1/1')
  // console.log(JSON.stringify(subs, null,2))
  // console.log("SUBS 2")
  // await wait(1000);

  // for (let random of paths) {
  //   await serviceInstance.services.security.groups.removePermission(
  //     addedTestGroup.name,
  //     random,
  //     "on"
  //   );
  // }
  // subs = await serviceInstance.services.subscription.subscriptions.search('/*/TEST/1/1')
  // console.log(JSON.stringify(subs, null,2))
  // console.log("SUBS 3")
  // if (testType == "time") {
  //   t1 = performance.now();
  //   let delta = t1 - t0;
  //   process.send(delta.toString());
  // }

  // if (testType == "memory") {
  //   await wait(10000);
  //   memwatch.gc();
  //   heapdump.writeSnapshot(test_outfile);

  //   // heap = heapDiff.end();
  //   // fs.writeFileSync(test_outfile, JSON.stringify(heap, null,2))
  // }0
  // let subs = await serviceInstance.services.subscription.subscriptions.search('/*/TEST/1/1')
  // console.log(JSON.stringify(subs, null,2))
  await adminClient.set('/TEST/1/1', { test: 1 });
  await testClient.offAll();

  if (testClient)
    testClient.disconnect({
      reconnect: false,
    });
  if (adminClient)
    adminClient.disconnect({
      reconnect: false,
    });

  setTimeout(serviceInstance.stop
  , 3000);
});
