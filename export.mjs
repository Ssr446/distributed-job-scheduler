import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const outputFile = path.join(projectRoot, 'claude_export.txt');

const includeExtensions = ['.ts', '.tsx', '.prisma', '.json', '.yml', '.md'];
const excludeDirs = ['node_modules', 'dist', '.git', '.gemini'];
const excludeFiles = ['package-lock.json', 'claude_export.txt'];

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat && stat.isDirectory()) {
            if (!excludeDirs.includes(file)) {
                results = results.concat(walkDir(fullPath));
            }
        } else {
            const ext = path.extname(fullPath);
            if (includeExtensions.includes(ext) && !excludeFiles.includes(file)) {
                results.push(fullPath);
            }
        }
    });
    
    return results;
}

const allFiles = walkDir(projectRoot);
let outputContent = '';

for (const file of allFiles) {
    const relativePath = path.relative(projectRoot, file);
    outputContent += `\n\n--- ${relativePath} ---\n\n`;
    try {
        const content = fs.readFileSync(file, 'utf-8');
        outputContent += content;
    } catch (e) {
        outputContent += `Error reading file: ${e.message}`;
    }
}

fs.writeFileSync(outputFile, outputContent);
console.log(`Exported ${allFiles.length} files to claude_export.txt`);
