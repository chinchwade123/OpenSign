import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import axios from 'axios'; // Added for Firebase Identity Toolkit API calls
import { ParseServer } from 'parse-server'; // Will be removed later
import path from 'path';
const __dirname = path.resolve();
import http from 'http';
import admin from 'firebase-admin';
import { readFile } from 'fs/promises'; // To read the service account key

// Firebase Initialization
import { firebaseAuthMiddleware } from './auth/authMiddleware.js'; // Import the auth middleware
try {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(await readFile(serviceAccountPath, 'utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://digitalsign-cb6a2-default-rtdb.firebaseio.com" // From user-provided config
  });
  console.log('Firebase Admin SDK initialized successfully.');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  // Depending on the error, you might want to exit the process
  // process.exit(1);
}
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { ApiPayloadConverter } from 'parse-server-api-mail-adapter';
import S3Adapter from '@parse/s3-files-adapter';
import FSFilesAdapter from '@parse/fs-files-adapter';
import AWS from 'aws-sdk';
import { app as customRoute } from './cloud/customRoute/customApp.js';
import { exec } from 'child_process';
import { createTransport } from 'nodemailer';
import { appName, cloudServerUrl, smtpenable, smtpsecure, useLocal } from './Utils.js';
import { SSOAuth } from './auth/authadapter.js';
import createContactIndex from './migrationdb/createContactIndex.js';
import { validateSignedLocalUrl } from './cloud/parsefunction/getSignedUrl.js';
import maintenance_mode_message from 'aws-sdk/lib/maintenance_mode_message.js';
let fsAdapter;
maintenance_mode_message.suppress = true;
if (useLocal !== 'true') {
  try {
    const spacesEndpoint = new AWS.Endpoint(process.env.DO_ENDPOINT);
    const s3Options = {
      bucket: process.env.DO_SPACE,
      baseUrl: process.env.DO_BASEURL,
      fileAcl: 'none',
      region: process.env.DO_REGION,
      directAccess: true,
      preserveFileName: true,
      presignedUrl: true,
      presignedUrlExpires: 900,
      s3overrides: {
        credentials: {
          accessKeyId: process.env.DO_ACCESS_KEY_ID,
          secretAccessKey: process.env.DO_SECRET_ACCESS_KEY,
        },
        endpoint: spacesEndpoint,
      },
    };
    fsAdapter = new S3Adapter(s3Options);
  } catch (err) {
    console.log('Please provide AWS credintials in env file! Defaulting to local storage.');
    fsAdapter = new FSFilesAdapter({
      filesSubDirectory: 'files', // optional, defaults to ./files
    });
  }
} else {
  fsAdapter = new FSFilesAdapter({
    filesSubDirectory: 'files', // optional, defaults to ./files
  });
}

let transporterMail;
let mailgunClient;
let mailgunDomain;
let isMailAdapter = false;
if (smtpenable) {
  try {
    transporterMail = createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 465,
      secure: smtpsecure,
      auth: {
        user: process.env.SMTP_USERNAME ? process.env.SMTP_USERNAME : process.env.SMTP_USER_EMAIL,
        pass: process.env.SMTP_PASS,
      },
    });
    await transporterMail.verify();
    isMailAdapter = true;
  } catch (err) {
    isMailAdapter = false;
    console.log('Please provide valid SMTP credentials');
  }
} else if (process.env.MAILGUN_API_KEY) {
  try {
    const mailgun = new Mailgun(formData);
    mailgunClient = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY,
    });
    mailgunDomain = process.env.MAILGUN_DOMAIN;
    isMailAdapter = true;
  } catch (error) {
    isMailAdapter = false;
    console.log('Please provide valid Mailgun credentials');
  }
}
const mailsender = smtpenable ? process.env.SMTP_USER_EMAIL : process.env.MAILGUN_SENDER;
export const config = {
  databaseURI:
    process.env.DATABASE_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/dev',
  cloud: function () {
    import('./cloud/main.js');
  },
  appId: process.env.APP_ID || 'opensign',
  logLevel: ['error'],
  maxLimit: 500,
  maxUploadSize: '30mb',
  masterKey: process.env.MASTER_KEY, //Add your master key here. Keep it secret!
  masterKeyIps: ['0.0.0.0/0', '::/0'], // '::1'
  serverURL: cloudServerUrl, // Don't forget to change to https if needed
  verifyUserEmails: false,
  publicServerURL: process.env.SERVER_URL || cloudServerUrl,
  // Your apps name. This will appear in the subject and body of the emails that are sent.
  appName: appName,
  allowClientClassCreation: false,
  allowExpiredAuthDataToken: false,
  encodeParseObjectInCloudFunction: true,
  ...(isMailAdapter === true
    ? {
        emailAdapter: {
          module: 'parse-server-api-mail-adapter',
          options: {
            // The email address from which emails are sent.
            sender: appName + ' <' + mailsender + '>',
            // The email templates.
            templates: {
              // The template used by Parse Server to send an email for password
              // reset; this is a reserved template name.
              passwordResetEmail: {
                subjectPath: './files/password_reset_email_subject.txt',
                textPath: './files/password_reset_email.txt',
                htmlPath: './files/password_reset_email.html',
              },
              // The template used by Parse Server to send an email for email
              // address verification; this is a reserved template name.
              verificationEmail: {
                subjectPath: './files/verification_email_subject.txt',
                textPath: './files/verification_email.txt',
                htmlPath: './files/verification_email.html',
              },
            },
            apiCallback: async ({ payload, locale }) => {
              if (mailgunClient) {
                const mailgunPayload = ApiPayloadConverter.mailgun(payload);
                await mailgunClient.messages.create(mailgunDomain, mailgunPayload);
              } else if (transporterMail) await transporterMail.sendMail(payload);
            },
          },
        },
      }
    : {}),
  filesAdapter: fsAdapter,
  auth: { google: { enabled: true }, sso: SSOAuth },
  // for fix Adapter prototype don't match expected prototype
  push: { queueOptions: { disablePushWorker: true } },
};
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

