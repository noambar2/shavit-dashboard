<script setup lang="ts">
/**
 * Shows the `tip` slot (or `text`) in a small popover while the trigger is hovered or focused.
 * The popover is teleported to <body> so scrolling containers (e.g. the tasks table) never clip it.
 */
import { nextTick, onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{ text?: string; placement?: 'bottom' | 'top'; width?: number }>(), {
  placement: 'bottom',
  width: 220,
})

const GAP = 6
const EDGE = 8

const open = ref(false)
const trigger = ref<HTMLElement | null>(null)
const tip = ref<HTMLElement | null>(null)
const pos = ref({ top: 0, left: 0 })

let observer: ResizeObserver | undefined

async function show() {
  open.value = true
  window.addEventListener('scroll', hide, true)
  await nextTick()
  if (!tip.value) return
  position()
  // Content can grow after it loads (e.g. indicator details), so re-place it when its size changes.
  observer = new ResizeObserver(position)
  observer.observe(tip.value)
}

function position() {
  if (!trigger.value || !tip.value) return
  const r = trigger.value.getBoundingClientRect()
  const h = tip.value.offsetHeight
  const left = Math.min(Math.max(r.left + r.width / 2 - props.width / 2, EDGE), window.innerWidth - props.width - EDGE)
  const fitsBelow = r.bottom + GAP + h <= window.innerHeight - EDGE
  const fitsAbove = r.top - GAP - h >= EDGE
  const below = props.placement === 'bottom' ? fitsBelow || !fitsAbove : !fitsAbove && fitsBelow
  pos.value = { left, top: below ? r.bottom + GAP : r.top - GAP - h }
}

function hide() {
  open.value = false
  observer?.disconnect()
  observer = undefined
  window.removeEventListener('scroll', hide, true)
}

onBeforeUnmount(hide)
</script>

<template>
  <span ref="trigger" class="hover-tip" @mouseenter="show" @mouseleave="hide" @focusin="show" @focusout="hide">
    <slot />
    <Teleport to="body">
      <span
        v-if="open"
        ref="tip"
        class="popover tip"
        :style="{ width: `${width}px`, top: `${pos.top}px`, left: `${pos.left}px` }"
        role="tooltip"
        dir="rtl"
      >
        <slot name="tip">{{ text }}</slot>
      </span>
    </Teleport>
  </span>
</template>

<style scoped>
.hover-tip {
  display: inline-flex;
  align-items: center;
}
.tip {
  position: fixed;
  z-index: 100;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--text);
  white-space: normal;
  text-align: start;
  pointer-events: none;
}
</style>
