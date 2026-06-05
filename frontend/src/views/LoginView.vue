<template>
  <div class="page login-page">
    <div class="login-header">
      <h2>待办事项</h2>
      <p>登录你的账号</p>
    </div>
    <van-form @submit="handleLogin" class="login-form">
      <van-cell-group inset>
        <van-field
          v-model="username"
          name="username"
          label="用户名"
          placeholder="请输入用户名"
          :rules="[{ required: true, message: '请输入用户名' }]"
        />
        <van-field
          v-model="password"
          type="password"
          name="password"
          label="密码"
          placeholder="请输入密码"
          :rules="[{ required: true, message: '请输入密码' }]"
        />
      </van-cell-group>
      <div class="login-actions">
        <van-button type="primary" block round native-type="submit" :loading="loading">
          登录
        </van-button>
        <van-button block round plain type="primary" @click="router.push('/register')" class="register-btn">
          注册新账号
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { showToast } from 'vant'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    await userStore.login(username.value, password.value)
    showToast('登录成功')
    const redirect = (route.query.redirect as string) || '/'
    router.replace(redirect)
  } catch {
    // error handled in interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  padding: 0 16px;
  background: #fff;
}

.login-header {
  text-align: center;
  padding: 40px 0 32px;
}

.login-header h2 {
  font-size: 28px;
  color: #323233;
}

.login-header p {
  margin-top: 8px;
  color: #969799;
  font-size: 14px;
}

.login-form {
  margin-top: 16px;
}

.login-actions {
  margin: 24px 16px 0;
}

.register-btn {
  margin-top: 12px;
}
</style>
