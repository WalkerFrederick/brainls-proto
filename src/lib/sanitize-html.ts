import sanitize from "sanitize-html";
import { isAllowedImageUrl } from "@/lib/allowed-hosts";

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "blockquote",
  "code",
  "pre",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "sub",
  "sup",
];

const SANITIZE_OPTIONS: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt"],
    span: ["data-cloze"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
  },
  allowedClasses: {
    span: [
      "cloze-blank",
      "cloze-reveal",
      "cloze-preview",
      "inline-block",
      "rounded",
      "bg-muted",
      "px-2",
      "py-1",
      "text-xs",
      "text-muted-foreground",
    ],
  },
  allowedSchemes: ["https", "http"],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    img: (tagName, attribs) => {
      if (!attribs.src || !isAllowedImageUrl(attribs.src)) {
        return {
          tagName: "span",
          attribs: {
            class: "inline-block rounded bg-muted px-2 py-1 text-xs text-muted-foreground",
          },
          text: attribs.alt || "Image not available",
        };
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizeHtml(html: string): string {
  return sanitize(html, SANITIZE_OPTIONS);
}

/**
 * Strips all HTML tags and returns plain text.
 * Useful for extracting text content for length checks or cloze parsing.
 */
export function stripHtml(html: string): string {
  return sanitize(html, { allowedTags: [], allowedAttributes: {} });
}
