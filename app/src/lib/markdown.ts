import { marked } from 'marked'
import DOMPurify from 'dompurify'

// [[Title]] links (not preceded by "!"), and Obsidian-style ![[image name]] embeds (optional |width).
const WIKI = /(?<!!)\[\[([^[\]\n]+)\]\]/g
const EMBED = /!\[\[([^[\]\n|]+)(?:\|(\d+))?\]\]/g

/** Titles referenced with [[wikilinks]] in a note body. Image embeds are not links. */
export function extractLinks(body: string): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(WIKI)) out.add(m[1].trim())
  return [...out]
}

/** Library names embedded with ![[name]]. */
export function extractEmbeds(body: string): string[] {
  return [...new Set([...body.matchAll(EMBED)].map(m => m[1].trim()))]
}

/** Match key for an embed or library item: case-insensitive, ignores folders and the file extension. */
export const embedKey = (name: string) => name.trim().replace(/^.*\//, '').replace(/\.(png|jpe?g|gif|webp|svg|pdf|avif|heic)$/i, '').toLowerCase()

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Render markdown to safe HTML. Wikilinks become <a class="wiki">; embeds become <img data-embed> that the
 *  page fills with an object URL after render (blob: URLs are not allowed through the sanitiser). */
export function renderMarkdown(body: string, exists: (title: string) => boolean): string {
  const withEmbeds = body.replace(EMBED, (_m, raw: string, w?: string) => {
    const name = raw.trim()
    return `<img class="embed" data-embed="${esc(name)}" alt="${esc(name)}"${w ? ` width="${Number(w)}"` : ''}>`
  })
  const withLinks = withEmbeds.replace(WIKI, (_m, raw: string) => {
    const title = raw.trim()
    const cls = exists(title) ? 'wiki' : 'wiki missing'
    return `<a class="${cls}" data-wiki="${esc(title)}">${esc(title)}</a>`
  })
  const html = marked.parse(withLinks, { async: false, gfm: true, breaks: false }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ['data-wiki', 'data-embed'] })
}
