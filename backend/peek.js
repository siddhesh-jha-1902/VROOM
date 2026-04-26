const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
async function peek() {
  const users = await db.collection('users').get();
  console.log('Users count:', users.size);
  const drivers = await db.collection('drivers').get();
  console.log('Drivers count:', drivers.size);
}
peek().catch(console.error);
