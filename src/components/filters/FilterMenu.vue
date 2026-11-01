<script setup lang="ts">
/** The סינון dropdown: one collapsible radio group per filter. */
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { FILTER_SECTIONS, OPTIONS_FOR, useFiltersStore } from '@/stores/filters'
import type { FilterKey, Option } from '@/api/types'
import AppIcon from '@/components/common/AppIcon.vue'

const store = useFiltersStore()
const { selected, options } = storeToRefs(store)

const openSection = ref<FilterKey | null>('taskStatus')
const search = ref<Partial<Record<FilterKey, string>>>({})

function optionsFor(key: FilterKey): Option[] {
  const list = (options.value?.[OPTIONS_FOR[key]] ?? []) as Option[]
  const term = search.value[key]?.trim()
  return term ? list.filter((o) => o.label.includes(term)) : list
}

function toggle(key: FilterKey) {
  openSection.value = openSection.value === key ? null : key
}
</script>

<template>
  <div class="popover menu">
    <div class="menu-head">
      <span class="menu-title">סינון</span>
      <button type="button" class="link" @click="store.clearAll()">נקה הכל</button>
    </div>
    <div v-if="!options" class="loading">טוען…</div>
    <section v-for="s in FILTER_SECTIONS" v-else :key="s.key" class="section">
      <button type="button" class="section-head" :aria-expanded="openSection === s.key" @click="toggle(s.key)">
        <span>{{ s.title }}</span>
        <AppIcon :name="openSection === s.key ? 'chevron-up' : 'chevron-down'" :size="14" />
      </button>
      <div v-if="openSection === s.key" class="section-body">
        <label v-if="s.searchable" class="search">
          <AppIcon name="search" :size="14" />
          <input v-model="search[s.key]" type="search" placeholder="חיפוש" />
        </label>
        <label class="radio">
          <input type="radio" :name="s.key" :checked="!selected[s.key]" @change="store.setFilter(s.key, undefined)" />
          בחר הכל
        </label>
        <label v-for="o in optionsFor(s.key)" :key="o.id" class="radio">
          <input type="radio" :name="s.key" :checked="selected[s.key] === o.id" @change="store.setFilter(s.key, o.id)" />
          {{ o.label }}
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.menu {
  top: calc(100% + 6px);
  inset-inline-start: 0;
  width: 210px;
  font-size: 12px;
  overflow: hidden;
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
}
.section-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 14px 12px;
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
</style>
