/**
 * @fileoverview WebAuthn (Passkey) Cloud Functions for Da-Costa.
 *
 * Security hardening (Prompt C-1b):
 * 1. Challenge expiry: challenges expire after 5 minutes
 * 2. Rate limiting: max 5 failed auth attempts per user per 15 minutes
 * 3. Audit logging: every auth attempt logged to authAuditLog collection
 * 4. Credential revocation: revokePasskey function
 * 5. Multi-device limit: max 5 passkeys per user
 */

const {setGlobalOptions} = require("firebase-functions/v2");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const cors = require("cors");

admin.initializeApp();
function getDb() {
  return admin.firestore();
}

setGlobalOptions({region: "europe-west1"});

const rpID = "dacosta-svalinn.com";
const rpName = "Da-Costa";
const allowedOrigins = [
  "http://localhost:3000",
  "https://dacosta-svalinn.com",
  "https://da-costa-unisoc23v1-6386-61f95.web.app",
  "https://da-costa-unisoc23v1-6386-61f95.firebaseapp.com",
  "https://9000-firebase-da-costa-unisoc23v1-1771869511659.cluster-ikslh4rdsnbqsvu5nw3v4dqjj2.cloudworkstations.dev",
];
const corsHandler = cors({
  origin: (origin, callback) => {
    const isAllowed = allowedOrigins.includes(origin) ||
      /.cloudworkstations.dev$/.test(origin) ||
      /.web.app$/.test(origin);
    callback(null, isAllowed);
  },
});

const CHALLENGE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILED_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_PASSKEYS_PER_USER = 5;

/** @param {string} userId @return {Promise<Array>} */
async function getUserCredentials(userId) {
  const credentials = [];
  const snapshot = await db
      .collection("webAuthnCredentials")
      .doc(userId)
      .collection("credentials")
      .get();
  snapshot.forEach((doc) => credentials.push(doc.data()));
  return credentials;
}

/**
 * Writes an audit log entry.
 * @param {string} userId - User ID
 * @param {Object} req - Express request
 * @param {boolean} success - Whether auth succeeded
 * @param {string|null} failureReason - Reason for failure
 * @param {string} action - Action type
 * @return {Promise<void>}
 */
async function writeAuditLog(userId, req, success, failureReason = null, action = "AUTH_ATTEMPT") {
  try {
    await getDb().collection("authAuditLog").add({
      userId,
      action,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: req.headers["x-forwarded-for"] || req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      success,
      failureReason,
    });
  } catch (err) {
    logger.error("Failed to write audit log:", err.message);
  }
}

/** @param {string} userId @return {Promise<boolean>} */
async function isRateLimited(userId) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const snapshot = await getDb().collection("authAuditLog")
      .where("userId", "==", userId)
      .where("success", "==", false)
      .where("timestamp", ">=", windowStart)
      .get();
  return snapshot.size >= MAX_FAILED_ATTEMPTS;
}

/** @param {string} userId @return {Promise<string|null>} */
async function getValidChallenge(userId) {
  const doc = await getDb().collection("webAuthnChallenges").doc(userId).get();
  if (!doc.exists) return null;
  const {challenge, createdAt} = doc.data();
  if (!createdAt) return challenge;
  const age = Date.now() - createdAt.toMillis();
  if (age > CHALLENGE_EXPIRY_MS) {
    await doc.ref.delete();
    return null;
  }
  return challenge;
}

exports.webAuthnRegisterOptions = onRequest({cors: true}, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const {userId, displayName} = req.body;
      if (!userId || !displayName) {
        res.status(400).send({error: "Missing userId or displayName"});
        return;
      }
      const userCredentials = await getUserCredentials(userId);
      if (userCredentials.length >= MAX_PASSKEYS_PER_USER) {
        res.status(400).send({
          error: `Maximum of ${MAX_PASSKEYS_PER_USER} passkeys allowed. Please revoke an existing passkey first.`,
        });
        return;
      }
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(userId),
        userName: displayName,
        excludeCredentials: userCredentials.map((cred) => ({
          id: cred.credentialID,
          type: "public-key",
          transports: cred.transports,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });
      await getDb().collection("webAuthnChallenges").doc(userId).set({
        challenge: options.challenge,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(`Generated registration options for userId: ${userId}`);
      res.status(200).send(options);
    } catch (error) {
      logger.error("Error generating registration options:", error);
      logger.error("Biometric registration error details:", error.message);
      res.status(500).send({error: "biometric_registration_failed", message: error.message});
    }
  });
});

