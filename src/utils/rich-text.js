export function spansToHtml(body, spans, images = []) {
  if (!body) return ''
  const imgCursor = { index: 0 }

  if (!spans || spans.length === 0) {
    return renderTextWithImages(body, images, imgCursor)
  }

  const sorted = [...spans]
    .filter(s => s.start < s.end && s.start >= 0 && s.end <= body.length)
    .sort((a, b) => a.start - b.start || b.end - a.end)

  const openTags = []
  let result = ''
  let pos = 0

  const events = []
  for (const span of sorted) {
    events.push({ pos: span.start, type: 'open', span })
    events.push({ pos: span.end, type: 'close', span })
  }
  events.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos
    return a.type === 'close' ? -1 : 1
  })

  for (const ev of events) {
    if (ev.pos > pos) {
      result += renderTextWithImages(body.substring(pos, ev.pos), images, imgCursor)
      pos = ev.pos
    }
    if (ev.type === 'open') {
      const tags = spanToTags(ev.span)
      for (const tag of tags) {
        result += tag.open
        openTags.push(tag)
      }
    } else {
      const tags = spanToTags(ev.span)
      for (let i = tags.length - 1; i >= 0; i--) {
        const idx = openTags.length - 1
        if (idx >= 0) {
          result += openTags[idx].close
          openTags.pop()
        }
      }
    }
  }

  if (pos < body.length) {
    result += renderTextWithImages(body.substring(pos), images, imgCursor)
  }

  while (openTags.length > 0) {
    result += openTags.pop().close
  }

  return result
}

// Render plain text, escaping special characters and newlines, while replacing
// the object-replacement character (\uFFFC) — Android's marker for an inline
// image — with an <img> placeholder. The placeholder carries only the
// attachment's file name (resolved to a blob URL after the HTML is mounted in
// HomeView), so the editor shows the picture in situ instead of the literal
// "OBJ" glyph. Inline images are matched to note.images positionally by
// imgCursor: the k-th \uFFFC maps to images[k], mirroring how Android stores
// inline images alongside the body text.
function renderTextWithImages(text, images, imgCursor) {
  let out = ''
  for (const ch of text) {
    if (ch === '\uFFFC') {
      const img = images[imgCursor.index]
      const fname = img ? attachmentName(img) : null
      if (fname) {
        out += `<img class="inline-image" data-fname="${escapeAttr(fname)}" contenteditable="false" alt="">`
      }
      imgCursor.index++
    } else if (ch === '\n') {
      out += '<br>'
    } else {
      out += escapeHtml(ch)
    }
  }
  return out
}

function attachmentName(img) {
  if (!img) return null
  if (typeof img === 'string') {
    const parts = img.split('/')
    return parts[parts.length - 1] || img
  }
  if (typeof img !== 'object') return null
  for (const key of ['localName', 'fileName', 'filename', 'name', 'originalName', 'path', 'uri']) {
    const v = img[key]
    if (v && typeof v === 'string') {
      const clean = v.split('?')[0].split('#')[0]
      const parts = clean.split('/')
      return parts[parts.length - 1] || clean
    }
  }
  return null
}

