<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
    <div class="w-full max-w-sm mx-4 p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl">
      <div class="text-center mb-8">
        <div class="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
          <svg class="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">memoX 已锁定</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">请输入 PIN 码解锁</p>
      </div>

      <div class="flex justify-center gap-3 mb-6">
        <div
          v-for="i in 4"
          :key="i"
          class="w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all duration-200"
          :class="pin.length >= i
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
            : 'border-gray-300 dark:border-gray-600'"
        >
          {{ pin.length >= i ? '●' : '' }}
        </div>
      </div>

      <div v-if="error" class="text-center text-red-500 text-sm mb-4 animate-pulse">
        PIN 码错误，请重试
      </div>

      <div class="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        <button
          v-for="n in 9"
          :key="n"
          @click="addDigit(String(n))"
          class="h-14 rounded-xl text-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all"
        >
          {{ n }}
        </button>
        <button @click="pin = ''" class="h-14 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all">
          清除
        </button>
        <button @click="addDigit('0')" class="h-14 rounded-xl text-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all">
          0
        </button>
        <button @click="submitPin" class="h-14 rounded-xl text-lg font-medium bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all" :disabled="pin.length < 4">
          <svg class="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useLockStore } from '../stores/lock'
import { useNotesStore } from '../stores/notes'

const lockStore = useLockStore()
const notesStore = useNotesStore()
const pin = ref('')
const error = ref(false)

function addDigit(d) {
  if (pin.value.length < 4) {
    pin.value += d
    error.value = false
    if (pin.value.length === 4) {
      setTimeout(submitPin, 150)
    }
  }
}

async function submitPin() {
  if (pin.value.length < 4) return
  const ok = await lockStore.unlock(pin.value)
  if (ok) {
    await notesStore.loadNotes()
  } else {
    error.value = true
    pin.value = ''
  }
}
</script>
