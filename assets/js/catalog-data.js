/**
 * Canonical Catalog of Pre-Existing Courses & Lessons on ShortStudy
 * Ensures all existing site content is immediately available, synchronized,
 * and rendered across the Admin Dashboard and Public interfaces.
 */

export const PRE_EXISTING_COURSES = [
  {
    id: "python-basics",
    title: "Python Basics",
    slug: "python-basics",
    description: "Variables, data types, and control flow — the essential starting point for beginners.",
    icon: "🐍",
    status: "published",
    order: 1
  },
  {
    id: "c-basics",
    title: "C Programming Basics",
    slug: "c-basics",
    description: "How memory, pointers, and compilation logic operate under the hood in systems programming.",
    icon: "⚡",
    status: "published",
    order: 2
  },
  {
    id: "data-structures-arrays",
    title: "Data Structures: Arrays",
    slug: "data-structures-arrays",
    description: "The core foundation of technical coding interviews — contiguous memory & indexing from first principles.",
    icon: "📊",
    status: "published",
    order: 3
  },
  {
    id: "java-oop-concepts",
    title: "Java & OOP Concepts",
    slug: "java-oop-concepts",
    description: "Classes, objects, inheritance, polymorphism, and abstraction for interview prep.",
    icon: "☕",
    status: "in_development",
    order: 4
  },
  {
    id: "html-css-basics",
    title: "HTML & CSS Basics",
    slug: "html-css-basics",
    description: "Structuring and styling modern webpages with responsive layouts and box model fundamentals.",
    icon: "🌐",
    status: "in_development",
    order: 5
  },
  {
    id: "sql-basics",
    title: "SQL Basics",
    slug: "sql-basics",
    description: "Relational database queries, joins, groupings, and constraints every fresher must master.",
    icon: "🗄️",
    status: "in_development",
    order: 6
  }
];

