import sanitizeHtml from "sanitize-html";

const allowedTags = ["p", "strong", "b", "em", "i", "u", "ul", "ol", "li", "br"];

export function sanitizeProductRichText(value: string) {
  return sanitizeHtml(value, {
    allowedTags,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

export function productRichTextLength(value: string) {
  return sanitizeHtml(sanitizeProductRichText(value), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/gi, " ")
    .trim()
    .length;
}

export function productRichTextToPlainText(value: string) {
  return sanitizeHtml(sanitizeProductRichText(value), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/gi, " ")
    .trim();
}