export const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(function (req, res, next) {
  req.headers['x-real-ip'] = getUserIP(req);
  const publicUrl = 'https://' + req?.get('host');
  req.headers['public_url'] = publicUrl;
  next();
});
function getUserIP(request) {
  let forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    if (forwardedFor.indexOf(',') > -1) {
      return forwardedFor.split(',')[0];
    } else {
      return forwardedFor;
    }
  } else {
    return request.socket.remoteAddress;
  }
}

app.use(async function (req, res, next) {
  const isFilePath = req.path.includes('files') || false;
  if (isFilePath && req.method.toLowerCase() === 'get') {
    const serverUrl = new URL(process.env.SERVER_URL);
    const origin = serverUrl.pathname === '/api/app' ? serverUrl.origin + '/api' : serverUrl.origin;
    const fileUrl = origin + req.originalUrl;
    const params = fileUrl?.split('?')?.[1];
    if (params) {
      const fileRes = await validateSignedLocalUrl(fileUrl);
      if (fileRes === 'Unauthorized') {
        return res.status(400).json({ message: 'unauthorized' });
      }
    } else {
      return res.status(400).json({ message: 'unauthorized' });
    }
    next();
  } else {
    next();
  }
});

// List Templates Route
app.get('/api/templates', firebaseAuthMiddleware, async (req, res) => {
  const requestingUid = req.user.uid;
  // TODO: Implement pagination and filtering (e.g., by isArchived, search term)

  try {
    const templatesRef = admin.database().ref('templates');
    const snapshot = await templatesRef.orderByChild('createdAt').once('value'); // Order by creation time
    const allTemplates = snapshot.val();

    if (!allTemplates) {
      return res.status(200).json([]); // No templates found
    }

    const accessibleTemplates = [];
    // Fetch user's teams once for efficiency if team check is implemented
    // const userTeamsSnapshot = await admin.database().ref(`/user_teams/${requestingUid}`).once('value');
    // const userTeams = userTeamsSnapshot.val() || {};

    for (const templateId in allTemplates) {
      const template = allTemplates[templateId];
      template.id = templateId; // Add id to the object

      if (template.isArchived === true && template.owner !== requestingUid) {
        continue; // Skip archived templates not owned by the requester
      }

      let hasAccess = template.owner === requestingUid ||
                      (template.readAccess && template.readAccess[requestingUid]) ||
                      (template.sharedWithUsers && template.sharedWithUsers[requestingUid]);

      // if (!hasAccess && template.sharedWithTeams) {
      //   for (const teamId in userTeams) {
      //     if (template.sharedWithTeams[teamId]) {
      //       hasAccess = true;
      //       break;
      //     }
      //   }
      // }

      if (hasAccess) {
        // TODO: Handle pre-signed URLs for fileUrl if needed
        accessibleTemplates.push(template);
      }
    }

    // Sort by most recent first before sending (optional, as already ordered by 'createdAt' from DB)
    accessibleTemplates.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));


    res.status(200).json(accessibleTemplates);

  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: 'Failed to list templates.' });
  }
});

