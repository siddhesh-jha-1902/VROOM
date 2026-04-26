const fs = require('fs');
const readline = require('readline');
require('dotenv').config();

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const FIREBASE_SIGNER_KEY = process.env.FIREBASE_SIGNER_KEY; 
const FIREBASE_SALT_SEPARATOR = process.env.FIREBASE_SALT_SEPARATOR;
const FIREBASE_ROUNDS = process.env.FIREBASE_ROUNDS; 
const FIREBASE_MEM_COST = process.env.FIREBASE_MEM_COST;

if (!CLERK_SECRET_KEY || !FIREBASE_SIGNER_KEY || !FIREBASE_SALT_SEPARATOR || !FIREBASE_ROUNDS || !FIREBASE_MEM_COST) {
  console.error("❌ Missing required environment variables in backend/.env!");
  console.error("Please ensure FIREBASE_SIGNER_KEY, FIREBASE_SALT_SEPARATOR, FIREBASE_ROUNDS, and FIREBASE_MEM_COST are all set.");
  process.exit(1);
}

async function run() {
  const fileStream = fs.createReadStream('C:/Users/DELL/users.csv');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  console.log("🚀 Starting user migration to Clerk...");

  for await (const line of rl) {
    const parts = line.split(',');
    if (parts.length < 5) continue;
    
    const localId = parts[0];
    const email = parts[1];
    const passwordHash = parts[3];
    const salt = parts[4];
    
    const payload = {
      external_id: localId,
      email_address: [email],
    };
    
    // If they have a password hash, they used Email/Password. 
    // If not, they used Google Sign In and don't have a password.
    if (passwordHash && salt) {
      payload.password_hasher = 'scrypt_firebase';
      payload.password_digest = `${passwordHash}$${salt}$${FIREBASE_SIGNER_KEY}$${FIREBASE_SALT_SEPARATOR}$${FIREBASE_ROUNDS}$${FIREBASE_MEM_COST}`;
    } else {
      payload.skip_password_requirement = true;
    }
    
    try {
      const res = await fetch('https://api.clerk.com/v1/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        if (data.errors && data.errors[0]?.code === 'form_identifier_exists') {
          console.log(`⚠️ User ${email} already exists in Clerk. Skipping.`);
        } else {
           console.error(`❌ Failed to migrate ${email}:`, data.errors || data);
        }
      } else {
        console.log(`✅ Successfully migrated: ${email}`);
      }
    } catch (e) {
      console.error(`❌ Network error migrating ${email}:`, e);
    }
  }
  console.log("✨ Migration script finished!");
}

run();
