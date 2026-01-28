import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const packages = [
  '@hf-chimera/store',
  '@hf-chimera/query-builder',
  '@hf-chimera/adapters-shared',
  '@hf-chimera/react',
  '@hf-chimera/vue'
];

const changesetId = randomBytes(4).toString('hex');
const changesetContent = `---
${packages.map(pkg => `"${pkg}": major`).join('\n')}
---

Major version bump across all packages
`;

writeFileSync(path.resolve(import.meta.dirname, `../.changeset/${changesetId}.md`), changesetContent);
console.log('✅ Created synchronized major changeset for all packages');
