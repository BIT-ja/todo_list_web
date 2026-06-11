<template>
  <van-swipe-cell>
    <div
      class="todo-swipe"
      :class="{
        'todo-swipe--active': completionSwipeActive,
        'todo-swipe--ready': completionSwipeReady,
        'todo-swipe--commit': completionSwipeCommitting,
        'todo-swipe--restore': todo.status === 'completed',
      }"
      :style="swipeProgressStyle"
    >
      <div class="todo-swipe__hint" aria-hidden="true">
        <span class="todo-swipe__hint-icon">
          <van-icon :name="swipeHintIcon" />
        </span>
        <span>{{ swipeHintText }}</span>
      </div>
      <div
        class="todo-item"
        :class="{
          'todo-item--completed': todo.status === 'completed',
          'todo-item--pinned': Boolean(todo.is_pinned),
          'todo-item--urgent': Boolean(todo.is_urgent),
        }"
        :style="todoItemStyle"
        @click="handleClick"
        @pointerdown="handlePressStart"
      >
        <div class="todo-item__category" :title="todo.category_name || '其他'">
          <CategoryIcon :icon="todo.category_icon" :color="todo.category_color" />
        </div>
        <div class="todo-item__content">
          <div class="todo-item__head">
            <div class="todo-item__title">{{ todo.title }}</div>
            <span v-if="todo.is_pinned" class="todo-item__badge todo-item__badge--pin">置顶</span>
            <span v-if="todo.is_urgent" class="todo-item__badge todo-item__badge--urgent">加急</span>
          </div>
          <div v-if="primaryLocation" class="todo-item__location">
            <van-icon name="location-o" />
            <span>
              {{ primaryLocation.name }}
              <em v-if="extraLocationCount">等 {{ todoLocations.length }} 个地点</em>
            </span>
            <button v-if="canNavigate" type="button" @click.stop="navigateToTodo">导航</button>
          </div>
          <div class="todo-item__meta">
            <span class="todo-item__creator">{{ todo.creator_username }}</span>
            <span v-if="todo.due_at" class="todo-item__due" :class="dueClass">
              {{ formatDate(todo.due_at) }}
            </span>
            <span v-if="todo.priority > 0" class="todo-item__priority">
              {{ priorityLabel }}
            </span>
          </div>
        </div>
        <van-icon name="arrow" color="#c8c9cc" />
      </div>
    </div>
    <template #right>
      <van-button square type="primary" :text="todo.is_pinned ? '取消置顶' : '置顶'" class="action-btn" @click="$emit('pin', todo)" />
      <van-button square color="#ff976a" :text="todo.is_urgent ? '取消加急' : '加急'" class="action-btn" @click="$emit('urgent', todo)" />
      <van-button square type="danger" text="删除" class="action-btn" @click="$emit('delete', todo)" />
    </template>
  </van-swipe-cell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { TodoItem as TodoItemType } from '../api/todo'
import CategoryIcon from './CategoryIcon.vue'
import { openAmapNavigation } from '../utils/amap'
import { formatEast8MonthDay, getEast8DaysUntil, isEast8BeforeNow } from '../utils/time'

const LONG_PRESS_MS = 430
const MOVE_TOLERANCE = 10
const COMPLETE_SWIPE_DISTANCE = 90
const COMPLETE_SWIPE_MAX = 132

const props = defineProps<{
  todo: TodoItemType
}>()

const emit = defineEmits<{
  click: [todo: TodoItemType]
  toggle: [todo: TodoItemType]
  pin: [todo: TodoItemType]
  urgent: [todo: TodoItemType]
  delete: [todo: TodoItemType]
  'drag-start': [payload: { todo: TodoItemType; event: PointerEvent }]
}>()

const suppressClick = ref(false)
const completionSwipeActive = ref(false)
const completionSwipeCommitting = ref(false)
const completionSwipeOffset = ref(0)

let pressTimer: ReturnType<typeof window.setTimeout> | null = null
let pressStartX = 0
let pressStartY = 0
let longPressActivated = false
let trackingPress = false
let clickSuppressTimer: ReturnType<typeof window.setTimeout> | null = null
let swipeResetTimer: ReturnType<typeof window.setTimeout> | null = null

const dueClass = computed(() => {
  if (props.todo.status === 'completed' || !props.todo.due_at) return ''
  if (isEast8BeforeNow(props.todo.due_at)) return 'todo-item__due--danger'

  const days = getEast8DaysUntil(props.todo.due_at)
  if (!Number.isFinite(days)) return ''
  if (days <= 3) return 'todo-item__due--danger'
  if (days <= 7) return 'todo-item__due--warning'
  return ''
})