// Get Single Template Route
app.get('/api/templates/:templateId', firebaseAuthMiddleware, async (req, res) => {
  const { templateId } = req.params;
  const requestingUid = req.user.uid;

  try {
    const templateRef = admin.database().ref(`templates/${templateId}`);
    const snapshot = await templateRef.once('value');
    const template = snapshot.val();

    if (!template) {
      return res.status(404).json({ error: 'Template not found.' });
    }

    if (template.isArchived === true) {
      // Optionally, only owners or specific roles can see archived templates
      if (template.owner !== requestingUid) {
        return res.status(404).json({ error: 'Template not found (archived).' });
      }
    }

    // Access Control Check (simplified version of GetTemplate.js logic)
    // 1. Owner check
    let hasAccess = template.owner === requestingUid;

    // 2. Direct share check (readAccess map)
    if (!hasAccess && template.readAccess && template.readAccess[requestingUid]) {
      hasAccess = true;
    }

    // 3. SharedWithUsers check (redundant if readAccess is properly maintained, but good for direct query)
    if (!hasAccess && template.sharedWithUsers && template.sharedWithUsers[requestingUid]) {
        hasAccess = true;
    }

    // 4. Team share check (requires fetching user's teams then checking template.sharedWithTeams)
    // This part can be complex and might involve multiple DB reads.
    // For now, we'll acknowledge this would be needed for full parity.
    // A simpler approach for RTDB rules is often preferred for direct data access.
    // If !hasAccess, and we need to check teams:
    //   const userTeamsSnapshot = await admin.database().ref(`/user_teams/${requestingUid}`).once('value');
    //   const userTeams = userTeamsSnapshot.val(); // Assuming this is a map like { teamId1: true, teamId2: true }
    //   if (userTeams && template.sharedWithTeams) {
    //     for (const teamId in userTeams) {
    //       if (template.sharedWithTeams[teamId]) {
    //         hasAccess = true;
    //         break;
    //       }
    //     }
    //   }

    if (!hasAccess) {
        // A more robust team check would be here if the above simplified checks aren't enough.
        // For now, if not owner or in readAccess/sharedWithUsers, deny.
        // This implies that when sharing with a team, all team members should ideally be added to readAccess,
        // or RTDB rules must handle team membership checks.
        return res.status(403).json({ error: 'Forbidden: You do not have access to this template.' });
    }

    // TODO: Handle pre-signed URLs for fileUrl if needed (from TemplateAfterFind.js)
    // For Firebase Storage, typically client gets download URL and it's either public or short-lived.
    // If template.fileUrl is a gs:// path, it would need to be converted to a download URL here.

    res.status(200).json(template);

  } catch (error) {
    console.error(`Error fetching template ${templateId}:`, error);
    res.status(500).json({ error: 'Failed to fetch template.' });
  }
});

// --- Template Management Routes ---

// Create New Template Route
app.post('/api/templates', firebaseAuthMiddleware, async (req, res) => {
  const {
    Name, Note, Description, // Basic info
    TimeToCompleteDays = 15, RemindOnceInEvery = 5, AutomaticReminders = false, // Reminder settings
    Signers, // Array of signer identifiers (e.g., emails or UIDs) - if templates have signers
    fileUrl, // URL of the file uploaded to Firebase Storage (if templates have a primary file)
    Placeholders, // Specific to templates
    SharedWithUsers, // array of UIDs
    SharedWithTeams, // array of Team IDs
    // Any other relevant fields from the original 'contracts_Template'
  } = req.body;

  const MAX_NAME_LENGTH = 255;
  const MAX_NOTE_LENGTH = 1000;
  const MAX_DESCRIPTION_LENGTH = 5000;

  // 1. Validation (from TemplateBeforesave)
  if (!Name) { // fileUrl might be optional for templates if they are purely metadata/placeholders
    return res.status(400).json({ error: 'Missing required field: Name.' });
  }
  if (Name && Name.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `The "Name" field must be at most ${MAX_NAME_LENGTH} characters long.` });
  }
  // ... other validations for Note, Description (similar to documents) ...

  const reminderCount = TimeToCompleteDays / RemindOnceInEvery;
  if (AutomaticReminders && reminderCount > 15) {
    return res.status(400).json({ error: 'Reminder settings exceed the maximum of 15 reminders.' });
  }

  const createdBy = req.user.uid;

  try {
    let resolvedSignerUids = [];
    if (Signers && Array.isArray(Signers)) {
      resolvedSignerUids = Signers.filter(uid => typeof uid === 'string');
    }

    let resolvedSharedWithUserUids = [];
    if (SharedWithUsers && Array.isArray(SharedWithUsers)) {
        resolvedSharedWithUserUids = SharedWithUsers.filter(uid => typeof uid === 'string');
    }

    let resolvedSharedWithTeamIds = [];
    if (SharedWithTeams && Array.isArray(SharedWithTeams)) {
        resolvedSharedWithTeamIds = SharedWithTeams.filter(id => typeof id === 'string');
    }


    const createdAt = Date.now();
    let nextReminderDate = null;
    if (AutomaticReminders) {
      nextReminderDate = new Date(createdAt);
      nextReminderDate.setDate(nextReminderDate.getDate() + parseInt(RemindOnceInEvery, 10));
    }

    const templateData = {
      Name,
      Note: Note || null,
      Description: Description || null,
      fileUrl: fileUrl || null, // Templates might not always have a file
      Placeholders: Placeholders || [],
      createdBy,
      createdAt: admin.database.ServerValue.TIMESTAMP,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      timeToCompleteDays: parseInt(TimeToCompleteDays, 10),
      automaticReminders: AutomaticReminders,
      remindOnceInEvery: parseInt(RemindOnceInEvery, 10),
      ...(nextReminderDate && { nextReminderDate: nextReminderDate.toISOString() }),
      originIp: req.ip,
      owner: createdBy,
      isArchived: false,
      signers: {}, // If templates have direct signers like documents
      readAccess: { [createdBy]: true },
      writeAccess: { [createdBy]: true },
      sharedWithUsers: {},
      sharedWithTeams: {},
    };

    resolvedSharedWithUserUids.forEach(uid => templateData.sharedWithUsers[uid] = true);
    resolvedSharedWithTeamIds.forEach(teamId => templateData.sharedWithTeams[teamId] = true);

    // Add shared users/teams to readAccess as well
    resolvedSharedWithUserUids.forEach(uid => templateData.readAccess[uid] = true);
    // For teams, actual members would need to be resolved for direct readAccess,
    // or rules would check team membership. For simplicity here, we're just storing the teamId.

    if (resolvedSignerUids.length > 0) {
      resolvedSignerUids.forEach(uid => {
        templateData.signers[uid] = { status: 'defined', addedAt: admin.database.ServerValue.TIMESTAMP }; // Or similar for templates
        templateData.readAccess[uid] = true;
        // templateData.writeAccess[uid] = true; // Typically signers don't write to templates
      });
    }

    const newTemplateRef = admin.database().ref('templates').push();
    await newTemplateRef.set(templateData);
    const templateId = newTemplateRef.key;

    const userStatsRef = admin.database().ref(`user_stats/${createdBy}/templateCount`);
    await userStatsRef.transaction((currentCount) => {
      return (currentCount || 0) + 1;
    });

    res.status(201).json({ message: 'Template created successfully', templateId, ...templateData });

  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template.' });
  }
});

