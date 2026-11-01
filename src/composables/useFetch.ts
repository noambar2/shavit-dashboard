import { ref, shallowRef, watch, type WatchSource } from 'vue'
import { storeToRefs } from 'pinia'
import { useFiltersStore } from '@/stores/filters'
import type { DashboardFilters } from '@/api/types'

/**
 * Loads data and reloads it whenever the dashboard filters, the refresh button,
 * or any extra `deps` change. Stale responses are aborted and ignored.
 */
export function useDashboardData<T>(
  loader: (filters: DashboardFilters, signal: AbortSignal) => Promise<T>,
  deps: WatchSource[] = [],
) {
  const store = useFiltersStore()
  const { filters, refreshKey } = storeToRefs(store)
  const data = shallowRef<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  async function load() {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = null
    store.pending++
    try {
      const result = await loader(filters.value, current.signal)
      if (!current.signal.aborted) {
        data.value = result
        store.lastUpdated = new Date()
      }
    } catch (e) {
      if (!current.signal.aborted) error.value = e instanceof Error ? e.message : String(e)
    } finally {
      store.pending--
      if (controller === current) loading.value = false
    }
  }

  watch([filters, refreshKey, ...deps], load, { immediate: true, deep: true })

  return { data, loading, error, reload: load }
}
