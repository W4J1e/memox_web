import { reactive } from 'vue'

// App-wide in-memory clipboard for the rich-text editor.
//
// The web editor stores images *positionally*: the body text carries a \uFFFC
// placeholder for every inline image, and note.images[i] is the data for the
// i-th placeholder. The browser's native clipboard cannot move these images
// (it only copies the <img data-fname> node without the backing blob and, on
// paste, never splices the entry back into note.images — that desyncs the
// body <-> images mapping and "messes up" the note, exactly what the user hit
// with Ctrl+X/Ctrl+V).
//
// So we keep our own clipboard. For images we carry { fname, entry, blob }:
//   - fname  : the attachment file name — it is the SAME unique name used on
//              WebDAV, so a cut/paste across notes only transfers the REFERENCE.
//              The remote file is never deleted or re-uploaded (uploadAttachments
//              always skips a name that already exists on the server).
//   - entry  : the note.images entry ({ localName, originalName, mimeType }).
//   - blob   : the actual bytes from IndexedDB, kept in memory so a paste still
//              works even if the source is later gone in this session.
const state = reactive({
  html: '',
  text: '',
  images: [], // [{ fname, entry, blob }]
})

function setClipboard({ html, text, images }) {
  state.html = html || ''
  state.text = text || ''
  state.images = images || []
}

function getClipboard() {
  return state
}

function hasData() {
  return !!(state.html || state.text || state.images.length)
}

function clear() {
  state.html = ''
  state.text = ''
  state.images = []
}

export function useClipboard() {
  return { state, setClipboard, getClipboard, hasData, clear }
}
