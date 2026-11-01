import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/** Calls `handler` on any pointerdown outside `el` or on Escape. */
export function useClickOutside(el: Ref<HTMLElement | null>, handler: () => void) {
  const onPointer = (e: PointerEvent) => {
    if (el.value && !el.value.contains(e.target as Node)) handler()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') handler()
  }
  onMounted(() => {
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onPointer)
    document.removeEventListener('keydown', onKey)
  })
}
