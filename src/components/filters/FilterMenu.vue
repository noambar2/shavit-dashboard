<script setup lang="ts">
/** The dashboard-wide סינון dropdown, backed by the filters store. */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { FILTER_SECTIONS, OPTIONS_FOR, useFiltersStore } from '@/stores/filters'
import type { FilterKey, Option } from '@/api/types'
import FilterAccordion, { type FilterSection } from './FilterAccordion.vue'

const store = useFiltersStore()
const { selected, options } = storeToRefs(store)

const sections = computed<FilterSection[]>(() =>
  FILTER_SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    searchable: s.searchable,
    options: (options.value?.[OPTIONS_FOR[s.key]] ?? []) as Option[],
  })),
)
</script>

<template>
  <FilterAccordion
    :sections="sections"
    :selected="selected"
    :loading="!options"
    initially-open="taskStatus"
    @select="(key, id) => store.setFilter(key as FilterKey, id)"
    @clear="store.clearAll()"
  />
</template>
