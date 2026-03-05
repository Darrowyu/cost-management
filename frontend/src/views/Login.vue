<template>
  <div class="login-container">
    <!-- 左侧：数据流动背景 -->
    <div class="brand-section">
      <canvas ref="particleCanvas" class="particle-canvas"></canvas>
      <div class="brand-content">
        <img :src="logoImage" alt="Logo" class="brand-logo">
        <h1 class="brand-title">成本分析系统</h1>
        <p class="brand-subtitle">数据驱动 · 精准决策 · 高效管理</p>
        <div class="brand-footer">
          <p>内部专用 · 数据保密 · 高效决策</p>
        </div>
      </div>
      <div class="grid-overlay"></div>
    </div>

    <!-- 右侧：登录表单 -->
    <div class="form-section">
      <div class="form-card">
        <div class="form-header">
          <div class="mobile-logo lg:hidden">
            <el-icon :size="32" color="#2563eb"><TrendCharts /></el-icon>
          </div>
          <h2 class="form-title">欢迎回来</h2>
          <p class="form-desc">登录您的账户以继续</p>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="input-group">
            <label class="input-label">账号</label>
            <div class="input-wrapper">
              <input 
                v-model="loginForm.username"
                type="text" 
                class="form-input"
                placeholder="请输入用户名"
                autocomplete="username"
              >
            </div>
          </div>

          <div class="input-group">
            <label class="input-label">密码</label>
            <div class="input-wrapper">
              <input
                v-model="loginForm.password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                placeholder="请输入密码"
                autocomplete="current-password"
              >
              <el-icon v-show="loginForm.password" class="password-toggle" @click="showPassword = !showPassword">
                <View v-if="!showPassword" />
                <Hide v-else />
              </el-icon>
            </div>
          </div>

          <button type="submit" class="submit-btn" :disabled="loading">
            <span v-if="loading" class="loading-spinner"></span>
            <span>{{ loading ? '登录中...' : '登 录' }}</span>
          </button>
        </form>

        <div class="form-footer">
          <p>&copy; 2025 Makrite Inc.</p>
          <p>如有问题请联系工程部</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { TrendCharts, User, Lock, View, Hide } from '@element-plus/icons-vue'
import logoImage from '../images/logo.png'
import { useLoginParticles } from '../composables/useLoginParticles'
import { useAuthFlow } from '../composables/useAuthFlow'

defineOptions({ name: 'LoginPage' })

const { particleCanvas } = useLoginParticles()
const { loading, showPassword, loginForm, handleLogin } = useAuthFlow()
</script>

<style scoped>
.login-container {
  display: flex;
  min-height: 100vh;
  background: #f8fafc;
}

.brand-section { /* 左侧品牌区 - 蓝色渐变 */
  display: none;
  position: relative;
  width: 50%;
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%);
  overflow: hidden;
}

@media (min-width: 1024px) {
  .brand-section { display: flex; align-items: center; justify-content: center; }
}

.particle-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.grid-overlay { /* 网格叠加层 */
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.brand-content {
  position: relative;
  z-index: 10;
  text-align: center;
  padding: 2rem;
}

.brand-logo {
  width: 260px;
  height: auto;
  margin-bottom: 1.5rem;
  filter: brightness(1.15);
}

.brand-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.4rem;
  margin-bottom: 0.75rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.brand-subtitle {
  font-size: 0.9375rem;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 0.15rem;
}

.brand-footer { /* 底部说明 */
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.brand-footer p {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.1rem;
}

.form-section { /* 右侧表单区 */
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: #fff;
}

.form-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
}

.form-header { text-align: left; margin-bottom: 2rem; }
.mobile-logo { margin-bottom: 1.5rem; }
.form-title { font-size: 1.875rem; font-weight: 700; color: #1e293b; margin-bottom: 0.625rem; }
.form-desc { font-size: 0.875rem; color: #64748b; }

.login-form { display: flex; flex-direction: column; gap: 1.25rem; }

.input-group { display: flex; flex-direction: column; gap: 0.5rem; }
.input-label { font-size: 0.8125rem; font-weight: 500; color: #475569; }

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.form-input {
  width: 100%;
  padding: 0.6875rem 1rem;
  padding-right: 2.75rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  color: #1e293b;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-input::placeholder { color: #94a3b8; }
.form-input::-ms-reveal,
.form-input::-ms-clear { display: none; }
.form-input::-webkit-credentials-auto-fill-button { display: none !important; }
.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.password-toggle { /* 密码显示切换按钮 */
  position: absolute;
  right: 1rem;
  color: #94a3b8;
  font-size: 1rem;
  cursor: pointer;
  transition: color 0.2s;
}

.password-toggle:hover { color: #64748b; }

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6875rem;
  margin-top: 0.75rem;
  background: #3b82f6;
  border: none;
  border-radius: 2rem;
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #2563eb;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.loading-spinner { /* 加载动画 */
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.form-footer {
  margin-top: 2rem;
  text-align: center;
}

.form-footer p {
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.6;
}
</style>
