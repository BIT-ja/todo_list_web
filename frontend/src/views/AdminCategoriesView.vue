<template>
  <div class="page admin-page">
    <van-nav-bar title="分类管理" left-arrow @click-left="router.back()" />

    <div v-if="!ready" class="admin-denied">
      <van-loading size="22px">加载中...</van-loading>
    </div>

    <div v-else-if="!userStore.isAdmin" class="admin-denied">
      <TodoEmpty text="只有管理员可以管理分类" />
    </div>

    <template v-else>
      <van-cell-group inset class="category-list">
        <van-cell
          v-for="category in categories"
          :key="category.id"
          :title="category.name"
          :label="getIconLabel(category.icon)"
        >
          <template #icon>
            <CategoryIcon class="category-list__icon" :icon="category.icon" :color="category.color" />
          </template>
          <template #right-icon>
            <div class="category-list__actions">
              <button type="button" @click.stop="openEditor(category)">编辑</button>
              <button type="button" class="category-list__delete" @click.stop="handleDelete(category)">删除</button>
            </div>
          </template>
        </van-cell>
      </van-cell-group>

      <div class="admin-actions">
        <van-button type="primary" block round @click="openEditor()">
          新增分类
        </van-button>
      </div>
    </template>

    <van-popup v-model:show="showEditor" position="bottom" round>
      <van-form class="category-editor" @submit="handleSubmit">
        <div class="category-editor__title">{{ editingCategory ? '编辑分类' : '新增分类' }}</div>
        <van-cell-group inset>
          <van-field
            v-model="form.name"
            label="名称"
            maxlength="12"
            placeholder="例如：吃喝"
            :rules="[{ required: true, message: '请输入分类名称' }]"
          />
          <van-field
            v-model="iconLabel"
            label="图标"
            readonly
            is-link
            placeholder="选择图标"
            @click="showIconPicker = true"
          />
          <div class="color-picker">
            <div class="color-picker__label">颜色</div>
            <button
              v-for="color in colorOptions"
              :key="color"
              type="button"
              class="color-picker__swatch"
              :class="{ 'color-picker__swatch--active': form.color === color }"
              :style="{ backgroundColor: color }"
              @click="form.color = color"
            />
          </div>
        </van-cell-group>
        <div class="category-editor__preview">
          <CategoryIcon :icon="form.icon" :color="form.color" />
          <span>{{ form.name || '分类名称' }}</span>
        </div>
        <div class="category-editor__actions">
          <van-button block round type="primary" native-type="submit" :loading="saving">
            保存
          </van-button>
        </div>
      </van-form>
    </van-popup>

    <van-popup v-model:show="showIconPicker" position="bottom" round>
      <van-picker :columns="iconColumns" @confirm="onIconConfirm" @cancel="showIconPicker = false" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type TodoCategory,
} from '../api/category'
import CategoryIcon from '../components/CategoryIcon.vue'
import TodoEmpty from '../components/TodoEmpty.vue'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const iconOptions = [
  { text: '吃喝', value: 'utensils' },
  { text: '玩乐', value: 'gamepad-2' },
  { text: '骑行', value: 'bike' },
  { text: '开车', value: 'car' },
  { text: '出游', value: 'map' },
  { text: '露营', value: 'tent-tree' },
  { text: '其他', value: 'sparkles' },
]

const colorOptions = ['#ff976a', '#9c6ade', '#07c160', '#1989fa', '#00b8d9', '#ee0a24', '#7d8da6']

const categories = ref<TodoCategory[]>([])
const showEditor = ref(false)
const showIconPicker = ref(false)
const saving = ref(false)
const ready = ref(false)
const editingCategory = ref<TodoCategory | null>(null)
const form = ref({
  name: '',
  icon: 'sparkles',
  color: '#7d8da6',
})

const iconColumns = computed(() => iconOptions)

const iconLabel = computed(() => getIconLabel(form.value.icon))

function getIconLabel(icon: string) {
  return iconOptions.find((option) => option.value === icon)?.text || '其他'
}

function openEditor(category?: TodoCategory) {
  editingCategory.value = category ?? null
  form.value = {
    name: category?.name || '',
    icon: category?.icon || 'sparkles',
    color: category?.color || '#7d8da6',
  }
  showEditor.value = true
}

function onIconConfirm({ selectedValues }: { selectedValues: string[] }) {
  form.value.icon = selectedValues[0] || 'sparkles'
  showIconPicker.value = false
}

async function fetchCategories() {
  try {
    categories.value = await getCategories()
  } catch {
    // handled by interceptor
  }
}

async function handleSubmit() {
  saving.value = true
  try {
    if (editingCategory.value) {
      await updateCategory(editingCategory.value.id, form.value)
      showToast('已保存')
    } else {
      await createCategory({
        name: form.value.name,
        icon: form.value.icon,
        color: form.value.color,
      })
      showToast('已新增')
    }
    showEditor.value = false
    fetchCategories()
  } catch {
    // handled by interceptor
  } finally {
    saving.value = false
  }
}

async function handleDelete(category: TodoCategory) {
  try {
    await showDialog({
      title: '删除分类',
      message: `删除「${category.name}」不会删除待办，相关待办会迁移到“其他”或清空分类。确定删除吗？`,
      showCancelButton: true,
    })
    await deleteCategory(category.id)
    showToast('已删除')
    fetchCategories()
  } catch {
    // cancelled or handled by interceptor
  }
}

onMounted(async () => {
  if (!userStore.username) {
    await userStore.fetchUser()
  }
  ready.value = true
  if (!userStore.isAdmin) {
    return
  }
  fetchCategories()
})
</script>

<style scoped>
.admin-page {
  background: #f7f8fa;
}

.admin-denied {
  padding-top: 64px;
}

.category-list {
  margin-top: 12px;
}

.category-list__icon {
  margin-right: 10px;
}

.category-list__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 100%;
}

.category-list__actions button {
  border: 0;
  background: transparent;
  color: #1989fa;
  font: inherit;
  font-size: 13px;
}

.category-list__actions .category-list__delete {
  color: #ee0a24;
}

.admin-actions {
  padding: 20px 16px;
}

.category-editor {
  padding: 16px 0 calc(var(--safe-bottom) + 20px);
  background: #f7f8fa;
}

.category-editor__title {
  padding: 0 16px 12px;
  color: #323233;
  font-size: 18px;
  font-weight: 700;
}

.color-picker {
  display: grid;
  grid-template-columns: 70px repeat(7, 24px);
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #fff;
}

.color-picker__label {
  color: #646566;
  font-size: 14px;
}

.color-picker__swatch {
  width: 24px;
  height: 24px;
  border: 2px solid transparent;
  border-radius: 50%;
}

.color-picker__swatch--active {
  border-color: #323233;
  box-shadow: 0 0 0 2px #fff inset;
}

.category-editor__preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 16px 0;
  padding: 12px;
  color: #323233;
  background: #fff;
  border-radius: 12px;
}

.category-editor__actions {
  padding: 18px 16px 0;
}
</style>
