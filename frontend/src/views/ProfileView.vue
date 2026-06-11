<template>
  <div class="page profile-page">
    <van-nav-bar title="个人主页" left-arrow @click-left="router.back()" />

    <section class="profile-card">
      <div class="profile-avatar">{{ avatarText }}</div>
      <div class="profile-name">{{ userStore.username || '未登录' }}</div>
      <div class="profile-role">{{ userStore.isAdmin ? '管理员' : '组织成员' }}</div>
    </section>

    <van-cell-group inset>
      <van-cell title="组织" :value="userStore.organizationName || '-'" />
      <van-cell title="账号 ID" :value="String(userStore.userId || '-')" />
      <van-cell v-if="userStore.isAdmin" title="分类管理后台" is-link @click="router.push('/admin/categories')" />
    </van-cell-group>

    <div class="profile-actions">
      <van-button block round plain type="danger" @click="handleLogout">
        退出登录
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog } from 'vant'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const avatarText = computed(() => {
  const username = userStore.username || '我'
  return username.trim().charAt(0).toUpperCase() || '我'
})

async function handleLogout() {
  try {
    await showDialog({ title: '退出登录', message: '确定要退出登录吗？', showCancelButton: true })
    userStore.logout()
    router.replace('/login')
  } catch {
    // cancelled
  }
}

onMounted(() => {
  if (!userStore.username) {
    userStore.fetchUser()
  }
})
</script>

<style scoped>
.profile-page {
  background: #f7f8fa;
}

.profile-card {
  margin: 16px;
  padding: 24px 16px;
  text-align: center;
  background: #fff;
  border: 1px solid #eef0f4;
  border-radius: 16px;
  box-shadow: 0 6px 18px rgba(31, 35, 41, 0.05);
}

.profile-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 22px;
  color: #fff;
  font-size: 26px;
  font-weight: 700;
  background: linear-gradient(135deg, #1989fa, #7b61ff);
}

.profile-name {
  margin-top: 12px;
  color: #323233;
  font-size: 20px;
  font-weight: 700;
}

.profile-role {
  margin-top: 4px;
  color: #969799;
  font-size: 13px;
}

.profile-actions {
  padding: 24px 16px;
}
</style>
