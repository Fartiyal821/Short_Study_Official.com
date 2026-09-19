/**
 * Canonical Catalog of Courses & Lessons on ShortStudy
 */

export const DEFAULT_COURSE_IDS = new Set([
  "python-basics",
  "c-basics",
  "data-structures-arrays",
  "java-oop-basics",
  "sql-basics",
  "html-css-basics"
]);

export const DEFAULT_POST_IDS = new Set([
  "lesson-python-1",
  "lesson-c-1",
  "lesson-dsa-1",
  "lesson-java-1",
  "lesson-web-1"
]);

/**
 * 1. Admin Masterclasses (The courses on the admin page)
 * These appear ONLY on the Home page (index.html) and Courses page (courses.html).
 */
export const ADMIN_PRE_EXISTING_COURSES = [
  {
    id: "cEXtCCHZ88BG38jyX3rA",
    title: "Ultimate Full-Stack Web Development Course",
    price: "₹1000",
    originalPrice: "₹3899",
    type: "paid",
    isPaid: true,
    paid: true,
    isPurchased: false,
    purchased: false,
    category: "Paid Masterclass",
    badge: "Featured Masterclass",
    lessons: "1 lesson",
    level: "Beginner",
    language: "Hindi",
    status: "published",
    order: 1,
    icon: "🚀",
    imageUrl: "https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&w=800&q=80",
    courseImage: "https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&w=800&q=80",
    image: "https://images.unsplash.com/photo-1547658719-da2b51169166?auto=format&fit=crop&w=800&q=80",
    slug: "ultimate-full-stack-web-development-course",
    link: "courses.html",
    description: "Comprehensive masterclass with Code With Gaurav. Includes full-stack project building, modern web architecture, and video tutorials.",
    videoUrl: "https://www.youtube.com/watch?v=tVzUXW6siu0",
    videoEmbedUrl: "https://www.youtube-nocookie.com/embed/tVzUXW6siu0?rel=0&modestbranding=1",
    videos: [
      {
        id: "vid_1789753046799_0_gp5x",
        order: 1,
        title: "Ultimate Full-Stack Web Development Course",
        url: "https://www.youtube.com/watch?v=tVzUXW6siu0",
        embedUrl: "https://www.youtube-nocookie.com/embed/tVzUXW6siu0?rel=0&modestbranding=1",
        videoId: "tVzUXW6siu0",
        description: "Sigma Web Development Course with VS Code, HTML, CSS, JavaScript, and backend foundations."
      }
    ]
  }
];

/**
 * 2. Written Programming Tutorial Curriculum Tracks
 * These appear on programming.html (Tutorials Page) and link directly to full guide chapters.
 */
export const TUTORIAL_COURSES = [
  {
    id: "python-basics",
    title: "Python Basics & Core Fundamentals",
    category: "programming",
    slug: "python-basics",
    link: "python-basics.html",
    icon: "🐍",
    description: "Learn variables, loops, object-oriented concepts, and functions with interactive dry-run execution tables.",
    status: "published",
    order: 1,
    imageUrl: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "c-basics",
    title: "C Language & Memory Management",
    category: "programming",
    slug: "c-basics",
    link: "c-basics.html",
    icon: "⚙️",
    description: "Pointers, dynamic memory allocation (malloc/free), structs, and low-level C programming fundamentals.",
    status: "published",
    order: 2,
    imageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "data-structures-arrays",
    title: "Data Structures: Arrays & Algorithms",
    category: "dsa",
    slug: "data-structures-arrays",
    link: "data-structures-arrays.html",
    icon: "📦",
    description: "Understand time complexity, arrays, linked lists, stacks, and binary search trees with chapter-by-chapter exercises.",
    status: "published",
    order: 3,
    imageUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "java-oop-basics",
    title: "Java OOP & Design Patterns",
    category: "programming",
    slug: "java-oop-basics",
    link: "java-oop-basics.html",
    icon: "☕",
    description: "Master encapsulation, inheritance, polymorphism, abstraction, and enterprise design patterns.",
    status: "published",
    order: 4,
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "sql-basics",
    title: "SQL & Relational Database Design",
    category: "web",
    slug: "sql-basics",
    link: "sql-basics.html",
    icon: "🗄️",
    description: "Master schemas, table relations, indexes, ACID transactions, and query optimization.",
    status: "published",
    order: 5,
    imageUrl: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "html-css-basics",
    title: "HTML5 & Modern CSS3 Fundamentals",
    category: "web",
    slug: "html-css-basics",
    link: "html-css-basics.html",
    icon: "🌐",
    description: "Semantic layouts, CSS flexbox, grid, responsive design, and accessible styling.",
    status: "published",
    order: 6,
    imageUrl: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80"
  }
];

// For storefront catalog (Home page and Courses page), PRE_EXISTING_COURSES exports the admin masterclasses
export const PRE_EXISTING_COURSES = ADMIN_PRE_EXISTING_COURSES;
export const ALL_COURSES = [...ADMIN_PRE_EXISTING_COURSES, ...TUTORIAL_COURSES];

export const PRE_EXISTING_PAID_COURSES = [];

export const PRE_EXISTING_LESSONS = [
  {
    id: "lesson-python-1",
    courseId: "python-basics",
    courseTitle: "Python Basics & Core Fundamentals",
    title: "Introduction to Python Syntax & Variables",
    slug: "intro-python-syntax",
    excerpt: "Learn how Python executes code, defines dynamic variables, and structures memory.",
    author: "ShortStudy Editorial",
    readingTime: "6 min read",
    order: 1,
    status: "published",
    content: `## 1. Welcome to Python Programming

Python is an interpreted, high-level, dynamically typed language known for its clean syntax and readability.

### Example Code:
\`\`\`python
# Hello World in Python
name = "ShortStudy Student"
print(f"Welcome to ShortStudy, {name}!")

# Dynamic variable types
count = 10
price = 99.50
is_active = True
\`\`\`

### Key Takeaways:
- Indentation defines code blocks instead of curly braces.
- Variables are dynamically typed.
`
  }
];
