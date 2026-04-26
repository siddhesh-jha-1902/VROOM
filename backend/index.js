require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
const nodemailer = require('nodemailer');

// Configure Gmail SMTP transporter for SOS emails
let mailTransporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });
  console.log('✅ Gmail SMTP transporter configured for SOS emails.');
} else {
  console.warn('WARNING: GMAIL_USER or GMAIL_APP_PASSWORD not set. SOS emails will not be sent.');
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
// You must have FIREBASE_SERVICE_ACCOUNT_PATH or credentials set in your environment
try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK. Please ensure firebase-service-account.json exists:', error.message);
}

// Endpoint to mint Firebase Custom Token for a Clerk-authenticated user
app.post('/api/auth/firebase-token', ClerkExpressRequireAuth(), async (req, res) => {
  try {
    const clerkUserId = req.auth.userId;
    
    if (!clerkUserId) {
      return res.status(401).json({ error: 'Unauthorized: No Clerk user ID found.' });
    }

    // Fetch the full Clerk User Profile to check for externalId (migrated Firebase UID)
    const { users } = require('@clerk/clerk-sdk-node');
    const clerkUser = await users.getUser(clerkUserId);
    
    // If the user was manually imported from Firebase via CSV, their old UID is in externalId
    const firebaseUid = clerkUser.externalId || clerkUserId;

    // Mint a custom Firebase token using the appropriate UID
    const customToken = await admin.auth().createCustomToken(firebaseUid);
    
    res.status(200).json({ token: customToken });
  } catch (error) {
    console.error('Error generating Firebase Custom Token:', error);
    res.status(500).json({ error: 'Failed to generate Firebase Custom Token.' });
  }
});

// For backward compatibility while testing, or just a simple health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Public endpoint for Landing page stats
app.get('/api/stats', async (req, res) => {
  try {
    const db = admin.firestore();
    const tripsSnap = await db.collection('trips').count().get();
    const driversSnap = await db.collection('drivers').count().get();
    
    res.json({
      totalTrips: tripsSnap.data().count,
      totalDrivers: driversSnap.data().count
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Emergency SOS Endpoint
app.post('/api/sos', async (req, res) => {
  try {
    const { emergencyEmail, subject, html, userType, userId, tripId, location } = req.body;

    if (!emergencyEmail) {
      return res.status(400).json({ error: 'emergencyEmail is required' });
    }

    // Attempt to log the alert to Firestore
    try {
      const db = admin.firestore();
      await db.collection('sosAlerts').add({
        emergencyEmail,
        subject,
        userType: userType || 'unknown',
        userId: userId || 'unknown',
        tripId: tripId || 'unknown',
        location: location || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending' // can be updated by admin later
      });
    } catch (dbErr) {
      console.error('Failed to log SOS to Firestore:', dbErr);
      // We continue to send the email even if logging fails
    }

    // Send email using Nodemailer (Gmail SMTP)
    let data = null;
    if (mailTransporter) {
      data = await mailTransporter.sendMail({
        from: `"Vroom Emergency Alert" <${process.env.GMAIL_USER}>`,
        to: emergencyEmail,
        subject: subject || 'EMERGENCY SOS ALERT',
        html: html || '<p>An emergency SOS alert was triggered.</p>'
      });
      console.log('SOS email sent successfully to:', emergencyEmail);
    } else {
      console.log('Simulating SOS email (Gmail credentials missing):', { to: emergencyEmail, subject });
      data = { simulated: true };
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error sending SOS email:', error);
    res.status(500).json({ error: 'Failed to send SOS email.' });
  }
});

app.listen(PORT, () => {
  console.log(`Vroom Auth Backend (Clerk + Firebase) running on port ${PORT}`);
});
