<template>
  <div class="chat-area">
    <!-- 聊天消息区域 -->
    <div class="chat-messages" ref="messagesRef" @scroll="handleUserScroll">
      <!-- 初始状态 -->
      <div v-if="!currentSession" class="welcome-screen">
        <div class="welcome-content">
          <div class="welcome-icon">
            <img src="../logo.png" alt="HerbMind Logo" class="welcome-logo" />
          </div>
          <h1>欢迎来到 HerbMind</h1>
          <h2>您的智能中医问诊助手</h2>
          <p>基于传统中医理论和现代AI技术，为您提供专业的中医诊断建议</p>
            <div class="features">
              <div class="feature-item">
                <div class="check-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span>智能舌诊分析</span>
              </div>
              <div class="feature-item">
                <div class="check-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span>个性化诊疗方案</span>
              </div>
              <div class="feature-item">
                <div class="check-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </div>
                <span>专业中医知识库</span>
              </div>
            </div>
          <p class="welcome-tip">点击左侧"新聊天"开始您的问诊</p>
        </div>
      </div>
      
      <!-- 消息列表 -->
      <div v-else class="messages-container">
        <MessageItem
          v-for="message in currentSession.messages"
          :key="message.id"
          :message="message"
          :is-loading="isLoading"
          @option-selected="handleOptionSelected"
          @other-submitted="handleOtherSubmitted"
          @file-uploaded="handleFileUploaded"
          @streaming-started="startStreamingScroll"
          @streaming-ended="stopStreamingScroll"
          @details-toggled="handleDetailsToggled"
          @content-updated="handleContentUpdated"
        />
        
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-message">
          <div class="loading-avatar">
            <img src="../logo.png" alt="HerbMind Logo" class="loading-logo" />
          </div>
          <div class="loading-content">
            <div class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 输入区域 -->
    <div class="chat-input-area" :class="{ 'has-session': !!currentSession }">
      <div class="input-container">
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="1"
          :autosize="{ minRows: 1, maxRows: 3 }"
          placeholder="请输入您的问题..."
          class="message-input"
          @keydown.enter.prevent="handleSendMessage"
          :disabled="isLoading || !currentSession"
        />
        <el-button
          type="primary"
          class="send-btn"
          @click="handleSendMessage"
          :disabled="!inputMessage.trim() || isLoading || !currentSession"
          :loading="isLoading"
        >
          <el-icon><Position /></el-icon>
        </el-button>
      </div>

      <div class="input-tips">
        <p>请注意：AI问诊结果仅供参考，不构成医疗建议，如有身体不适请及时就医。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Position } from '@element-plus/icons-vue'
import { useInquiryStore } from '../store/inquiry'
import { sendMessage, uploadImage } from '../api/api'
import MessageItem from './MessageItem.vue'

// 全局声明
declare const ElMessage: any

const store = useInquiryStore()

const inputMessage = ref('')
const isLoading = ref(false)
const messagesRef = ref<HTMLElement>()

const currentSession = computed(() => store.currentSession)

// 智能滚动相关状态
const autoScrollEnabled = ref(true)
const isUserScrolling = ref(false)
const scrollTimer = ref<number | null>(null)
const isStreamingActive = ref(false)
const streamingScrollTimer = ref<number | null>(null)
// 防抖机制，避免短时间内重复滚动
const scrollDebounceTimer = ref<number | null>(null)
const isScrollPending = ref(false)

// 检查是否有消息待播放流式动画
const hasPendingStreamingAnimation = () => {
  if (!currentSession.value) return false
  return currentSession.value.messages.some(msg => 
    msg.finalAnswer && !msg.hasPlayedStreamingAnimation
  )
}

// 监听消息变化，智能滚动到底部
watch(
  () => currentSession.value?.messages.length,
  () => {
    nextTick(() => {
      // 如果有待播放的流式动画，延长等待时间让流式动画处理
      if (hasPendingStreamingAnimation()) {
        // 延长等待时间，确保流式动画有足够时间开始
        setTimeout(() => {
          if (!isStreamingActive.value && !isScrollPending.value) {
            debouncedIntelligentScroll(50) // 使用防抖滚动，短延迟
          }
        }, 300) // 增加到300ms，给流式动画更多启动时间
      } else {
        // 没有流式动画时，使用防抖滚动避免重复
        debouncedIntelligentScroll(50)
      }
    })
  },
  { deep: true }
)

