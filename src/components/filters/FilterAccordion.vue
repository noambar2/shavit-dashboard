<script lang="ts">
import type { Option } from '@/api/types'

export interface FilterSection {
  key: string
  title: string
  options: Option[]
  /** Show a search box above the options. */
  searchable?: boolean
}
</script>

<script setup lang="ts">
/**
 * The "סינון" dropdown from the Figma: a collapsible radio group per field, each with
 * "בחר הכל" and (optionally) a search box. Purely presentational — callers pass the
 * sections and the current selection, and handle `select` / `clear`.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps<{
  sections: FilterSection[]
  /** Selected option id per section key; missing = "בחר הכל". */
  selected: Record<string, string | undefined>
  loading?: boolean
  /** Section open when the menu appears. */
  initiallyOpen?: string | null
}>()
const emit = defineEmits<{ select: [key: string, id: string | undefined]; clear: [] }>()

const openSection = ref<string | null>(props.initiallyOpen ?? null)

/** Keep the whole menu on screen: cap its height at the space left below where it opens. */
const SCREEN_MARGIN = 12
const root = ref<HTMLElement | null>(null)
const maxHeight = ref<number | null>(null)
function fitToScreen() {
  if (root.value) maxHeight.value = Math.max(180, window.innerHeight - root.value.getBoundingClientRect().top - SCREEN_MARGIN)
}
onMounted(() => {
  fitToScreen()
  window.addEventListener('resize', fitToScreen)
})
onBeforeUnmount(() => window.removeEventListener('resize', fitToScreen))
const search = ref<Record<string, string>>({})

function visibleOptions(s: FilterSection): Option[] {
  const term = search.value[s.key]?.trim()
  return term ? s.options.filter((o) => o.label.includes(term)) : s.options
}

function toggle(key: string) {
  openSection.value = openSection.value === key ? null : key
}
</script>

<template>
  <div ref="root" class="popover menu" :style="maxHeight ? { maxHeight: `${maxHeight}px` } : undefined">
    <div class="menu-head">
      <span class="menu-title">סינון</span>
      <button type="button" class="link" @click="emit('clear')">נקה הכל</button>
    </div>
    <div v-if="loading" class="loading">טוען…</div>
    <div v-else class="sections">
      <section v-for="s in sections" :key="s.key" class="section">
        <button type="button" class="section-head" :aria-expanded="openSection === s.key" @click="toggle(s.key)">
          <span>
            {{ s.title }}
            <span v-if="selected[s.key]" class="active-dot" aria-label="מסונן" />
          </span>
          <AppIcon :name="openSection === s.key ? 'chevron-up' : 'chevron-down'" :size="14" />
        </button>
        <div v-if="openSection === s.key" class="section-body">
          <label v-if="s.searchable" class="search">
            <AppIcon name="search" :size="14" />
            <input v-model="search[s.key]" type="search" placeholder="חיפוש" />
          </label>
          <div class="options">
            <label class="radio">
              <input type="radio" :name="`f-${s.key}`" :checked="!selected[s.key]" @change="emit('select', s.key, undefined)" />
              בחר הכל
            </label>
            <label v-for="o in visibleOptions(s)" :key="o.id" class="radio">
              <input type="radio" :name="`f-${s.key}`" :checked="selected[s.key] === o.id" @change="emit('select', s.key, o.id)" />
              {{ o.label }}
            </label>
            <span v-if="!visibleOptions(s).length" class="empty">אין תוצאות</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.menu {
  top: calc(100% + 6px);
  inset-inline-start: 0;
  width: 210px;
  font-size: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sections {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.menu-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
}
.menu-title {
  font-weight: 600;
  color: var(--darkest);
}
.link {
  color: var(--main-blue);
  font-size: 11px;
}
.loading {
  padding: 12px 14px;
  color: var(--text-medium);
}
.section {
  border-top: 1px solid var(--border);
}
.section-head {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  font-weight: 500;
  color: var(--darkest);
  text-align: start;
}
.active-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-inline-start: 4px;
  border-radius: 50%;
  background: var(--main-blue);
  vertical-align: middle;
}
.section-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 14px 12px;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 168px;
  overflow-y: auto;
}
.radio {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row-reverse;
  gap: 8px;
  padding-inline-start: 30px;
  cursor: pointer;
  color: var(--text);
}
.radio input {
  accent-color: var(--main-blue);
  margin: 0;
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  height: 28px;
  border-radius: 999px;
  background: var(--bg);
  color: var(--text-medium);
}
.search input {
  border: 0;
  background: transparent;
  outline: none;
  width: 100%;
  font-size: 12px;
}
.empty {
  color: var(--text-light);
  padding-inline-start: 30px;
}
</style>
