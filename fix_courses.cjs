const fs = require('fs');
let code = fs.readFileSync('courses.html', 'utf8');

code = code.replace(/<div class="class-card">.*?<\/div>\s*`;/s, `
            <div class="class-card" style="background: #2b3a32; color: #f2c94c; border: 1px solid rgba(242, 201, 76, 0.4); box-shadow: 4px 4px 0px rgba(242, 201, 76, 0.2); border-radius: 12px; transition: transform 0.2s;">
              <div class="tape" style="background: rgba(242, 201, 76, 0.8); border: 1px solid #b98f1f;"></div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span class="num" style="background:rgba(242, 201, 76, 0.2); color:#f2c94c; padding:4px 10px; border-radius:6px; font-weight:700;">\${course.price || "₹2599"}</span>
                <span class="num" style="font-size: 12px; font-weight:700; color: #f2c94c; text-transform:uppercase; opacity: 0.8;">\${course.category || "Masterclass"}</span>
              </div>
              <h3 style="color: #f2c94c; font-family: 'Kalam', cursive; font-size: 28px; margin-top: 0;">\${course.title}</h3>
              <p style="color: #e2e8f0; font-family: 'Work Sans', sans-serif; opacity: 0.9;">\${course.description || "Comprehensive masterclass with premium materials."}</p>
              <a href="programming-videos.html?id=\${course.id}" class="go" style="color: #f2c94c; border-top: 1px dashed rgba(242, 201, 76, 0.3); padding-top: 12px; margin-top: auto;">Explore Course →</a>
            </div>
          \`;
`);

fs.writeFileSync('courses.html', code);
