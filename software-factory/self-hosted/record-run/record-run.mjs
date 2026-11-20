#!/usr/bin/env node
// Writes/merges one document in the `factory_runs` Firestore collection
// (egg-models project) for a single software-factory run. Called from
// run-factory.sh and sync-run-outcomes.sh; never from the browser client,
// since firestore.rules denies client writes to this collection outright.
//
// Auth: a service-account key for the egg-models project, scoped to
// Firestore only (see software-factory/self-hosted/gcp/README.md, "Factory
// run-logging service account"). Path comes from
// FACTORY_FIRESTORE_SA_KEY_PATH; if that env var is unset or the file is
// missing, this script logs a warning and exits 0 rather than failing the
// run -- run logging is observability, not something that should block a
// backlog item from shipping.
//
// Usage:
//   node record-run.mjs <runId> '<json merge patch>'
//
// Fields named *At are treated as ISO-8601 timestamps and converted to
// Firestore Timestamps; everything else is merged as-is. This script has
// its own package.json/node_modules (run `npm install` in this directory
// once) so firebase-admin doesn't touch the main app's or functions'
// dependency trees.
import { readFileSync, existsSync } from 'node:fs';

const TIMESTAMP_FIELD_SUFFIX = 'At';

async function main() {
  const [runId, patchJson] = process.argv.slice(2);
  if (!runId || !patchJson) {
    console.error('Usage: node record-run.mjs <runId> \'<json merge patch>\'');
    process.exit(1);
  }

  const keyPath = process.env.FACTORY_FIRESTORE_SA_KEY_PATH;
  if (!keyPath || !existsSync(keyPath)) {
    console.warn(
      `record-run.mjs: FACTORY_FIRESTORE_SA_KEY_PATH not set or missing (${keyPath ?? 'unset'}); skipping Firestore write.`,
    );
    return;
  }

  let patch;
  try {
    patch = JSON.parse(patchJson);
  } catch (err) {
    console.warn(`record-run.mjs: patch was not valid JSON (${err.message}); storing it raw under scoresRaw.`);
    patch = { scoresRaw: patchJson };
  }

  const { initializeApp, applicationDefault, cert } = await import('firebase-admin/app');
  const { getFirestore, Timestamp } = await import('firebase-admin/firestore');

  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount), projectId: 'egg-models' });
  const db = getFirestore();

  const converted = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key.endsWith(TIMESTAMP_FIELD_SUFFIX) && typeof value === 'string') {
      const date = new Date(value);
      converted[key] = Number.isNaN(date.getTime()) ? value : Timestamp.fromDate(date);
    } else {
      converted[key] = value;
    }
  }

  await db.collection('factory_runs').doc(runId).set(converted, { merge: true });
  console.log(`record-run.mjs: merged ${Object.keys(converted).join(', ')} into factory_runs/${runId}`);
}

main().catch((err) => {
  // Same philosophy as the missing-key case: log and exit 0, don't fail the
  // factory run because logging it hiccuped.
  console.warn(`record-run.mjs: failed to write run record: ${err.message}`);
});