// Unshare Document Route
app.delete('/api/documents/:documentId/share/:userIdToRemove', firebaseAuthMiddleware, async (req, res) => {
  const { documentId, userIdToRemove } = req.params;
  const sharerUid = req.user.uid; // The user initiating the unshare operation

  if (!documentId || !userIdToRemove) {
    return res.status(400).json({ error: 'Missing required fields: documentId and userIdToRemove.' });
  }

  try {
    const docRef = admin.database().ref(`documents/${documentId}`);
    const snapshot = await docRef.once('value');
    const document = snapshot.val();

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Verify sharer has write access or is the owner
    if (!(document.owner === sharerUid || (document.writeAccess && document.writeAccess[sharerUid]))) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify sharing for this document.' });
    }

    // Prevent owner from being removed via this endpoint
    if (userIdToRemove === document.owner) {
        return res.status(400).json({ error: 'Cannot remove document owner via this endpoint. Ownership changes should be handled differently.' });
    }

    // Check if the user to remove actually has access
    if (!(document.readAccess && document.readAccess[userIdToRemove])) {
        return res.status(404).json({ error: `User ${userIdToRemove} does not currently have access to this document.`});
    }

    // Prepare updates to remove access
    const updates = {};
    updates[`/documents/${documentId}/readAccess/${userIdToRemove}`] = null; // Remove read access
    updates[`/documents/${documentId}/writeAccess/${userIdToRemove}`] = null; // Remove write access
    updates[`/documents/${documentId}/updatedAt`] = admin.database.ServerValue.TIMESTAMP;

    // Add to audit trail
    const auditEntry = {
      timestamp: admin.database.ServerValue.TIMESTAMP,
      userId: sharerUid, // User performing the unshare action
      action: 'DOCUMENT_UNSHARED',
      details: {
        unsharedFromUid: userIdToRemove,
        ipAddress: req.ip
      }
    };
    updates[`/documents/${documentId}/auditTrail/${admin.database().ref().push().key}`] = auditEntry;

    await admin.database().ref().update(updates);

    res.status(200).json({ message: `User ${userIdToRemove}'s access to document ${documentId} has been revoked.` });

  } catch (error) {
    console.error(`Error unsharing document ${documentId} for user ${userIdToRemove}:`, error);
    res.status(500).json({ error: 'Failed to unshare document.' });
  }
});

