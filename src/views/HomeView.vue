<template>
  <div class="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative">
    <!-- Mobile sidebar overlay -->
    <div
      v-if="sidebarOpen && isMobile"
      class="fixed inset-0 bg-black/50 z-40"
      @click="sidebarOpen = false"
    ></div>

    <!-- Left Sidebar -->
    <aside
      class="h-full bg-dou-sidebar border-r border-gray-200/70 dark:border-gray-700/70 flex flex-col transition-all duration-300 z-50"
      :class="[
        isMobile
          ? (sidebarOpen ? 'fixed left-0 top-0 w-64 translate-x-0' : 'fixed left-0 top-0 w-64 -translate-x-full')
          : (sidebarCollapsed ? 'w-16 shrink-0' : 'w-64 shrink-0')
      ]"
    >
      <!-- Logo & toggle -->
      <div class="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 shrink-0" :class="(sidebarCollapsed && !isMobile) ? 'px-2 py-3 justify-center' : 'px-4 py-3'">
        <template v-if="!(sidebarCollapsed && !isMobile)">
          <img src="/memox.png" alt="memoX" class="w-8 h-8 rounded-xl shrink-0 object-cover" />
          <h1 class="text-lg font-bold text-gray-900 dark:text-gray-100">Memox</h1>
        </template>
        <button
          @click="toggleSidebar"
          class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0"
          :class="(sidebarCollapsed && !isMobile) ? '' : 'ml-auto'"
          :title="(sidebarCollapsed && !isMobile) || (isMobile && !sidebarOpen) ? '展开侧边栏' : '收起侧边栏'"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <!-- New note button -->
      <div class="p-3 shrink-0">
        <button
          @click="createNewNote('NOTE')"
          class="w-full flex items-center gap-2 px-3 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl shadow-sm transition-colors font-medium"
          :class="sidebarCollapsed ? 'justify-center' : 'justify-start'"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span v-if="!sidebarCollapsed" class="text-sm">新建笔记</span>
        </button>
      </div>

      <!-- Nav items -->
      <div class="flex-1 overflow-y-auto px-2 space-y-1">
        <NavItem
          icon="notebook"
          :label="sidebarCollapsed ? '' : '全部笔记'"
          :active="!recentView && notesStore.currentFolder === 'NOTES' && !notesStore.currentLabel"
          :count="notesStore.notes.filter(n => n.folder === 'NOTES').length"
          :collapsed="sidebarCollapsed"
          @click="selectAllNotes"
        />
        <NavItem
          icon="clock"
          :label="sidebarCollapsed ? '' : '最近编辑'"
          :active="recentView"
          :collapsed="sidebarCollapsed"
          @click="selectRecentEdited"
        />
        <NavItem
          icon="archive"
          :label="sidebarCollapsed ? '' : '归档'"
          :active="notesStore.currentFolder === 'ARCHIVED'"
          :count="notesStore.archivedNotes.length"
          :collapsed="sidebarCollapsed"
          @click="selectFolder('ARCHIVED')"
        />
        <NavItem
          icon="trash"
          :label="sidebarCollapsed ? '' : '回收站'"
          :active="notesStore.currentFolder === 'DELETED'"
          :count="notesStore.deletedNotes.length"
          :collapsed="sidebarCollapsed"
          @click="selectFolder('DELETED')"
        />

        <!-- User folders (Android v1.2.4) — ABOVE labels -->
        <div v-if="!sidebarCollapsed" class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between px-3 mb-2">
            <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">文件夹</span>
            <button @click="promptNewFolder(false)" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="新建文件夹">
              <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <!-- Virtual "uncategorized" pseudo-folder -->
          <FolderItem
            label="未归类"
            :count="getFolderCount('')"
            :active="notesStore.currentUserFolder === ''"
            :can-edit="false"
            @click="selectUserFolder('')"
          />
          <FolderItem
            v-for="f in allFoldersSorted"
            :key="f.name"
            :label="f.name"
            :count="getFolderCount(f.name)"
            :active="notesStore.currentUserFolder === f.name"
            :hidden="f.hidden"
            @click="selectUserFolder(f.name)"
            @contextmenu="onFolderContextMenu"
          />
        </div>

        <!-- Labels section (below folders) — no hide/show, only create/delete/rename via settings -->
        <div v-if="!sidebarCollapsed && (allAvailableLabels.length)" class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between px-3 mb-2">
            <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">标签</span>
            <button @click="promptNewLabelSidebar" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="新建标签">
              <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <LabelItem
            v-for="label in visibleLabels"
            :key="label"
            :label="label"
            :count="getLabelCount(label)"
            :active="notesStore.currentLabel === label"
            @select="selectLabel"
            @contextmenu="onLabelContextMenu"
          />
          <button
            v-if="allAvailableLabels.length > 5"
            @click="showAllLabels = !showAllLabels"
            class="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg cursor-pointer transition-colors w-full"
          >
            <svg class="w-3.5 h-3.5 transition-transform" :class="{ 'rotate-180': showAllLabels }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            <span>{{ showAllLabels ? '收起标签' : `更多标签 (${allAvailableLabels.length - 5})` }}</span>
          </button>
        </div>
      </div>

      <!-- Footer: theme toggle + storage + account/settings -->
      <div class="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-2">
        <!-- Theme toggle switch -->
        <div class="flex items-center justify-center">
          <button
            @click="toggleTheme"
            class="relative w-12 h-7 rounded-full bg-gray-200 dark:bg-gray-600 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 shrink-0"
            :title="settingsStore.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
            aria-label="切换深浅色模式"
          >
            <!-- sun icon (left, light side) -->
            <svg
              class="absolute left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-gray-400 transition-colors"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <!-- moon icon (right, dark side) -->
            <svg
              class="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-300 transition-colors"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <!-- sliding thumb -->
            <span
              class="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white dark:bg-gray-300 shadow-md transition-transform duration-300 flex items-center justify-center"
              :class="settingsStore.theme === 'dark' ? 'translate-x-5' : 'translate-x-0'"
            >
              <svg
                v-if="settingsStore.theme === 'dark'"
                class="w-3.5 h-3.5 text-indigo-600"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <svg
                v-else
                class="w-3.5 h-3.5 text-amber-500"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
          </button>
        </div>

        <!-- Storage usage -->
        <div v-if="!sidebarCollapsed && storageQuota" class="px-1 pb-1">
          <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300 mb-1">
            <span>存储使用</span>
            <span>{{ formatBytes(storageQuota.usedBytes) }} / {{ formatBytes(storageQuota.totalBytes) }}</span>
          </div>
          <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              class="h-full bg-accent rounded-full transition-all duration-500"
              :style="{ width: storagePercent + '%' }"
            ></div>
          </div>
        </div>
        <!-- Account / provider row (bottom): avatar chip + settings icon -->
        <div class="relative">
          <div
            v-if="showProviderMenu"
            class="fixed inset-0 z-40"
            @click="showProviderMenu = false"
          ></div>
          <div
            class="flex items-center"
            :class="sidebarCollapsed ? 'justify-center gap-1' : 'gap-2'"
          >
            <!-- avatar chip: click to switch provider -->
            <button
              @click="toggleProviderMenu"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors min-w-0"
              :class="sidebarCollapsed ? '' : 'flex-1'"
              :title="providerLabel"
            >
              <img v-if="providerAvatarUrl" :src="providerAvatarUrl" class="w-7 h-7 rounded-full object-cover shrink-0" alt="" />
              <span
                v-else
                class="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0"
              >
                <svg v-if="settingsStore.syncProvider === 'onedrive'" class="w-4 h-4" viewBox="0 0 23 23" fill="currentColor"><path d="M10.7 4.3c.4 0 .8.2 1 .6.2-.1.5-.2.7-.2 1.9 0 3.2 1.6 3.2 3.4 0 .2 0 .4-.1.6 1.1.3 2 1.3 2 2.6 0 1.5-1.2 2.7-2.7 2.7H7.9c-2 0-3.6-1.6-3.6-3.6 0-1.7 1.2-3.1 2.8-3.5.3-1.9 1.9-3.3 3.9-3.3.3 0 .5 0 .7.1.3-.4.8-.6 1.2-.6z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h10a4 4 0 000-8 5 5 0 00-9.6-1.5A4 4 0 003 15z" /></svg>
              </span>
              <span v-if="!sidebarCollapsed" class="text-sm text-gray-700 dark:text-gray-300 truncate flex-1 text-left">{{ providerLabel }}</span>
              <svg v-if="!sidebarCollapsed" class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            <!-- settings icon (rightmost) -->
            <router-link
              to="/settings"
              class="p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors shrink-0"
              title="设置"
              @click="showProviderMenu = false"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </router-link>
          </div>

          <!-- provider switch dropdown -->
          <div
            v-if="showProviderMenu"
            class="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-1.5"
          >
            <button
              @click="switchProvider('webdav')"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-sm"
              :class="settingsStore.syncProvider === 'webdav' ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
            >
              <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h10a4 4 0 000-8 5 5 0 00-9.6-1.5A4 4 0 003 15z" /></svg>
              </span>
              <span class="flex-1 text-left">WebDAV 同步</span>
              <svg v-if="settingsStore.syncProvider === 'webdav'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
            </button>
            <button
              @click="switchProvider('onedrive')"
              class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-sm"
              :class="settingsStore.syncProvider === 'onedrive' ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300'"
            >
              <span class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <svg class="w-3.5 h-3.5" viewBox="0 0 23 23" fill="currentColor"><path d="M10.7 4.3c.4 0 .8.2 1 .6.2-.1.5-.2.7-.2 1.9 0 3.2 1.6 3.2 3.4 0 .2 0 .4-.1.6 1.1.3 2 1.3 2 2.6 0 1.5-1.2 2.7-2.7 2.7H7.9c-2 0-3.6-1.6-3.6-3.6 0-1.7 1.2-3.1 2.8-3.5.3-1.9 1.9-3.3 3.9-3.3.3 0 .5 0 .7.1.3-.4.8-.6 1.2-.6z"/></svg>
              </span>
              <span class="flex-1 text-left">OneDrive 同步</span>
              <svg v-if="settingsStore.syncProvider === 'onedrive'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Middle: Notes list (hidden on mobile when a note is selected) -->
    <section
      v-show="!isMobile || !selectedNote"
      class="w-full md:w-80 lg:w-96 shrink-0 flex flex-col min-w-0 border-r border-gray-200/80 dark:border-gray-700/60 bg-white dark:bg-gray-800/95 backdrop-blur-sm"
    >
      <!-- List header -->
      <div class="p-4 shrink-0">
        <div class="flex items-center gap-2 mb-3">
          <button
            v-if="isMobile"
            @click="sidebarOpen = true"
            class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="打开菜单"
          >
            <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <template v-if="selectionMode">
            <button
              @click="exitSelection"
              class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="退出多选"
            >
              <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 class="text-base font-bold text-gray-900 dark:text-gray-100">已选 {{ selectedIds.size }} 项</h2>
            <div class="ml-auto flex items-center gap-1">
              <button
                @click="selectAllInView"
                class="px-2 py-1 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                title="全选"
              >全选</button>
              <button
                @click="exitSelection"
                class="px-2 py-1 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
                title="取消"
              >取消</button>
            </div>
          </template>
          <template v-else>
            <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ currentViewTitle }}</h2>
            <span v-if="isSearching" class="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{{ displayedNotes.length }} 条结果</span>
            <DynamicIsland />
            <div class="ml-auto flex items-center gap-1">
              <button
                @click="toggleSortOrder"
                class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="排序"
              >
                <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>
              <button
                @click="viewMode = viewMode === 'list' ? 'grid' : 'list'"
                class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="切换视图"
              >
                <svg v-if="viewMode === 'list'" class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                <svg v-else class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              </button>
            </div>
          </template>
        </div>
        <!-- Search bar (card style) -->
        <div class="relative group">
          <div class="flex items-center gap-2 px-3 py-2 bg-white/90 dark:bg-gray-750 border border-gray-200/60 rounded-full shadow-sm hover:shadow-md transition-shadow duration-200 focus-within:ring-2 focus-within:ring-green-500/25 focus-within:border-green-400/60 dark:focus-within:border-green-500/60">
            <svg class="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref="searchInputRef"
              v-model="notesStore.searchQuery"
              type="text"
              placeholder="搜索笔记..."
              class="flex-1 bg-transparent border-0 outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 py-0.5 min-w-0"
              @keydown.esc="notesStore.searchQuery = ''"
            />
            <kbd class="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500 pointer-events-none group-focus-within:hidden" :class="{ '!hidden': notesStore.searchQuery }">⌘ K</kbd>
            <button v-if="notesStore.searchQuery" @click="notesStore.searchQuery = ''" class="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Notes list -->
      <div class="flex-1 overflow-y-auto notes-scroll">
        <template v-if="notesStore.currentFolder === 'DELETED'">
          <div v-if="notesStore.deletedNotes.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
            <svg class="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <p class="text-lg">回收站为空</p>
          </div>
          <div v-else class="divide-y divide-gray-100/60 dark:divide-gray-700/40">
            <div
              v-for="note in notesStore.deletedNotes"
              :key="note.id"
              class="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors flex items-center gap-3"
              @click="selectNote(note)"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ note.title || '(无标题)' }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(note.timestamp) }}</div>
              </div>
              <button @click.stop="notesStore.restoreNote(note.id)" class="text-sm text-green-500 hover:text-green-600 px-2 py-1">恢复</button>
              <button @click.stop="permanentDelete(note.id)" class="text-sm text-red-500 hover:text-red-600 px-2 py-1">删除</button>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="displayedNotes.length === 0 && !notesStore.loading" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
            <svg class="w-20 h-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-lg mb-2">{{ isSearching ? `没有找到匹配「${notesStore.searchQuery}」的笔记` : '暂无笔记' }}</p>
            <p class="text-sm">{{ isSearching ? '试试其他关键词' : '点击"新建笔记"开始记录' }}</p>
          </div>

          <div v-if="notesStore.loading" class="flex items-center justify-center h-32">
            <svg class="w-8 h-8 text-green-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>

          <!-- List view -->
          <div v-if="viewMode === 'list' && !notesStore.loading && displayedNotes.length > 0" :class="isSearching ? 'p-3 space-y-2' : 'divide-y divide-gray-100/60 dark:divide-gray-700/40'">
            <div
              v-for="note in displayedNotes"
              :key="note.id"
              class="cursor-pointer transition-all duration-150 rounded-xl"
              :class="[
                isSearching
                  ? 'bg-white dark:bg-gray-750 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md p-3.5 gap-3'
                  : 'px-3 py-3 border-l-2 flex gap-3',
                selectedIds.has(note.id)
                  ? (isSearching ? 'ring-2 ring-green-500' : 'bg-green-100 dark:bg-green-900/40 border-l-green-500')
                  : selectedNote?.id === note.id
                    ? (isSearching ? 'ring-2 ring-green-400' : 'bg-green-50 dark:bg-green-900/20 border-l-green-500')
                    : (isSearching ? 'hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-transparent')
              ]"
              @click="onNoteCardClick(note)"
              @mousedown="startLongPress(note)"
              @touchstart="startLongPress(note)"
              @mouseup="cancelLongPress"
              @mouseleave="cancelLongPress"
              @touchend="cancelLongPress"
              @touchmove="cancelLongPress"
              @contextmenu.prevent="onNoteContextMenu($event, note)"
            >
              <div class="flex-1 min-w-0 flex flex-col">
                <div class="flex items-center gap-1 mb-1">
                  <span v-if="note.pinned" class="text-xs shrink-0">📌</span>
                  <span v-if="note.locked" class="text-xs shrink-0">🔒</span>
                  <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" v-html="isSearching ? highlightText(note.title || '(无标题)', notesStore.searchQuery) : (note.title || '(无标题)')"></span>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1.5" v-html="isSearching && !note.locked ? highlightText(getNotePreview(note).substring(0, 120), notesStore.searchQuery) : (note.locked ? '🔒 内容已锁定' : getNotePreview(note).substring(0, 100))"></div>
                <div class="flex items-center gap-2 mt-auto flex-wrap">
                  <span
                    v-if="note.folderId"
                    :key="'folder_' + note.folderId"
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200/60 dark:border-green-800/40"
                  >📁 {{ note.folderId }}</span>
                  <span
                    v-for="label in (note.labels || []).slice(0, 2)"
                    :key="label"
                    class="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  >{{ label }}</span>
                  <span v-if="(note.labels || []).length > 2" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">+{{ note.labels.length - 2 }}</span>
                  <span class="text-[10px] text-gray-400 ml-auto tabular-nums">{{ formatDate(note.timestamp) }}</span>
                </div>
              </div>
              <div v-if="!note.locked && !isSearching && note.images && note.images.length > 0" class="flex flex-col items-end shrink-0 w-20">
                <div class="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  <img
                    v-if="getListThumbnail(note.id)"
                    :src="getListThumbnail(note.id)"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    @error="onListImgError(note.id)"
                  />
                </div>
                <span class="text-[10px] text-gray-400 mt-1">{{ formatDate(note.timestamp) }}</span>
              </div>
            </div>
          </div>

          <!-- Grid view -->
          <div v-if="viewMode === 'grid' && !notesStore.loading && displayedNotes.length > 0" class="p-3 columns-2 gap-3">
            <NoteCard
              v-for="note in displayedNotes"
              :key="note.id"
              :note="note"
              :thumbnail-url="getListThumbnail(note.id)"
              :class="[
                selectedIds.has(note.id) ? 'ring-2 ring-green-600' : '',
                selectedNote?.id === note.id && !selectedIds.has(note.id) ? 'ring-2 ring-green-500' : ''
              ]"
              @click="onNoteCardClick(note)"
              @mousedown="startLongPress(note)"
              @touchstart="startLongPress(note)"
              @mouseup="cancelLongPress"
              @mouseleave="cancelLongPress"
              @touchend="cancelLongPress"
              @touchmove="cancelLongPress"
              @img-error="onListImgError(note.id)"
              @contextmenu="onNoteContextMenu"
            />
          </div>
        </template>
      </div>
    </section>

    <!-- Right: Note preview/editor (visible on mobile only when a note is selected) -->
    <section
      v-show="!isMobile || selectedNote"
      class="flex-1 flex-col min-w-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
      :class="isMobile ? 'flex' : 'hidden md:flex'"
    >
      <template v-if="selectedNote">
        <!-- Locked note -->
        <template v-if="selectedNote.locked && !isSelectedNoteUnlocked">
          <div v-if="isMobile" class="px-4 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
            <button @click="deselectNote" class="fmt-btn" title="返回列表" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
          </div>
          <div class="flex-1 flex flex-col items-center justify-center text-center">
            <div class="w-16 h-16 mb-4 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
              <svg class="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <p class="text-gray-600 dark:text-gray-300 mb-4">此笔记已锁定</p>
            <button @click="showPinDialog = true" class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors">输入PIN解锁</button>
          </div>
        </template>

        <!-- Editable note content -->
        <template v-else>
          <!-- Formatting toolbar -->
          <div class="px-4 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0 flex items-center gap-1 overflow-x-auto">
            <button v-if="isMobile" @click="deselectNote" class="fmt-btn mr-2" title="返回列表" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button @click="execFormat('bold')" class="fmt-btn" :class="{ active: previewFormats.bold }" title="加粗" type="button"><b>B</b></button>
            <button @click="execFormat('italic')" class="fmt-btn" :class="{ active: previewFormats.italic }" title="斜体" type="button"><i>I</i></button>
            <button @click="execFormat('strikeThrough')" class="fmt-btn" :class="{ active: previewFormats.strikethrough }" title="删除线" type="button"><s>S</s></button>
            <button @click="execFormat('monospace')" class="fmt-btn" :class="{ active: previewFormats.monospace }" title="等宽" type="button"><code style="font-family:monospace;font-size:0.85em">M</code></button>
            <button @click="handleLinkClick" class="fmt-btn" :class="{ active: previewFormats.link }" title="链接" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </button>
            <button @click="triggerImageUpload" class="fmt-btn" title="插入图片" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <button @click="fileInputRef?.click()" class="fmt-btn" title="上传附件" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            </button>
            <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <input ref="imageInputRef" type="file" accept="image/*" multiple class="hidden" @change="onImageFilesSelected" />
            <input ref="fileInputRef" type="file" class="hidden" @change="onFileSelected" />
            <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button @click="execUndo" class="fmt-btn" title="撤销 (Ctrl+Z)" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" /></svg>
            </button>
            <button @click="execRedo" class="fmt-btn" title="重做 (Ctrl+Y)" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 10h-10a5 5 0 00-5 5v2M21 10l-4-4m4 4l-4 4" /></svg>
            </button>
            <div class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1"></div>
            <button @click="execFormat('removeFormat')" class="fmt-btn" title="清除格式" type="button">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div class="ml-auto flex items-center gap-1">
              <button v-if="selectedNote?.folder === 'NOTES'" @click="archiveNote" class="fmt-btn" title="归档" type="button">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              </button>
              <button v-if="selectedNote?.folder === 'ARCHIVED'" @click="unarchiveNote" class="fmt-btn" title="取消归档" type="button">
                <svg class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button v-if="selectedNote?.folder === 'DELETED'" @click="restoreNote" class="fmt-btn" title="恢复" type="button">
                <svg class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button @click="deleteNote" class="fmt-btn hover:text-red-500" :title="selectedNote?.folder === 'DELETED' ? '永久删除' : '删除'" type="button">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </div>

          <!-- Scrollable edit area -->
          <div class="flex-1 overflow-y-auto editor-scroll">
            <div class="max-w-3xl mx-auto px-6 py-4">
              <input
                v-model="editingTitle"
                type="text"
                placeholder="标题"
                class="w-full text-2xl font-bold bg-transparent border-0 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 mb-2"
                @input="onPreviewInput"
              />
              <!-- Folder + Labels on one row: [📁 folder ▾] [🏷️] chips [+ tag] -->
              <div v-if="selectedNote" class="relative flex flex-wrap items-center gap-2 mb-2">
                <!-- Folder picker -->
                <button
                  @click="showFolderMenu = !showFolderMenu"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  :title="selectedNote.folderId ? '移动到其他文件夹' : '分配到文件夹'"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                  <span>{{ selectedNote.folderId || '未分类' }}</span>
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div v-if="showFolderMenu" class="fixed inset-0 z-10" @click="showFolderMenu = false"></div>
                <div v-if="showFolderMenu" class="absolute left-0 top-full z-20 mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto">
                  <button @click="assignCurrentFolder('')" class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" :class="!selectedNote.folderId ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'">未分类</button>
                  <button
                    v-for="f in settingsStore.folders"
                    :key="f.name"
                    @click="assignCurrentFolder(f.name)"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between gap-2"
                    :class="selectedNote.folderId === f.name ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'"
                  >
                    <span class="truncate">{{ f.name }}</span>
                    <svg v-if="selectedNote.folderId === f.name" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button @click="promptNewFolder(true)" class="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">+ 新建文件夹</button>
                </div>

                <!-- Separator -->
                <span class="text-gray-300 dark:text-gray-600">|</span>

                <!-- Label chips -->
                <svg class="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" /></svg>
                <span
                  v-for="lb in (selectedNote.labels || [])"
                  :key="lb"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                >
                  <span class="truncate max-w-[8rem]">{{ lb }}</span>
                  <button @click="removeNoteLabel(lb)" class="hover:text-red-500 leading-none" title="移除标签">×</button>
                </span>
                <button
                  @click="showLabelMenu = !showLabelMenu"
                  class="px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-green-600 hover:border-green-500 transition-colors"
                  title="添加标签"
                >+ 标签</button>
                <div v-if="showLabelMenu" class="fixed inset-0 z-10" @click="showLabelMenu = false"></div>
                <div v-if="showLabelMenu" class="absolute left-0 top-full z-20 mt-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 max-h-64 overflow-y-auto">
                  <div v-if="notesStore.allLabels.length === 0" class="px-3 py-2 text-xs text-gray-400">暂无标签，点击下方新建</div>
                  <button
                    v-for="lb in notesStore.allLabels"
                    :key="lb"
                    @click="toggleNoteLabel(lb)"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between gap-2"
                    :class="(selectedNote.labels || []).includes(lb) ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'"
                  >
                    <span class="truncate">{{ lb }}</span>
                    <svg v-if="(selectedNote.labels || []).includes(lb)" class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <div class="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                  <button @click="promptNewLabel" class="w-full text-left px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">+ 新建标签</button>
                </div>
              </div>
              <div class="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span>{{ formatDate(selectedNote.timestamp) }}</span>
                <span>{{ formatDate(selectedNote.modifiedTimestamp) }}</span>
              </div>

              <!-- TEXT note: rich editor -->
              <div v-if="selectedNote.type !== 'LIST'">
                <div
                  ref="previewEditorRef"
                  class="preview-editor text-gray-700 dark:text-gray-300 leading-relaxed text-base outline-none min-h-[120px]"
                  contenteditable="true"
                  @input="onPreviewEditorInput"
                  @keydown="onPreviewEditorKeydown"
                  @keyup="updatePreviewFormats"
                  @mouseup="updatePreviewFormats"
                  @click="onPreviewEditorClick"
                  @contextmenu="onPreviewEditorContextMenu"
                  @paste="onPreviewEditorPaste"
                  @focus="previewEditorFocused = true"
                  @blur="previewEditorFocused = false"
                ></div>
              </div>

              <!-- LIST note -->
              <div v-else class="space-y-1">
                <div v-for="(item, idx) in editingItems" :key="idx" class="flex items-start gap-2 group py-1">
                  <button @click="togglePreviewItem(idx)" class="mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors" :class="item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'">
                    <svg v-if="item.checked" class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                  </button>
                  <input v-model="item.body" type="text" class="flex-1 bg-transparent border-0 outline-none text-gray-800 dark:text-gray-200 text-sm" :class="item.checked ? 'line-through text-gray-400' : ''" placeholder="列表项..." @input="onPreviewInput" @keydown.enter="addPreviewItem(idx)" @keydown.backspace="deletePreviewItemIfEmpty(idx)" />
                </div>
                <button @click="addPreviewItem" class="text-sm text-green-500 hover:text-green-600 py-1">+ 添加项</button>
              </div>

              <!-- Images render inline inside the editor (body \uFFFC + note.images).
                 There is intentionally NO bottom image gallery: every image lives in
                 the body text. Legacy non-inline images are re-attached inline by
                 initPreviewEditor and self-heal into \uFFFC on the next save. -->

              <!-- Audio attachments -->
              <div v-if="previewAudioUrls.length > 0" class="mt-4 space-y-2">
                <div
                  v-for="(item, idx) in previewAudioUrls"
                  :key="'audio_' + idx"
                  class="flex items-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-xl p-3"
                >
                  <svg class="w-6 h-6 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-gray-700 dark:text-gray-200 truncate mb-1">{{ item.name }}</div>
                    <audio :src="item.url" controls class="w-full h-8"></audio>
                  </div>
                </div>
              </div>

              <!-- File attachments -->
              <div v-if="previewFileUrls.length > 0" class="mt-4 grid grid-cols-1 gap-2">
                <a
                  v-for="(item, idx) in previewFileUrls"
                  :key="'file_' + idx"
                  :href="item.url"
                  :download="item.name"
                  class="flex items-center gap-3 bg-gray-100 dark:bg-gray-700 rounded-xl p-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg class="w-6 h-6 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9l-6-6H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span class="text-sm text-gray-700 dark:text-gray-200 truncate">{{ item.name }}</span>
                  <svg class="w-4 h-4 text-gray-400 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- Empty preview -->
      <template v-else>
        <div class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <svg class="w-24 h-24 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-lg mb-2">选择一条笔记查看</p>
          <p class="text-sm">点击左侧列表中的笔记</p>
        </div>
      </template>
    </section>

    <!-- Link dialog -->
    <div v-if="showLinkDlg" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showLinkDlg = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-2xl w-80">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">插入链接</h3>
        <input ref="linkInputRef" v-model="linkUrl" type="text" placeholder="请输入链接地址" class="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-green-500 text-gray-900 dark:text-gray-100 mb-3" @keydown.enter="applyLink" />
        <div class="flex gap-2">
          <button @click="showLinkDlg = false" class="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
          <button @click="applyLink" class="flex-1 px-3 py-2 text-sm rounded-lg bg-green-500 text-white hover:bg-green-600">确定</button>
        </div>
      </div>
    </div>

    <!-- PIN unlock dialog for locked note -->
    <div v-if="showPinDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="closePinDialog">
      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-72 shadow-2xl" @click.stop>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-5">输入 PIN 解锁笔记</h3>
        <div class="relative flex justify-center gap-3 mb-3">
          <div
            v-for="i in 4"
            :key="i"
            class="w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all bg-white dark:bg-gray-700"
            :class="pinInput.length >= i
              ? 'border-green-500 text-green-600 dark:text-green-400'
              : 'border-gray-300 dark:border-gray-600'"
          >{{ pinInput.length >= i ? '●' : '' }}</div>
          <input
            ref="pinInputRef"
            v-model="pinInput"
            type="password"
            inputmode="numeric"
            maxlength="4"
            class="absolute inset-0 w-full h-full opacity-0 cursor-text"
            @input="onPinInput"
            @keydown.enter="verifyPreviewPin"
          />
        </div>
        <p v-if="pinError" class="text-center text-red-500 text-sm mb-2">PIN码错误，请重试</p>
        <div class="flex gap-2 mt-4">
          <button @click="closePinDialog" class="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm">取消</button>
          <button @click="verifyPreviewPin" :disabled="pinInput.length < 4" class="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg transition-colors text-sm">解锁</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Global right-click context menu (notes / folders / labels) -->
  <ContextMenu :current-folder-id="selectedNote?.folderId || ''" />
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useNotesStore } from '../stores/notes'
import { useSettingsStore } from '../stores/settings'
import { useLockStore } from '../stores/lock'
import { isOneDriveSignedIn, getOneDriveAccount, getOneDriveAccountPhoto } from '../utils/onedrive-auth'
import NoteCard from '../components/NoteCard.vue'
import NavItem from '../components/NavItem.vue'
import LabelItem from '../components/LabelItem.vue'
import FolderItem from '../components/FolderItem.vue'
import ContextMenu from '../components/ContextMenu.vue'
import { useContextMenu } from '../composables/contextMenu'
import { useClipboard } from '../composables/clipboard'
import DynamicIsland from '../components/DynamicIsland.vue'
import { formatDate, getNotePreview, sanitizeBody, getImageFileName, createEmptyListItem, guessMimeType } from '../utils/note-parser'
import { getAttachment, putAttachment, putSetting } from '../utils/storage'
import { compressImageFile, withNewExt } from '../utils/image-compress'
import { spansToHtml, htmlToSpans, getPlainTextFromHtml } from '../utils/rich-text'

