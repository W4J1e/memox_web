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
      class="h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 z-50"
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
          class="w-full flex items-center gap-2 px-3 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors font-medium"
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
          :active="notesStore.currentFolder === 'NOTES' && !notesStore.currentLabel"
          :count="notesStore.notes.filter(n => n.folder === 'NOTES').length"
          :collapsed="sidebarCollapsed"
          @click="selectAllNotes"
        />
        <NavItem
          icon="clock"
          :label="sidebarCollapsed ? '' : '最近使用'"
          :active="false"
          :collapsed="sidebarCollapsed"
          @click="selectAllNotes"
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

        <!-- Labels section -->
        <div v-if="!sidebarCollapsed && (notesStore.allLabels.length || hiddenLabelsToShow.length)" class="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between px-3 mb-2">
            <span class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">标签</span>
          </div>
          <LabelItem
            v-for="label in notesStore.allLabels"
            :key="label"
            :label="label"
            :count="getLabelCount(label)"
            :active="notesStore.currentLabel === label"
            :hidden="false"
            @select="selectLabel"
            @toggle-visibility="toggleLabelVisibility"
          />
          <template v-if="hiddenLabelsToShow.length">
            <div class="px-3 py-1 mt-1">
              <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">已隐藏</span>
            </div>
            <LabelItem
              v-for="label in hiddenLabelsToShow"
              :key="'h_' + label"
              :label="label"
              :count="getLabelCount(label)"
              :active="notesStore.currentLabel === label"
              :hidden="true"
              @select="selectLabel"
              @toggle-visibility="toggleLabelVisibility"
            />
          </template>
        </div>
      </div>

      <!-- Footer: storage + theme toggle + settings -->
      <div class="p-3 border-t border-gray-200 dark:border-gray-700 shrink-0 space-y-1">
        <!-- Storage usage -->
        <div v-if="!sidebarCollapsed && storageQuota" class="px-3 pb-2 mb-1">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>存储使用</span>
            <span>{{ formatBytes(storageQuota.usedBytes) }} / {{ formatBytes(storageQuota.totalBytes) }}</span>
          </div>
          <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              class="h-full bg-green-500 rounded-full transition-all duration-500"
              :style="{ width: storagePercent + '%' }"
            ></div>
          </div>
        </div>
        <button
          @click="toggleTheme"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          :class="sidebarCollapsed ? 'justify-center' : ''"
          :title="settingsStore.theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
        >
          <svg v-if="settingsStore.theme === 'dark'" class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span v-if="!sidebarCollapsed" class="text-sm">{{ settingsStore.theme === 'dark' ? '浅色模式' : '深色模式' }}</span>
        </button>
        <router-link
          to="/settings"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          :class="sidebarCollapsed ? 'justify-center' : ''"
          title="设置"
        >
          <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span v-if="!sidebarCollapsed" class="text-sm">设置</span>
        </router-link>
      </div>
    </aside>

    <!-- Middle: Notes list (hidden on mobile when a note is selected) -->
    <section
      v-show="!isMobile || !selectedNote"
      class="w-full md:w-80 lg:w-96 shrink-0 flex flex-col min-w-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    >
      <!-- List header -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
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
          <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ currentViewTitle }}</h2>
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
        </div>
        <!-- Search bar -->
        <div class="relative">
          <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="notesStore.searchQuery"
            type="text"
            placeholder="搜索笔记..."
            class="w-full pl-9 pr-8 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-full border-0 focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          <button v-if="notesStore.searchQuery" @click="notesStore.searchQuery = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Notes list -->
      <div class="flex-1 overflow-y-auto">
        <template v-if="notesStore.currentFolder === 'DELETED'">
          <div v-if="notesStore.deletedNotes.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-8">
            <svg class="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <p class="text-lg">回收站为空</p>
          </div>
          <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
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
            <p class="text-lg mb-2">暂无笔记</p>
            <p class="text-sm">点击"新建笔记"开始记录</p>
          </div>

          <div v-if="notesStore.loading" class="flex items-center justify-center h-32">
            <svg class="w-8 h-8 text-green-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>

          <!-- List view -->
          <div v-if="viewMode === 'list' && !notesStore.loading && displayedNotes.length > 0" class="divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="note in displayedNotes"
              :key="note.id"
              class="px-3 py-3 cursor-pointer transition-colors border-l-2 flex gap-3"
              :class="[
                selectedNote?.id === note.id
                  ? 'bg-green-50 dark:bg-green-900/20 border-l-green-500'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-transparent'
              ]"
              @click="selectNote(note)"
            >
              <div class="flex-1 min-w-0 flex flex-col">
                <div class="flex items-center gap-1 mb-1">
                  <span v-if="note.pinned" class="text-xs">📌</span>
                  <span v-if="note.locked" class="text-xs">🔒</span>
                  <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{{ note.title || '(无标题)' }}</span>
                </div>
                <div class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-1.5">
                  {{ note.locked ? '🔒 内容已锁定' : getNotePreview(note).substring(0, 100) }}
                </div>
                <div class="flex items-center gap-2 mt-auto">
                  <span
                    v-for="label in (note.labels || []).slice(0, 2)"
                    :key="label"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  >{{ label }}</span>
                  <span v-if="!note.images || note.images.length === 0 || note.locked" class="text-[10px] text-gray-400 ml-auto">{{ formatDate(note.timestamp) }}</span>
                </div>
              </div>
              <div v-if="!note.locked && note.images && note.images.length > 0" class="flex flex-col items-end shrink-0 w-20">
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
              :class="selectedNote?.id === note.id ? 'ring-2 ring-green-500' : ''"
              @click="selectNote(note)"
              @img-error="onListImgError(note.id)"
            />
          </div>
        </template>
      </div>
    </section>

    <!-- Right: Note preview/editor (visible on mobile only when a note is selected) -->
    <section
      v-show="!isMobile || selectedNote"
      class="flex-1 flex-col min-w-0 bg-white dark:bg-gray-800"
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
            <input ref="imageInputRef" type="file" accept="image/*" multiple class="hidden" @change="onImageFilesSelected" />
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
          <div class="flex-1 overflow-y-auto">
            <div class="max-w-3xl mx-auto px-6 py-4">
              <input
                v-model="editingTitle"
                type="text"
                placeholder="标题"
                class="w-full text-2xl font-bold bg-transparent border-0 outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 mb-2"
                @input="onPreviewInput"
              />
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
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted, onMounted } from 'vue'
import { useNotesStore } from '../stores/notes'
import { useSettingsStore } from '../stores/settings'
import { useLockStore } from '../stores/lock'
import NoteCard from '../components/NoteCard.vue'
import NavItem from '../components/NavItem.vue'
import LabelItem from '../components/LabelItem.vue'
import DynamicIsland from '../components/DynamicIsland.vue'
import { formatDate, getNotePreview, sanitizeBody, getImageFileName, createEmptyListItem, guessMimeType } from '../utils/note-parser'
import { getAttachment, putAttachment } from '../utils/storage'
import { spansToHtml, htmlToSpans, getPlainTextFromHtml } from '../utils/rich-text'