// Share Document Route
app.post('/api/documents/:documentId/share', firebaseAuthMiddleware, async (req, res) => {
  const { documentId } = req.params;
  const { email, userId, accessLevel } = req.body; // accessLevel can be 'read' or 'write'
  const sharerUid = req.user.uid;

  if (!documentId || (!email && !userId) || !accessLevel) {
    return res.status(400).json({ error: 'Missing required fields: documentId, (email or userId), and accessLevel.' });
  }

  if (accessLevel !== 'read' && accessLevel !== 'write') {
    return res.status(400).json({ error: "Invalid accessLevel. Must be 'read' or 'write'." });
  }

  try {
    const docRef = admin.database().ref(`documents/${documentId}`);
    const snapshot = await docRef.once('value');
    const document = snapshot.val();

    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }

    // Verify sharer has write access or is the owner
    if (!(document.owner === sharerUid || (document.writeAccess && document.writeAccess[sharerUid]))) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to share this document.' });
    }

    let targetUid = userId;
    if (email) {
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        targetUid = userRecord.uid;
      } catch (error) {
        console.error(`Error fetching user by email ${email}:`, error);
        return res.status(404).json({ error: `User with email ${email} not found.` });
      }
    }

    if (!targetUid) {
        return res.status(400).json({ error: 'Target user could not be identified.' });
    }

    if (targetUid === document.owner) {
        return res.status(400).json({ error: 'Cannot share document with its owner with modified permissions via this endpoint.' });
    }

    // Update access fields
    const updates = {};
    updates[`/documents/${documentId}/readAccess/${targetUid}`] = true;
    if (accessLevel === 'write') {
      updates[`/documents/${documentId}/writeAccess/${targetUid}`] = true;
    } else {
      // If granting only 'read', ensure 'write' is explicitly removed or not set to true
      // This handles cases where a user might be downgraded from 'write' to 'read'
      updates[`/documents/${documentId}/writeAccess/${targetUid}`] = null;
    }
    updates[`/documents/${documentId}/updatedAt`] = admin.database.ServerValue.TIMESTAMP;

    // Add to audit trail
    const auditEntry = {
      timestamp: admin.database.ServerValue.TIMESTAMP,
      userId: sharerUid, // User performing the share action
      action: 'DOCUMENT_SHARED',
      details: {
        sharedWithUid: targetUid,
        accessLevel: accessLevel,
        ipAddress: req.ip
      }
    };
    // To add to an array in RTDB, we typically fetch, modify, then set, or use a transaction.
    // For simplicity here, pushing to a new sub-node if auditTrail is an array.
    // A more robust way for arrays is to read, push, then write the whole document or use a transaction.
    // If auditTrail is a map { pushId: entry }, it's simpler:
    updates[`/documents/${documentId}/auditTrail/${admin.database().ref().push().key}`] = auditEntry;


    await admin.database().ref().update(updates);

    res.status(200).json({ message: `Document shared with user ${targetUid} with ${accessLevel} access.` });

  } catch (error) {
    console.error(`Error sharing document ${documentId}:`, error);
    res.status(500).json({ error: 'Failed to share document.' });
  }
});

