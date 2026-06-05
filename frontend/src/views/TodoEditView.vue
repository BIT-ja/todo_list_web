<template>
  <div class="page-with-button">
    <van-nav-bar title="编辑待办" left-arrow @click-left="router.back()" />

    <div v-if="notFound" class="not-found">
      <TodoEmpty text="该待办不存在或已被删除" />
    </div>

    <template v-else>
      <van-form @submit="handleSubmit" class="todo-form">
        <van-cell-group inset>
          <van-field
            v-model="form.title"
            label="标题"
            placeholder="待办标题"
            :rules="[{ required: true, message: '请输入标题' }]"
          />
          <van-field
            v-model="form.content"
            label="详情"
            type="textarea"
            placeholder="待办详情，支持粘贴 URL"
            rows="3"
            autosize
          />
          <div v-if="contentLinks.length" class="link-preview">
            <a
              v-for="link in contentLinks"
              :key="link"
              class="link-preview__item"
              :href="link"
              target="_blank"
              rel="noreferrer"
            >
              <van-icon name="link-o" />
              <span>{{ link }}</span>
            </a>
          </div>
          <LocationPicker v-model:location="form.location" v-model:lat="form.location_lat" v-model:lng="form.location_lng" />
          <van-field
            v-model="priorityLabel"
            is-link
            readonly
            label="优先级"
            placeholder="选择优先级"
            @click="showPriorityPicker = true"
          />
          <van-field
            v-model="dueAtLabel"
            is-link
            readonly
            label="截止时间"
            placeholder="选择截止时间"
            @click="showDatePicker = true"
          />
          <van-cell title="加急">
            <template #right-icon>
              <van-switch v-model="form.is_urgent" size="22px" />
            </template>
          </van-cell>
          <van-cell title="置顶">
            <template #right-icon>
              <van-switch v-model="form.is_pinned" size="22px" />
            </template>
          </van-cell>
        </van-cell-group>

        <div class="form-actions">
          <van-button type="primary" block round native-type="submit" :loading="loading">
            保存修改
          </van-button>
          <van-button block round plain type="danger" class="delete-btn" @click="handleDelete">
            删除待办
          </van-button>
        </div>
      </van-form>

      <section class="comments-panel">
        <div class="section-title">评论</div>
        <van-cell-group inset>
          <div v-if="commentsLoading" class="comments-loading">
            <van-loading size="20px">加载中...</van-loading>
          </div>
          <div v-else-if="!comments.length" class="comments-empty">暂无评论</div>
          <div v-else class="comment-list">
            <div v-for="comment in comments" :key="comment.id" class="comment-item">
              <div class="comment-item__content">
                <template v-for="(part, index) in parseTextLinks(comment.content)" :key="`${comment.id}-${index}`">
                  <a v-if="part.url" :href="part.url" target="_blank" rel="noreferrer">{{ part.text }}</a>
                  <span v-else>{{ part.text }}</span>
                </template>
              </div>
              <div class="comment-item__footer">
                <span>{{ formatDateTime(comment.created_at) }}</span>
                <van-button size="mini" type="danger" plain @click="handleDeleteComment(comment.id)">删除</van-button>
              </div>
            </div>
          </div>
        </van-cell-group>

        <van-cell-group inset class="comment-editor">
          <van-field
            v-model="commentText"
            type="textarea"
            rows="2"
            autosize
            maxlength="500"
            show-word-limit
            placeholder="添加评论，支持 URL"
          />
        </van-cell-group>
        <div class="comment-actions">
          <van-button type="primary" block round :loading="commentSaving" @click="handleAddComment">
            发表评论
          </van-button>
        </div>
      </section>
    </template>

    <van-popup v-model:show="showPriorityPicker" position="bottom" round>
      <van-picker :columns="priorityColumns" @confirm="onPriorityConfirm" @cancel="showPriorityPicker = false" />
    </van-popup>

    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="dateValue"
        title="选择截止日期"
        :min-date="getEast8TodayDate()"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  getTodoById,
  updateTodo,
  deleteTodo,
  getTodoComments,
  addTodoComment,
  deleteTodoComment,
  type TodoComment,
} from '../api/todo'
import { showDialog, showToast } from 'vant'
import TodoEmpty from '../components/TodoEmpty.vue'
import LocationPicker from '../components/LocationPicker.vue'
import { formatEast8DateLabel, formatEast8DateTime, getEast8DatePickerValue, getEast8TodayDate } from '../utils/time'

const router = useRouter()
const route = useRoute()

const form = ref({
  title: '',
  content: '',
  priority: 0,
  due_at: '',
  location: '',
  location_lat: null as number | null,
  location_lng: null as number | null,
  is_urgent: false,
  is_pinned: false,
})

const comments = ref<TodoComment[]>([])
const commentText = ref('')
const loading = ref(false)
const commentsLoading = ref(false)
const commentSaving = ref(false)
const notFound = ref(false)
const showPriorityPicker = ref(false)
const showDatePicker = ref(false)

const priorityColumns = [
  { text: '无', value: 0 },
  { text: '普通', value: 1 },
  { text: '重要', value: 2 },
  { text: '紧急', value: 3 },
]

