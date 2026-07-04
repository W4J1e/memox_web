<template>
  <div class="flex flex-col h-screen">
    <!-- Top bar -->
    <header class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
      <button @click="$router.push('/')" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">设置</h1>
    </header>

    <main class="flex-1 overflow-y-auto">
      <div class="max-w-2xl mx-auto p-4 space-y-6">

        <!-- Theme -->
        <section class="card p-4">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">外观</h2>
          <div class="flex gap-2">
            <button
              v-for="t in themes"
              :key="t.value"
              @click="settingsStore.saveTheme(t.value)"
              class="flex-1 py-2 text-sm rounded-lg border-2 transition-all"
              :class="settingsStore.theme === t.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'"
            >
              {{ t.label }}
            </button>
          </div>
        </section>

        <!-- PIN Lock -->
        <section class="card p-4">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">安全</h2>
          <div v-if="!lockStore.lockEnabled">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">设置 PIN 码锁定应用和加密笔记，保护隐私</p>
            <div class="flex gap-2">
              <input
                v-model="newPin"
                type="password"
                maxlength="4"
                inputmode="numeric"
                placeholder="输入4位PIN码"
                class="input-field flex-1"
                @keydown.enter="confirmSetPin"
              />
              <button @click="confirmSetPin" class="btn-primary" :disabled="newPin.length < 4">设置</button>
            </div>
            <p v-if="pinError" class="text-red-500 text-sm mt-2">{{ pinError }}</p>
          </div>
          <div v-else>
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-900 dark:text-gray-100 font-medium">PIN 锁定已启用</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ settingsStore.lockOnStartup ? '应用启动和查看锁定笔记需输入PIN' : '仅查看锁定笔记需输入PIN' }}</p>
              </div>
              <button @click="showRemovePin = !showRemovePin" class="btn-danger text-sm">移除</button>
            </div>

            <!-- Lock on startup toggle -->
            <div class="flex items-center justify-between mt-3">
              <div>
                <p class="text-sm text-gray-900 dark:text-gray-100">启动时锁定</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">开启后每次打开应用需输入PIN码</p>
              </div>
              <button
                @click="settingsStore.saveLockOnStartup(!settingsStore.lockOnStartup)"
                class="relative w-11 h-6 rounded-full transition-colors"
                :class="settingsStore.lockOnStartup ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
              >
                <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform" :class="settingsStore.lockOnStartup ? 'translate-x-5' : ''"></span>
              </button>
            </div>

            <!-- Remove PIN form -->
            <div v-if="showRemovePin" class="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
              <p class="text-xs text-gray-500 dark:text-gray-400">请输入当前PIN码以移除锁定</p>
              <div class="flex gap-2">
                <input
                  v-model="oldPin"
                  type="password"
                  maxlength="4"
                  inputmode="numeric"
                  placeholder="当前PIN码"
                  class="input-field flex-1"
                  @keydown.enter="confirmRemovePin"
                />
                <button @click="confirmRemovePin" class="btn-danger" :disabled="oldPin.length < 4">确认移除</button>
              </div>
              <p v-if="removePinError" class="text-red-500 text-xs">{{ removePinError }}</p>
            </div>

            <div class="mt-3">
              <button @click="showChangePin = !showChangePin; oldPin = ''; changePinError = ''" class="text-sm text-green-500 hover:text-green-600">
                {{ showChangePin ? '取消' : '修改 PIN 码' }}
              </button>
            </div>

            <!-- Change PIN form -->
            <div v-if="showChangePin" class="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
              <div class="flex gap-2">
                <input
                  v-model="oldPin"
                  type="password"
                  maxlength="4"
                  inputmode="numeric"
                  placeholder="当前PIN码"
                  class="input-field flex-1"
                />
              </div>
              <div class="flex gap-2">
                <input
                  v-model="newPin"
                  type="password"
                  maxlength="4"
                  inputmode="numeric"
                  placeholder="新PIN码"
                  class="input-field flex-1"
                  @keydown.enter="confirmChangePin"
                />
                <button @click="confirmChangePin" class="btn-primary" :disabled="oldPin.length < 4 || newPin.length < 4">确认修改</button>
              </div>
              <p v-if="changePinError" class="text-red-500 text-xs">{{ changePinError }}</p>
            </div>
          </div>
        </section>

        <!-- WebDAV -->
        <section class="card p-4">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">WebDAV 同步</h2>
          <div class="space-y-3">
            <div>
              <label class="text-sm text-gray-600 dark:text-gray-400 mb-1 block">服务器地址</label>
              <input
                v-model="webdavForm.url"
                type="url"
                placeholder="https://dav.example.com/path"
                class="input-field"
              />
            </div>
            <div>
              <label class="text-sm text-gray-600 dark:text-gray-400 mb-1 block">用户名</label>
              <input
                v-model="webdavForm.username"
                type="text"
                placeholder="用户名"
                class="input-field"
              />
            </div>
            <div>
              <label class="text-sm text-gray-600 dark:text-gray-400 mb-1 block">密码</label>
              <input
                v-model="webdavForm.password"
                type="password"
                placeholder="密码"
                class="input-field"
              />
            </div>

            <!-- Connection mode / proxy -->
            <div>
              <label class="text-sm text-gray-600 dark:text-gray-400 mb-1 block">连接模式</label>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="m in proxyModes"
                  :key="m.value"
                  @click="webdavForm.proxyMode = m.value"
                  class="px-3 py-1.5 text-xs rounded-lg border-2 transition-all"
                  :class="webdavForm.proxyMode === m.value ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'"
                >
                  {{ m.label }}
                </button>
              </div>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{{ proxyModeHint }}</p>
            </div>

            <!-- Custom proxy URL -->
            <div v-if="webdavForm.proxyMode === 'proxy'">
              <label class="text-sm text-gray-600 dark:text-gray-400 mb-1 block">代理地址</label>
              <input
                v-model="webdavForm.proxyUrl"
                type="url"
                placeholder="http://localhost:3001/__dav__/"
                class="input-field"
              />
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">部署代理服务器后填写此地址，开发环境留空则自动使用内置代理</p>
            </div>

            <div class="flex gap-2 pt-2">
              <button @click="saveWebdav" class="btn-primary">保存配置</button>
              <button @click="testConn" :disabled="testing" class="btn-secondary">
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
            </div>

            <div v-if="connResult" class="text-sm p-2 rounded-lg" :class="connResult.ok ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'">
              {{ connResult.msg }}
            </div>
          </div>

          <!-- Sync actions -->
          <div v-if="settingsStore.webdavUrl" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3" v-if="settingsStore.lastSyncTime">
              上次同步：{{ formatSyncTime(settingsStore.lastSyncTime) }}
            </p>
            <div class="flex gap-2">
              <button @click="doSync" :disabled="settingsStore.syncStatus === 'syncing'" class="btn-primary flex-1">
                {{ settingsStore.syncStatus === 'syncing' ? '同步中...' : '双向同步' }}
              </button>
              <button @click="doUpload" :disabled="settingsStore.syncStatus === 'syncing'" class="btn-secondary flex-1">上传</button>
              <button @click="doDownload" :disabled="settingsStore.syncStatus === 'syncing'" class="btn-secondary flex-1">下载</button>
            </div>
          </div>

          <!-- CORS / Proxy info -->
          <div class="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs">
            <p class="font-medium mb-1">💡 关于跨域问题</p>
            <p>浏览器直连 WebDAV 受 CORS 限制。选择「自动」模式可通过内置代理绕过 CORS。若 WebDAV 服务器支持 CORS，可选择「直连」模式。</p>
          </div>
        </section>

        <!-- Data management -->
        <section class="card p-4">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">数据管理</h2>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">本地笔记数量</span>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ notesStore.notes.length }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-400">回收站</span>
              <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ notesStore.deletedNotes.length }}</span>
            </div>
            <div class="flex gap-2 pt-2">
              <button @click="onExportClick" class="btn-secondary flex-1">导出数据</button>
              <button @click="clearAllData" class="btn-danger flex-1">清除所有数据</button>
            </div>
            <div v-if="showExportPin" class="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">请输入PIN码以导出数据</p>
              <div class="flex gap-2">
                <input
                  v-model="exportPin"
                  type="password"
                  maxlength="4"
                  inputmode="numeric"
                  placeholder="PIN码"
                  class="input-field flex-1"
                  @keydown.enter="confirmExport"
                />
                <button @click="confirmExport" class="btn-primary" :disabled="exportPin.length < 4">确认</button>
              </div>
              <p v-if="exportPinError" class="text-red-500 text-xs mt-1">{{ exportPinError }}</p>
            </div>
            <div v-if="showClearPin" class="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">请输入PIN码以清除所有数据</p>
              <div class="flex gap-2">
                <input
                  v-model="clearPinInput"
                  type="password"
                  maxlength="4"
                  inputmode="numeric"
                  placeholder="PIN码"
                  class="input-field flex-1"
                  @keydown.enter="confirmClearPin"
                />
                <button @click="confirmClearPin" class="btn-danger" :disabled="clearPinInput.length < 4">确认</button>
              </div>
              <p v-if="clearPinError" class="text-red-500 text-xs mt-1">{{ clearPinError }}</p>
            </div>
          </div>
        </section>

        <!-- About -->
        <section class="card p-4">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">关于</h2>
          <div class="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <p>memoX Web v0.0.1</p>
            <p>与 memoX Android 应用数据兼容</p>
            <p class="pt-2">作者：<a href="https://hin.cool" target="_blank" rel="noopener" class="text-green-600 dark:text-green-400 hover:underline">W4J1e</a></p>
            <p>仓库：<a href="https://github.com/W4J1e/memox_web" target="_blank" rel="noopener" class="text-green-600 dark:text-green-400 hover:underline">github/memox_web</a></p>
          </div>
        </section>

      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useNotesStore } from '../stores/notes'
