<script setup lang="ts">
/** Shows the `tip` slot (or `text`) in a small popover while the trigger is hovered or focused. */
import { ref } from 'vue'

withDefaults(defineProps<{ text?: string; placement?: 'bottom' | 'top'; width?: number }>(), {
  placement: 'bottom',
  width: 220,
})
const open = ref(false)
</script>

<template>
  <span
    class="hover-tip"
    @mouseenter="open = true"
    @mouseleave="open = false"
    @focusin="open = true"
    @focusout="open = false"
  >
    <slot />
    <span v-if="open" class="popover tip" :class="placement" :style="{ width: `${width}px` }" role="tooltip">
      <slot name="tip">{{ text }}</slot>
    </span>
  </span>
</template>

<style scoped>
.hover-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.tip {
  inset-inline-start: 50%;
  transform: translateX(50%);
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--text);
  white-space: normal;
  text-align: start;
}
.tip.bottom {
  top: calc(100% + 6px);
}
.tip.top {
  bottom: calc(100% + 6px);
}
</style>
