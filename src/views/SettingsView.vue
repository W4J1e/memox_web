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

        <!-- 同步设置：WebDAV / OneDrive 二选一 -->
        <section class="card p-4">
          <!-- 标签页标题（左右切换，仅切内容不切路由） -->
          <div class="flex border-b border-gray-200 dark:border-gray-700 mb-4 -mt-1">
            <button
              @click="selectProvider('webdav')"
              class="flex-1 pb-2 text-sm font-medium border-b-2 -mb-px transition-colors"
              :class="syncProvider === 'webdav' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400'"
            >WebDAV 同步</button>
            <button
              @click="selectProvider('onedrive')"
              class="flex-1 pb-2 text-sm font-medium border-b-2 -mb-px transition-colors"
              :class="syncProvider === 'onedrive' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 dark:text-gray-400'"
            >OneDrive 同步</button>
          </div>

          <!-- WebDAV 面板 -->
          <div v-if="syncProvider === 'webdav'">
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
                  @click="selectProxyMode(m.value)"
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
                placeholder="https://your-proxy.example.com/dav/"
                class="input-field"
              />
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">请填写你自建的代理服务地址，客户端会将真实 WebDAV 地址通过 X-WebDAV-Url 请求头传递</p>
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

          <!-- CORS / Proxy info (WebDAV 面板内) -->
          <div class="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs">
            <p class="font-medium mb-1">关于连接模式</p>
            <p><b>自动</b>：通过站点同源的 <code>/api/dav/</code> 接口连接，适用于 EdgeOne Makers（自带边缘函数）和自建服务器（需配置反向代理暴露 /api/dav/），无需填写任何地址。</p>
            <p class="mt-1"><b>代理模式</b>：使用你自己的代理服务，需手动填写完整代理地址。</p>
            <p class="mt-1"><b>直连模式</b>：直接访问 WebDAV 服务器，仅当该服务器开启了 CORS 时才可用，否则会因跨域而被浏览器拦截。</p>
          </div>
          </div>

          <!-- OneDrive 面板 -->
          <div v-else>
            <div class="space-y-3">
              <p class="text-sm text-gray-600 dark:text-gray-400">使用 Microsoft OneDrive 同步，无需配置服务器。登录后与 memoX 安卓端共享同一份笔记（同一棵 memoX/ 目录树）。</p>
              <div v-if="onedriveSignedIn">
                <div class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm">
                  <img v-if="onedrivePhotoUrl" :src="onedrivePhotoUrl" class="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                  <svg v-else class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.3l6.5 3.6L12 11.5 5.5 7.9 12 4.3zM5 9.2l6 3.3v6.2l-6-3.3V9.2zm14 0v6.2l-6 3.3V12.5l6-3.3z"/></svg>
                  <span class="truncate">已登录：{{ onedriveAccount || 'Microsoft 账户' }}</span>
                </div>
                <button @click="disconnectOneDrive" class="btn-secondary mt-3 w-full">退出 OneDrive 登录</button>
              </div>
              <div v-else>
                <button @click="connectOneDrive" class="btn-primary w-full flex items-center justify-center gap-2">
                  <svg class="w-5 h-5" viewBox="0 0 23 23" fill="currentColor"><path d="M10.7 4.3c.4 0 .8.2 1 .6.2-.1.5-.2.7-.2 1.9 0 3.2 1.6 3.2 3.4 0 .2 0 .4-.1.6 1.1.3 2 1.3 2 2.6 0 1.5-1.2 2.7-2.7 2.7H7.9c-2 0-3.6-1.6-3.6-3.6 0-1.7 1.2-3.1 2.8-3.5.3-1.9 1.9-3.3 3.9-3.3.3 0 .5 0 .7.1.3-.4.8-.6 1.2-.6z"/></svg>
                  使用 Microsoft 账号登录
                </button>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">首次登录请允许 memoX 访问你的 OneDrive 文件。登录后会自动跳回本页。</p>
              </div>
            </div>
          </div>

          <!-- 共享同步操作 -->
          <div v-if="activeSyncConfigured" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
            <p>memoX Web v1.2.0</p>
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
import { startOAuthSignIn, signOutOneDrive, isOneDriveSignedIn, getOneDriveAccount, getOneDriveAccountPhoto } from '../utils/onedrive-auth'

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

// OneDrive：与 WebDAV 二选一的同步后端
const syncProvider = ref(settingsStore.syncProvider)
const onedriveSignedIn = ref(isOneDriveSignedIn())
const onedriveAccount = ref(getOneDriveAccount())
const onedrivePhotoUrl = ref('')

async function refreshOneDriveAccount() {
  onedriveSignedIn.value = isOneDriveSignedIn()
  onedriveAccount.value = getOneDriveAccount()
  onedrivePhotoUrl.value = onedriveSignedIn.value ? (await getOneDriveAccountPhoto()) : ''
}
// 底部共享的「双向同步/上传/下载」按钮只在该 provider 已配置时显示
const activeSyncConfigured = computed(() =>
  syncProvider.value === 'onedrive' ? onedriveSignedIn.value : !!settingsStore.webdavUrl
)
function selectProvider(p) {
  syncProvider.value = p
  settingsStore.saveSyncProvider(p)
}
function connectOneDrive() {
  // 整页跳转到 Microsoft 登录，回调由 App.vue 捕获
  startOAuthSignIn()
}
function disconnectOneDrive() {
  signOutOneDrive()
  refreshOneDriveAccount()
}

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
    case 'auto': return '自动通过当前站点同源的 /api/dav/ 接口连接（EdgeOne Makers 边缘函数、自建 OpenResty 反向代理均适用），无需任何配置'
    case 'proxy': return '通过你自建的代理服务访问 WebDAV，请填写完整的代理地址'
    case 'direct': return '直接连接 WebDAV 服务器，仅当该服务器允许跨域（CORS）时才可用，否则会连接失败'
    default: return ''
  }
})

function selectProxyMode(mode) {
  webdavForm.value.proxyMode = mode
  // auto / direct 不使用自定义代理地址，清空任何残留值，避免它日后劫持 auto 模式
  if (mode !== 'proxy') {
    webdavForm.value.proxyUrl = ''
  }
}

onMounted(() => {
  webdavForm.value = {
    url: settingsStore.webdavUrl,
    username: settingsStore.webdavUsername,
    password: settingsStore.webdavPassword,
    proxyMode: settingsStore.proxyMode,
    // Only keep a stored proxy URL when actually in proxy mode; otherwise drop any
    // stale value (e.g. an old Cloudflare Worker prefill) so it can't linger.
    proxyUrl: settingsStore.proxyMode === 'proxy' ? settingsStore.proxyUrl : '',
  }
  // Reflect the latest provider + OneDrive sign-in state (e.g. when arriving here
  // straight after an OAuth redirect handled by App.vue).
  syncProvider.value = settingsStore.syncProvider
  refreshOneDriveAccount()
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
    version: '1.2.0-web',
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
