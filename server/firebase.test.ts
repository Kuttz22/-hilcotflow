/**
 * Firebase credential validation test.
 * Verifies that FIREBASE_SERVICE_ACCOUNT_JSON is valid JSON with all required fields.
 * Does NOT make a live network call — validates the credential structure only.
 */
import { describe, it, expect } from "vitest";

describe("Firebase service account credential", () => {
  it("FIREBASE_SERVICE_ACCOUNT_JSON is set and valid JSON", () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    expect(raw, "FIREBASE_SERVICE_ACCOUNT_JSON must be set").toBeTruthy();

    let parsed: Record<string, unknown>;
    expect(() => {
      parsed = JSON.parse(raw!);
    }, "FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON").not.toThrow();

    // After the assertion above, parsed is guaranteed to be set
    const sa = JSON.parse(raw!);
    expect(sa.type).toBe("service_account");
    expect(typeof sa.project_id).toBe("string");
    expect(sa.project_id.length).toBeGreaterThan(0);
    expect(typeof sa.private_key).toBe("string");
    // Accept both normalized ("BEGIN PRIVATE KEY") and malformed ("BEGINPRIVATEKEY") headers
    // The pushNotifications.ts service normalizes malformed headers before passing to Firebase
    expect(sa.private_key).toMatch(/BEGIN\s*(RSA\s*)?PRIVATE\s*KEY/);
    expect(typeof sa.client_email).toBe("string");
    expect(sa.client_email).toContain("@");
  });

  it("Firebase Admin SDK can be initialized with the credential", () => {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON!;
    const serviceAccount = JSON.parse(raw);

    // Dynamic require to avoid top-level initialization issues in test env
    const admin = require("firebase-admin");

    // Clean up any existing apps from previous test runs
    for (const app of admin.apps) {
      // Don't delete — just check we can cert-initialize
    }

    // Normalize PEM headers (same logic as pushNotifications.ts)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key
        .replace("-----BEGINPRIVATEKEY-----", "-----BEGIN PRIVATE KEY-----")
        .replace("-----ENDPRIVATEKEY-----", "-----END PRIVATE KEY-----")
        .replace("-----BEGINRSAPRIVATEKEY-----", "-----BEGIN RSA PRIVATE KEY-----")
        .replace("-----ENDRSAPRIVATEKEY-----", "-----END RSA PRIVATE KEY-----");
    }

    // Verify credential.cert() accepts the normalized service account without throwing
    expect(() => {
      admin.credential.cert(serviceAccount);
    }).not.toThrow();
  });

  it("APNs environment variables are set", () => {
    // These are required for iOS push — validate they are present
    const apnsKeyId = process.env.APNS_KEY_ID;
    const apnsTeamId = process.env.APNS_TEAM_ID;
    const apnsBundleId = process.env.APNS_BUNDLE_ID;
    const apnsKeyP8 = process.env.APNS_KEY_P8;

    expect(apnsKeyId, "APNS_KEY_ID must be set").toBeTruthy();
    expect(apnsTeamId, "APNS_TEAM_ID must be set").toBeTruthy();
    expect(apnsBundleId, "APNS_BUNDLE_ID must be set").toBeTruthy();
    expect(apnsKeyP8, "APNS_KEY_P8 must be set").toBeTruthy();
  });
});
