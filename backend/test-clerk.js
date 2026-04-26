const { users } = require('@clerk/clerk-sdk-node');
require('dotenv').config();

async function test() {
  try {
    const userList = await users.getUserList({ limit: 1 });
    console.log("Success! Users found:", userList.length);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