const notesStore = useNotesStore()
const settingsStore = useSettingsStore()
const lockStore = useLockStore()

const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)
const selectedNote = ref(null)
const showFolderMenu = ref(false)
const showLabelMenu = ref(false)

const isMobile = ref(window.innerWidth < 768)

function toggleSidebar() {
  if (isMobile.value) {
    sidebarOpen.value = !sidebarOpen.value
  } else {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }
}

window.addEventListener('resize', () => {
  const mobile = window.innerWidth < 768
  if (mobile !== isMobile.value) {
    isMobile.value = mobile
    if (mobile) {
      sidebarOpen.value = false
    }
  }
})
const viewMode = ref('list')
const sortOrder = ref('desc')
// When true, the notes list shows recently-EDITED notes (sorted by modifiedTimestamp desc)
// instead of the default "all notes" (creation-time desc) view.
const recentView = ref(false)
const showPinDialog = ref(false)
const pinInput = ref('')
const pinError = ref(false)
const pinInputRef = ref(null)
const previewImageUrls = ref([])
const previewAudioUrls = ref([])
const previewFileUrls = ref([])
const createdPreviewUrls = new Set()
const listThumbnails = ref({})
const createdListThumbnails = new Set()
const storageQuota = ref(null)

// ---- Account / provider chip in the sidebar footer ----
const router = useRouter()
const showProviderMenu = ref(false)
const oneDriveSignedIn = ref(isOneDriveSignedIn())
const providerAvatarUrl = ref('')

