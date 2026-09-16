const fs = require('fs');
let code = fs.readFileSync('courses.html', 'utf8');

// The main container
code = code.replace(/<section style="margin-bottom: 48px; padding: 0 12px;">/, '<section style="margin-bottom: 48px; padding: 32px; background: #2b3a32; border-radius: 12px; box-shadow: 4px 4px 0px rgba(242, 201, 76, 0.2); border: 1px solid rgba(242, 201, 76, 0.4);">');

// Replace dark colors with yellow/white for chalkboard
code = code.replace(/color: var\(--ink\);/g, 'color: #f2c94c;');
code = code.replace(/color: var\(--ink-soft\);/g, 'color: #e2e8f0;');

fs.writeFileSync('courses.html', code);
