const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

// Find the courses section
code = code.replace(/<section id="courses".*?<\/section>/s, match => {
  return match.replace(/background:\s*#ffffff;/g, 'background: #2b3a32;')
              .replace(/color:\s*#0f172a;/g, 'color: #f2c94c; font-family: \\\'Kalam\\\', cursive;')
              .replace(/<h2.*?Recommended Programming Courses.*?<\/h2>/, '<h2 style="font-size: clamp(28px, 4vw, 38px); color: #f2c94c; font-family: \'Kalam\', cursive; margin-bottom: 8px;">Recommended Programming Courses &amp; Notes</h2>')
              .replace(/<div class="class-card">/g, '<div class="class-card" style="background: #2b3a32; color: #f2c94c; border-color: #f2c94c;">')
              .replace(/<h3>\$\{course.title\}<\/h3>/g, '<h3 style="color: #f2c94c; font-family: \'Kalam\', cursive;">${course.title}</h3>')
              .replace(/<p>\$\{course.description.*?\}/g, '<p style="color: #cbd5e1;">${course.description || "Master core concepts with in-depth structured modules and interactive code examples."}</p>')
              .replace(/color:var\(--ink-soft\)/g, 'color: #f2c94c')
              .replace(/color:var\(--pink-dark\)/g, 'color: #f2c94c')
              .replace(/class="num"/g, 'class="num" style="color: #f2c94c;"')
});

// Also fix the JS template in index.html
code = code.replace(/<div class="class-card">/g, '<div class="class-card" style="background: #2b3a32; color: #f2c94c; border: 1px solid #f2c94c; box-shadow: none;">')
           .replace(/<h3>\$\{course\.title\}<\/h3>/g, '<h3 style="color: #f2c94c; font-family: \'Kalam\', cursive; font-size: 28px;">${course.title}</h3>')
           .replace(/<p>\$\{course\.description.*?\}/g, '<p style="color: #cbd5e1; font-family: \'Work Sans\', sans-serif;">${course.description || "Master core concepts with in-depth structured modules and interactive code examples."}</p>');

fs.writeFileSync('index.html', code);