const providerLabel = computed(() => {
  if (settingsStore.syncProvider === 'onedrive') {
    return oneDriveSignedIn.value ? (getOneDriveAccount() || 'Microsoft 账户') : 'OneDrive 未登录'
  }
  return 'WebDAV'
})

async function loadProviderAvatar() {
  if (settingsStore.syncProvider === 'onedrive' && oneDriveSignedIn.value) {
    providerAvatarUrl.value = await getOneDriveAccountPhoto()
  } else {
    providerAvatarUrl.value = ''
  }
}

function toggleProviderMenu() {
  showProviderMenu.value = !showProviderMenu.value
}

async function switchProvider(p) {
  showProviderMenu.value = false
  if (settingsStore.syncProvider === p) return
  // Picking OneDrive without a signed-in account → jump to settings to sign in.
  if (p === 'onedrive' && !isOneDriveSignedIn()) {
    router.push('/settings')
    return
  }
  await settingsStore.saveSyncProvider(p)
  oneDriveSignedIn.value = isOneDriveSignedIn()
  await loadProviderAvatar()
  await loadStorageQuota()
}

// Rich text editing state
const editingTitle = ref('')
const editingItems = ref([])
const previewEditorRef = ref(null)
const previewEditorFocused = ref(false)
const previewFormats = ref({ bold: false, italic: false, strikethrough: false, monospace: false, link: false })
const showLinkDlg = ref(false)
const linkUrl = ref('')
const linkInputRef = ref(null)
const imageInputRef = ref(null)
const fileInputRef = ref(null)
const searchInputRef = ref(null)
let savedSelection = null
let previewSaveTimer = null