const priorityLabel = computed(() => {
  const labels = ['', '普通', '重要', '紧急']
  return labels[props.todo.priority] || ''
})

const completionSwipeReady = computed(() => {
  return completionSwipeOffset.value >= COMPLETE_SWIPE_DISTANCE
})

const swipeProgress = computed(() => {
  return Math.min(completionSwipeOffset.value / COMPLETE_SWIPE_DISTANCE, 1)
})

const swipeHintText = computed(() => {
  if (props.todo.status === 'completed') {
    return completionSwipeReady.value ? '松手恢复' : '右滑恢复'
  }
  return completionSwipeReady.value ? '松手完成' : '右滑完成'
})

const swipeHintIcon = computed(() => {
  return props.todo.status === 'completed' ? 'replay' : 'success'
})

const swipeProgressStyle = computed(() => {
  return {
    '--complete-swipe-progress': swipeProgress.value.toFixed(3),
  }
})

const todoItemStyle = computed(() => {
  return {
    transform: `translate3d(${completionSwipeOffset.value}px, 0, 0)`,
  }
})

const todoLocations = computed(() => {
  if (props.todo.locations?.length) {
    return props.todo.locations
  }
  if (!props.todo.location) {
    return []
  }
  return [{
    name: props.todo.location,
    lat: props.todo.location_lat,
    lng: props.todo.location_lng,
  }]
})

const primaryLocation = computed(() => {
  return todoLocations.value[0] ?? null
})

const extraLocationCount = computed(() => {
  return Math.max(todoLocations.value.length - 1, 0)
})

const canNavigate = computed(() => {
  return primaryLocation.value?.lng != null && primaryLocation.value?.lat != null
})

function formatDate(dateStr: string) {
  return formatEast8MonthDay(dateStr)
}

function navigateToTodo() {
  if (!canNavigate.value || !primaryLocation.value) return
  openAmapNavigation({
    name: primaryLocation.value.name,
    lng: primaryLocation.value.lng!,
    lat: primaryLocation.value.lat!,
  })
}

function clearPressTimer() {
  if (!pressTimer) return
  window.clearTimeout(pressTimer)
  pressTimer = null
}

function clearClickSuppressTimer() {
  if (!clickSuppressTimer) return
  window.clearTimeout(clickSuppressTimer)
  clickSuppressTimer = null
}

function keepClickSuppressed(duration = 240) {
  suppressClick.value = true
  clearClickSuppressTimer()
  clickSuppressTimer = window.setTimeout(() => {
    suppressClick.value = false
    clickSuppressTimer = null
  }, duration)
}

function clearSwipeResetTimer() {
  if (!swipeResetTimer) return
  window.clearTimeout(swipeResetTimer)
  swipeResetTimer = null
}

function cleanupPressListeners() {
  if (!trackingPress) return
  document.removeEventListener('pointermove', handlePressMove)
  document.removeEventListener('pointerup', handlePressEnd)
  document.removeEventListener('pointercancel', handlePressEnd)
  trackingPress = false
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('button,a,input,textarea,.van-swipe-cell__left,.van-swipe-cell__right'))
}

function handlePressStart(event: PointerEvent) {
  if (!event.isPrimary || event.button !== 0 || isInteractiveTarget(event.target)) return

  pressStartX = event.clientX
  pressStartY = event.clientY
  longPressActivated = false
  completionSwipeActive.value = false
  completionSwipeCommitting.value = false
  completionSwipeOffset.value = 0
  clearPressTimer()
  clearSwipeResetTimer()
  cleanupPressListeners()

  pressTimer = window.setTimeout(() => {
    longPressActivated = true
    keepClickSuppressed(360)
    emitDragStart(event)
  }, LONG_PRESS_MS)

  document.addEventListener('pointermove', handlePressMove, { passive: false })
  document.addEventListener('pointerup', handlePressEnd, { once: true })
  document.addEventListener('pointercancel', handlePressEnd, { once: true })
  trackingPress = true
}

function handlePressMove(event: PointerEvent) {
  if ((!pressTimer && !trackingPress) || longPressActivated) return

  const dx = event.clientX - pressStartX
  const dy = event.clientY - pressStartY

  if (completionSwipeActive.value || (dx > MOVE_TOLERANCE && dx > Math.abs(dy) * 1.15)) {
    event.preventDefault()
    clearPressTimer()
    completionSwipeActive.value = true
    keepClickSuppressed()
    completionSwipeOffset.value = Math.min(Math.max(dx, 0), COMPLETE_SWIPE_MAX)
    return
  }

  if (Math.hypot(dx, dy) > MOVE_TOLERANCE) {
    clearPressTimer()
  }
}