const priorityLabel = computed(() => {
  return priorityColumns.find((p) => p.value === form.value.priority)?.text || '无'
})

const dueAtLabel = computed(() => {
  if (!form.value.due_at) return ''
  return formatEast8DateLabel(form.value.due_at)
})

const contentLinks = computed(() => extractUrls(form.value.content))

const dateValue = ref<string[]>(getEast8DatePickerValue())

function extractUrls(text: string) {
  return Array.from(new Set(text.match(/https?:\/\/[^\s]+/g) || []))
}

function parseTextLinks(text: string) {
  const parts: { text: string; url?: string }[] = []
  const pattern = /https?:\/\/[^\s]+/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index) })
    }
    parts.push({ text: match[0], url: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) })
  }
  return parts
}

function onPriorityConfirm({ selectedValues }: { selectedValues: number[] }) {
  form.value.priority = selectedValues[0]
  showPriorityPicker.value = false
}

function onDateConfirm({ selectedValues }: { selectedValues: string[] }) {
  const [year, month, day] = selectedValues
  form.value.due_at = `${year}-${month}-${day} 23:59:59`
  showDatePicker.value = false
}

function formatDateTime(dateStr: string) {
  return formatEast8DateTime(dateStr)
}

async function fetchTodo() {
  try {
    const id = Number(route.params.id)
    const todo = await getTodoById(id)
    form.value.title = todo.title
    form.value.content = todo.content
    form.value.priority = todo.priority
    form.value.due_at = todo.due_at || ''
    form.value.location = todo.location || ''
    form.value.location_lat = todo.location_lat
    form.value.location_lng = todo.location_lng
    form.value.is_urgent = Boolean(todo.is_urgent)
    form.value.is_pinned = Boolean(todo.is_pinned)
    if (todo.due_at) {
      dateValue.value = getEast8DatePickerValue(todo.due_at)
    }
  } catch {
    notFound.value = true
  }
}

async function fetchComments() {
  commentsLoading.value = true
  try {
    comments.value = await getTodoComments(Number(route.params.id))
  } catch {
    // handled by interceptor
  } finally {
    commentsLoading.value = false
  }
}

async function handleSubmit() {
  loading.value = true
  try {
    const id = Number(route.params.id)
    await updateTodo(id, {
      title: form.value.title,
      content: form.value.content,
      priority: form.value.priority,
      due_at: form.value.due_at || undefined,
      location: form.value.location || undefined,
      location_lat: form.value.location_lat,
      location_lng: form.value.location_lng,
      is_urgent: form.value.is_urgent ? 1 : 0,
      is_pinned: form.value.is_pinned ? 1 : 0,
    })
    showToast('保存成功')
    router.replace('/')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

async function handleDelete() {
  try {
    await showDialog({ title: '确认删除', message: '删除后无法恢复，确定要删除吗？', showCancelButton: true })
    const id = Number(route.params.id)
    await deleteTodo(id)
    showToast('已删除')
    router.replace('/')
  } catch {
    // cancelled or error
  }
}

async function handleAddComment() {
  const content = commentText.value.trim()
  if (!content) {
    showToast('请输入评论')
    return
  }

  commentSaving.value = true
  try {
    await addTodoComment(Number(route.params.id), content)
    commentText.value = ''
    showToast('已评论')
    fetchComments()
  } catch {
    // handled by interceptor
  } finally {
    commentSaving.value = false
  }
}

async function handleDeleteComment(commentId: number) {
  try {
    await showDialog({ title: '删除评论', message: '确定删除这条评论吗？', showCancelButton: true })
    await deleteTodoComment(Number(route.params.id), commentId)
    showToast('已删除')
    fetchComments()
  } catch {
    // cancelled or error
  }
}

onMounted(() => {
  fetchTodo()
  fetchComments()
})
</script>

<style scoped>
.not-found {
  padding-top: 64px;
}

.todo-form {
  margin-top: 12px;
}

.link-preview {
  padding: 0 16px 12px 92px;
  background: #fff;
}

.link-preview__item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #1989fa;
  font-size: 13px;
  line-height: 20px;
  word-break: break-all;
}

.link-preview__item + .link-preview__item {
  margin-top: 4px;
}

.form-actions {
  padding: 20px 16px 0;
}

.delete-btn {
  margin-top: 12px;
}

.comments-panel {
  margin-top: 24px;
}

.section-title {
  padding: 0 16px 8px;
  color: #323233;
  font-size: 16px;
  font-weight: 600;
}

.comments-loading,
.comments-empty {
  padding: 28px 16px;
  color: #969799;
  text-align: center;
}

.comment-list {
  background: #fff;
}

.comment-item {
  padding: 12px 16px;
}

.comment-item + .comment-item {
  border-top: 1px solid #f1f2f5;
}

.comment-item__content {
  color: #323233;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.comment-item__content a {
  color: #1989fa;
}

.comment-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: #969799;
  font-size: 12px;
}

.comment-editor {
  margin-top: 12px;
}

.comment-actions {
  padding: 12px 16px 0;
}
</style>
