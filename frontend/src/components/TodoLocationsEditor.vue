<template>
  <div class="locations-editor">
    <div
      v-for="(location, index) in visibleLocations"
      :key="index"
      class="locations-editor__item"
    >
      <div class="locations-editor__picker">
        <LocationPicker
          :location="location.name"
          :lat="location.lat"
          :lng="location.lng"
          :label="`地点${index + 1}`"
          :placeholder="index === 0 ? '在地图上选择地点' : '选择额外地点'"
          @update:location="updateLocationName(index, $event)"
          @update:lat="updateLocationLat(index, $event)"
          @update:lng="updateLocationLng(index, $event)"
        />
      </div>
      <button
        v-if="visibleLocations.length > 1"
        class="locations-editor__remove"
        type="button"
        @click="removeLocation(index)"
      >
        移除
      </button>
    </div>

    <div class="locations-editor__actions">
      <van-button
        v-if="visibleLocations.length < MAX_LOCATIONS"
        size="small"
        plain
        type="primary"
        round
        @click="addLocation"
      >
        增加地点
      </van-button>
      <span>{{ selectedCount }}/{{ MAX_LOCATIONS }} 个地点</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import LocationPicker from './LocationPicker.vue'
import type { TodoLocation } from '../api/todo'

const MAX_LOCATIONS = 5

const props = defineProps<{
  locations: TodoLocation[]
}>()

const emit = defineEmits<{
  'update:locations': [value: TodoLocation[]]
}>()

const draftLocations = ref<TodoLocation[]>(normalizeLocations(props.locations))

const visibleLocations = computed(() => {
  return normalizeLocations(draftLocations.value)
})

const selectedCount = computed(() => {
  return visibleLocations.value.filter((location) => location.name.trim()).length
})

function createEmptyLocation(): TodoLocation {
  return {
    name: '',
    lat: null,
    lng: null,
  }
}

function normalizeLocations(locations: TodoLocation[]) {
  const rows = locations.length > 0 ? locations : [createEmptyLocation()]
  return rows.slice(0, MAX_LOCATIONS).map((location) => ({ ...location }))
}

function cloneVisibleLocations() {
  return visibleLocations.value.map((location) => ({ ...location }))
}

function emitLocations(locations: TodoLocation[]) {
  const nextLocations = locations.slice(0, MAX_LOCATIONS)
  draftLocations.value = nextLocations.length > 0 ? nextLocations : [createEmptyLocation()]
  emit('update:locations', draftLocations.value.map((location) => ({ ...location })))
}

function updateLocationName(index: number, name: string) {
  const nextLocations = cloneVisibleLocations()
  nextLocations[index] = {
    ...nextLocations[index],
    name,
  }
  emitLocations(nextLocations)
}

function updateLocationLat(index: number, lat: number | null) {
  const nextLocations = cloneVisibleLocations()
  nextLocations[index] = {
    ...nextLocations[index],
    lat,
  }
  emitLocations(nextLocations)
}

function updateLocationLng(index: number, lng: number | null) {
  const nextLocations = cloneVisibleLocations()
  nextLocations[index] = {
    ...nextLocations[index],
    lng,
  }
  emitLocations(nextLocations)
}

function addLocation() {
  if (visibleLocations.value.length >= MAX_LOCATIONS) return
  emitLocations([...cloneVisibleLocations(), createEmptyLocation()])
}

function removeLocation(index: number) {
  const nextLocations = cloneVisibleLocations()
  nextLocations.splice(index, 1)
  emitLocations(nextLocations)
}

watch(
  () => props.locations,
  (locations) => {
    draftLocations.value = normalizeLocations(locations)
  },
  { deep: true }
)
</script>

<style scoped>
.locations-editor {
  background: #fff;
}

.locations-editor__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  align-items: center;
}

.locations-editor__item + .locations-editor__item {
  border-top: 1px solid #f2f3f5;
}

.locations-editor__picker {
  min-width: 0;
}

.locations-editor__remove {
  margin-right: 14px;
  padding: 3px 0;
  border: 0;
  background: transparent;
  color: #ee0a24;
  font: inherit;
  font-size: 13px;
}

.locations-editor__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px 12px;
  color: #969799;
  font-size: 12px;
  border-top: 1px solid #f2f3f5;
}
</style>
