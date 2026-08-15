<template>
  <teleport to="body">
    <div
      v-if="state.visible"
      data-context-menu
      class="fixed z-[1000] min-w-[10rem] max-w-[16rem] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1 text-sm select-none"
      :style="{ left: state.x + 'px', top: state.y + 'px' }"
      @contextmenu.prevent
      @click.stop
    >
      <template v-for="(item, i) in state.items" :key="i">
        <div v-if="item.separator" class="my-1 border-t border-gray-100 dark:border-gray-700"></div>
        <div
          v-else
          class="relative"
          @mouseenter="onHover(i)"
        >
          <button
            type="button"
            class="w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors"
            :class="[
              item.danger
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
              item.disabled ? 'opacity-40 pointer-events-none' : ''
            ]"
            @click.stop="onSelect(item)"
          >
            <span v-if="item.icon" class="w-4 h-4 shrink-0 flex items-center justify-center" v-html="iconSvg(item.icon)"></span>
            <span class="flex-1 truncate">{{ item.label }}</span>
            <span v-if="item.submenu" class="ml-2 text-gray-400">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
            </span>
          </button>

          <!-- One-level submenu -->
          <div
            v-if="item.submenu && openSub === i"
            class="absolute left-full top-0 ml-1 min-w-[10rem] max-w-[16rem] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1"
          >
            <template v-for="(sub, j) in item.submenu" :key="'s' + j">
              <div v-if="sub.separator" class="my-1 border-t border-gray-100 dark:border-gray-700"></div>
              <button
                v-else
                type="button"
                class="w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors"
                :class="[
                  sub.danger
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
                  sub.disabled ? 'opacity-40 pointer-events-none' : ''
                ]"
                @click.stop="onSelect(sub)"
              >
                <span v-if="sub.icon" class="w-4 h-4 shrink-0 flex items-center justify-center" v-html="iconSvg(sub.icon)"></span>
                <span class="flex-1 truncate">{{ sub.label }}</span>
                <svg v-if="sub.value === currentFolderId" class="w-4 h-4 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              </button>
            </template>
          </div>
        </div>
      </template>
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useContextMenu } from '../composables/contextMenu'

const { state, closeMenu } = useContextMenu()
const openSub = ref(-1)

const props = defineProps({
  // Optional id used to mark the active item in submenus (e.g. current folderId)
  currentFolderId: { type: String, default: '' },
})

function onHover(i) {
  openSub.value = i
}

function onSelect(item) {
  if (item.disabled) return
  if (item.submenu) return // clicking a submenu parent just keeps it open
  closeMenu()
  openSub.value = -1
  if (typeof item.action === 'function') item.action()
}

const ICONS = {
  folder: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>',
  delete: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>',
  rename: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.586a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>',
  pin: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2h-3l-3 3-3-3H7a2 2 0 01-2-2V5z" /><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v-4" /></svg>',
  lock: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>',
  unlock: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0v4" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 11h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2z" /></svg>',
  eyeOn: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>',
  eyeOff: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>',
  copy: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h10a2 2 0 012 2v1"/></svg>',
  cut: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>',
  paste: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 4v2a1 1 0 001 1h4a1 1 0 001-1V4M9 4H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-2M9 4h6"/></svg>',
}

function iconSvg(key) {
  return ICONS[key] || ''
}

function onDocPointer(e) {
  // Close when clicking anywhere outside the menu (the menu stops propagation on its own click)
  if (!e.target.closest || !e.target.closest('[data-context-menu]')) {
    closeMenu()
    openSub.value = -1
  }
}

function onKey(e) {
  if (e.key === 'Escape') {
    closeMenu()
    openSub.value = -1
  }
}

function onScroll() {
  closeMenu()
  openSub.value = -1
}

onMounted(() => {
  document.addEventListener('click', onDocPointer, true)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onScroll)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocPointer, true)
  document.removeEventListener('keydown', onKey, true)
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onScroll)
})
</script>
