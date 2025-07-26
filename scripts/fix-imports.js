#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to fix imports in a file
function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix relative imports that don't have .js extension
  const importRegex = /(import\s+(?:.*?\s+from\s+)?["'])(\.\.?\/[^"']+(?<!\.js))(['"])/g;
  let newContent = content.replace(importRegex, (match, p1, p2, p3) => {
    modified = true;
    // Check if this might be a directory import
    if (p2.includes('/cache') || p2.includes('/types') || p2.includes('/utils') || p2.includes('/config')) {
      // Special cases for directory imports
      if (p2.endsWith('/cache')) return `${p1}${p2}/index.js${p3}`;
      if (p2.endsWith('/types')) return `${p1}${p2}/index.js${p3}`;
      if (p2.endsWith('/utils')) return `${p1}${p2}/index.js${p3}`;
    }
    return `${p1}${p2}.js${p3}`;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Fixed imports in: ${path.relative(process.cwd(), filePath)}`);
  }
}

// Recursively find all .js files in dist directory
function fixAllImports(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      fixAllImports(fullPath);
    } else if (file.endsWith('.js')) {
      fixImportsInFile(fullPath);
    }
  }
}

// Run the fix
const distPath = path.join(__dirname, '..', 'dist');
console.log('Fixing imports in dist directory...');
fixAllImports(distPath);
console.log('Done!');