const storagePercent = computed(() => {
  if (!storageQuota.value) return 0
  const total = storageQuota.value.totalBytes
  if (total === 0) return 0
  return Math.min(100, Math.round((storageQuota.value.usedBytes / total) * 100))
})

const currentViewTitle = computed(() => {
  if (recentView.value) return '最近编辑'
  if (notesStore.currentUserFolder !== null) return `文件夹: ${notesStore.currentUserFolder || '未分类'}`
  if (notesStore.currentFolder === 'DELETED') return '回收站'
  if (notesStore.currentFolder === 'ARCHIVED') return '归档'
  if (notesStore.searchQuery) return '搜索结果'
  if (notesStore.currentLabel) return `标签: ${notesStore.currentLabel}`
  return '全部笔记'
})


const isImportant = computed(() => {
  return selectedNote.value?.labels?.includes('重要')
})

const isSelectedNoteUnlocked = computed(() => {
  return lockStore.isNoteUnlocked(selectedNote.value?.id)
})

const displayedNotes = computed(() => {
  const notes = notesStore.activeNotes
  if (recentView.value) {
    // Recently edited: sort by last-modified time, newest first.
    return [...notes].sort((a, b) => (b.modifiedTimestamp || 0) - (a.modifiedTimestamp || 0))
  }
  if (sortOrder.value === 'asc') {
    return [...notes].sort((a, b) => a.timestamp - b.timestamp)
  }
  return notes
})

// ---- Search keyword highlighting ----
// Wraps occurrences of the search query in <mark> tags for visual emphasis.
function highlightText(text, query) {
  if (!query || !text) return text || ''
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200/70 dark:bg-yellow-500/30 text-gray-900 dark:text-gray-100 rounded px-0.5 font-medium">$1</mark>')
}

const isSearching = computed(() => !!notesStore.searchQuery?.trim())

function selectNote(note) {
  const prevId = selectedNote.value?.id
  if (prevId && prevId !== note.id) {
    flushPreviewSave()
    lockStore.lockNote(prevId)
  }
  selectedNote.value = note
  showLabelMenu.value = false
  editingTitle.value = note.title || ''
  editingItems.value = note.items ? note.items.map(i => ({ ...i })) : []
  clearPreviewUrls()
  if (!note.locked || lockStore.isNoteUnlocked(note.id)) {
    loadPreviewImages()
  }
  nextTick(() => {
    initPreviewEditor()
  })
}

const { openMenu } = useContextMenu()
const { setClipboard, getClipboard, hasData: clipboardHasData, clear: clearClipboard } = useClipboard()

// ---- Long-press multi-select (list & grid) ----
// A long press (450ms) on a note card enters selection mode and selects that note.
// In selection mode a tap toggles the note; right-click operates on the whole set.
const selectionMode = ref(false)
const selectedIds = reactive(new Set())
let longPressTimer = null
// Set true once a long-press actually fires, so the synthesized click on release
// doesn't immediately toggle (de-select) the very note we just selected.
let longPressed = false

function startLongPress(note) {
  cancelLongPress()
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    longPressed = true
    selectionMode.value = true
    selectedIds.add(note.id)
  }, 450)
}
function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
function onNoteCardClick(note) {
  if (longPressed) { longPressed = false; return }
  if (selectionMode.value) toggleSelect(note.id)
  else selectNote(note)
}
function toggleSelect(id) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
  if (selectedIds.size === 0) selectionMode.value = false
}
function exitSelection() {
  selectionMode.value = false
  selectedIds.clear()
}
function selectAllInView() {
  selectionMode.value = true
  displayedNotes.value.forEach(n => selectedIds.add(n.id))
}
async function batchMove(ids, folderName) {
  for (const id of ids) {
    await notesStore.assignNoteFolder(id, folderName)
  }
  exitSelection()
}
async function batchDelete(ids) {
  if (selectedNote.value && ids.includes(selectedNote.value.id)) {
    flushPreviewSave()
    selectedNote.value = null
  }
  const inTrash = ids.some(id => {
    const n = notesStore.notes.find(x => x.id === id)
    return n && n.folder === 'DELETED'
  })
  if (!confirm(inTrash
    ? `确定永久删除选中的 ${ids.length} 个笔记？此操作不可撤销。`
    : `确定删除选中的 ${ids.length} 个笔记？将移至回收站。`)) {
    return
  }
  for (const id of ids) {
    const n = notesStore.notes.find(x => x.id === id)
    if (!n) continue
    if (n.folder === 'DELETED') await notesStore.permanentDeleteNote(id)
    else await notesStore.deleteNoteFromFolder(id)
  }
  exitSelection()
}

// ---- Right-click context menu for a note card ----
function onNoteContextMenu(e, note) {
  e.preventDefault()
  // In multi-select mode, operate on the whole selection (and include the
  // right-clicked note if it isn't part of it yet).
  let ids = [note.id]
  if (selectionMode.value && selectedIds.size > 0) {
    if (!selectedIds.has(note.id)) selectedIds.add(note.id)
    ids = Array.from(selectedIds)
  }
  const multi = ids.length > 1
  const moveSubmenu = [
    { label: '未归类', value: '', action: () => batchMove(ids, '') },
    ...settingsStore.folders
      .filter(f => !f.hidden)
      .map(f => ({ label: f.name, value: f.name, action: () => batchMove(ids, f.name) })),
  ]
  const items = [
    { label: '移动到', icon: 'folder', submenu: moveSubmenu },
    ...(multi ? [] : [
      note.pinned
        ? { label: '取消置顶', icon: 'pin', action: () => notesStore.togglePin(note.id) }
        : { label: '置顶', icon: 'pin', action: () => notesStore.togglePin(note.id) },
      note.locked
        ? { label: '解锁', icon: 'unlock', action: () => notesStore.updateNoteLocked(note.id, false) }
        : { label: '锁定', icon: 'lock', action: () => notesStore.updateNoteLocked(note.id, true) },
    ]),
    { separator: true },
    {
      label: multi ? `删除 ${ids.length} 项` : '删除',
      icon: 'delete',
      danger: true,
      action: () => batchDelete(ids),
    },
  ]
  openMenu(e.clientX, e.clientY, items)
}

async function deleteNoteById(note) {
  if (note.folder === 'DELETED') {
    if (!confirm('确定永久删除此笔记？此操作不可撤销。')) return
    await notesStore.permanentDeleteNote(note.id)
  } else {
    if (!confirm('确定删除此笔记？将移至回收站。')) return
    await notesStore.deleteNoteFromFolder(note.id)
  }
  if (selectedNote.value?.id === note.id) selectedNote.value = null
}

// ---- Right-click context menu for a folder row ----
function onFolderContextMenu(e, folderName) {
  if (folderName === '未归类') return // pseudo-folder: not editable
  e.preventDefault()
  const folder = settingsStore.folders.find(f => f.name === folderName)
  const items = [
    { label: '重命名', icon: 'rename', action: () => renameFolderPrompt(folderName) },
    { label: '删除', icon: 'delete', danger: true, action: () => deleteFolderConfirm(folderName) },
    { separator: true },
    folder?.hidden
      ? { label: '显示文件夹', icon: 'eyeOn', action: () => settingsStore.toggleFolderHidden(folderName) }
      : { label: '隐藏文件夹', icon: 'eyeOff', action: () => settingsStore.toggleFolderHidden(folderName) },
  ]
  openMenu(e.clientX, e.clientY, items)
}

// ---- Right-click context menu for a label row ----
function onLabelContextMenu(e, labelName) {
  e.preventDefault()
  const items = [
    { label: '重命名', icon: 'rename', action: () => renameLabelPrompt(labelName) },
    { label: '删除', icon: 'delete', danger: true, action: () => deleteLabelConfirm(labelName) },
  ]
  openMenu(e.clientX, e.clientY, items)
}

function deselectNote() {
  if (selectedNote.value) {
    flushPreviewSave()
    lockStore.lockNote(selectedNote.value.id)
  }
  selectedNote.value = null
}

function selectAllNotes() {
  recentView.value = false
  notesStore.currentFolder = 'NOTES'
  notesStore.currentLabel = null
  notesStore.currentUserFolder = null
  notesStore.searchQuery = ''
  selectedNote.value = null
}

function selectRecentEdited() {
  recentView.value = true
  notesStore.currentFolder = 'NOTES'
  notesStore.currentLabel = null
  notesStore.currentUserFolder = null
  notesStore.searchQuery = ''
  selectedNote.value = null
}

function selectFolder(folder) {
  recentView.value = false
  notesStore.currentFolder = folder
  notesStore.currentLabel = null
  notesStore.currentUserFolder = null
  notesStore.searchQuery = ''
  selectedNote.value = null
}

