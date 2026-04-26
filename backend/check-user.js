require('dotenv').config();

async function run() {
  const res = await fetch('https://api.clerk.com/v1/users?email_address=keshav@gmail.com', {
    headers: { 'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}` }
  });
  const data = await res.json();
  console.dir(data, { depth: null });
}
run();