// New Document Creation Route
app.post('/api/documents', firebaseAuthMiddleware, async (req, res) => {
  const {
    Name, Note, Description, // Basic info
    TimeToCompleteDays = 15, RemindOnceInEvery = 5, AutomaticReminders = false, // Reminder settings
    Signers, // Array of signer identifiers (e.g., emails or UIDs)
    fileUrl, // URL of the file uploaded to Firebase Storage
    // Any other relevant fields from the original 'contracts_Document'
  } = req.body;

  const MAX_NAME_LENGTH = 255; // Define these or import from a constants file
  const MAX_NOTE_LENGTH = 1000;
  const MAX_DESCRIPTION_LENGTH = 5000;

  // 1. Validation (from DocumentBeforesave)
  if (!Name || !fileUrl) {
    return res.status(400).json({ error: 'Missing required fields: Name and fileUrl.' });
  }
  if (Name && Name.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `The "Name" field must be at most ${MAX_NAME_LENGTH} characters long.` });
  }
  if (Note && Note.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({ error: `The "Note" field must be at most ${MAX_NOTE_LENGTH} characters long.` });
  }
  if (Description && Description.length > MAX_DESCRIPTION_LENGTH) {
    return res.status(400).json({ error: `The "Description" field must be at most ${MAX_DESCRIPTION_LENGTH} characters long.` });
  }

  const reminderCount = TimeToCompleteDays / RemindOnceInEvery;
  if (AutomaticReminders && reminderCount > 15) {
    return res.status(400).json({ error: 'Reminder settings exceed the maximum of 15 reminders.' });
  }

  const createdBy = req.user.uid; // UID from authenticated user

  try {
    // 2. Resolve Signer UIDs (Placeholder - assuming Signers are UIDs for now, or need lookup)
    let resolvedSignerUids = [];
    if (Signers && Array.isArray(Signers)) {
      // If Signers are emails, you'd loop and use admin.auth().getUserByEmail()
      // For now, assuming they are provided as UIDs or this step is enhanced later
      resolvedSignerUids = Signers.filter(uid => typeof uid === 'string');
    }

    // 3. Prepare Document Data for Realtime Database
    const createdAt = Date.now(); // Using simple timestamp for now, can use ServerValue.TIMESTAMP
    const expiryDate = new Date(createdAt);
    expiryDate.setDate(expiryDate.getDate() + parseInt(TimeToCompleteDays, 10));

    let nextReminderDate = null;
    if (AutomaticReminders) {
      nextReminderDate = new Date(createdAt);
      nextReminderDate.setDate(nextReminderDate.getDate() + parseInt(RemindOnceInEvery, 10));
    }

    const documentData = {
      Name,
      Note: Note || null,
      Description: Description || null,
      fileUrl,
      createdBy,
      createdAt: admin.database.ServerValue.TIMESTAMP, // Firebase server timestamp
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      timeToCompleteDays: parseInt(TimeToCompleteDays, 10),
      automaticReminders: AutomaticReminders,
      remindOnceInEvery: parseInt(RemindOnceInEvery, 10),
      expiryDate: expiryDate.toISOString(),
      ...(nextReminderDate && { nextReminderDate: nextReminderDate.toISOString() }),
      originIp: req.ip, // Express req.ip
      owner: createdBy,
      status: 'draft', // Initial status
      signers: {}, // To be populated if signers exist
      readAccess: { [createdBy]: true },
      writeAccess: { [createdBy]: true },
      auditTrail: [], // Initialize audit trail
    };

    // Add initial creation event to audit trail
    documentData.auditTrail.push({
      timestamp: admin.database.ServerValue.TIMESTAMP,
      userId: createdBy,
      action: 'DOCUMENT_CREATED',
      details: { ipAddress: req.ip }
    });

    if (resolvedSignerUids.length > 0) {
      documentData.status = 'sent'; // Or 'pending_signature'
      documentData.auditTrail.push({ // Log sending event if signers are added at creation
        timestamp: admin.database.ServerValue.TIMESTAMP,
        userId: createdBy,
        action: 'DOCUMENT_SENT',
        details: { signers: resolvedSignerUids }
      });
      documentData.docSentAt = admin.database.ServerValue.TIMESTAMP;
      resolvedSignerUids.forEach(uid => {
        documentData.signers[uid] = { status: 'pending', addedAt: admin.database.ServerValue.TIMESTAMP };
        documentData.readAccess[uid] = true;
        documentData.writeAccess[uid] = true; // Or false depending on if signers can edit
      });
    }

    // 4. Save to Realtime Database
    const newDocRef = admin.database().ref('documents').push();
    await newDocRef.set(documentData);
    const documentId = newDocRef.key;

    // 5. Increment user's document count (replaces logic from DocumentBeforesave)
    // This path `/user_stats/{uid}/documentCount` is an example.
    const userStatsRef = admin.database().ref(`user_stats/${createdBy}/documentCount`);
    await userStatsRef.transaction((currentCount) => {
      return (currentCount || 0) + 1;
    });

    res.status(201).json({ message: 'Document created successfully', documentId, ...documentData });

  } catch (error) {
    console.error('Error creating document:', error);
    // Handle specific errors like failing to resolve signer emails if that's implemented
    res.status(500).json({ error: 'Failed to create document.' });
  }
});