function selectLabel(label) {
  recentView.value = false
  notesStore.currentLabel = notesStore.currentLabel === label ? null : label
  notesStore.currentFolder = 'NOTES'
  notesStore.currentUserFolder = null
  selectedNote.value = null
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
}

function toggleTheme() {
  settingsStore.saveTheme(settingsStore.theme === 'dark' ? 'light' : 'dark')
}

async function createNewNote(type) {
  const note = await notesStore.createNote(type)
  selectNote(note)
}

async function deleteNote() {
  if (!selectedNote.value) return
  if (selectedNote.value.folder === 'DELETED') {
    if (confirm('确定永久删除此笔记？此操作不可撤销。')) {
      const id = selectedNote.value.id
      await notesStore.permanentDeleteNote(id)
      selectedNote.value = null
    }
  } else {
    if (confirm('确定删除此笔记？将移至回收站。')) {
      const id = selectedNote.value.id
      await notesStore.deleteNoteFromFolder(id)
      selectedNote.value = null
    }
  }
}

async function restoreNote() {
  if (!selectedNote.value) return
  await notesStore.restoreNote(selectedNote.value.id)
  selectedNote.value = null
}

async function archiveNote() {
  if (!selectedNote.value) return
  await notesStore.archiveNote(selectedNote.value.id)
  selectedNote.value = null
  settingsStore.scheduleAutoSync()
}

async function unarchiveNote() {
  if (!selectedNote.value) return
  await notesStore.unarchiveNote(selectedNote.value.id)
  selectedNote.value = null
  settingsStore.scheduleAutoSync()
}

async function permanentDelete(id) {
  if (confirm('确定永久删除？此操作不可撤销。')) {
    await notesStore.permanentDeleteNote(id)
    if (selectedNote.value?.id === id) {
      selectedNote.value = null
    }
  }
}

function getLabelCount(label) {
  return notesStore.notes.filter(n => n.folder === 'NOTES' && n.labels && n.labels.includes(label)).length
}

const hiddenLabelsToShow = computed(() => {
  const hidden = settingsStore.hiddenLabels || []
  const allLabels = notesStore.allLabelsIncludingHidden
  return hidden.filter(l => allLabels.includes(l))
})

// Merged label list: labels from notes + sidebar-created labels not yet on any note
const allAvailableLabels = computed(() => {
  const set = new Set([...notesStore.allLabels, ...(settingsStore.createdLabels || [])])
  return Array.from(set).sort()
})

// Show at most 5 labels in sidebar; "更多标签" reveals the rest
const showAllLabels = ref(false)
const visibleLabels = computed(() => {
  return showAllLabels.value ? allAvailableLabels.value : allAvailableLabels.value.slice(0, 5)
})

async function toggleLabelVisibility(label) {
  await settingsStore.toggleLabelVisibility(label)
}

// ---- User folders (Android v1.2.4) ----
const visibleFolders = computed(() => {
  const folders = settingsStore.folders || []
  return folders.filter(f => !f.hidden || settingsStore.revealHiddenFolders)
})
const hiddenFolders = computed(() => {
  const folders = settingsStore.folders || []
  return folders.filter(f => f.hidden && !settingsStore.revealHiddenFolders)
})
const foldersHaveHidden = computed(() => (settingsStore.folders || []).some(f => f.hidden))
// All real user folders (excluding the virtual "未归类" pseudo-folder), sorted by
// their stored order. Hidden folders are still rendered — with a strikethrough —
// so hiding never removes them from the sidebar, it just de-emphasizes them and
// pulls their notes out of the "全部笔记" view.
const allFoldersSorted = computed(() => {
  const folders = settingsStore.folders || []
  return [...folders].sort((a, b) => (a.order || 0) - (b.order || 0))
})

function getFolderCount(name) {
  return notesStore.notes.filter(n => n.folder === 'NOTES' && (n.folderId || '') === name).length
}

function selectUserFolder(name) {
  recentView.value = false
  notesStore.currentUserFolder = name
  notesStore.currentFolder = 'NOTES'
  notesStore.currentLabel = null
  notesStore.searchQuery = ''
  selectedNote.value = null
  showFolderMenu.value = false
}

async function promptNewFolder(fromEditor = false) {
  const name = window.prompt('新建文件夹名称')
  showFolderMenu.value = false
  if (!name) return
  const trimmed = name.trim()
  if (!trimmed) return
  await settingsStore.addFolder(trimmed)
  // In the editor, creating a folder is meant to file the current note into it —
  // auto-assign so the note "enters" the new folder (matches Android's
  // move-to-folder expectation). The sidebar "+" only builds the directory and
  // leaves the open note where it is.
  if (fromEditor && selectedNote.value) {
    await notesStore.assignNoteFolder(selectedNote.value.id, trimmed)
  }
}

// ---- In-editor label management (Android parity) ----
// A note's labels are a list of strings (synced via labels.json). Toggling or
// creating a label here writes straight back to the note and triggers a sync.
async function toggleNoteLabel(label) {
  if (!selectedNote.value) return
  const current = selectedNote.value.labels || []
  const next = current.includes(label)
    ? current.filter(l => l !== label)
    : [...current, label]
  await notesStore.updateNoteLabels(selectedNote.value.id, next)
}

async function removeNoteLabel(label) {
  if (!selectedNote.value) return
  const current = selectedNote.value.labels || []
  if (!current.includes(label)) return
  await notesStore.updateNoteLabels(selectedNote.value.id, current.filter(l => l !== label))
}

async function promptNewLabel() {
  const name = window.prompt('新建标签名称')
  showLabelMenu.value = false
  if (!name) return
  const trimmed = name.trim()
  if (!trimmed) return
  const current = selectedNote.value?.labels || []
  if (current.includes(trimmed)) return
  await notesStore.updateNoteLabels(selectedNote.value.id, [...current, trimmed])
}

async function promptNewLabelSidebar() {
  const name = window.prompt('新建标签名称')
  if (!name) return
  const trimmed = name.trim()
  if (!trimmed) return
  await settingsStore.addCreatedLabel(trimmed)
}

async function renameLabelPrompt(oldName) {
  const newName = window.prompt('重命名标签', oldName)
  if (!newName) return
  const trimmed = newName.trim()
  if (!trimmed || trimmed === oldName) return
  // Rename label across all notes that have it
  const notes = notesStore.notes.filter(n => (n.labels || []).includes(oldName))
  for (const note of notes) {
    const labels = note.labels.map(l => l === oldName ? trimmed : l)
    await notesStore.updateNoteLabels(note.id, labels)
  }
  // Also rename in createdLabels if present
  const ci = settingsStore.createdLabels.indexOf(oldName)
  if (ci >= 0) {
    settingsStore.createdLabels[ci] = trimmed
    await putSetting('createdLabels', [...settingsStore.createdLabels])
  }
}

async function deleteLabelConfirm(labelName) {
  if (!window.confirm(`确定删除标签「${labelName}」吗？\n该标签将从所有笔记中移除。`)) return
  // Remove label from all notes that have it
  const notes = notesStore.notes.filter(n => (n.labels || []).includes(labelName))
  for (const note of notes) {
    const labels = note.labels.filter(l => l !== labelName)
    await notesStore.updateNoteLabels(note.id, labels)
  }
  // Also remove from createdLabels if present
  const ci = settingsStore.createdLabels.indexOf(labelName)
  if (ci >= 0) {
    settingsStore.createdLabels.splice(ci, 1)
    await putSetting('createdLabels', [...settingsStore.createdLabels])
  }
}

function renameFolderPrompt(name) {
  const nn = window.prompt('重命名文件夹', name)
  if (!nn) return
  settingsStore.renameFolder(name, nn.trim())
}

function deleteFolderConfirm(name) {
  if (window.confirm(`删除文件夹"${name}"？相关笔记将变为未分类。`)) {
    settingsStore.deleteFolder(name)
    if (notesStore.currentUserFolder === name) notesStore.currentUserFolder = null
  }
}

async function assignCurrentFolder(name) {
  showFolderMenu.value = false
  if (!selectedNote.value) return
  await notesStore.assignNoteFolder(selectedNote.value.id, name)
}

async function loadPreviewImages() {
  if (!selectedNote.value) return
  const note = selectedNote.value

  // Images are rendered inline by the editor (spansToHtml). There is no bottom
  // image gallery; inline images come purely from the body's \uFFFC markers.

  // Audio attachments: show an inline player.
  const audioUrls = []
  if (note.audios) {
    for (const a of note.audios) {
      try {
        const fn = getImageFileName(a)
        if (!fn) continue
        const blob = await getAttachment(fn)
        if (blob) {
          const url = URL.createObjectURL(blob)
          audioUrls.push({ url, name: attachmentDisplayName(a) })
          createdPreviewUrls.add(url)
        }
      } catch {}
    }
  }
  previewAudioUrls.value = audioUrls

  // Other file attachments (pdf, doc, ...): show a download link.
  const fileUrls = []
  if (note.files) {
    for (const f of note.files) {
      try {
        const fn = getImageFileName(f)
        if (!fn) continue
        const blob = await getAttachment(fn)
        if (blob) {
          const url = URL.createObjectURL(blob)
          fileUrls.push({ url, name: attachmentDisplayName(f) })
          createdPreviewUrls.add(url)
        }
      } catch {}
    }
  }
  previewFileUrls.value = fileUrls
}

function attachmentDisplayName(att) {
  if (!att) return '附件'
  if (att && typeof att === 'object' && att.originalName) return att.originalName
  return getImageFileName(att) || '附件'
}

function clearPreviewUrls() {
  for (const url of createdPreviewUrls) {
    URL.revokeObjectURL(url)
  }
  createdPreviewUrls.clear()
  previewImageUrls.value = []
  previewAudioUrls.value = []
  previewFileUrls.value = []
}

function onPreviewImageError(idx) {
  console.warn('Preview image failed to load at index', idx)
}

function openImage(url) {
  window.open(url, '_blank')
}

function getListThumbnail(noteId) {
  return listThumbnails.value[noteId] || null
}

async function loadListThumbnails() {
  const notes = displayedNotes.value
  for (const note of notes) {
    if (note.locked) continue
    if (!note.images || note.images.length === 0) continue
    if (listThumbnails.value[note.id]) continue
    try {
      const firstImg = note.images[0]
      const fn = getImageFileName(firstImg)
      if (!fn) continue
      const blob = await getAttachment(fn)
      if (blob) {
        const url = URL.createObjectURL(blob)
        listThumbnails.value = { ...listThumbnails.value, [note.id]: url }
        createdListThumbnails.add(url)
      }
    } catch {}
  }
}