// 监听会话切换，优化滚动体验
watch(
  () => currentSession.value?.id,
  (newSessionId, oldSessionId) => {
    if (newSessionId && newSessionId !== oldSessionId) {
      // 重置滚动状态
      autoScrollEnabled.value = true
      isUserScrolling.value = false
      
      // 清除之前的防抖计时器，避免冲突
      if (scrollDebounceTimer.value) {
        clearTimeout(scrollDebounceTimer.value)
        scrollDebounceTimer.value = null
      }
      isScrollPending.value = false
      
      nextTick(() => {
        // 如果有待播放的流式动画，完全交给消息变化的watch和流式动画来处理滚动
        if (hasPendingStreamingAnimation()) {
          // 不做任何滚动，完全由流式动画控制
          return
        } else {
          // 没有流式动画时，使用较长的防抖延迟，确保消息完全渲染
          debouncedIntelligentScroll(150)
        }
      })
    }
  }
)

const scrollToBottom = () => {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

const intelligentScrollToBottom = () => {
  if (autoScrollEnabled.value && !isUserScrolling.value) {
    scrollToBottom()
  }
}

// 带防抖机制的智能滚动，避免短时间内重复滚动
const debouncedIntelligentScroll = (delay = 100) => {
  // 如果已经有挂起的滚动，清除它
  if (scrollDebounceTimer.value) {
    clearTimeout(scrollDebounceTimer.value)
  }
  
  isScrollPending.value = true
  
  scrollDebounceTimer.value = window.setTimeout(() => {
    if (autoScrollEnabled.value && !isUserScrolling.value) {
      scrollToBottom()
    }
    isScrollPending.value = false
  }, delay)
}

// 检测用户是否在页面底部
const isAtBottom = () => {
  if (!messagesRef.value) return true
  const { scrollTop, scrollHeight, clientHeight } = messagesRef.value
  return scrollHeight - scrollTop - clientHeight < 50 // 50px的容差
}

// 处理用户滚动
const handleUserScroll = () => {
  if (!messagesRef.value) return
  
  isUserScrolling.value = true
  
  // 清除之前的定时器
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value)
  }
  
  // 如果用户滚动到底部，重新启用自动滚动
  if (isAtBottom()) {
    autoScrollEnabled.value = true
    isUserScrolling.value = false
  } else {
    autoScrollEnabled.value = false
    
    // 1.5秒后重置用户滚动状态
    scrollTimer.value = window.setTimeout(() => {
      isUserScrolling.value = false
      if (isAtBottom()) {
        autoScrollEnabled.value = true
      }
    }, 1500)
  }
}

// 开始流式动画时的持续滚动
const startStreamingScroll = () => {
  isStreamingActive.value = true
  
  // 清除任何挂起的防抖滚动，由流式滚动接管
  if (scrollDebounceTimer.value) {
    clearTimeout(scrollDebounceTimer.value)
    scrollDebounceTimer.value = null
  }
  isScrollPending.value = false
  
  // 立即滚动一次，确保定位正确
  if (autoScrollEnabled.value && !isUserScrolling.value) {
    scrollToBottom()
  }
  
  const streamingScroll = () => {
    if (isStreamingActive.value && autoScrollEnabled.value && !isUserScrolling.value) {
      scrollToBottom()
      streamingScrollTimer.value = window.setTimeout(streamingScroll, 50) // 每50ms滚动一次，更及时响应
    }
  }
  
  // 延迟一小段时间后开始持续滚动，给内容渲染留点时间
  streamingScrollTimer.value = window.setTimeout(streamingScroll, 25)
}

// 停止流式动画滚动
const stopStreamingScroll = () => {
  isStreamingActive.value = false
  if (streamingScrollTimer.value) {
    clearTimeout(streamingScrollTimer.value)
    streamingScrollTimer.value = null
  }
}

// 处理详情切换事件
const handleDetailsToggled = (expanded: boolean) => {
  if (expanded && !isUserScrolling.value) {
    // 等待展开动画完成后滚动到底部
    nextTick(() => {
      setTimeout(() => {
        intelligentScrollToBottom()
      }, 450) // 等待动画完成 (0.4s动画 + 50ms缓冲)
    })
  }
}

