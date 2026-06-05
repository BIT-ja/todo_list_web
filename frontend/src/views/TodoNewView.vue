<template>
  <div class="page-with-button">
    <van-nav-bar title="新建待办" left-arrow @click-left="router.back()" />

    <van-form @submit="handleSubmit" class="todo-form">
      <van-cell-group inset>
        <van-field
          v-model="form.title"
          label="标题"
          placeholder="待办标题（必填）"
          :rules="[{ required: true, message: '请输入标题' }]"
        />
        <van-field
          v-model="form.content"
          label="详情"
          type="textarea"
          placeholder="待办详情（选填）"
          rows="3"
          autosize
        />
        <van-field
          v-model="form.location"
          label="地点"
          placeholder="地点（选填）"
        />
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
          保存
        </van-button>
      </div>
    </van-form>

    <van-popup v-model:show="showPriorityPicker" position="bottom" round>
      <van-picker :columns="priorityColumns" @confirm="onPriorityConfirm" @cancel="showPriorityPicker = false" />
    </van-popup>

    <van-popup v-model:show="showDatePicker" position="bottom" round>
      <van-date-picker
        v-model="dateValue"
        title="选择截止日期"
        :min-date="new Date()"
        @confirm="onDateConfirm"
        @cancel="showDatePicker = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { createTodo } from '../api/todo'
import { showToast } from 'vant'

const router = useRouter()

const form = ref({
  title: '',
  content: '',
  priority: 0,
  due_at: '',
  location: '',
  is_urgent: false,
  is_pinned: false,
})

const loading = ref(false)
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
  const d = new Date(form.value.due_at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const dateValue = ref<string[]>([
  String(new Date().getFullYear()),
  String(new Date().getMonth() + 1).padStart(2, '0'),
  String(new Date().getDate()).padStart(2, '0'),
])

function onPriorityConfirm({ selectedValues }: { selectedValues: number[] }) {
  form.value.priority = selectedValues[0]
  showPriorityPicker.value = false
}

function onDateConfirm({ selectedValues }: { selectedValues: string[] }) {
  const [year, month, day] = selectedValues
  form.value.due_at = `${year}-${month}-${day} 23:59:59`
  showDatePicker.value = false
}

async function handleSubmit() {
  loading.value = true
  try {
    await createTodo({
      title: form.value.title,
      content: form.value.content || undefined,
      priority: form.value.priority || undefined,
      due_at: form.value.due_at || undefined,
      location: form.value.location || undefined,
      is_urgent: form.value.is_urgent ? 1 : 0,
      is_pinned: form.value.is_pinned ? 1 : 0,
    })
    showToast('创建成功')
    router.replace('/')
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.todo-form {
  margin-top: 12px;
}

.form-actions {
  padding: 24px 16px;
}
</style>