export const PRE_EXISTING_LESSONS = [
  {
    id: "lesson-python-1",
    courseId: "python-basics",
    courseTitle: "Python Basics",
    title: "Python Fundamentals: print(), Variables, Data Types & More",
    slug: "python-basics",
    excerpt: "An in-depth Python lesson covering print(), variables, data types, input(), type casting, comments, keywords and identifiers.",
    readingTime: "15 min read",
    status: "published",
    order: 1,
    youtubeEmbed: "",
    content: `<h2>1. Getting Started with Python</h2>
<p>Python is a high-level, interpreted programming language known for readability and clean syntax. Unlike compiled languages like C or Java, Python uses dynamic typing and automatic memory management.</p>

<h3>print() and Basic Output</h3>
<p>The <code>print()</code> function outputs text and variable values to the console.</p>

<pre><code class="language-python"># Printing strings and formatted values
name = "ShortStudy"
version = 3.12
print(f"Welcome to {name}! Running Python {version}")</code></pre>

<h2>2. Variables and Data Types</h2>
<p>In Python, variables are created the moment you first assign a value to them. Everything in Python is an object.</p>

<ul>
  <li><strong>int</strong>: Whole numbers like <code>42</code>, <code>-7</code></li>
  <li><strong>float</strong>: Decimal numbers like <code>3.14159</code></li>
  <li><strong>str</strong>: Sequence of Unicode characters like <code>"Hello, World!"</code></li>
  <li><strong>bool</strong>: Boolean truth values <code>True</code> or <code>False</code></li>
  <li><strong>list</strong>: Mutable ordered sequence like <code>[1, 2, 3]</code></li>
  <li><strong>dict</strong>: Key-value mapping like <code>{"lang": "Python"}</code></li>
</ul>

<pre><code class="language-python"># Dynamic type reassignment
x = 10          # x is an integer
x = "Now text"  # x is now a string
print(type(x))  # &lt;class 'str'&gt;</code></pre>

<h2>3. Common Mistakes Beginners Make</h2>
<ol>
  <li><strong>Indentation Errors</strong>: Python uses whitespace indentation instead of curly braces. Consistent 4-space indentation is standard.</li>
  <li><strong>Type Errors in Concatenation</strong>: Trying to concatenate strings and numbers without typecasting (use f-strings instead of <code>"age: " + 20</code>).</li>
</ol>`
  },
  {
    id: "lesson-python-2",
    courseId: "python-basics",
    courseTitle: "Python Basics",
    title: "Python Operators & Conditionals",
    slug: "python-operators-conditionals",
    excerpt: "Arithmetic, comparison, and logical operators plus if-elif-else statements with 10 practice questions per topic.",
    readingTime: "12 min read",
    status: "published",
    order: 2,
    youtubeEmbed: "",
    content: `<h2>1. Arithmetic & Comparison Operators</h2>
<p>Operators perform operations on variables and values. Python provides arithmetic, comparison, logical, and bitwise operators.</p>

<pre><code class="language-python"># Comparison expressions evaluate to booleans
score = 85
is_passing = score >= 50
print("Passing status:", is_passing) # True</code></pre>

<h2>2. Conditional Branching (if, elif, else)</h2>
<p>Control flow allows programs to execute different code blocks based on conditional expressions.</p>

<pre><code class="language-python">grade = 92

if grade >= 90:
    print("Grade: A - Excellent Work")
elif grade >= 80:
    print("Grade: B - Good Effort")
elif grade >= 70:
    print("Grade: C - Satisfactory")
else:
    print("Needs Improvement")</code></pre>`
  },
  {
    id: "lesson-c-1",
    courseId: "c-basics",
    courseTitle: "C Programming Basics",
    title: "C Programming Basics: Variables, Data Types & Control Flow",
    slug: "c-basics",
    excerpt: "How memory, compilation, variables, pointers, and control flow work at a lower level in C.",
    readingTime: "14 min read",
    status: "published",
    order: 1,
    youtubeEmbed: "",
    content: `<h2>1. Introduction to C & The Compilation Pipeline</h2>
<p>C is a compiled, procedural programming language developed in 1972. It gives developers direct access to system memory and CPU hardware registers, making it the bedrock of operating systems and embedded devices.</p>

<h3>The 4 Compilation Stages</h3>
<ol>
  <li><strong>Preprocessing</strong>: Header inclusion (<code>#include &lt;stdio.h&gt;</code>) and macro expansion.</li>
  <li><strong>Compilation</strong>: Converts C source code into assembly code.</li>
  <li><strong>Assembly</strong>: Converts assembly code into machine object code (<code>.o</code> or <code>.obj</code>).</li>
  <li><strong>Linking</strong>: Combines object files with system libraries to produce an executable binary.</li>
</ol>

<pre><code class="language-c">#include &lt;stdio.h&gt;

int main(void) {
    int score = 100;
    printf("C Programming Fundamentals: score = %d\n", score);
    return 0;
}</code></pre>

<h2>2. Data Types and Memory Sizing</h2>
<p>Unlike dynamically typed languages, C requires explicit type declarations for every variable.</p>

<ul>
  <li><code>char</code>: 1 byte (-128 to 127)</li>
  <li><code>int</code>: typically 4 bytes (-2,147,483,648 to 2,147,483,647)</li>
  <li><code>float</code>: 4 bytes single-precision IEEE 754 floating point</li>
  <li><code>double</code>: 8 bytes double-precision floating point</li>
</ul>`
  },
  {
    id: "lesson-dsa-1",
    courseId: "data-structures-arrays",
    courseTitle: "Data Structures: Arrays",
    title: "Data Structures: Arrays Explained from First Principles",
    slug: "data-structures-arrays",
    excerpt: "The foundation of technical interviews — contiguous memory allocation, indexing, time complexity, and practice interview questions.",
    readingTime: "16 min read",
    status: "published",
    order: 1,
    youtubeEmbed: "",
    content: `<h2>1. What is an Array?</h2>
<p>An array is a linear data structure that stores elements of the same data type in contiguous memory locations. Because memory addresses are consecutive, arrays provide instantaneous O(1) random access time.</p>

<pre><code class="language-c">#include &lt;stdio.h&gt;

int main() {
    int arr[5] = {10, 20, 30, 40, 50};
    // Access element at index 2 (third item) in O(1) time
    printf("Element at index 2: %d\n", arr[2]); // 30
    return 0;
}</code></pre>

<h2>2. Array Time & Space Complexity</h2>
<div class="notes-table-wrap">
  <table class="notes-table">
    <thead>
      <tr>
        <th>Operation</th>
        <th>Time Complexity</th>
        <th>Explanation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Access by Index</strong></td>
        <td><code>O(1)</code></td>
        <td>Calculated directly via memory base address + (index * element_size)</td>
      </tr>
      <tr>
        <td><strong>Search (Unsorted)</strong></td>
        <td><code>O(n)</code></td>
        <td>Requires linear scan of all elements</td>
      </tr>
      <tr>
        <td><strong>Insertion (End)</strong></td>
        <td><code>O(1)</code></td>
        <td>Direct write if capacity exists</td>
      </tr>
      <tr>
        <td><strong>Insertion (Beginning)</strong></td>
        <td><code>O(n)</code></td>
        <td>All existing elements must be shifted one position right</td>
      </tr>
      <tr>
        <td><strong>Deletion</strong></td>
        <td><code>O(n)</code></td>
        <td>Elements after deleted item must shift left to close gap</td>
      </tr>
    </tbody>
  </table>
</div>`
  }
];
