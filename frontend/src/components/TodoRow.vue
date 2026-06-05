<template>
  <van-swipe-cell>
    <div
      class="todo-item"
      :class="{
        'todo-item--completed': todo.status === 'completed',
        'todo-item--pinned': Boolean(todo.is_pinned),
        'todo-item--urgent': Boolean(todo.is_urgent),
      }"
      @click="$emit('click', todo)"
    >
      <div class="todo-item__check" @click.stop="$emit('toggle', todo)">
        <van-icon :name="todo.status === 'completed' ? 'checked' : 'circle'" :color="todo.status === 'completed' ? '#1989fa' : '#c8c9cc'" size="22" />
      </div>
      <div class="todo-item__content">
        <div class="todo-item__head">
          <div class="todo-item__title">{{ todo.title }}</div>
          <span v-if="todo.is_pinned" class="todo-item__badge todo-item__badge--pin">置顶</span>
          <span v-if="todo.is_urgent" class="todo-item__badge todo-item__badge--urgent">加急</span>
        </div>
        <div v-if="todo.location" class="todo-item__location">
          <van-icon name="location-o" />
          <span>{{ todo.location }}</span>
          <button v-if="canNavigate" type="button" @click.stop="navigateToTodo">导航</button>
        </div>
        <div v-if="todo.due_at || todo.priority > 0" class="todo-item__meta">
          <span v-if="todo.due_at" class="todo-item__due" :class="{ 'todo-item__due--overdue': isOverdue }">
            {{ formatDate(todo.due_at) }}
          </span>
          <span v-if="todo.priority > 0" class="todo-item__priority">
            {{ priorityLabel }}
          </span>
        </div>
      </div>
      <van-icon name="arrow" color="#c8c9cc" />
    </div>
    <template #right>
      <van-button square type="primary" :text="todo.is_pinned ? '取消置顶' : '置顶'" class="action-btn" @click="$emit('pin', todo)" />
      <van-button square color="#ff976a" :text="todo.is_urgent ? '取消加急' : '加急'" class="action-btn" @click="$emit('urgent', todo)" />
      <van-button square type="danger" text="删除" class="action-btn" @click="$emit('delete', todo)" />
    </template>
  </van-swipe-cell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TodoItem as TodoItemType } from '../api/todo'
import { openAmapNavigation } from '../utils/amap'
import { formatEast8MonthDay, isEast8BeforeNow } from '../utils/time'

const props = defineProps<{
  todo: TodoItemType
}>()

defineEmits<{
  click: [todo: TodoItemType]
  toggle: [todo: TodoItemType]
  pin: [todo: TodoItemType]
  urgent: [todo: TodoItemType]
  delete: [todo: TodoItemType]
}>()

const isOverdue = computed(() => {
  if (props.todo.status === 'completed' || !props.todo.due_at) return false
  return isEast8BeforeNow(props.todo.due_at)
})

const priorityLabel = computed(() => {
  const labels = ['', '普通', '重要', '紧急']
  return labels[props.todo.priority] || ''
})

const canNavigate = computed(() => {
  return props.todo.location_lng != null && props.todo.location_lat != null
})

function formatDate(dateStr: string) {
  return formatEast8MonthDay(dateStr)
}

function navigateToTodo() {
  if (!canNavigate.value || !props.todo.location) return
  openAmapNavigation({
    name: props.todo.location,
    lng: props.todo.location_lng!,
    lat: props.todo.location_lat!,
  })
}
</script>

<style scoped>
.todo-item {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  background: #fff;
  gap: 12px;
  min-height: 72px;
  border-left: 3px solid transparent;
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

.todo-item__check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
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

.todo-item__due--overdue {
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
</style>
