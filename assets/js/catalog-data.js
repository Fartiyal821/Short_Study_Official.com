/**
 * Canonical Catalog of Pre-Existing Courses & Lessons on ShortStudy
 */

export const DEFAULT_COURSE_IDS = new Set([
  "python-basics",
  "c-basics",
  "data-structures-arrays",
  "java-oop-basics",
  "sql-basics"
]);

export const DEFAULT_POST_IDS = new Set([
  "lesson-python-1",
  "lesson-c-1",
  "lesson-dsa-1",
  "lesson-java-1",
  "lesson-web-1"
]);

export const PRE_EXISTING_COURSES = [
  {
    id: "python-basics",
    title: "Python Basics & Core Fundamentals",
    price: "Free",
    type: "free",
    isPurchased: true,
    purchased: true,
    imageUrl: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=800&q=80",
    courseImage: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=800&q=80",
    image: "https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=800&q=80",
    icon: "🐍",
    category: "Free Curriculum",
    slug: "python-basics",
    link: "python-basics.html",
    description: "Learn variables, loops, object-oriented concepts, and functions with interactive dry-run execution tables.",
    status: "published",
    order: 1
  },
  {
    id: "c-basics",
    title: "C Language & Memory Management",
    price: "Free",
    type: "free",
    isPurchased: true,
    purchased: true,
    imageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
    courseImage: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
    image: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80",
    icon: "⚙️",
    category: "Free Curriculum",
    slug: "c-basics",
    link: "c-basics.html",
    description: "Pointers, dynamic memory allocation (malloc/free), structs, and low-level C programming fundamentals.",
    status: "published",
    order: 2
  },
  {
    id: "data-structures-arrays",
    title: "Data Structures: Arrays & Algorithms",
    price: "Free",
    type: "free",
    isPurchased: true,
    purchased: true,
    imageUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80",
    courseImage: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80",
    image: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=800&q=80",
    icon: "📦",
    category: "Free Curriculum",
    slug: "data-structures-arrays",
    link: "data-structures-arrays.html",
    description: "Understand time complexity, arrays, linked lists, stacks, and binary search trees with chapter-by-chapter exercises.",
    status: "published",
    order: 3
  },
  {
    id: "java-oop-basics",
    title: "Java OOP & Design Patterns",
    price: "Free",
    type: "free",
    isPurchased: true,
    purchased: true,
    imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
    courseImage: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
    image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80",
    icon: "☕",
    category: "Free Curriculum",
    slug: "java-oop-basics",
    link: "java-oop-basics.html",
    description: "Master encapsulation, inheritance, polymorphism, abstraction, and enterprise design patterns.",
    status: "published",
    order: 4
  }
];

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