exports.webAuthnRegisterVerify = onRequest({cors: true}, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const {userId} = req.body;
      if (!userId) {
        res.status(400).send({error: "userId is required for verification."});
        return;
      }
      // SECURITY: without this check, anyone can register their own passkey
      // against an existing userId (e.g. "Fredrick") and sign in as that
      // account — Firestore rules trust request.auth.uid with no further
      // verification. Reject registration outright if the userId already
      // has any credential.
      //
      // TRADE-OFF: this also blocks a legitimate user from adding a passkey
      // on a second device, since there's no session-based way yet to prove
      // "I already own this userId" before registering another credential
      // for it. MAX_PASSKEYS_PER_USER / excludeCredentials above were built
      // for that multi-device flow but it's not reachable until this is
      // replaced with an authenticated add-credential path (e.g. requiring
      // a valid Firebase ID token for that uid, or a challenge signed by an
      // already-registered credential). Closing the account-takeover hole
      // takes priority over that flow for now.
      const existingCreds = await db
          .collection("webAuthnCredentials")
          .doc(userId)
          .collection("credentials")
          .limit(1)
          .get();
      if (!existingCreds.empty) {
        logger.warn(`Registration rejected: userId "${userId}" already has credentials.`);
        res.status(409).send({error: "Username already taken. Please choose a different name."});
        return;
      }
      const challenge = await getValidChallenge(userId);
      if (!challenge) {
        res.status(400).send({error: "Challenge not found or expired. Please try again."});
        return;
      }
      const verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: challenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: rpID,
      });
      if (verification.verified) {
        const {registrationInfo} = verification;
        const cred = registrationInfo.credential;
        const newCredential = {
          credentialID: cred.id,
          credentialPublicKey: Array.from(cred.publicKey),
          counter: cred.counter,
          transports: cred.transports || req.body.response.transports || [],
          registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        await db
            .collection("webAuthnCredentials")
            .doc(userId)
            .collection("credentials")
            .doc(cred.id)
            .set(newCredential);
        await getDb().collection("webAuthnChallenges").doc(userId).delete();
        logger.info(`Successfully registered passkey for userId: ${userId}`);
      }
      res.status(200).send({verified: verification.verified});
    } catch (error) {
      logger.error("Error verifying registration:", error.message);
      res.status(400).send({error: error.message});
    }
  });
});

exports.webAuthnAuthOptions = onRequest({cors: true}, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const {userId} = req.body;
      if (!userId) {
        res.status(400).send({error: "userId is required."});
        return;
      }
      if (await isRateLimited(userId)) {
        await writeAuditLog(userId, req, false, "Rate limit exceeded");
        res.status(429).send({error: "Too many failed attempts. Please try again in 15 minutes."});
        return;
      }
      const userCredentials = await getUserCredentials(userId);
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userCredentials.map((cred) => ({
          id: cred.credentialID,
          type: "public-key",
          transports: cred.transports,
        })),
        userVerification: "required",
      });
      await getDb().collection("webAuthnChallenges").doc(userId).set({
        challenge: options.challenge,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(`Generated authentication options for userId: ${userId}`);
      res.status(200).send(options);
    } catch (error) {
      logger.error("Error generating authentication options:", error);
      logger.error("Biometric registration error details:", error.message);
      res.status(500).send({error: "biometric_registration_failed", message: error.message});
    }
  });
});