import { useLockStore } from '../stores/lock'

const settingsStore = useSettingsStore()
const notesStore = useNotesStore()
const lockStore = useLockStore()

const themes = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

const proxyModes = [
  { value: 'auto', label: '自动' },
  { value: 'proxy', label: '代理模式' },
  { value: 'direct', label: '直连模式' },
]

// PIN
const newPin = ref('')
const oldPin = ref('')
const pinError = ref('')
const showChangePin = ref(false)
const showRemovePin = ref(false)
const changePinError = ref('')
const removePinError = ref('')
const exportPinError = ref('')
const showExportPin = ref(false)
const exportPin = ref('')
const showClearPin = ref(false)
const clearPinInput = ref('')
const clearPinError = ref('')

async function confirmSetPin() {
  if (newPin.value.length < 4) {
    pinError.value = 'PIN 码至少4位'
    return
  }
  await lockStore.setPin(newPin.value)
  newPin.value = ''
  pinError.value = ''
  showChangePin.value = false
}

async function confirmChangePin() {
  if (oldPin.value.length < 4 || newPin.value.length < 4) return
  const valid = await lockStore.verifyPinOnly(oldPin.value)
  if (!valid) {
    changePinError.value = '当前PIN码错误'
    return
  }
  await lockStore.setPin(newPin.value)
  oldPin.value = ''
  newPin.value = ''
  changePinError.value = ''
  showChangePin.value = false
}

