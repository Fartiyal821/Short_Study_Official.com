const fs = require('fs');
let code = fs.readFileSync('assets/js/admin.js', 'utf8');

code = code.replace(/\}\)\(\);\n\}/g, '})();\n  });');

fs.writeFileSync('assets/js/admin.js', code);