// 处理内容更新事件，立即触发滚动
const handleContentUpdated = () => {
  if (autoScrollEnabled.value && !isUserScrolling.value && isStreamingActive.value) {
    // 流式动画期间立即滚动到底部，跟随内容更新
    scrollToBottom()
  }
}

const handleSendMessage = async () => {
  if (!inputMessage.value.trim() || !currentSession.value || isLoading.value) {
    return
  }
  
  const message = inputMessage.value.trim()
  inputMessage.value = ''
  
  // 添加用户消息
  store.addMessage(currentSession.value.id, {
    type: 'user',
    content: message
  })
  
  await sendMessageToAPI(message)
}

const handleOptionSelected = async (option: string) => {
  if (!currentSession.value || isLoading.value) return
  
  // 添加用户选择的消息
  store.addMessage(currentSession.value.id, {
    type: 'user',
    content: option
  })
  
  await sendMessageToAPI(option)
}

const handleOtherSubmitted = async (content: string) => {
  if (!currentSession.value || isLoading.value) return
  
  // 添加用户输入的消息
  store.addMessage(currentSession.value.id, {
    type: 'user',
    content: `其他: ${content}`
  })
  
  await sendMessageToAPI('其他', content)
}

const handleFileUploaded = async (file: File) => {
  if (!currentSession.value || isLoading.value) return
  
  isLoading.value = true
  
  try {
    // 创建图片的临时URL用于显示
    const imageUrl = URL.createObjectURL(file)
    
    // 添加用户上传文件的消息
    store.addMessage(currentSession.value.id, {
      type: 'user',
      content: `上传了舌头照片: ${file.name}`,
      uploadedImage: {
        url: imageUrl,
        name: file.name
      }
    })
    
    const response = await uploadImage(currentSession.value.id, file)
    
    // 添加AI回复
    store.addMessage(currentSession.value.id, {
      type: 'assistant',
      content: response.question,
      options: response.options,
      isFinished: response.is_finished,
      finalAnswer: response.final_answer,
      retrievedContextPreview: response.retrieved_context_preview,
      requiresFileUpload: response.requires_file_upload
    })
    
    ElMessage.success('图片上传成功')
  } catch (error) {
    ElMessage.error('图片上传失败')
    console.error('图片上传失败:', error)
  } finally {
    isLoading.value = false
  }
}

