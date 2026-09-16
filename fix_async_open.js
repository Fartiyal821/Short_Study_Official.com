const fs = require('fs');
let code = fs.readFileSync('assets/js/admin.js', 'utf8');

// Find all occurrences of "(async () => {\n" or similar that are left empty or unclosed
code = code.replace(/\(\s*async\s*\(\)\s*=>\s*\{\s*\}\s*\)\(\);/g, ''); // just in case

// Wait, the easiest way to fix the syntax is to remove these broken closures
// If there's an `(async () => {` followed closely by `serverPaidCoursesMap.delete`, it means the block was broken
// Let's look at the original code structure around 2160-2210.
