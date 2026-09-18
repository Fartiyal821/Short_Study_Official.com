import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.es.mjs";

/**
 * Sanitize generic HTML content while preserving rich educational markup,
 * code blocks, and vetted YouTube iframes.
 */
export function sanitizeHTML(rawHtml) {
  if (!rawHtml || typeof rawHtml !== "string") return "";

  const config = {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "strong", "em", "u", "s", "mark", "small", "sub", "sup",
      "ul", "ol", "li", "blockquote", "code", "pre", "hr", "br",
      "a", "img", "table", "thead", "tbody", "tr", "th", "td",
      "span", "div", "iframe"
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "src", "alt", "title", "class", "id",
      "width", "height", "frameborder", "allow", "allowfullscreen",
      "loading", "referrerpolicy"
    ],
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "loading", "referrerpolicy"]
  };

  // Run DOMPurify
  const cleaned = DOMPurify.sanitize(rawHtml, config);

  // Parse DOM to ensure iframe sources strictly point to allowed YouTube hosts
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, "text/html");
  const iframes = doc.querySelectorAll("iframe");

  iframes.forEach((iframe) => {
    const src = iframe.getAttribute("src") || "";
    const isYouTube = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i.test(src);
    if (!isYouTube) {
      // Remove any unauthorized iframe
      iframe.remove();
    } else {
      // Add secure defaults
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
      iframe.setAttribute("allowfullscreen", "true");
    }
  });

  return doc.body.innerHTML;
}

/**
 * Extract YouTube Video ID from any format:
 * - URL: https://www.youtube.com/watch?v=VIDEO_ID
 * - Short URL: https://youtu.be/VIDEO_ID
 * - Embed URL: https://www.youtube.com/embed/VIDEO_ID
 * - Shorts: https://www.youtube.com/shorts/VIDEO_ID
 * - <iframe> embed code containing any of the above
 */
export function extractYouTubeId(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  // Pattern matches common YouTube URL and embed patterns
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i,
    /src=["']https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([\w-]{11})["']/i
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If user pasted just an 11-char ID
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Convert any YouTube input (URL or <iframe>) into a standard, responsive,
 * sanitized embed HTML string and embed metadata.
 */
export function processYouTubeEmbed(input) {
  if (!input || !input.trim()) {
    return {
      videoId: null,
      embedUrl: null,
      iframeHtml: "",
      isValid: false
    };
  }

  const videoId = extractYouTubeId(input);
  if (!videoId) {
    return {
      videoId: null,
      embedUrl: null,
      iframeHtml: "",
      isValid: false,
      error: "Invalid YouTube URL or embed code. Please provide a valid YouTube link or iframe."
    };
  }

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&controls=1&playsinline=1&enablejsapi=1`;
  const rawIframe = `<iframe src="${embedUrl}" title="Course Video Player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen loading="lazy"></iframe>`;
  const iframeHtml = sanitizeHTML(rawIframe);

  return {
    videoId,
    embedUrl,
    iframeHtml,
    isValid: true
  };
}
