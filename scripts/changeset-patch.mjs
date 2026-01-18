import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

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

writeFileSync(`.changeset/${changesetId}.md`, changesetContent);
console.log(`✅ Created patch changeset for ${packageName}`);
