import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const packageName = process.argv[2];

if (!packageName) {
  console.error('❌ Error: Package name is required');
  console.error('Usage: node scripts/changeset-patch.mjs <package-name>');
  process.exit(1);
}

const changesetId = randomBytes(4).toString('hex');
const changesetContent = `---
"${packageName}": patch
---

Patch version bump for ${packageName}
`;

writeFileSync(path.resolve(import.meta.dirname, `../.changeset/${changesetId}.md`), changesetContent);
console.log(`✅ Created patch changeset for ${packageName}`);
