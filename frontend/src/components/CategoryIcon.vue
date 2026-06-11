<template>
  <span class="category-icon" :style="{ color, backgroundColor: backgroundColor }">
    <component :is="iconComponent" :size="size" :stroke-width="2.2" />
  </span>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  Bike,
  Car,
  Gamepad2,
  Map,
  Sparkles,
  TentTree,
  Utensils,
} from '@lucide/vue'

const props = withDefaults(defineProps<{
  icon?: string | null
  color?: string | null
  size?: number
}>(), {
  icon: 'sparkles',
  color: '#7d8da6',
  size: 18,
})

const iconMap: Record<string, Component> = {
  bike: Bike,
  car: Car,
  'gamepad-2': Gamepad2,
  map: Map,
  sparkles: Sparkles,
  'tent-tree': TentTree,
  utensils: Utensils,
}

const iconComponent = computed(() => {
  return iconMap[props.icon || 'sparkles'] || Sparkles
})

const color = computed(() => props.color || '#7d8da6')
const backgroundColor = computed(() => `${color.value}18`)
</script>

<style scoped>
.category-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 12px;
}
</style>
