<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'
import { useClickOutside } from '@/composables/useClickOutside'
import type { Scope } from '@/api/types'
import AppIcon from '@/components/common/AppIcon.vue'
import FilterMenu from './FilterMenu.vue'
import DatePicker from './DatePicker.vue'

const SCOPES: { id: Scope; label: string }[] = [
  { id: 'all', label: 'כלל מיטב' },
  { id: 'bureaus', label: 'לשכות' },
  { id: 'hq', label: 'מפקדה' },
]

const store = useFiltersStore()
const { scope, activeChips } = storeToRefs(store)

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)
useClickOutside(menuRoot, () => (menuOpen.value = false))

onMounted(() => store.loadOptions())
</script>

<template>
  <div class="filter-bar">
    <div class="row">
      <div ref="menuRoot" class="menu-anchor">
        <button type="button" class="filters-btn" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
          <AppIcon name="filter" :size="16" />
          סינונים
          <span v-if="activeChips.length" class="count">{{ activeChips.length }}</span>
        </button>
        <FilterMenu v-if="menuOpen" />
      </div>

      <div class="scopes" role="radiogroup" aria-label="היקף">
        <button
          v-for="s in SCOPES"
          :key="s.id"
          type="button"
          role="radio"
          :aria-checked="scope === s.id"
          :class="{ active: scope === s.id }"
          @click="scope = s.id"
        >
          {{ s.label }}
        </button>
      </div>

      <DatePicker />

      <button v-if="!activeChips.length" type="button" class="clear" @click="store.clearAll()">נקה הכל</button>

      <button type="button" class="icon-btn refresh" aria-label="רענון נתונים" @click="store.refresh()">
        <AppIcon name="refresh" :size="16" />
      </button>
    </div>

    <div v-if="activeChips.length" class="chips">
      <span v-for="chip in activeChips" :key="chip.key" class="chip">
        {{ chip.label }}
        <button type="button" :aria-label="`הסרת סינון ${chip.label}`" @click="store.setFilter(chip.key, undefined)">
          <AppIcon name="close" :size="12" />
        </button>
      </span>
      <button type="button" class="clear" @click="store.clearAll()">נקה הכל</button>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.menu-anchor {
  position: relative;
}
.filters-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 16px;
  border-radius: var(--radius-sm);
  background: var(--main-blue);
  color: #fff;
  font-weight: 600;
}
.count {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #fff;
  color: var(--main-blue);
  font-size: 11px;
}
.scopes {
  display: flex;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
}
.scopes button {
  padding: 4px 16px;
  border-radius: 999px;
  color: var(--text-light);
}
.scopes button.active {
  background: var(--selected-bg);
  color: var(--main-blue);
  font-weight: 600;
}
.clear {
  font-weight: 600;
  color: var(--darkest);
}
.clear:hover {
  color: var(--main-blue);
}
.refresh {
  margin-inline-start: auto;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--darkest);
  font-size: 13px;
}
.chip button {
  display: grid;
  color: var(--darkest);
}
</style>