function spanToTags(span) {
  const tags = []
  if (span.monospace) {
    tags.push({ open: '<code style="font-family:monospace;background:rgba(127,127,127,0.15);padding:1px 3px;border-radius:3px;font-size:0.95em">', close: '</code>', type: 'monospace' })
  }
  if (span.strikethrough) {
    tags.push({ open: '<s>', close: '</s>', type: 'strikethrough' })
  }
  if (span.link && span.linkData) {
    tags.push({ open: `<a href="${escapeAttr(span.linkData)}" style="color:inherit;text-decoration:underline">`, close: '</a>', type: 'link' })
  }
  if (span.italic) {
    tags.push({ open: '<i>', close: '</i>', type: 'italic' })
  }
  if (span.bold) {
    tags.push({ open: '<b>', close: '</b>', type: 'bold' })
  }
  return tags
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function htmlToSpans(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstChild

  const spans = []
  const plainTextChars = []
  let offset = 0

  const blockElements = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'PRE', 'BLOCKQUOTE'])

  function addText(text) {
    for (let i = 0; i < text.length; i++) {
      plainTextChars.push(text[i])
    }
    offset += text.length
  }

  function addNewline() {
    plainTextChars.push('\n')
    offset += 1
  }

  function traverse(node, parentIsBlock = false) {
    if (node.nodeType === Node.TEXT_NODE) {
      addText(node.textContent)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const tagName = node.tagName
    const tagNameLower = tagName.toLowerCase()
    const style = node.style || {}
    const isBlock = blockElements.has(tagName)

    if (tagNameLower === 'br') {
      addNewline()
      return
    }

    // Inline image placeholders (rendered by spansToHtml as <img data-fname>)
    // must round-trip back into the plain body as a single \uFFFC character, so
    // the text offset stays aligned with the saved body and the picture keeps
    // its position on the next render. We advance the offset by one (like a
    // normal character) but emit no formatting span for it.
    if (tagNameLower === 'img') {
      addText('\uFFFC')
      return
    }

    const format = {
      bold: tagNameLower === 'b' || tagNameLower === 'strong' || style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 600,
      italic: tagNameLower === 'i' || tagNameLower === 'em' || style.fontStyle === 'italic',
      strikethrough: tagNameLower === 's' || tagNameLower === 'strike' || style.textDecorationLine === 'line-through' || style.textDecoration === 'line-through',
      monospace: tagNameLower === 'code' || tagNameLower === 'tt' || tagNameLower === 'pre' || style.fontFamily?.includes('monospace'),
      link: tagNameLower === 'a',
      linkData: tagNameLower === 'a' ? (node.getAttribute('href') || '') : null,
    }

    const startOffset = offset

    if (isBlock && offset > 0 && plainTextChars[plainTextChars.length - 1] !== '\n') {
      addNewline()
    }

    for (const child of node.childNodes) {
      traverse(child, isBlock)
    }

    const endOffset = offset
    if (endOffset > startOffset) {
      if (format.bold || format.italic || format.strikethrough || format.monospace || format.link) {
        spans.push({
          start: startOffset,
          end: endOffset,
          bold: format.bold,
          italic: format.italic,
          strikethrough: format.strikethrough,
          monospace: format.monospace,
          link: format.link,
          linkData: format.linkData,
          checkbox: false,
          checkboxChecked: false,
        })
      }
    }
  }

  for (const child of root.childNodes) {
    traverse(child, false)
  }

  return normalizeSpans(spans)
}

function normalizeSpans(spans) {
  if (spans.length <= 1) return spans

  spans.sort((a, b) => a.start - b.start || b.end - a.end)

  const merged = []
  for (const s of spans) {
    const last = merged[merged.length - 1]
    if (last && last.start === s.start && last.end === s.end) {
      last.bold = last.bold || s.bold
      last.italic = last.italic || s.italic
      last.strikethrough = last.strikethrough || s.strikethrough
      last.monospace = last.monospace || s.monospace
      if (s.link && !last.link) {
        last.link = true
        last.linkData = s.linkData
      }
    } else {
      merged.push({ ...s })
    }
  }

  return merged.filter(s => s.start < s.end)
}

export function getPlainTextFromHtml(html) {
  const div = document.createElement('div')
  div.innerHTML = html
  return elementToPlainText(div)
}

function elementToPlainText(element) {
  let result = ''
  const blockElements = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'PRE', 'BLOCKQUOTE'])
  
  function traverse(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    
    const tagName = node.tagName
    const isBlock = blockElements.has(tagName)
    
    if (tagName === 'BR') {
      result += '\n'
      return
    }

    // Inline image placeholder -> one \uFFFC char (mirrors htmlToSpans) so the
    // plain text preserves the picture's position within the note body.
    if (tagName === 'IMG') {
      result += '\uFFFC'
      return
    }
    
    if (isBlock && result.length > 0 && !result.endsWith('\n')) {
      result += '\n'
    }
    
    for (const child of node.childNodes) {
      traverse(child)
    }
  }
  
  traverse(element)
  return result
}

export function applyFormat(command, value = null) {
  document.execCommand(command, false, value)
}

export function createLink(url) {
  document.execCommand('createLink', false, url)
}
