const fs = require('fs');

function cleanFile(filePath) {
    let html = fs.readFileSync(filePath, 'utf8');

    // Remove cachedPaid
    html = html.replace(/try\s*\{\s*const\s*cachedPaid[^]*?\}\s*catch\s*\(e\)\s*\{\}/, '');

    // Replace Promise.all fetch
    html = html.replace(/const\s+\[res1,\s*res2\]\s*=\s*await\s*Promise\.all\(\[fetch\('\/api\/courses'\),\s*fetch\('\/api\/paid-courses'\)\]\);/g, `const res1 = await fetch('/api/courses');`);
    
    // Remove if (res2.ok) block
    html = html.replace(/if\s*\(res2\.ok\)\s*\{\s*const\s*j2\s*=\s*await\s*res2\.json\(\);\s*if\s*\(j2\.success\s*&&\s*Array\.isArray\(j2\.courses\)\)\s*mergeCourses\(j2\.courses\);\s*\}/g, '');

    // Remove paidSyncChannel
    html = html.replace(/try\s*\{\s*const\s*paidSyncChannel[^]*?\}\s*catch\s*\(e\)\s*\{\}/, '');

    // Fix storage listener
    html = html.replace(/if\s*\(\(e\.key\s*===\s*"shortstudy_cached_courses"\s*\|\|\s*e\.key\s*===\s*"shortstudy_cached_paid_courses"\)\s*&&\s*e\.newValue\)/g, `if (e.key === "shortstudy_cached_courses" && e.newValue)`);

    // Remove paid_courses snapshot
    html = html.replace(/onSnapshot\(collection\(db,\s*"paid_courses"\)[^]*?console\.warn\("Homepage\s*Firestore\s*paid_courses\s*notice:",\s*err\);\s*}\);/g, '');

    fs.writeFileSync(filePath, html);
    console.log('Cleaned ' + filePath);
}

cleanFile('index.html');
cleanFile('programming.html');
