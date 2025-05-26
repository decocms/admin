import { readdirSync } from 'node:fs';
import { join } from 'node:path';

function isKebabCase(str: string): boolean {
    // Kebab case regex: only lowercase letters, numbers, and hyphens
    // No consecutive hyphens, no leading/trailing hyphens
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(str);
}

function findNonKebabCaseFiles(dir: string): string[] {
    const files: string[] = [];
    
    function traverse(currentDir: string) {
        const entries = readdirSync(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = join(currentDir, entry.name);
            
            // Skip node_modules directory
            if (entry.name === 'node_modules') {
                continue;
            }
            
            if (entry.isDirectory()) {
                traverse(fullPath);
            } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
                const fileName = entry.name.replace(/\.(ts|tsx)$/, '');
                if (!isKebabCase(fileName)) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    traverse(dir);
    return files;
}

// Start from current directory
const nonKebabCaseFiles = findNonKebabCaseFiles('.');
console.log('Files that don\'t follow kebab-case naming convention:');
nonKebabCaseFiles.forEach(file => console.log(file));