function onListImgError(noteId) {
  const url = listThumbnails.value[noteId]
  if (url) {
    URL.revokeObjectURL(url)
    createdListThumbnails.delete(url)
  }
  const nt = { ...listThumbnails.value }
  delete nt[noteId]
  listThumbnails.value = nt
}

function clearListThumbnails() {
  for (const url of createdListThumbnails) {
    URL.revokeObjectURL(url)
  }
  createdListThumbnails.clear()
  listThumbnails.value = {}
}

function closePinDialog() {
  showPinDialog.value = false
  pinInput.value = ''
  pinError.value = false
}

function onPinInput() {
  pinError.value = false
  if (pinInput.value.length === 4) {
    verifyPreviewPin()
  }
}

async function verifyPreviewPin() {
  if (pinInput.value.length < 4) return
  const ok = await lockStore.verifyPinOnly(pinInput.value)
  if (ok) {
    lockStore.unlockNote(selectedNote.value.id)
    showPinDialog.value = false
    pinInput.value = ''
    pinError.value = false
    loadPreviewImages()
    nextTick(() => {
      initPreviewEditor()
    })
  } else {
    pinError.value = true
    pinInput.value = ''
  }
}

watch(showPinDialog, async (val) => {
  if (val) {
    await nextTick()
    pinInputRef.value?.focus()
  }
})

onUnmounted(() => {
  flushPreviewSave()
  clearPreviewUrls()
  clearListThumbnails()
  lockStore.clearUnlockedNotes()
})

watch(displayedNotes, () => {
  loadListThumbnails()
}, { immediate: true, deep: false })

async function loadStorageQuota() {
  try {
    const client = await settingsStore.getClient()
    // Guard against clients that don't expose quota (e.g. a provider without
    // support) so we never crash with "client.getQuota is not a function".
    if (!client || typeof client.getQuota !== 'function') return
    const quota = await client.getQuota()
    if (quota) {
      storageQuota.value = quota
    }
  } catch (e) {
    console.warn('[memoX] loadStorageQuota failed:', e)
  }
}

// --- Rich text editing in preview ---

function initPreviewEditor() {
  if (!previewEditorRef.value || !selectedNote.value) return
  if (selectedNote.value.type === 'LIST') return
  const html = spansToHtml(selectedNote.value.body || '', selectedNote.value.spans || [], selectedNote.value.images || [])
  previewEditorRef.value.innerHTML = html || ''
  resolveInlineImages()
  previewFormats.value = { bold: false, italic: false, strikethrough: false, monospace: false, link: false }
}

// The inline <img> placeholders rendered by spansToHtml carry only a data-fname;
// resolve each to a blob URL from IndexedDB so the picture actually displays in
// the editor. Tracked for revocation in clearPreviewUrls().
function resolveInlineImages() {
  if (!previewEditorRef.value) return
  const imgs = previewEditorRef.value.querySelectorAll('img.inline-image')
  imgs.forEach(async (el) => {
    const fname = el.getAttribute('data-fname')
    if (!fname) return
    try {
      const blob = await getAttachment(fname)
      if (blob) {
        const url = URL.createObjectURL(blob)
        el.src = url
        createdPreviewUrls.add(url)
      }
    } catch {}
  })
}


function onPreviewEditorInput() {
  onPreviewInput()
}

// Click an inline image in the body to view it full-size (same behavior as the
// bottom gallery). The <img> lives in the contenteditable DOM (set via
// innerHTML), so it can't carry a Vue @click — handled by delegation here.
function onPreviewEditorClick(e) {
  const target = e.target
  if (target && target.tagName === 'IMG' && target.classList.contains('inline-image')) {
    const src = target.getAttribute('src')
    if (src) openImage(src)
  }
}


// Right-click inside the editor. Two cases:
//   - on an inline image: 查看 / 复制 / 剪切 / 删除
//   - on text or empty space: 复制 / 剪切 (when there is a selection) and 粘贴
//     (when the clipboard holds something). Native copy/paste can't carry inline
//     images, so we drive everything through our own clipboard.
function onPreviewEditorContextMenu(e) {
  const target = e.target
  const editor = previewEditorRef.value
  if (target && target.tagName === 'IMG' && target.classList && target.classList.contains('inline-image')) {
    e.preventDefault()
    e.stopPropagation()
    const src = target.getAttribute('src')
    const img = target
    const items = [
      { label: '查看', icon: 'eyeOn', action: () => { if (src) openImage(src) } },
      { separator: true },
      { label: '复制', icon: 'copy', action: () => copyImage(img) },
      { label: '剪切', icon: 'cut', action: () => cutImage(img) },
      { separator: true },
      { label: '删除', icon: 'delete', danger: true, action: () => deleteInlineImages([img]) },
    ]
    openMenu(e.clientX, e.clientY, items)
    return
  }

  // Text or empty area. Offer 复制/剪切 if there is a non-collapsed selection,
  // and 粘贴 whenever the clipboard has content. Let native through otherwise.
  const sel = window.getSelection()
  const hasSelection = !!sel && sel.rangeCount > 0 && !sel.isCollapsed &&
    !!editor && editor.contains(sel.getRangeAt(0).commonAncestorContainer)
  const items = []
  if (hasSelection) {
    items.push({ label: '复制', icon: 'copy', action: () => doCopy() })
    items.push({ label: '剪切', icon: 'cut', action: () => doCut() })
  }
  if (clipboardHasData()) {
    if (items.length) items.push({ separator: true })
    items.push({ label: '粘贴', icon: 'paste', action: () => pasteFromInternal() })
  }
  if (items.length) {
    e.preventDefault()
    e.stopPropagation()
    openMenu(e.clientX, e.clientY, items)
  }
}

// Explicit single-key deletion of inline images. Relying on the browser's native
// Backspace/Delete around a contenteditable=false image is unreliable: with a
// trailing <br> it takes two presses (br first, then image), and when an image is
// followed by other content native deletion is blocked entirely (only drag-select
// worked). We intercept Backspace/Delete when the caret is adjacent to an inline
// image (or a selection covers one) and remove the DOM node ourselves, keeping
// note.images in sync so the body <-> images position mapping never desyncs.
function onPreviewEditorKeydown(e) {
  const meta = e.ctrlKey || e.metaKey
  if (meta && (e.key === 'c' || e.key === 'C')) {
    doCopy()
    e.preventDefault()
    return
  }
  if (meta && (e.key === 'x' || e.key === 'X')) {
    doCut()
    e.preventDefault()
    return
  }
  if (e.key !== 'Backspace' && e.key !== 'Delete') return
  if (e.isComposing) return
  const sel = window.getSelection()
  const editor = previewEditorRef.value
  if (!sel || sel.rangeCount === 0 || !editor) return

  let imgs = []
  if (sel.isCollapsed) {
    const range = sel.getRangeAt(0)
    const n = e.key === 'Backspace' ? inlineImageBeforeCaret(range) : inlineImageAfterCaret(range)
    if (n) imgs.push(n)
  } else {
    const range = sel.getRangeAt(0)
    editor.querySelectorAll('img.inline-image').forEach(img => {
      if (range.intersectsNode(img)) imgs.push(img)
    })
  }
  if (imgs.length === 0) return

  e.preventDefault()
  deleteInlineImages(imgs)
}

function isInlineImage(node) {
  return !!node && node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG' && node.classList.contains('inline-image')
}

// The inline image immediately BEFORE the collapsed caret (Backspace target).
// We accept the image only when it is the node directly before the caret, OR the
// node directly before a SINGLE <br> (the caret slot we add after every image).
// With TWO or more blank lines below the picture, Backspace must NOT tunnel up to
// the picture — it should only remove a blank line, like normal text. So we never
// cross more than one <br>.
function inlineImageBeforeCaret(range) {
  const node = range.startContainer
  const parent = node.nodeType === Node.TEXT_NODE ? node.parentNode : node
  if (!parent) return null
  const children = parent.childNodes
  const pos = node.nodeType === Node.TEXT_NODE
    ? (range.startOffset > 0 ? -1 : Array.prototype.indexOf.call(children, node))
    : range.startOffset
  if (pos < 0) return null
  const i = pos - 1
  if (i < 0) return null
  const cand = children[i]
  if (isInlineImage(cand)) return cand
  if (cand && cand.nodeName === 'BR' && i - 1 >= 0 && isInlineImage(children[i - 1])) {
    return children[i - 1]
  }
  return null
}

// The inline image immediately AFTER the collapsed caret (Delete target). Mirror
// of inlineImageBeforeCaret: accept the image only when it is directly after the
// caret or directly after a single <br>, never tunneling across extra blank lines.
function inlineImageAfterCaret(range) {
  const node = range.startContainer
  const parent = node.nodeType === Node.TEXT_NODE ? node.parentNode : node
  if (!parent) return null
  const children = parent.childNodes
  const pos = node.nodeType === Node.TEXT_NODE
    ? (range.startOffset < node.length ? -1 : Array.prototype.indexOf.call(children, node))
    : range.startOffset
  if (pos < 0) return null
  const i = pos
  if (i >= children.length) return null
  const cand = children[i]
  if (isInlineImage(cand)) return cand
  if (cand && cand.nodeName === 'BR' && i + 1 < children.length && isInlineImage(children[i + 1])) {
    return children[i + 1]
  }
  return null
}

function deleteInlineImages(imgs) {
  const editor = previewEditorRef.value
  const sel = window.getSelection()
  // Remember a caret anchor so we can restore the caret after removal.
  const anchor = sel && sel.rangeCount
    ? { c: sel.getRangeAt(0).startContainer, o: sel.getRangeAt(0).startOffset }
    : null

  const removedFnames = new Set()
  for (const img of imgs) {
    const fname = img.getAttribute('data-fname')
    if (fname) removedFnames.add(fname)
    const url = img.getAttribute('src')
    if (url && createdPreviewUrls.has(url)) {
      URL.revokeObjectURL(url)
      createdPreviewUrls.delete(url)
    }
    img.remove()
  }
  if (removedFnames.size && selectedNote.value && selectedNote.value.images) {
    selectedNote.value.images = selectedNote.value.images.filter(img => {
      const fn = getImageFileName(img)
      return !fn || !removedFnames.has(fn)
    })
  }
  if (anchor && editor.contains(anchor.c)) {
    try {
      const r = document.createRange()
      const max = anchor.c.nodeType === Node.TEXT_NODE ? anchor.c.length : anchor.c.childNodes.length
      r.setStart(anchor.c, Math.min(anchor.o, max))
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
    } catch {}
  }
  onPreviewInput()
}

// --- Cut / Copy / Paste (custom clipboard so inline images survive) ---

