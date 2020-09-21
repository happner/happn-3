/* eslint-disable no-console */
const OLD_CLIENTS_COUNT = 1;
const NEW_CLIENTS_COUNT = 1;
const MODULUS = 30;
const happn = require('../../../lib/index');
const Service = happn.service;
const Client = happn.client;
const OldHappn = require('happn');
const OldClient = OldHappn.client;
const existingOldClients = [];
const existingNewClients = [];

async function runTest() {
  await startServer();
  console.log('starting old clients...');
  await startClients(OLD_CLIENTS_COUNT, true);
  console.log('starting new clients...');
  await startClients(NEW_CLIENTS_COUNT);
  console.log('starting old activity...');
  startOldActivity(OLD_CLIENTS_COUNT)();
  console.log('starting new activity...');
  startNewActivity(NEW_CLIENTS_COUNT)();
}

runTest();

async function startServer() {
  return new Promise((resolve, reject) => {
    Service.create({ secure: true }, (e, instance) => {
      if (e) return reject(e);
      instance.services.session.on('disconnect', ev => {
        console.log(`disconnect: ${JSON.stringify(ev)}`);
      });
      instance.services.session.on('authentic', ev => {
        console.log(`authentic: ${JSON.stringify(ev)}`);
      });
      resolve();
    });
  });
}

async function startClients(clientCount, old) {
  for (let i = 0; i < clientCount; i++) {
    let newClient = await connectClient(i, old);
    if (old) existingOldClients.push(newClient);
    else existingNewClients.push(newClient);
  }
}

async function connectClient(i, old) {
  return new Promise((resolve, reject) => {
    console.log(`${old ? 'old' : 'new'} client ${i} starting...`);
    if (old)
      return OldClient.create(
        {
          config: { username: '_ADMIN', password: 'happn' },
          secure: true
        },
        function(e, instance) {
          if (e) return reject(e);
          console.log(`${old ? 'old' : 'new'} client ${i} started...`);
          instance.on(
            `/event/${i}`,
            () => {
              console.log(`hit event handler for client ${i}`);
            },
            e => {
              if (e) return reject(e);
              resolve(instance);
            }
          );
        }
      );
    Client.create(
      {
        config: { username: '_ADMIN', password: 'happn' },
        secure: true
      },
      function(e, instance) {
        if (e) return reject(e);
        console.log(`${old ? 'old' : 'new'} client ${i} started...`);
        instance.on(
          `/event/${i}`,
          () => {
            console.log(`hit event handler for client ${i}`);
          },
          e => {
            if (e) return reject(e);
            resolve(instance);
          }
        );
      }
    );
  });
}

var currentOldInterval = 0;
var currentNewInterval = 0;

function startOldActivity(clientCount) {
  return async () => {
    currentOldInterval++;
    if (currentOldInterval % MODULUS === 0) await reconnectClients(true);
    else {
      const clientId1 = Math.floor(Math.random() * clientCount);
      const clientId2 = Math.floor(Math.random() * clientCount);
      console.log(`doing set: ${clientId1} to ${clientId2}`);
      existingOldClients[clientId1].set(`/event/${clientId2}`, clientId1, e => {
        if (!e) console.log(`did set: ${clientId1} to ${clientId2}`);
      });
    }
    setTimeout(startOldActivity(clientCount), 1000);
  };
}

function startNewActivity(clientCount) {
  return async () => {
    currentNewInterval++;
    if (currentNewInterval % MODULUS === 0) await reconnectClients();
    else {
      const clientId1 = Math.floor(Math.random() * clientCount);
      const clientId2 = Math.floor(Math.random() * clientCount);
      console.log(`doing set: ${clientId1} to ${clientId2}`);
      existingNewClients[clientId1].set(`/event/${clientId2}`, clientId1, e => {
        if (!e) console.log(`did set: ${clientId1} to ${clientId2}`);
      });
    }
    setTimeout(startNewActivity(clientCount), 1000);
  };
}

async function reconnectClients(old) {
  let count = NEW_CLIENTS_COUNT;
  let clientsColl = existingNewClients;
  if (old) {
    count = OLD_CLIENTS_COUNT;
    clientsColl = existingOldClients;
  }
  await disconnectClients(clientsColl);
  await startClients(count, old);
}

async function disconnectClients(coll) {
  for (var client of coll) {
    await client.disconnect();
    coll.splice(coll.indexOf(client), 1);
  }
}