const notesStore = useNotesStore()
const settingsStore = useSettingsStore()
const lockStore = useLockStore()

const sidebarCollapsed = ref(false)
const sidebarOpen = ref(false)
const selectedNote = ref(null)

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
let savedSelection = null
let previewSaveTimer = null

const storagePercent = computed(() => {
  if (!storageQuota.value) return 0
  const total = storageQuota.value.totalBytes
  if (total === 0) return 0
  return Math.min(100, Math.round((storageQuota.value.usedBytes / total) * 100))
})

const currentViewTitle = computed(() => {
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
  if (sortOrder.value === 'asc') {
    return [...notes].sort((a, b) => a.timestamp - b.timestamp)
  }
  return notes
})

function selectNote(note) {
  const prevId = selectedNote.value?.id
  if (prevId && prevId !== note.id) {
    flushPreviewSave()
    lockStore.lockNote(prevId)
  }
  selectedNote.value = note
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

function deselectNote() {
  if (selectedNote.value) {
    flushPreviewSave()
    lockStore.lockNote(selectedNote.value.id)
  }
  selectedNote.value = null
}

function selectAllNotes() {
  notesStore.currentFolder = 'NOTES'
  notesStore.currentLabel = null
  notesStore.searchQuery = ''
  selectedNote.value = null
}

function selectFolder(folder) {
  notesStore.currentFolder = folder
  notesStore.currentLabel = null
  notesStore.searchQuery = ''
  selectedNote.value = null
}

function selectLabel(label) {
  notesStore.currentLabel = notesStore.currentLabel === label ? null : label
  notesStore.currentFolder = 'NOTES'
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

async function toggleLabelVisibility(label) {
  await settingsStore.toggleLabelVisibility(label)
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
  if (!settingsStore.webdavUrl) return
  try {
    const client = await settingsStore.getClient()
    if (!client) return
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

// Explicit single-key deletion of inline images. Relying on the browser's native
// Backspace/Delete around a contenteditable=false image is unreliable: with a
// trailing <br> it takes two presses (br first, then image), and when an image is
// followed by other content native deletion is blocked entirely (only drag-select
// worked). We intercept Backspace/Delete when the caret is adjacent to an inline
// image (or a selection covers one) and remove the DOM node ourselves, keeping
// note.images in sync so the body <-> images position mapping never desyncs.
function onPreviewEditorKeydown(e) {
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

async function onImageFilesSelected(event) {
  const files = event.target.files
  if (!files || files.length === 0 || !selectedNote.value) return
  const editor = previewEditorRef.value
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    const fileName = `${Date.now()}_${file.name}`
    await putAttachment(fileName, file)
    if (!selectedNote.value.images) selectedNote.value.images = []
    // Android's Converters.jsonToFiles requires localName / originalName / mimeType.
    // mimeType uses getString() (non-optional) — a missing field throws and the whole
    // note is silently dropped during Android sync. Always write all three fields.
    const imageEntry = {
      localName: fileName,
      originalName: file.name,
      mimeType: file.type || guessMimeType(fileName),
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
      const url = URL.createObjectURL(file)
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
  if (imageInputRef.value) imageInputRef.value.value = ''
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
  loadStorageQuota()
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
