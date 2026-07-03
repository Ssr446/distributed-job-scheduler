const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/ssrsh/Documents/projects/codity/packages/dashboard/src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace hardcoded classes
  content = content.replace(/glass-panel/g, 'theme-panel');
  content = content.replace(/text-white/g, '');
  content = content.replace(/text-slate-\d+/g, 'opacity-70');
  content = content.replace(/bg-surface-900/g, 'theme-card');
  content = content.replace(/bg-surface-800/g, 'bg-black/10 dark:bg-white/10');
  content = content.replace(/bg-surface-950\/50/g, 'bg-black/5 dark:bg-white/5');
  content = content.replace(/border-surface-800\/50/g, 'border-black/10 dark:border-white/10');
  content = content.replace(/border-surface-800/g, 'border-black/20 dark:border-white/20');
  
  // Clean up extra spaces inside className
  content = content.replace(/className=\"\s+/g, 'className=\"');
  content = content.replace(/\s+\"/g, '\"');

  fs.writeFileSync(filePath, content);
  console.log('Fixed', file);
}