const sendMessageToAPI = async (answer: string, llmDetail?: string) => {
  if (!currentSession.value) return
  
  isLoading.value = true
  
  try {
    const response = await sendMessage(currentSession.value.id, answer, llmDetail)
    
    // 添加AI回复
    store.addMessage(currentSession.value.id, {
      type: 'assistant',
      content: response.question,
      options: response.options,
      isFinished: response.is_finished,
      finalAnswer: response.final_answer,
      retrievedContextPreview: response.retrieved_context_preview,
      requiresFileUpload: response.requires_file_upload
    })
  } catch (error) {
    ElMessage.error('发送消息失败')
    console.error('发送消息失败:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  position: relative;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background: transparent;
  min-height: 0;
}

.welcome-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  overflow: hidden;
  box-sizing: border-box;
}

.welcome-content {
  max-width: 800px;
  width: 100%;
  padding: 0 20px;
  animation: fadeInUp 0.8s ease-out;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.welcome-icon {
  font-size: 72px;
  color: #667eea;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.welcome-logo {
  width: 110px;
  height: 110px;
  object-fit: contain;
  filter: invert(38%) sepia(90%) saturate(1000%) hue-rotate(228deg) brightness(95%) contrast(95%);
}

.welcome-content h1 {
  font-size: 42px;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
  flex-shrink: 0;
}

.welcome-content h2 {
  font-size: 24px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 20px;
  letter-spacing: -0.3px;
  flex-shrink: 0;
}

.welcome-content p {
  font-size: 18px;
  color: #64748b;
  line-height: 1.6;
  margin-bottom: 28px;
  font-weight: 500;
  flex-shrink: 0;
}

.features {
  display: flex;
  flex-direction: row;
  gap: 20px;
  margin-bottom: 24px;
  justify-content: center;
  align-items: center;
  flex-wrap: nowrap;
  width: 100%;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  flex-shrink: 0;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: rgba(102, 126, 234, 0.05);
  border-radius: 24px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  white-space: nowrap;
  transition: all 0.3s ease;
  flex: 1;
  justify-content: center;
  min-width: fit-content;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  cursor: default;
}

.feature-item:hover {
  background: rgba(102, 126, 234, 0.08);
  border-color: rgba(102, 126, 234, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
}

.check-icon {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 50%;
  padding: 3px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.check-icon svg {
  width: 16px;
  height: 16px;
}

.feature-item span {
  font-size: 15px;
  font-weight: 600;
  color: #475569;
}

.welcome-tip {
  font-size: 14px;
  color: #94a3b8;
  font-style: normal;
  font-weight: 500;
  padding: 14px 20px;
  background: rgba(102, 126, 234, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(102, 126, 234, 0.1);
  opacity: 0.8;
  margin-top: 16px;
  letter-spacing: 0.2px;
  flex-shrink: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.messages-container {
  max-width: 800px;
  margin: 0 auto;
}

.loading-message {
  display: flex;
  padding: 16px 0;
  gap: 12px;
  align-items: center;
}

.loading-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(16, 185, 129, 0.25);
  font-size: 16px;
  padding: 6px;
}

.loading-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.loading-content {
  background: rgba(255, 255, 255, 0.95);
  padding: 12px 16px;
  border-radius: 18px;
  max-width: fit-content;
  border: 1px solid rgba(102, 126, 234, 0.08);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.04);
  position: relative;
}



.loading-dots {
  display: flex;
  gap: 5px;
}

.loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  animation: loading 1.4s infinite ease-in-out;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes loading {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.chat-input-area {
  padding: 24px 24px 16px 24px;
  background: transparent;
  position: relative;
  flex-shrink: 0;
}

.chat-input-area.has-session {
  padding: 24px 24px 16px 24px;
}

.input-container {
  display: flex;
  gap: 16px;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
  position: relative;
}

.input-container::before {
  content: '';
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, rgba(102, 126, 234, 0.2) 50%, transparent 100%);
  border-radius: 2px;
}

.message-input {
  flex: 1;
}

.message-input :deep(.el-textarea) {
  box-shadow: none !important;
  border: none !important;
  background: transparent !important;
}

.message-input :deep(.el-textarea__wrapper) {
  box-shadow: none !important;
  border: none !important;
  background: transparent !important;
  padding: 0 !important;
}

.message-input :deep(.el-textarea__suffix) {
  display: none !important;
}

.message-input :deep(.el-textarea__prefix) {
  display: none !important;
}

.message-input :deep(.el-input__suffix) {
  display: none !important;
}

.message-input :deep(.el-input__prefix) {
  display: none !important;
}

.message-input :deep(.el-textarea__inner) {
  border-radius: 20px !important;
  padding: 16px 20px !important;
  resize: none !important;
  border: 2px solid rgba(102, 126, 234, 0.1) !important;
  font-size: 14px !important;
  line-height: 1.6 !important;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  outline: none !important;
  box-sizing: border-box !important;
  width: 100% !important;
  overflow: hidden !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.message-input :deep(.el-textarea__inner):focus {
  border-color: #667eea !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08) !important;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%) !important;
  transform: translateY(-1px) !important;
  outline: none !important;
}

.send-btn {
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: linear-gradient(135deg, rgba(102, 126, 234) 0%, rgb(93, 25, 161) 100%) !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25) !important;
  transition: all 0.3s ease !important;
  flex-shrink: 0 !important;
  border: 2px solid rgba(102, 126, 234, 0.1) !important;
  color: white !important;
}

.send-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4) !important;
  color: white !important;
}

.send-btn:disabled {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%) !important;
  opacity: 0.6 !important;
  transform: none !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  color: white !important;
  cursor: not-allowed !important;
}

.send-btn:focus {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%) !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15), 0 6px 20px rgba(102, 126, 234, 0.4) !important;
  color: white !important;
}

.input-tips {
  text-align: center;
  margin-top: 5px;
  margin-bottom: 0;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
  line-height: 1.4;
}

.input-tips p {
  margin: 0;
  padding: 0;
}
</style>