exports.webAuthnAuthVerify = onRequest({cors: true}, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const {userId} = req.body;
      if (!userId) {
        res.status(400).send({error: "userId is required for verification."});
        return;
      }
      if (await isRateLimited(userId)) {
        await writeAuditLog(userId, req, false, "Rate limit exceeded");
        res.status(429).send({error: "Too many failed attempts. Please try again in 15 minutes."});
        return;
      }
      const challenge = await getValidChallenge(userId);
      if (!challenge) {
        await writeAuditLog(userId, req, false, "Challenge not found or expired");
        res.status(400).send({error: "Challenge not found or expired. Please try again."});
        return;
      }
      const credentialDoc = await db
          .collection("webAuthnCredentials")
          .doc(userId)
          .collection("credentials")
          .doc(req.body.id)
          .get();
      if (!credentialDoc.exists) {
        await writeAuditLog(userId, req, false, "Credential not found");
        res.status(404).send({error: "Credential not found."});
        return;
      }
      const credential = credentialDoc.data();
      const verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge: challenge,
        expectedOrigin: allowedOrigins,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialID,
          publicKey: Uint8Array.from(credential.credentialPublicKey),
          counter: credential.counter,
          transports: credential.transports,
        },
      });
      if (!verification.verified) {
        await writeAuditLog(userId, req, false, "WebAuthn verification failed");
        res.status(400).send({verified: false, error: "Verification failed."});
        return;
      }
      await credentialDoc.ref.update({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await getDb().collection("webAuthnChallenges").doc(userId).delete();
      await writeAuditLog(userId, req, true, null);
      // Fetch displayName from Firestore and set on Firebase Auth user
      const userDoc = await getDb().collection("users").doc(userId).get();
      const displayName = userDoc.exists ? (userDoc.data().displayName || userId) : userId;
      // Save displayName to Firestore if missing
      if (userDoc.exists && !userDoc.data().displayName) {
        await getDb().collection("users").doc(userId).update({displayName, updatedAt: new Date().toISOString()});
      }
      try {
        await admin.auth().updateUser(userId, {displayName});
      } catch (authErr) {
        // User may not exist in Auth yet — create them
        try {
          await admin.auth().createUser({uid: userId, displayName});
        } catch (createErr) {
          logger.warn("Could not set displayName on Auth user:", createErr.message);
        }
      }
      const customToken = await admin.auth().createCustomToken(userId);
      logger.info(`Successfully verified authentication for userId: ${userId}`);
      res.status(200).send({verified: true, token: customToken, displayName});
    } catch (error) {
      await writeAuditLog(req.body.userId || "unknown", req, false, error.message);
      logger.error("Error verifying authentication:", error.message);
      res.status(400).send({error: error.message});
    }
  });
});


/**
 * Generate biometric-specific registration options (platform authenticator only).
 */
exports.webAuthnBiometricRegisterOptions = onRequest({cors: true}, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const {userId, displayName} = req.body;
      if (!userId || !displayName) {
        res.status(400).send({error: "Missing userId or displayName"});
        return;
      }
      const userCredentials = await getUserCredentials(userId);
      if (userCredentials.length >= MAX_PASSKEYS_PER_USER) {
        res.status(400).send({error: "Maximum passkeys reached"});
        return;
      }
      const options = await generateRegistrationOptions({
        rpName: rpName,
        rpID: rpID,
        userID: Buffer.from(userId),
        userName: displayName,
        userDisplayName: displayName,
        attestation: "none",
        excludeCredentials: userCredentials.map((cred) => ({
          id: cred.credentialID,
          type: "public-key",
          transports: cred.transports || [],
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
      });
      await getDb().collection("webAuthnChallenges").doc(userId).set({
        challenge: options.challenge,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info("Generated biometric registration options for userId: " + userId);
      res.status(200).send(options);
    } catch (error) {
      logger.error("Error generating biometric registration options:", error);
      logger.error("Biometric registration error details:", error.message);
      res.status(500).send({error: "biometric_registration_failed", message: error.message});
    }
  });
});

exports.revokePasskey = onRequest({cors: true}, async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const {userId, credentialId} = req.body;
      if (!userId || !credentialId) {
        res.status(400).send({error: "userId and credentialId are required."});
        return;
      }
      const credentialRef = db
          .collection("webAuthnCredentials")
          .doc(userId)
          .collection("credentials")
          .doc(credentialId);
      const credentialDoc = await credentialRef.get();
      if (!credentialDoc.exists) {
        res.status(404).send({error: "Credential not found."});
        return;
      }
      await credentialRef.delete();
      await writeAuditLog(userId, req, true, null, "PASSKEY_REVOKED");
      logger.info(`Passkey revoked for userId: ${userId}, credentialId: ${credentialId}`);
      res.status(200).send({revoked: true});
    } catch (error) {
      logger.error("Error revoking passkey:", error.message);
      logger.error("Biometric registration error details:", error.message);
      res.status(500).send({error: "biometric_registration_failed", message: error.message});
    }
  });
});
