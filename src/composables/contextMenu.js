import { reactive } from 'vue'

// Shared, app-wide context-menu state. A single <ContextMenu> instance in each
// view reads from this store; any component can call openMenu() to show it.
const state = reactive({
  visible: false,
  x: 0,
  y: 0,
  items: [],
})

function openMenu(x, y, items) {
  state.x = x
  state.y = y
  state.items = items || []
  state.visible = true
  // Defer viewport clamping until the menu is actually rendered (needs its size).
  // setTimeout (macrotask) runs after Vue's nextTick render.
  setTimeout(clampToViewport, 0)
}

function closeMenu() {
  state.visible = false
  state.items = []
}

function clampToViewport() {
  const menu = document.querySelector('[data-context-menu]')
  if (!menu) return
  const rect = menu.getBoundingClientRect()
  const margin = 8
  let nx = state.x
  let ny = state.y
  if (nx + rect.width > window.innerWidth - margin) {
    nx = Math.max(margin, window.innerWidth - rect.width - margin)
  }
  if (ny + rect.height > window.innerHeight - margin) {
    ny = Math.max(margin, window.innerHeight - rect.height - margin)
  }
  state.x = nx
  state.y = ny
}

export function useContextMenu() {
  return { state, openMenu, closeMenu }
}
