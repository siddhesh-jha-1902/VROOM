const http = require('http');

const data = JSON.stringify({
  emergencyEmail: 'test@example.com',
  subject: 'Test',
  html: 'test'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sos',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
