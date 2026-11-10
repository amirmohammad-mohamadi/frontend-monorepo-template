const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decodes `&amp;`-style named and `&#160;` / `&#xA0;`-style numeric character references. */
function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const codePoint =
        code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Drops tags and the bodies of `<script>` / `<style>` elements, each for a space. */
function stripTags(html: string): string {
  return html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ");
}

/** Cuts `text` to `maxLength` characters at a word boundary with a trailing ellipsis. */
export function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const truncated = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut;
  return `${truncated.replace(/[\s\p{P}]+$/u, "")}…`;
}

/**
 * Turns rich HTML into a one-line plain-text summary (a meta description):
 * tags dropped, entities decoded, whitespace collapsed, cut at a word
 * boundary. `undefined` when nothing readable is left, so callers can fall
 * through with `??`.
 */
export function htmlToSummary(html: string | null | undefined, maxLength = 160): string | undefined {
  if (!html) return undefined;
  const text = decodeEntities(stripTags(html)).replace(/\s+/g, " ").trim();
  return text ? truncateAtWord(text, maxLength) : undefined;
}

/**
 * Like `htmlToSummary`, but keeps line breaks (`<br>`, the ends of block
 * elements) as `\n` for an element styled with `white-space: pre-line`.
 */
export function htmlToPlainText(html: string | null | undefined, maxLength = 160): string | undefined {
  if (!html) return undefined;
  const marked = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n");
  const text = decodeEntities(stripTags(marked))
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? truncateAtWord(text, maxLength) : undefined;
}

/** A URL-safe slug: lower-cased, diacritics stripped, non-alphanumerics collapsed to `-`. Unicode letters are kept. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
