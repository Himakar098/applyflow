import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  ".firebaserc",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "storage.rules",
];

for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) {
    console.error(`Missing required Firebase config file: ${file}`);
    process.exit(1);
  }
}

const firebaseRc = JSON.parse(readFileSync(path.join(root, ".firebaserc"), "utf8"));
if (!firebaseRc.projects?.default) {
  console.error(".firebaserc must define a default Firebase project alias.");
  process.exit(1);
}

const firebaseJson = JSON.parse(readFileSync(path.join(root, "firebase.json"), "utf8"));
const expectedMappings = [
  ["firestore.rules", firebaseJson.firestore?.rules],
  ["firestore.indexes.json", firebaseJson.firestore?.indexes],
  ["storage.rules", firebaseJson.storage?.rules],
];

for (const [label, configuredPath] of expectedMappings) {
  if (!configuredPath || typeof configuredPath !== "string") {
    console.error(`firebase.json is missing a valid ${label} reference.`);
    process.exit(1);
  }
  if (!existsSync(path.join(root, configuredPath))) {
    console.error(`firebase.json points to a missing file: ${configuredPath}`);
    process.exit(1);
  }
}

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
for (const scriptName of ["firebase:deploy", "firebase:emulators", "firebase:seed"]) {
  if (!packageJson.scripts?.[scriptName]) {
    console.error(`package.json is missing the required script: ${scriptName}`);
    process.exit(1);
  }
}

console.log("Firebase config check passed.");
