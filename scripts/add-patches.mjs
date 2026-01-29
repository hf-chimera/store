import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

/**
 * Get all changed files from git
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles() {
  try {
    // Get staged and unstaged changes
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('❌ Error getting git changes:', error.message);
    process.exit(1);
  }
}

/**
 * Map file paths to package names
 * @param {string[]} files - Array of file paths
 * @returns {Set<string>} Set of package names
 */
function mapFilesToPackages(files) {
  const packages = new Set();

  for (const file of files) {
    // Normalize path separators
    const normalizedFile = file.replace(/\\/g, '/');

    // Check if file is in src/ directory (root store package)
    if (normalizedFile.startsWith('src/')) {
      packages.add('@hf-chimera/store');
      continue;
    }

    // Check if file is in packages/store/
    if (normalizedFile.startsWith('packages/store/')) {
      packages.add('@hf-chimera/store');
      continue;
    }

    // Check if file is in packages/qb/
    if (normalizedFile.startsWith('packages/qb/')) {
      packages.add('@hf-chimera/query-builder');
      continue;
    }

    // Check if file is in packages/adapters/shared/
    if (normalizedFile.startsWith('packages/adapters/shared/')) {
      packages.add('@hf-chimera/adapters-shared');
      continue;
    }

    // Check if file is in packages/adapters/react/
    if (normalizedFile.startsWith('packages/adapters/react/')) {
      packages.add('@hf-chimera/react');
      continue;
    }

    // Check if file is in packages/adapters/vue/
    if (normalizedFile.startsWith('packages/adapters/vue/')) {
      packages.add('@hf-chimera/vue');
      continue;
    }
  }

  return packages;
}

/**
 * Create a patch changeset for a package
 * @param {string} packageName - Name of the package
 * @param {string} message - Optional custom message for the changeset
 */
function createPatchChangeset(packageName, message) {
  const changesetId = randomBytes(4).toString('hex');
  const description = message || `Patch version bump for ${packageName}`;
  const changesetContent = `---
"${packageName}": patch
---

${description}
`;

  const changesetPath = path.resolve(import.meta.dirname, `../.changeset/${changesetId}.md`);
  writeFileSync(changesetPath, changesetContent);
  console.log(`✅ Created patch changeset for ${packageName} (${changesetId}.md)`);
}

/**
 * Main function
 */
function main() {
  // Parse optional message argument
  const message = process.argv[2];

  if (message) {
    console.log(`📝 Using custom message: "${message}"\n`);
  }

  console.log('🔍 Detecting changed files...\n');

  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    console.log('ℹ️  No changes detected');
    return;
  }

  console.log(`Found ${changedFiles.length} changed file(s):\n`);
  changedFiles.forEach(file => console.log(`  - ${file}`));
  console.log();

  const packages = mapFilesToPackages(changedFiles);

  if (packages.size === 0) {
    console.log('ℹ️  No package changes detected');
    return;
  }

  console.log(`📦 Detected ${packages.size} touched package(s):\n`);
  packages.forEach(pkg => console.log(`  - ${pkg}`));
  console.log();

  console.log('📝 Creating patch changesets...\n');
  packages.forEach(pkg => createPatchChangeset(pkg, message));

  console.log(`\n✨ Done! Created ${packages.size} patch changeset(s)`);
}

main();
