const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function test() {
  try {
    const q = db.collection('trips')
      .where('driverId', '==', 'test')
      .where('status', 'in', ['Assigned', 'InProgress', 'Disrupted']);
    
    const snapshot = await q.get();
    console.log("Success! snapshot size:", snapshot.size);
  } catch (err) {
    console.error("Query failed!", err);
  }
}

test();