// Collect every inline image whose DOM node intersects the given range, in
// document order, together with its note.images entry. Used by copy/cut to know
// which attachments travel with the selection.
function imagesInRange(range) {
  const editor = previewEditorRef.value
  const out = []
  if (!editor) return out
  editor.querySelectorAll('img.inline-image').forEach(img => {
    if (range.intersectsNode(img)) {
      const fname = img.getAttribute('data-fname')
      if (!fname) return
      const entry = (selectedNote.value.images || []).find(x => getImageFileName(x) === fname)
      out.push({ img, fname, entry })
    }
  })
  return out
}

// Capture the current selection (text + any inline images inside it) into the
// clipboard without altering the note.
// Push the current text selection to the OS clipboard so it can be pasted into
// other apps. Our internal clipboard (setClipboard) only serves rich in-app
// paste, so without this a Ctrl+C/Ctrl+X left the OS clipboard empty and
// external paste silently failed. Uses the legacy synchronous execCommand on
// purpose: it runs inside the Ctrl+C/V keydown gesture, so the user activation
// is still valid (navigator.clipboard.write would need the activation kept alive
// across an await). It copies the live selection as text + html.
function copySelectionToOsClipboard() {
  try { document.execCommand('copy') } catch {}
}

async function doCopy() {
  const editor = previewEditorRef.value
  const sel = window.getSelection()
  if (!editor || !sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return
  if (sel.isCollapsed) return

  // Mirror to the OS clipboard FIRST, while the selection is still intact.
  copySelectionToOsClipboard()

  const tmp = document.createElement('div')
  tmp.appendChild(range.cloneContents())
  const captured = imagesInRange(range)
  const images = []
  for (const c of captured) {
    let blob = null
    try { blob = await getAttachment(c.fname) } catch {}
    images.push({ fname: c.fname, entry: c.entry || { localName: c.fname }, blob })
  }
  setClipboard({ html: tmp.innerHTML, text: range.toString(), images })
}

// Capture the selection AND remove it from the note (DOM + note.images entries).
// The attachment blob is deliberately kept in IndexedDB and the remote WebDAV
// file is left untouched — a later paste just re-references the same name, so
// there is no delete-and-re-upload round trip.
async function doCut() {
  const editor = previewEditorRef.value
  const sel = window.getSelection()
  if (!editor || !sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return
  if (sel.isCollapsed) return

  const tmp = document.createElement('div')
  tmp.appendChild(range.cloneContents())
  const captured = imagesInRange(range)
  const images = []
  for (const c of captured) {
    let blob = null
    try { blob = await getAttachment(c.fname) } catch {}
    images.push({ fname: c.fname, entry: c.entry || { localName: c.fname }, blob })
  }
  const removed = new Set(images.map(i => i.fname))
  if (removed.size && selectedNote.value.images) {
    selectedNote.value.images = selectedNote.value.images.filter(img => !removed.has(getImageFileName(img)))
  }
  // Mirror to the OS clipboard BEFORE we remove the selection, so the cut text
  // can still be pasted into other apps.
  copySelectionToOsClipboard()
  range.deleteContents()
  // Collapse the caret where the removed content used to be.
  try {
    sel.removeAllRanges()
    const r = document.createRange()
    r.setStart(range.startContainer, range.startOffset)
    r.collapse(true)
    sel.addRange(r)
  } catch {}
  setClipboard({ html: tmp.innerHTML, text: range.toString(), images })
  onPreviewInput()
}

// Copy a single inline image (right-click 复制).
async function copyImage(img) {
  const fname = img.getAttribute('data-fname')
  if (!fname) return
  const entry = (selectedNote.value.images || []).find(x => getImageFileName(x) === fname)
  let blob = null
  try { blob = await getAttachment(fname) } catch {}
  setClipboard({ html: img.outerHTML, text: '', images: [{ fname, entry: entry || { localName: fname }, blob }] })
  // Best-effort: also place the image on the OS clipboard so it can be pasted into
  // other apps. (Text copy goes through doCopy/doCut via execCommand.)
  if (blob && blob.type && blob.type.startsWith('image/') && navigator.clipboard && window.ClipboardItem) {
    try { await navigator.clipboard.write(new ClipboardItem({ [blob.type]: blob })) } catch {}
  }
}

// Cut a single inline image (right-click 剪切): capture then delete.
async function cutImage(img) {
  await copyImage(img)
  deleteInlineImages([img])
}

// Re-resolve src for just-inserted inline images (those we flagged before
// splicing). Avoids re-resolving / leaking URLs on every image in the editor.
async function resolveJustInsertedImages() {
  const editor = previewEditorRef.value
  if (!editor) return
  const nodes = editor.querySelectorAll('img.inline-image[data-just-inserted]')
  for (const el of nodes) {
    const fname = el.getAttribute('data-fname')
    el.removeAttribute('data-just-inserted')
    if (!fname) continue
    let blob = null
    try { blob = await getAttachment(fname) } catch {}
    if (!blob) continue
    const url = URL.createObjectURL(blob)
    createdPreviewUrls.add(url)
    el.src = url
  }
}

// Paste from our own clipboard at the current caret (replacing any selection).
// Text pastes as formatted HTML; inline images are spliced back into note.images
// at the correct positional index and re-resolved from IndexedDB. Because the
// same attachment file name travels with the image, a cross-note paste reuses
// the existing WebDAV file instead of re-uploading it.
async function pasteFromInternal() {
  const editor = previewEditorRef.value
  if (!editor || !selectedNote.value) return
  const data = getClipboard()
  if (!data.html && !data.text && !data.images.length) return

  const sel = window.getSelection()
  let range
  if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    range = sel.getRangeAt(0)
  } else {
    range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
  }

  // If pasting replaces a selection that contains images, drop those first so
  // the body <-> images mapping stays aligned.
  if (!sel.isCollapsed) {
    const replaced = imagesInRange(range)
    if (replaced.length && selectedNote.value.images) {
      const removed = new Set(replaced.map(r => r.fname))
      selectedNote.value.images = selectedNote.value.images.filter(img => !removed.has(getImageFileName(img)))
    }
  }

  // Index where new images' \uFFFC will land = number of images before the caret.
  const insertIndex = countInlineImagesBeforeCaret(editor)
  const lastInserted = (function () {
    const frag = document.createDocumentFragment()
    const tmp = document.createElement('div')
    tmp.innerHTML = data.html || ''
    tmp.querySelectorAll('img.inline-image').forEach(el => el.setAttribute('data-just-inserted', '1'))
    let last = null
    while (tmp.firstChild) {
      last = tmp.firstChild
      frag.appendChild(tmp.firstChild)
    }
    return { frag, last }
  })()

  range.deleteContents()
  range.insertNode(lastInserted.frag)

  // Splice the carried image entries back into note.images, in document order.
  if (data.images.length) {
    if (!selectedNote.value.images) selectedNote.value.images = []
    for (let k = 0; k < data.images.length; k++) {
      const im = data.images[k]
      if (im.blob) {
        try { await putAttachment(im.fname, im.blob) } catch {}
      }
      const entry = im.entry || { localName: im.fname }
      if (!entry.localName) entry.localName = im.fname
      selectedNote.value.images.splice(insertIndex + k, 0, entry)
    }
  }

  await resolveJustInsertedImages()

  // Place the caret right after the inserted content.
  if (lastInserted.last) {
    try {
      const r = document.createRange()
      r.setStartAfter(lastInserted.last)
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
    } catch {}
  }
  editor.focus()
  onPreviewInput()
  // A cut is consumed once pasted; a copy can be pasted repeatedly.
  clearClipboard()
}

// Native paste event: prefer our own clipboard (it carries images + formatting);
// else, if the OS clipboard dropped image files, insert them as new attachments;
// else let the browser paste text natively.
function onPreviewEditorPaste(e) {
  if (!selectedNote.value || selectedNote.value.type === 'LIST') return
  if (clipboardHasData()) {
    e.preventDefault()
    pasteFromInternal()
    return
  }
  if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
    const imgs = Array.from(e.clipboardData.files).filter(f => f.type && f.type.startsWith('image/'))
    if (imgs.length) {
      e.preventDefault()
      insertImageFiles(imgs)
      return
    }
  }
  // otherwise native text paste proceeds
}

function onPreviewInput() {
  clearTimeout(previewSaveTimer)
  previewSaveTimer = setTimeout(flushPreviewSave, 800)
}

function flushPreviewSave() {
  if (!selectedNote.value) return
  clearTimeout(previewSaveTimer)

  // Reconstruct the prospective content straight from the live editors, without
  // mutating the note yet — so we can tell whether anything actually changed.
  const draftTitle = editingTitle.value
  let draftBody = selectedNote.value.body
  let draftSpans = selectedNote.value.spans
  let draftItems = selectedNote.value.items
  if (selectedNote.value.type !== 'LIST' && previewEditorRef.value) {
    const html = previewEditorRef.value.innerHTML
    draftBody = getPlainTextFromHtml(html)
    draftSpans = htmlToSpans(html)
  }
  if (selectedNote.value.type === 'LIST') {
    draftItems = editingItems.value.map(i => ({ ...i }))
  }

  // Scheme A: only persist + bump modifiedTimestamp when the content truly
  // changed. Merely OPENING or BROWSING a note must NOT refresh its timestamp —
  // otherwise the sync conflict rule ("local newer -> overwrite remote") would
  // push a stale body up to WebDAV and silently clobber the Android copy (the
  // data-loss bug reported by the user).
  const note = selectedNote.value
  // Compare formatting spans in a way that IGNORES inline-image spans. The web
  // editor renders images positionally from body (\uFFFC) + note.images, never
  // from span data, so image spans are not part of the editable content. If we
  // compared raw span JSON, merely OPENING an Android note (whose spans carry
  // image data the web drops on save) would look "changed" and bump the
  // modifiedTimestamp — re-introducing the overwrite-remote data-loss bug.
  const contentChanged =
    draftTitle !== note.title ||
    draftBody !== note.body ||
    (note.type === 'LIST'
      ? JSON.stringify(draftItems) !== JSON.stringify(note.items)
      : normalizeSpansForCompare(draftSpans, draftBody) !== normalizeSpansForCompare(note.spans, note.body))
  if (!contentChanged) return

  note.title = draftTitle
  note.body = draftBody
  note.spans = draftSpans
  note.items = draftItems
  notesStore.saveNote(note)
  settingsStore.scheduleAutoSync()
}

function execUndo() {
  const editor = previewEditorRef.value
  if (!editor) return
  editor.focus()
  document.execCommand('undo', false, null)
}

function execRedo() {
  const editor = previewEditorRef.value
  if (!editor) return
  editor.focus()
  document.execCommand('redo', false, null)
}

function execFormat(command) {
  if (command === 'monospace') {
    toggleMonospaceFormat()
    return
  }
  document.execCommand(command, false, null)
  updatePreviewFormats()
  onPreviewInput()
}

