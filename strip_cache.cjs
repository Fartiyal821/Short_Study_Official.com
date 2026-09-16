const fs = require('fs');
let code = fs.readFileSync('assets/js/admin.js', 'utf8');

code = code.replace(/try\s*\{\s*const\s*cachedCourses\s*=\s*JSON\.parse\(localStorage\.getItem\("shortstudy_cached_courses"\)[\s\S]*?\} catch \(e\) \{\}/g, '');
code = code.replace(/try\s*\{\s*const\s*localUserOrders\s*=\s*JSON\.parse\(localStorage\.getItem\("shortstudy_user_orders"\)[\s\S]*?\} catch \(e\) \{\}/g, '');
code = code.replace(/try\s*\{\s*const\s*cachedPaid\s*=\s*JSON\.parse\(localStorage\.getItem\("shortstudy_cached_paid_courses"\)[\s\S]*?\} catch \(e\) \{\}/g, '');

fs.writeFileSync('assets/js/admin.js', code);
