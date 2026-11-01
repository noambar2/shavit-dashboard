<script setup lang="ts">
import { ref, watch } from 'vue'
import { searchCandidates, USE_MOCKS } from '@/api/dashboard'
import type { CandidateSearchResult } from '@/api/types'
import { useClickOutside } from '@/composables/useClickOutside'
import AppIcon from '@/components/common/AppIcon.vue'
import TestRoleToggle from './TestRoleToggle.vue'

const TABS = [
  { to: '/', label: 'דף הבית' },
  { to: '/candidate', label: 'פרטי מלש"ב' },
  { to: '/users', label: 'משתמשים' },
]

const query = ref('')
const results = ref<CandidateSearchResult[]>([])
const open = ref(false)
const searchEl = ref<HTMLElement | null>(null)
useClickOutside(searchEl, () => (open.value = false))

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
watch(query, (q) => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    controller?.abort()
    controller = new AbortController()
    try {
      results.value = q.trim() ? await searchCandidates(q, controller.signal) : []
      open.value = true
    } catch {
      /* aborted or failed — keep previous results */
    }
  }, 250)
})
</script>

<template>
  <nav class="navbar">
    <RouterLink to="/" class="logo">מלש"ביה</RouterLink>
    <ul class="tabs">
      <li v-for="tab in TABS" :key="tab.to">
        <RouterLink :to="tab.to" class="tab" active-class="" exact-active-class="active">{{ tab.label }}</RouterLink>
      </li>
    </ul>
    <TestRoleToggle v-if="USE_MOCKS" class="test-toggle" />
    <div ref="searchEl" class="search">
      <AppIcon name="search" :size="16" class="search-icon" />
      <input v-model="query" type="search" placeholder='חיפוש מלש"ב' aria-label='חיפוש מלש"ב' @focus="open = true" />
      <ul v-if="open && query.trim()" class="popover results">
        <li v-if="!results.length" class="empty">לא נמצאו תוצאות</li>
        <li v-for="r in results" :key="r.id">
          <RouterLink :to="`/candidate/${r.id}`" class="result" @click="open = false">
            <span>{{ r.fullName }}</span>
            <span class="num id">{{ r.idNumber }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  height: 48px;
  display: flex;
  align-items: center;
  gap: clamp(12px, 3vw, 40px);
  padding: 0 24px;
  background: var(--surface);
  position: sticky;
  top: 0;
  z-index: 40;
}
.logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--main-blue);
  text-decoration: none;
}
.tabs {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tab {
  display: block;
  white-space: nowrap;
  padding: 6px 22px;
  border-radius: var(--radius-sm);
  color: var(--darkest);
  text-decoration: none;
  font-weight: 500;
}
.tab:hover {
  background: var(--bg);
}
.tab.active {
  background: var(--selected-bg);
  color: var(--main-blue);
}
.test-toggle {
  margin-inline-start: auto;
}
.test-toggle + .search {
  margin-inline-start: 0;
}
.search {
  position: relative;
  margin-inline-start: auto;
  width: 240px;
}
.search input {
  width: 100%;
  height: 32px;
  padding: 0 36px 0 12px;
  border: 0;
  border-radius: 999px;
  background: var(--bg);
  outline: none;
}
.search input:focus {
  box-shadow: 0 0 0 2px var(--selected-bg);
}
.search-icon {
  position: absolute;
  inset-inline-start: 12px;
  top: 8px;
  color: var(--text-medium);
}
.results {
  top: 38px;
  inset-inline: 0;
  margin: 0;
  padding: 4px;
  list-style: none;
}
.result {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--text);
  text-decoration: none;
}
.result:hover {
  background: var(--bg);
}
.id,
.empty {
  color: var(--text-medium);
}
.empty {
  padding: 8px 10px;
}
</style>