function handlePressEnd() {
  clearPressTimer()
  cleanupPressListeners()

  if (completionSwipeActive.value) {
    const shouldToggle = completionSwipeReady.value
    completionSwipeActive.value = false

    if (shouldToggle) {
      completionSwipeCommitting.value = true
      completionSwipeOffset.value = COMPLETE_SWIPE_MAX
      keepClickSuppressed(360)
      emit('toggle', props.todo)
      swipeResetTimer = window.setTimeout(() => {
        completionSwipeCommitting.value = false
        completionSwipeOffset.value = 0
        swipeResetTimer = null
      }, 180)
      return
    }

    completionSwipeOffset.value = 0
    keepClickSuppressed()
    return
  }

  if (longPressActivated) {
    window.setTimeout(() => {
      suppressClick.value = false
      longPressActivated = false
    })
    return
  }
}

function handleClick() {
  if (suppressClick.value) {
    suppressClick.value = false
    return
  }
  emit('click', props.todo)
}

function emitDragStart(event: PointerEvent) {
  emit('drag-start', {
    todo: props.todo,
    event,
  })
}

onBeforeUnmount(() => {
  clearPressTimer()
  clearClickSuppressTimer()
  clearSwipeResetTimer()
  cleanupPressListeners()
})
</script>

<style scoped>
.todo-swipe {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(7, 193, 96, 0.16), rgba(7, 193, 96, 0)),
    #fff;
}

.todo-swipe--restore {
  background:
    linear-gradient(90deg, rgba(25, 137, 250, 0.16), rgba(25, 137, 250, 0)),
    #fff;
}

.todo-swipe__hint {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 90px;
  color: #07c160;
  font-size: 13px;
  font-weight: 600;
  opacity: calc(0.18 + var(--complete-swipe-progress) * 0.82);
  transform: translate3d(calc(-16px + var(--complete-swipe-progress) * 16px), 0, 0);
  transition: opacity 0.16s ease, transform 0.16s ease;
  pointer-events: none;
}

.todo-swipe--restore .todo-swipe__hint {
  color: #1989fa;
}

.todo-swipe__hint-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #fff;
  background: #07c160;
  box-shadow: 0 6px 16px rgba(7, 193, 96, 0.24);
  transform: scale(calc(0.78 + var(--complete-swipe-progress) * 0.22));
  transition: transform 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
}

.todo-swipe--restore .todo-swipe__hint-icon {
  background: #1989fa;
  box-shadow: 0 6px 16px rgba(25, 137, 250, 0.24);
}

.todo-swipe--ready .todo-swipe__hint-icon {
  transform: scale(1.08);
}

.todo-swipe--commit .todo-swipe__hint-icon {
  animation: complete-hint-pop 180ms ease-out;
}

.todo-item {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  padding: 12px 14px;
  background: #fff;
  gap: 10px;
  min-height: 72px;
  border-left: 3px solid transparent;
  user-select: none;
  touch-action: pan-y;
  transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  will-change: transform;
}

.todo-swipe--active .todo-item {
  transition: none;
}

.todo-item--pinned {
  border-left-color: #1989fa;
}

.todo-item--urgent {
  border-left-color: #ff976a;
}

.todo-item--completed .todo-item__title {
  text-decoration: line-through;
  color: #969799;
}

.todo-item__category {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-height: 36px;
}

.todo-item__content {
  flex: 1;
  min-width: 0;
}

.todo-item__head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.todo-item__title {
  flex: 1;
  min-width: 0;
  font-size: 15px;
  color: #323233;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-item__badge {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 16px;
}

.todo-item__badge--pin {
  color: #1989fa;
  background: #ecf5ff;
}

.todo-item__badge--urgent {
  color: #d46b08;
  background: #fff7e8;
}

.todo-item__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  font-size: 12px;
}

.todo-item__due {
  color: #969799;
}

.todo-item__creator {
  color: #646566;
}

.todo-item__due--overdue {
  color: #ee0a24;
}

.todo-item__due--warning {
  color: #ff976a;
}

.todo-item__due--danger {
  color: #ee0a24;
}

.todo-item__priority {
  color: #ff976a;
}

.todo-item__location {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: #646566;
  font-size: 13px;
  line-height: 1.35;
}

.todo-item__location span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-item__location em {
  margin-left: 4px;
  color: #969799;
  font-style: normal;
}

.todo-item__location button {
  flex-shrink: 0;
  padding: 2px 6px;
  border: 1px solid #d6e8ff;
  border-radius: 4px;
  background: #f2f8ff;
  color: #1989fa;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
}

.action-btn {
  height: 100%;
}

@keyframes complete-hint-pop {
  0% {
    transform: scale(1);
  }

  60% {
    transform: scale(1.16);
  }

  100% {
    transform: scale(1.08);
  }
}
</style>