async function confirmRemovePin() {
  if (oldPin.value.length < 4) return
  const valid = await lockStore.verifyPinOnly(oldPin.value)
  if (!valid) {
    removePinError.value = '当前PIN码错误'
    return
  }
  await lockStore.removePin()
  oldPin.value = ''
  removePinError.value = ''
  showRemovePin.value = false
}

async function removePin() {
  showRemovePin.value = !showRemovePin.value
  oldPin.value = ''
  removePinError.value = ''
}

// WebDAV
const webdavForm = ref({ url: '', username: '', password: '', proxyMode: 'auto', proxyUrl: '' })
const testing = ref(false)
const connResult = ref(null)

const proxyModeHint = computed(() => {
  switch (webdavForm.value.proxyMode) {
    case 'auto': return '自动通过代理绕过CORS'
    case 'proxy': return '通过指定代理服务器访问WebDAV（推荐部署时使用）'
    case 'direct': return '直接连接WebDAV服务器（需要服务器支持CORS）'
    default: return ''
  }
})

onMounted(() => {
  webdavForm.value = {
    url: settingsStore.webdavUrl,
    username: settingsStore.webdavUsername,
    password: settingsStore.webdavPassword,
    proxyMode: settingsStore.proxyMode,
    proxyUrl: settingsStore.proxyUrl,
  }
})

async function saveWebdav() {
  await settingsStore.saveWebdavSettings(
    webdavForm.value.url,
    webdavForm.value.username,
    webdavForm.value.password,
    webdavForm.value.proxyMode,
    webdavForm.value.proxyUrl,
  )
  connResult.value = { ok: true, msg: '配置已保存' }
}

async function testConn() {
  testing.value = true
  connResult.value = null
  try {
    await settingsStore.saveWebdavSettings(
      webdavForm.value.url,
      webdavForm.value.username,
      webdavForm.value.password,
      webdavForm.value.proxyMode,
      webdavForm.value.proxyUrl,
    )
    await settingsStore.testConnection()
    connResult.value = { ok: true, msg: '连接成功！' }
  } catch (e) {
    connResult.value = { ok: false, msg: '连接失败：' + e.message }
  } finally {
    testing.value = false
  }
}

async function doSync() {
  try { await settingsStore.sync() } catch {}
}

async function doUpload() {
  try { await settingsStore.upload() } catch {}
}

async function doDownload() {
  if (confirm('下载将替换所有本地笔记，确定继续？')) {
    try { await settingsStore.download() } catch {}
  }
}

function formatSyncTime(ts) {
  if (!ts) return '从未'
  return new Date(ts).toLocaleString('zh-CN')
}

// Data management
function onExportClick() {
  if (!lockStore.lockEnabled) {
    exportData()
    return
  }
  showExportPin.value = !showExportPin.value
  exportPin.value = ''
  exportPinError.value = ''
}

async function confirmExport() {
  if (exportPin.value.length < 4) return
  const valid = await lockStore.verifyPinOnly(exportPin.value)
  if (!valid) {
    exportPinError.value = 'PIN码错误'
    return
  }
  showExportPin.value = false
  exportPin.value = ''
  exportData()
}

function exportData() {
  const data = {
    notes: notesStore.notes,
    labels: notesStore.allLabels,
    exportTime: new Date().toISOString(),
    version: '1.0.0-web',
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `memox_export_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function clearAllData() {
  if (lockStore.lockEnabled) {
    showClearPin.value = true
    return
  }
  doClearAllData()
}

async function doClearAllData() {
  if (confirm('确定清除所有数据？此操作不可撤销。')) {
    await notesStore.replaceAllNotes([])
    connResult.value = { ok: true, msg: '数据已清除' }
  }
  showClearPin.value = false
  clearPinInput.value = ''
  clearPinError.value = ''
}

async function confirmClearPin() {
  const ok = await lockStore.verifyPinOnly(clearPinInput.value)
  if (!ok) {
    clearPinError.value = 'PIN码错误'
    return
  }
  doClearAllData()
}
</script>
