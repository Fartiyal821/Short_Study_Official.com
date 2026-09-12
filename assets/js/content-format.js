/**
 * Content Formatting & Semantic Alignment Engine
 * Transforms raw text, Markdown, or HTML into the ShortStudy design system:
 * - Responsive containers & table wrappers
 * - Typographic hierarchy (h2, h3, lead paragraphs)
 * - Syntax highlighted code blocks with language badges & copy triggers
 * - Callout boxes and notes accordions
 * - DOMPurify sanitization
 */

/**
 * Auto-calculate reading time from content
 */
export function calculateReadingTime(content) {
  if (!content) return "3 min read";
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/[#*`_~[\]]/g, " ");
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

/**
 * Generate a clean excerpt from raw content
 */
export function generateExcerpt(content, maxLength = 150) {
  if (!content) return "";
  // Strip markdown & HTML
  let text = content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<pre[\s\S]*?<\/pre>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/^[#>-]+\s*/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 60 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

/**
 * Convert string to URL-friendly slug
 */
export function slugify(text) {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Helper to escape HTML characters inside code blocks
 */
function escapeHtmlEntities(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parses Markdown code blocks (```lang ... ```) into semantic HTML
 */
function parseCodeBlocks(text) {
  return text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang.trim() || "code";
    const escapedCode = escapeHtmlEntities(code.trim());
    return `<div class="code-container"><div class="code-header"><span class="code-lang">${language}</span></div><pre><code class="language-${language}">${escapedCode}</code></pre></div>`;
  });
}

/**
 * Converts Markdown tables into responsive ShortStudy tables
 */
function parseMarkdownTables(text) {
  const tableRegex = /((?:\|[^\n]+\|\r?\n?){2,})/g;
  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;

    const parseRow = (rowStr) => {
      return rowStr
        .split("|")
        .slice(1, -1)
        .map(cell => cell.trim());
    };

    const headerCells = parseRow(lines[0]);
    // Skip separator line (e.g., |---|---|)
    const dataRows = lines.slice(2);

    let html = `<div class="notes-table-wrap"><table class="notes-table"><thead><tr>`;
    headerCells.forEach(cell => {
      html += `<th>${cell}</th>`;
    });
    html += `</tr></thead><tbody>`;

    dataRows.forEach(rowStr => {
      const cells = parseRow(rowStr);
      html += `<tr>`;
      cells.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    return html;
  });
}

/**
 * Converts Markdown lists into proper <ul> and <ol> blocks
 */
function parseLists(text) {
  // Unordered lists
  let res = text.replace(/((?:^(?:[-*]|\+)\s+[^\n]+\r?\n?)+)/gm, (match) => {
    const items = match.trim().split(/\r?\n/).map(line => {
      const cleaned = line.replace(/^(?:[-*]|\+)\s+/, "").trim();
      return `<li>${cleaned}</li>`;
    }).join("");
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  res = res.replace(/((?:^\d+\.\s+[^\n]+\r?\n?)+)/gm, (match) => {
    const items = match.trim().split(/\r?\n/).map(line => {
      const cleaned = line.replace(/^\d+\.\s+/, "").trim();
      return `<li>${cleaned}</li>`;
    }).join("");
    return `<ol>${items}</ol>`;
  });

  return res;
}

/**
 * Converts Blockquotes / Notes into styled callout boxes
 */
function parseBlockquotes(text) {
  return text.replace(/((?:^>\s*[^\n]+\r?\n?)+)/gm, (match) => {
    const quoteContent = match.replace(/^>\s*/gm, "").trim();
    return `<div class="callout-box"><blockquote>${quoteContent}</blockquote></div>`;
  });
}

/**
 * Full Markdown to Semantic HTML converter
 */
export function convertMarkdownToSemanticHtml(rawText) {
  if (!rawText) return "";
  let text = rawText.trim();

  // 1. Extract and preserve code blocks first to protect internal formatting
  const codePlaceholders = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codePlaceholders.length;
    const language = lang.trim() || "code";
    const escapedCode = escapeHtmlEntities(code.trim());
    const placeholder = `<!--CODE_PLACEHOLDER_${idx}-->`;
    codePlaceholders.push({
      placeholder,
      html: `<div class="code-container"><div class="code-header"><span class="code-lang">${language}</span></div><pre><code class="language-${language}">${escapedCode}</code></pre></div>`
    });
    return placeholder;
  });

  // 2. Parse Markdown Tables
  text = parseMarkdownTables(text);

  // 3. Headings
  text = text
    .replace(/^####\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h2>$1</h2>");

  // 4. Blockquotes & Callouts
  text = parseBlockquotes(text);

  // 5. Lists
  text = parseLists(text);

  // 6. Inline Formatting (bold, italic, inline code)
  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  // 7. Paragraphs: process standalone text lines separated by empty lines
  const blocks = text.split(/\n\s*\n/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    // If block starts with HTML tags or placeholders, leave as is
    if (
      trimmed.startsWith("<h2") ||
      trimmed.startsWith("<h3") ||
      trimmed.startsWith("<h4") ||
      trimmed.startsWith("<ul") ||
      trimmed.startsWith("<ol") ||
      trimmed.startsWith("<div") ||
      trimmed.startsWith("<table") ||
      trimmed.startsWith("<p") ||
      trimmed.startsWith("<!--CODE_PLACEHOLDER_")
    ) {
      return trimmed;
    }
    // Normal paragraph
    return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
  });

  text = formattedBlocks.filter(Boolean).join("\n\n");

  // 8. Restore Code Placeholders
  codePlaceholders.forEach(item => {
    text = text.replace(item.placeholder, item.html);
  });

  return text;
}

/**
 * Ensures any raw <table> inside HTML is wrapped in a responsive wrapper
 */
export function wrapTablesResponsively(html) {
  if (!html.includes("<table")) return html;

  // If table is already wrapped in notes-table-wrap, avoid double wrapping
  const container = document.createElement("div");
  container.innerHTML = html;

  const tables = container.querySelectorAll("table");
  tables.forEach(tbl => {
    tbl.classList.add("notes-table");
    if (!tbl.parentElement || !tbl.parentElement.classList.contains("notes-table-wrap")) {
      const wrap = document.createElement("div");
      wrap.className = "notes-table-wrap";
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    }
  });

  return container.innerHTML;
}

/**
 * Master parser and formatter for lesson content
 * Automatically aligns content to match the ShortStudy design system
 */
export function parseAndFormatLessonContent(raw) {
  if (!raw || typeof raw !== "string") return "";

  let content = raw.trim();
  const hasHtmlBlocks = /<(h[1-6]|p|div|ul|ol|table|pre|blockquote)[\s>]/i.test(content);

  if (!hasHtmlBlocks) {
    // Pure Markdown or formatted plain text
    content = convertMarkdownToSemanticHtml(content);
  } else {
    // Contains HTML tags, but might also have markdown ```code``` or tables
    content = parseCodeBlocks(content);
    content = parseMarkdownTables(content);
  }

  // Ensure responsive tables
  content = wrapTablesResponsively(content);

  // Sanitize with DOMPurify if available
  if (typeof DOMPurify !== "undefined" && DOMPurify.sanitize) {
    content = DOMPurify.sanitize(content, {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "scrolling"]
    });
  }

  return content;
}