// New Firebase-based Login Route (Custom Token approach)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const FIREBASE_WEB_API_KEY = "AIzaSyABIYqNGFE5sl565UgDiUat011PWRxDA90"; // User Provided

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // 1. Authenticate with Firebase Identity Toolkit REST API
    const firebaseAuthUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
    const authResponse = await axios.post(firebaseAuthUrl, {
      email: email,
      password: password,
      returnSecureToken: true,
    });

    const { localId: uid, idToken: firebaseIdToken } = authResponse.data; // localId is the UID

    // 2. Generate a custom token for the client to sign in with
    const customToken = await admin.auth().createCustomToken(uid);

    // 3. Fetch user data from Realtime Database (profile and role)
    const userProfileSnapshot = await admin.database().ref(`users/${uid}/profile`).once('value');
    const userRoleSnapshot = await admin.database().ref(`user_roles/${uid}`).once('value');

    const userProfile = userProfileSnapshot.val();
    const userRole = userRoleSnapshot.val();

    // Combine user data
    const userData = {
      uid: uid,
      ...userProfile,
      roleInfo: userRole,
      // Add any other essential fields the client might expect from the original Parse login
      // The original Parse login returned the full Parse.User object (toJSON)
      // We are constructing a similar object here.
      // Firebase ID token is also available if needed: firebaseIdToken
    };

    // The client will use this customToken with signInWithCustomToken(auth, customToken)
    res.status(200).json({
      message: 'Login successful. Use customToken to sign in on client.',
      customToken: customToken,
      user: userData
    });

  } catch (error) {
    console.error('Error during login:', error.response ? error.response.data : error.message);
    if (error.response && error.response.data && error.response.data.error) {
      const firebaseError = error.response.data.error;
      if (firebaseError.message === 'INVALID_LOGIN_CREDENTIALS' || firebaseError.message === 'EMAIL_NOT_FOUND' || firebaseError.message === 'INVALID_PASSWORD') {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
    }
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
if (!process.env.TESTING) {
  const mountPath = process.env.PARSE_MOUNT || '/app';
  try {
    const server = new ParseServer(config);
    await server.start();
    app.use(mountPath, server.app);
  } catch (err) {
    console.log(err);
    process.exit();
  }
}
// Mount your custom express app
app.use('/', customRoute); // We might move customRoute's definitions directly into this file later

// New Firebase-based Signup Route
app.post('/api/signup', async (req, res) => {
  // Accept uid if provided (client created Firebase Auth user)
  const { email, password, name, phone, company, role, uid: clientProvidedUid /*, ...otherUserDetails */ } = req.body.userDetails || req.body;

  if (!email || !name || !company || !role) {
    return res.status(400).json({ error: 'Missing required fields (email, name, company, role).' });
  }
  if (!clientProvidedUid && !password) { // Password required if backend creates auth user
    return res.status(400).json({ error: 'Password is required for new user creation.' });
  }

  let uid = clientProvidedUid;
  let firebaseUserRecord;

  try {
    if (!uid) {
      // 1. Create user in Firebase Authentication if UID not provided
      firebaseUserRecord = await admin.auth().createUser({
        email: email,
        password: password,
        displayName: name,
        disabled: false, // Enable user by default
        ...(phone && { phoneNumber: phone }) // Add phone number if provided
      });
      uid = firebaseUserRecord.uid;
      console.log(`Backend created Firebase Auth user: ${email} (${uid})`);
    } else {
      // If UID is provided, optionally verify it or fetch the user record to ensure it's valid
      try {
        firebaseUserRecord = await admin.auth().getUser(uid);
        if (firebaseUserRecord.email.toLowerCase() !== email.toLowerCase()) {
          console.warn(`Provided UID ${uid} email ${firebaseUserRecord.email} does not match provided email ${email}. Proceeding with provided UID.`);
          // Decide on policy: error out, or trust provided UID? For now, trust.
        }
        console.log(`Using client-provided Firebase Auth user: ${email} (${uid})`);
      } catch (userError) {
        console.error(`Error fetching user for provided UID ${uid}:`, userError);
        return res.status(400).json({ error: 'Invalid UID provided or user does not exist.' });
      }
    }

    // 2. Store additional user information in Realtime Database
    // This is a simplified initial structure. We will expand this based on the original logic.
    const userProfileData = {
      email: email.toLowerCase().replace(/\s/g, ''),
      name: name,
      ...(phone && { phone: phone }),
      createdAt: admin.database.ServerValue.TIMESTAMP,
      // We'll add tenant and role information here subsequently
    };
    await admin.database().ref(`users/${uid}/profile`).set(userProfileData);

    // 3. Create 'partners_Tenant' record in Realtime Database
    const tenantData = {
      UserId: uid, // Link to the Firebase Auth user
      TenantName: company,
      EmailAddress: email.toLowerCase().replace(/\s/g, ''),
      IsActive: true,
      CreatedBy: uid, // User who created this tenant record
      createdAt: admin.database.ServerValue.TIMESTAMP,
      ...(phone && { ContactNumber: phone }),
      // Add other address details from userDetails if available in req.body
      ...(req.body.userDetails?.pincode && { PinCode: req.body.userDetails.pincode }),
      ...(req.body.userDetails?.country && { Country: req.body.userDetails.country }),
      ...(req.body.userDetails?.state && { State: req.body.userDetails.state }),
      ...(req.body.userDetails?.city && { City: req.body.userDetails.city }),
      ...(req.body.userDetails?.address && { Address: req.body.userDetails.address }),
    };
    const tenantRef = admin.database().ref('tenants').push(); // Create a new tenant with a unique ID
    await tenantRef.set(tenantData);
    const tenantId = tenantRef.key;

    // 4. Create 'extClass_Users' equivalent record in Realtime Database
    const roleDetails = req.body.userDetails || req.body; // Use the same source for details
    const roleName = roleDetails.role; // e.g., "partner_Admin"
    const roleType = roleName.split('_')[0]; // e.g., "partner"

    if (!roleType) {
      // This case should ideally be validated earlier or handled based on business logic
      console.warn(`User ${uid} signed up with a role that doesn't define a type: ${roleName}. Skipping contextual role creation.`);
    } else {
      const contextualRoleData = {
        role: roleName,
        roleType: roleType,
        tenantId: tenantId, // Link to the tenant created above
        company: company, // From original userDetails
        email: email.toLowerCase().replace(/\s/g, ''), // Denormalized for easier querying if needed
        name: name, // Denormalized
        ...(phone && { phone: phone }), // Denormalized
        ...(roleDetails.jobTitle && { jobTitle: roleDetails.jobTitle }),
        ...(roleDetails.timezone && { timezone: roleDetails.timezone }),
        assignedAt: admin.database.ServerValue.TIMESTAMP
      };
      // Store this under a path that signifies this user's role within that tenant/context
      // Option 1: /user_roles/{uid} (if user has one primary role context)
      // Option 2: /tenant_user_roles/{tenantId}/{uid} (groups roles by tenant)
      // Option 3: /user_contextual_roles/{uid}/{some_context_id} (if multiple contexts)
      // Let's use /user_roles/{uid} for now, assuming one main contextual role from signup.
      // If a user can have multiple roles, this path or structure would need adjustment.
      await admin.database().ref(`user_roles/${uid}`).set(contextualRoleData);
      console.log(`Assigned contextual role ${roleName} to user ${uid} for tenant ${tenantId}`);
    }

    console.log(`Successfully created new user: ${email} (${uid}), tenant ${tenantId}, and assigned role.`);
    res.status(201).json({ message: 'User, tenant, and role assigned successfully', uid: uid, tenantId: tenantId });

  } catch (error) {
    console.error('Error during user signup:', error);
    if (error.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    if (error.code === 'auth/invalid-phone-number' && phone) {
      // If phone number was provided and is invalid, create user without it and log warning
      // Or, decide if phone is strictly required/validated upfront
      try {
        const userRecordWithoutPhone = await admin.auth().createUser({
          email: email,
          password: password,
          displayName: name,
          disabled: false,
        });
        const uidWithoutPhone = userRecordWithoutPhone.uid;
        const userProfileDataNoPhone = {
          email: email.toLowerCase().replace(/\s/g, ''),
          name: name,
          createdAt: admin.database.ServerValue.TIMESTAMP,
        };
        await admin.database().ref(`users/${uidWithoutPhone}/profile`).set(userProfileDataNoPhone);

        console.warn(`User ${email} created without phone due to invalid format. UID: ${uidWithoutPhone}`);
        return res.status(201).json({
          message: 'User created successfully, but phone number was invalid and ignored.',
          uid: uidWithoutPhone
        });
      } catch (nestedError) {
        console.error('Error during user signup (fallback after invalid phone):', nestedError);
        if (nestedError.code === 'auth/email-already-exists') {
          return res.status(409).json({ error: 'Email already in use.' });
        }
        return res.status(500).json({ error: 'Failed to create user after phone number error.' });
      }
    }
    res.status(500).json({ error: 'Failed to create user.', details: error.message });
  }
});

// Example Protected Route: Get current user info
app.get('/api/me', firebaseAuthMiddleware, async (req, res) => {
  // If firebaseAuthMiddleware succeeds, req.user will be populated with the decoded ID token
  const uid = req.user.uid;

  try {
    // Fetch additional user data from RTDB if needed
    const userProfileSnapshot = await admin.database().ref(`users/${uid}/profile`).once('value');
    const userRoleSnapshot = await admin.database().ref(`user_roles/${uid}`).once('value');

    const userProfile = userProfileSnapshot.val();
    const userRole = userRoleSnapshot.val();

    res.status(200).json({
      message: "Authenticated user data.",
      firebaseAuthInfo: req.user, // Info from the ID token itself
      profile: userProfile,
      role: userRole
    });
  } catch (error) {
    console.error(`Error fetching data for user ${uid}:`, error);
    res.status(500).json({ error: "Failed to fetch user data." });
  }
});


// Parse Server plays nicely with the rest of your web routes
app.get('/', function (req, res) {
  res.status(200).send('opensign-server is running !!!');
});

if (!process.env.TESTING) {
  const port = process.env.PORT || 8080;
  const httpServer = http.createServer(app);
  // Set the Keep-Alive and headers timeout to 100 seconds
  httpServer.keepAliveTimeout = 100000; // in milliseconds
  httpServer.headersTimeout = 100000; // in milliseconds
  httpServer.listen(port, '0.0.0.0', function () {
    console.log('opensign-server running on port ' + port + '.');
    const isWindows = process.platform === 'win32';
    // console.log('isWindows', isWindows);
    createContactIndex();

    const migrate = isWindows
      ? `set APPLICATION_ID=${process.env.APP_ID}&& set SERVER_URL=${cloudServerUrl}&& set MASTER_KEY=${process.env.MASTER_KEY}&& npx parse-dbtool migrate`
      : `APPLICATION_ID=${process.env.APP_ID} SERVER_URL=${cloudServerUrl} MASTER_KEY=${process.env.MASTER_KEY} npx parse-dbtool migrate`;
    exec(migrate, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }

      if (stderr) {
        console.error(`Error: ${stderr}`);
        return;
      }
      console.log(`Command output: ${stdout}`);
    });
  });
}
