<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'
import { useClickOutside } from '@/composables/useClickOutside'
import type { DateGranularity } from '@/api/types'
import { formatDate } from '@/utils/format'
import AppIcon from '@/components/common/AppIcon.vue'

const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
const MODES: { id: DateGranularity; label: string }[] = [
  { id: 'day', label: 'יום' },
  { id: 'month', label: 'חודש' },
  { id: 'year', label: 'שנה' },
]

const store = useFiltersStore()
const { date, dateGranularity } = storeToRefs(store)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
useClickOutside(root, () => (open.value = false))

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const parse = (s: string) => s.split('-').map(Number) as [number, number, number]
const today = new Date()
const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate())

const mode = ref<DateGranularity>(dateGranularity.value)
const [initY, initM] = parse(date.value)
const viewYear = ref(initY)
const viewMonth = ref(initM - 1)

function openPicker() {
  const [y, m] = parse(date.value)
  viewYear.value = y
  viewMonth.value = m - 1
  mode.value = dateGranularity.value
  open.value = !open.value
}

const label = computed(() => {
  const [y, m] = parse(date.value)
  if (dateGranularity.value === 'year') return `כל שנת ${y}`
  if (dateGranularity.value === 'month') return `כל ${MONTHS[m - 1]} ${y}`
  return formatDate(date.value)
})

/** Day cells for the current view month, padded with the neighbouring months' days. */
const days = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { iso: iso(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === viewMonth.value }
  }).filter((_, i, all) => i < 35 || all.slice(35).some((c) => c.inMonth))
})

/** Year pages are 12-year blocks aligned to 2015 (2015–2026, 2027–2038, …), as in the design. */
const yearStart = computed(() => 2015 + 12 * Math.floor((viewYear.value - 2015) / 12))
const years = computed(() => Array.from({ length: 12 }, (_, i) => yearStart.value + i))

const header = computed(() => {
  if (mode.value === 'day') return `${MONTHS[viewMonth.value]} ${viewYear.value}`
  if (mode.value === 'month') return String(viewYear.value)
  return `${yearStart.value} - ${yearStart.value + 11}`
})

function step(dir: 1 | -1) {
  if (mode.value === 'day') {
    const d = new Date(viewYear.value, viewMonth.value + dir, 1)
    viewYear.value = d.getFullYear()
    viewMonth.value = d.getMonth()
  } else {
    viewYear.value += dir * (mode.value === 'year' ? 12 : 1)
  }
}

function pick(value: string, granularity: DateGranularity) {
  store.setDate(value, granularity)
  open.value = false
}

const selectedYM = computed(() => parse(date.value))
</script>

<template>
  <div ref="root" class="date-picker">
    <button type="button" class="trigger" :aria-expanded="open" @click="openPicker">
      <span class="num">{{ label }}</span>
      <AppIcon name="calendar" :size="16" />
    </button>

    <div v-if="open" class="popover panel" role="dialog" aria-label="בחירת תאריך">
      <div class="modes">
        <button v-for="m in MODES" :key="m.id" type="button" :class="{ active: mode === m.id }" @click="mode = m.id">
          {{ m.label }}
        </button>
      </div>

      <div class="nav">
        <button type="button" class="arrow" aria-label="הקודם" @click="step(-1)"><AppIcon name="chevron-right" :size="14" /></button>
        <span class="header">{{ header }}</span>
        <button type="button" class="arrow" aria-label="הבא" @click="step(1)"><AppIcon name="chevron-left" :size="14" /></button>
      </div>

      <div v-if="mode === 'day'" class="grid days">
        <span v-for="w in WEEKDAYS" :key="w" class="weekday">{{ w }}</span>
        <button
          v-for="c in days"
          :key="c.iso"
          type="button"
          class="cell"
          :class="{ muted: !c.inMonth, selected: c.iso === date && dateGranularity === 'day', today: c.iso === todayIso }"
          @click="pick(c.iso, 'day')"
        >
          {{ c.day }}
        </button>
      </div>
      <button v-if="mode === 'day'" type="button" class="whole" @click="pick(iso(viewYear, viewMonth, 1), 'month')">
        הצגת כל {{ MONTHS[viewMonth] }}
      </button>

      <div v-else-if="mode === 'month'" class="grid months">
        <button
          v-for="(m, i) in MONTHS"
          :key="m"
          type="button"
          class="cell wide"
          :class="{ selected: dateGranularity === 'month' && selectedYM[0] === viewYear && selectedYM[1] === i + 1 }"
          @click="pick(iso(viewYear, i, 1), 'month')"
        >
          {{ m }}
        </button>
      </div>
      <p v-if="mode === 'month'" class="hint">בחירת חודש מציגה את נתוני החודש כולו</p>
      <button v-if="mode === 'month'" type="button" class="whole" @click="pick(iso(viewYear, 0, 1), 'year')">
        הצגת כל שנת {{ viewYear }}
      </button>

      <div v-else class="grid months">
        <button
          v-for="y in years"
          :key="y"
          type="button"
          class="cell wide"
          :class="{ selected: dateGranularity === 'year' && selectedYM[0] === y }"
          @click="pick(iso(y, 0, 1), 'year')"
        >
          {{ y }}
        </button>
      </div>
      <p v-if="mode === 'year'" class="hint">בחירת שנה מציגה את נתוני השנה כולה</p>
    </div>
  </div>
</template>

<style scoped>
.date-picker {
  position: relative;
}
.trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-weight: 600;
  color: var(--darkest);
}
.whole {
  width: 100%;
  margin-top: 10px;
  padding: 6px 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--main-blue);
  font-weight: 600;
}
.whole:hover {
  background: var(--selected-bg);
}
.hint {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--text-medium);
  text-align: center;
}
.panel {
  top: calc(100% + 6px);
  inset-inline-start: 0;
  width: 240px;
  padding: 12px;
}
.modes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 999px;
  margin-bottom: 12px;
}
.modes button {
  padding: 4px 0;
  border-radius: 999px;
  color: var(--text-medium);
}
.modes button.active {
  background: var(--selected-bg);
  color: var(--main-blue);
  font-weight: 600;
}
.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.header {
  font-weight: 700;
  color: var(--darkest);
}
.arrow {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--text-medium);
}
.arrow:hover {
  background: var(--bg);
}
.grid {
  display: grid;
  gap: 4px 2px;
  text-align: center;
}
.days {
  grid-template-columns: repeat(7, 1fr);
  font-size: 12px;
}
.months {
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.weekday {
  color: var(--text-light);
  font-size: 11px;
}
.cell {
  height: 26px;
  border-radius: 50%;
  font-weight: 600;
  color: var(--darkest);
}
.cell.wide {
  border-radius: var(--radius-sm);
  font-weight: 400;
}
.cell:hover {
  background: var(--bg);
}
.cell.muted {
  color: var(--text-light);
  font-weight: 400;
}
.cell.today {
  box-shadow: inset 0 0 0 1.5px var(--main-blue);
}
.cell.selected {
  background: var(--main-blue);
  color: #fff;
}
</style>