function toggleMonospaceFormat() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  if (!range.toString()) return
  const parent = range.commonAncestorContainer
  const isMono = checkPreviewMonospace(parent)
  if (isMono) {
    document.execCommand('removeFormat')
    const span = parent.nodeType === Node.TEXT_NODE ? parent.parentElement : parent
    if (span && span.tagName === 'CODE') {
      const textNode = document.createTextNode(span.textContent)
      span.parentNode.replaceChild(textNode, span)
    }
  } else {
    const code = document.createElement('code')
    code.style.fontFamily = 'monospace'
    code.style.background = 'rgba(127,127,127,0.15)'
    code.style.padding = '1px 3px'
    code.style.borderRadius = '3px'
    code.style.fontSize = '0.95em'
    range.surroundContents(code)
  }
  updatePreviewFormats()
  onPreviewInput()
}

function checkPreviewMonospace(node) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (el && el !== previewEditorRef.value) {
    if (el.tagName === 'CODE' || el.tagName === 'TT' || el.tagName === 'PRE') return true
    if (el.style?.fontFamily?.includes('monospace')) return true
    el = el.parentElement
  }
  return false
}

function handleLinkClick() {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    if (previewEditorRef.value?.contains(range.commonAncestorContainer)) {
      savedSelection = range.cloneRange()
    }
  }
  let currentLink = ''
  if (savedSelection) {
    let el = savedSelection.commonAncestorContainer
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement
    while (el && el !== previewEditorRef.value) {
      if (el.tagName === 'A') {
        currentLink = el.getAttribute('href') || ''
        break
      }
      el = el.parentElement
    }
  }
  linkUrl.value = currentLink
  showLinkDlg.value = true
  nextTick(() => {
    linkInputRef.value?.focus()
    linkInputRef.value?.select()
  })
}

function applyLink() {
  const url = linkUrl.value.trim()
  showLinkDlg.value = false
  linkUrl.value = ''
  if (!url) return
  let fullUrl = url
  if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) {
    fullUrl = 'https://' + url
  }
  previewEditorRef.value?.focus()
  if (savedSelection) {
    const sel = window.getSelection()
    sel.removeAllRanges()
    try { sel.addRange(savedSelection) } catch {}
  }
  document.execCommand('createLink', false, fullUrl)
  if (previewEditorRef.value) {
    previewEditorRef.value.querySelectorAll('a').forEach(a => {
      a.style.color = 'inherit'
      a.style.textDecoration = 'underline'
    })
  }
  updatePreviewFormats()
  onPreviewInput()
}

function updatePreviewFormats() {
  if (!previewEditorRef.value) return
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  if (!previewEditorRef.value.contains(range.commonAncestorContainer)) return
  let el = range.commonAncestorContainer
  if (el.nodeType === Node.TEXT_NODE) el = el.parentElement
  let bold = false, italic = false, strikethrough = false, monospace = false, link = false
  let cur = el
  while (cur && cur !== previewEditorRef.value) {
    const tag = cur.tagName
    const st = cur.style
    if (tag === 'B' || tag === 'STRONG' || st?.fontWeight === 'bold' || parseInt(st?.fontWeight) >= 600) bold = true
    if (tag === 'I' || tag === 'EM' || st?.fontStyle === 'italic') italic = true
    if (tag === 'S' || tag === 'STRIKE' || st?.textDecorationLine === 'line-through' || st?.textDecoration === 'line-through') strikethrough = true
    if (tag === 'CODE' || tag === 'TT' || tag === 'PRE' || st?.fontFamily?.includes('monospace')) monospace = true
    if (tag === 'A') link = true
    cur = cur.parentElement
  }
  previewFormats.value = { bold, italic, strikethrough, monospace, link }
}

function togglePreviewItem(idx) {
  editingItems.value[idx].checked = !editingItems.value[idx].checked
  editingItems.value[idx].checkedTimestamp = editingItems.value[idx].checked ? Date.now() : null
  onPreviewInput()
}

function addPreviewItem(afterIdx) {
  if (afterIdx !== undefined) {
    editingItems.value.splice(afterIdx + 1, 0, createEmptyListItem())
  } else {
    editingItems.value.push(createEmptyListItem())
  }
  onPreviewInput()
}

function deletePreviewItemIfEmpty(idx) {
  if (editingItems.value[idx].body === '' && editingItems.value.length > 1) {
    editingItems.value.splice(idx, 1)
    onPreviewInput()
  }
}

function triggerImageUpload() {
  imageInputRef.value?.click()
}

// Count how many inline images already sit before the current caret. Used to
// keep the note's positional image model intact: body \uFFFC[i] must always map
// to note.images[i], so a newly inserted image is spliced into note.images at
// the same offset its \uFFFC will occupy in the body.
function countInlineImagesBeforeCaret(editor) {
  if (!editor) return 0
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    return editor.querySelectorAll('img.inline-image').length
  }
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) {
    return editor.querySelectorAll('img.inline-image').length
  }
  const pre = document.createRange()
  pre.setStart(editor, 0)
  try {
    pre.setEnd(range.startContainer, range.startOffset)
  } catch {
    return editor.querySelectorAll('img.inline-image').length
  }
  const holder = document.createElement('div')
  holder.appendChild(pre.cloneContents())
  return holder.querySelectorAll('img.inline-image').length
}

async function onFileSelected(event) {
  const files = event.target.files
  if (!files || files.length === 0 || !selectedNote.value) return
  for (const file of files) {
    const isImage = file.type && file.type.startsWith('image/')
    // Compress images upstream; non-images pass through untouched.
    const comp = isImage
      ? await compressImageFile(file)
      : { blob: file, ext: '', mime: file.type || 'application/octet-stream' }
    const fileName = `${Date.now()}_${withNewExt(file.name, comp.ext)}`
    await putAttachment(fileName, comp.blob)
    if (!selectedNote.value.files) selectedNote.value.files = []
    const entry = {
      localName: fileName,
      originalName: file.name,
      mimeType: comp.mime,
    }
    selectedNote.value.files.push(entry)
    // Update preview list immediately
    previewFileUrls.value.push({
      name: file.name,
      url: URL.createObjectURL(comp.blob),
    })
    createdPreviewUrls.add(previewFileUrls.value[previewFileUrls.value.length - 1].url)
    onPreviewInput()
  }
  if (fileInputRef.value) fileInputRef.value.value = ''
}

async function onImageFilesSelected(event) {
  const files = event.target.files
  if (!files || files.length === 0) return
  await insertImageFiles(Array.from(files))
  if (imageInputRef.value) imageInputRef.value.value = ''
}

// Insert one or more image files as new inline attachments at the caret. Shared
// by the file picker (onImageFilesSelected) and the OS-clipboard paste path.
async function insertImageFiles(files) {
  if (!selectedNote.value || !files || files.length === 0) return
  const editor = previewEditorRef.value
  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) continue
    // Compress upstream (only >1MB images are touched; the worker keeps the original
    // on any failure). May return a new extension/mime when the format changed.
    const comp = await compressImageFile(file)
    const fileName = `${Date.now()}_${withNewExt(file.name, comp.ext)}`
    await putAttachment(fileName, comp.blob)
    if (!selectedNote.value.images) selectedNote.value.images = []
    // Android's Converters.jsonToFiles requires localName / originalName / mimeType.
    // mimeType uses getString() (non-optional) — a missing field throws and the whole
    // note is silently dropped during Android sync. Always write all three fields.
    const imageEntry = {
      localName: fileName,
      originalName: file.name,
      mimeType: comp.mime,
    }
    // Insert at the same index the new \uFFFC will occupy in the body.
    const insertIndex = editor ? countInlineImagesBeforeCaret(editor) : selectedNote.value.images.length
    selectedNote.value.images.splice(insertIndex, 0, imageEntry)

    // Insert an INLINE <img> at the caret so the picture lands where the user is
    // typing — not in the bottom gallery. A trailing <br> leaves a caret position
    // AFTER the (non-editable) image, so it can be selected and deleted.
    if (editor) {
      const img = document.createElement('img')
      img.className = 'inline-image'
      img.setAttribute('data-fname', fileName)
      img.setAttribute('contenteditable', 'false')
      const url = URL.createObjectURL(comp.blob)
      img.src = url
      createdPreviewUrls.add(url)

      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(img)
      } else {
        editor.appendChild(img)
      }
      // Place the caret right after the (inline-block, non-editable) image. No
      // trailing <br> anchor — an inline-block image keeps a valid caret position
      // after it natively, so we never pollute the body with a blank line (which
      // would make the note look "changed" on save and re-upload it over the newer
      // Android copy during sync).
      const newRange = document.createRange()
      newRange.setStartAfter(img)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      editor.focus()
    }
    onPreviewInput()
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Drop inline-image spans (those covering a \uFFFC in the body) before comparing
// span JSON, so opening/viewing an Android note never registers as an edit.
function normalizeSpansForCompare(spans, body) {
  const arr = (spans || [])
    .filter(s => s && typeof s.start === 'number' && s.end > s.start)
    .filter(s => body[s.start] !== '\uFFFC')
    .map(s => ({
      start: s.start,
      end: s.end,
      bold: !!s.bold,
      italic: !!s.italic,
      strikethrough: !!s.strikethrough,
      monospace: !!s.monospace,
      link: !!s.link,
      linkData: s.linkData || null,
    }))
    .sort((a, b) => a.start - b.start || b.end - a.end)
  return JSON.stringify(arr)
}

onMounted(() => {
  oneDriveSignedIn.value = isOneDriveSignedIn()
  loadProviderAvatar()
  loadStorageQuota()
  // Global Ctrl+K / Cmd+K to focus search
  function onGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault()
      searchInputRef.value?.focus()
      searchInputRef.value?.select()
    }
  }
  window.addEventListener('keydown', onGlobalKeydown)
  onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))
})
</script>

<style scoped>
.fmt-btn {
  @apply px-2 py-1 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors;
}
.fmt-btn.active {
  @apply bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400;
}
.preview-editor {
  white-space: pre-wrap;
  word-break: break-word;
}
.preview-editor code {
  font-family: monospace;
  background: rgba(127, 127, 127, 0.15);
  padding: 1px 3px;
  border-radius: 3px;
  font-size: 0.95em;
}
.preview-editor a {
  color: inherit;
  text-decoration: underline;
}
.preview-editor:empty::before {
  content: '写点什么...';
  color: #9ca3af;
  pointer-events: none;
}
.preview-editor img.inline-image {
  display: inline-block;
  max-width: 100%;
  height: auto;
  margin: 0.5rem 0;
  border-radius: 0.75rem;
  object-fit: cover;
  vertical-align: top;
}
</style>
