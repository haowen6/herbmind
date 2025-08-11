<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <div class="brand-icon">
          <img src="../logo.png" alt="HerbMind Logo" class="brand-logo" />
        </div>
        <div class="brand-text">
          <h2>HerbMind</h2>
          <p>智能中医问诊</p>
        </div>
      </div>
      <el-button 
        type="primary" 
        class="new-chat-btn" 
        @click="handleNewChat"
        :loading="isLoading"
      >
        <el-icon><Plus /></el-icon>
        新聊天
      </el-button>
    </div>
    
    <div class="sidebar-content">
      <div v-if="sortedSessions.length === 0" class="empty-state">
        <div class="empty-icon">
          <el-icon><ChatDotRound /></el-icon>
        </div>
        <h3>开始您的第一次问诊</h3>
        <p>点击上方"新聊天"按钮，开始与AI中医助手对话</p>
      </div>
      
      <div v-else class="session-list">
        <div
          v-for="session in sortedSessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === currentSessionId }"
          @click="selectSession(session.id)"
        >
          <div class="session-info">
            <div class="session-title">{{ session.title }}</div>
            <div class="session-time">{{ formatTime(session.createdAt) }}</div>
          </div>
          <el-button
            type="text"
            size="small"
            class="delete-btn"
            @click.stop="deleteSession(session.id)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>
    
    <div class="sidebar-footer">
      <el-button 
        type="primary" 
        class="clear-all-btn"
        @click="clearAllSessions"
        :disabled="sortedSessions.length === 0"
      >
        <el-icon><Delete /></el-icon>
        清空所有聊天
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Plus, ChatDotRound, Delete } from '@element-plus/icons-vue'
import { useInquiryStore } from '../store/inquiry'
import { startSession } from '../api/api'

// 全局声明
declare const ElMessage: any
declare const ElMessageBox: any

const store = useInquiryStore()

const sortedSessions = computed(() => store.sortedSessions)
const currentSessionId = computed(() => store.currentSessionId)
const isLoading = computed(() => store.isLoading)

const handleNewChat = async () => {
  try {
    store.isLoading = true
    const response = await startSession()
    store.createNewSession(response.session_id, response.question)
    ElMessage.success('新聊天已创建')
  } catch (error) {
    ElMessage.error('创建新聊天失败')
    console.error('创建新聊天失败:', error)
  } finally {
    store.isLoading = false
  }
}

const selectSession = (sessionId: string) => {
  store.setCurrentSession(sessionId)
}

const deleteSession = async (sessionId: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个聊天记录吗？',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    store.deleteSession(sessionId)
    ElMessage.success('聊天记录已删除')
  } catch {
    // 用户取消删除
  }
}

const clearAllSessions = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有聊天记录吗？此操作不可恢复。',
      '确认清空',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    store.clearAllSessions()
    ElMessage.success('所有聊天记录已清空')
  } catch {
    // 用户取消清空
  }
}

const formatTime = (date: Date) => {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    return date.toLocaleDateString('zh-CN')
  }
}
</script>

<style scoped>
.sidebar {
  width: 280px;
  height: 100%;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  position: relative;
}

.sidebar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.2) 50%, transparent 100%);
}

.sidebar-header {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.brand-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  padding: 6px;
}

.brand-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.brand-text h2 {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  line-height: 1.2;
}

.brand-text p {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  font-weight: 500;
}

.new-chat-btn {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transition: all 0.3s ease;
}

.new-chat-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #64748b;
}

.empty-icon {
  font-size: 48px;
  color: #cbd5e1;
  margin-bottom: 16px;
  opacity: 0.6;
}

.empty-state h3 {
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.5;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid transparent;
}

.session-item:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(102, 126, 234, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.session-item.active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  border-color: rgba(102, 126, 234, 0.3);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-time {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.delete-btn {
  opacity: 0;
  transition: all 0.3s ease;
  color: #ef4444;
  border-radius: 8px;
  padding: 6px;
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.sidebar-footer {
  padding: 20px;
  /* 移除背景和边框，让其与内容区一致 */
  background: none;
  border-top: none;
  backdrop-filter: none;
}

.clear-all-btn {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(148, 163, 184, 0.15);
  background: linear-gradient(135deg, #a9b1bc 0%, #babfc6 100%);
  color: #fff;
  transition: all 0.3s ease;
  border: none;
}

.clear-all-btn:disabled {
  background: #f3f4f6;
  color: #cbd5e1;
  cursor: not-allowed;
  box-shadow: none;
}

.clear-all-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
  box-shadow: 0 6px 20px rgba(239, 68, 68, 0.25);
  transform: translateY(-2px);
}

.clear-all-btn:focus:not(:disabled) {
  background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15), 0 6px 20px rgba(239, 68, 68, 0.25);
}
</style>