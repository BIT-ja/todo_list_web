<template>
  <div class="empty-state">
    <van-icon name="todo-list-o" size="64" color="#dcdee0" />
    <p class="empty-state__text">{{ text }}</p>
    <van-button v-if="showAction" type="primary" size="small" round @click="$emit('action')">
      {{ actionText }}
    </van-button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text?: string
  showAction?: boolean
  actionText?: string
}>()

defineEmits<{
  action: []
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 16px;
}

.empty-state__text {
  margin-top: 16px;
  color: #969799;
  font-size: 14px;
}
</style>
