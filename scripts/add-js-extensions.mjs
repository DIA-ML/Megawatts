#!/usr/bin/env node
/**
 * Post-build script to add .js extensions to ES module imports
 * This is needed because TypeScript doesn't automatically add .js extensions
 * to compiled output when using ES modules with Node.js
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const distDir = join(__dirname, '..', 'dist');

/**
 * Recursively find all .js files in a directory
 */
function findJsFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (extname(file) === '.js') {
      fileList.push(filePath);
    }
  }

  return fileList;
}

/**
 * Add .js extensions to relative imports in a file
 */
function addJsExtensionsToFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Match import statements with relative paths
  // Pattern: import ... from './...' or import ... from '../...'
  const importPattern = /import\s+[^;]*from\s+['"]((?:\.\/|\.\.\/)[^'"]+)['"]/g;

  content = content.replace(importPattern, (match, importPath) => {
    // Only add .js if it doesn't already have an extension
    if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
      modified = true;
      return match.replace(importPath, `${importPath}.js`);
    }
    return match;
  });

  // Match export statements with relative paths
  // Pattern: export ... from './...' or export ... from '../...'
  const exportPattern = /export\s+[^;]*from\s+['"]((?:\.\/|\.\.\/)[^'"]+)['"]/g;

  content = content.replace(exportPattern, (match, importPath) => {
    // Only add .js if it doesn't already have an extension
    if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
      modified = true;
      return match.replace(importPath, `${importPath}.js`);
    }
    return match;
  });

  // Also handle dynamic imports: import('./...')
  const dynamicImportPattern = /import\s*\(\s*['"]((?:\.\/|\.\.\/)[^'"]+)['"]\s*\)/g;

  content = content.replace(dynamicImportPattern, (match, importPath) => {
    // Only add .js if it doesn't already have an extension
    if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
      modified = true;
      return match.replace(importPath, `${importPath}.js`);
    }
    return match;
  });

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    return true;
  }

  return false;
}

/**
 * Main function
 */
function main() {
  console.log('Adding .js extensions to ES module imports in dist folder...');

  const jsFiles = findJsFiles(distDir);
  let modifiedCount = 0;

  for (const file of jsFiles) {
    if (addJsExtensionsToFile(file)) {
      modifiedCount++;
      const relativePath = relative(process.cwd(), file);
      console.log(`✓ Modified: ${relativePath}`);
    }
  }

  console.log(`\nTotal files processed: ${jsFiles.length}`);
  console.log(`Total files modified: ${modifiedCount}`);

  if (modifiedCount > 0) {
    console.log('\n✅ Successfully added .js extensions to imports');
  } else {
    console.log('\nℹ️  No files needed modification');
  }
}

main();
