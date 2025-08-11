<template>
  <div class="message-item" :class="message.type">
    <div class="message-content">
      <!-- 气泡文本区域 -->
      <Transition name="message-appear" appear>
        <div class="bubble-row">
          <div class="message-avatar">
            <div v-if="message.type === 'user'" class="user-avatar">
              <el-icon><User /></el-icon>
            </div>
            <div v-else class="ai-avatar">
              <img src="../logo.png" alt="HerbMind Logo" class="ai-logo" />
            </div>
          </div>
          
          <div class="message-text" v-html="renderedContent"></div>
        </div>
      </Transition>
      
      <!-- 上传的图片显示 -->
      <Transition name="content-appear" appear>
        <div v-if="message.uploadedImage" class="uploaded-image-container">
          <div class="uploaded-image">
            <img :src="message.uploadedImage.url" :alt="message.uploadedImage.name" />
          </div>
        </div>
      </Transition>
      
      <!-- 选项按钮 -->
      <Transition name="content-appear" appear>
        <div v-if="message.options && message.options.length > 0" class="options-container">
          <div class="options-grid">
            <el-button
              v-for="option in message.options"
              :key="option"
              class="option-btn"
              :class="{ 
                'option-selected': selectedOption === option || (option === '其他' && selectedOption === '其他'),
                'option-disabled': isOptionsDisabled && selectedOption !== option && !(option === '其他' && selectedOption === '其他')
              }"
              @click="handleOptionClick(option)"
              :disabled="isLoading"
            >
              {{ option === '其他' ? otherOptionText : option }}
            </el-button>
          </div>
          
          <!-- 其他选项的输入框 -->
          <div v-if="showOtherInput" class="other-input-container">
            <el-input
              v-model="otherInput"
              placeholder="请输入具体内容..."
              class="other-input"
              @keyup.enter="handleOtherSubmit"
            />
            <el-button 
              class="other-submit-btn"
              @click="handleOtherSubmit"
              :disabled="!otherInput.trim() || isLoading"
            >
              提交
            </el-button>
          </div>
        </div>
      </Transition>
      
      <!-- 图片上传 -->
      <Transition name="content-appear" appear>
        <div v-if="message.requiresFileUpload" class="upload-container">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleFileChange"
            accept="image/*"
            class="tongue-upload"
          >
            <el-button 
              type="primary" 
              :loading="isUploading"
              :class="{ 'upload-completed': isFileUploaded }"
              :disabled="isFileUploaded"
            >
              <el-icon><Upload /></el-icon>
              {{ isFileUploaded ? '已上传' : '上传舌头照片' }}
            </el-button>
            <template #tip>
              <div class="upload-tip">请上传舌头正面、自然光下的清晰照片</div>
            </template>
          </el-upload>
        </div>
      </Transition>
      
      <!-- 最终答案和决策详情 -->
      <Transition name="content-appear" appear>
        <div v-if="message.finalAnswer" class="final-answer">
          <!-- 流式显示思考内容 -->
          <div 
            v-if="displayedThinkContent" 
            class="streaming-content"
            v-html="renderedDisplayedThink"
          ></div>
          
          <!-- 流式显示诊断结果 -->
          <div 
            v-if="displayedAnswerContent" 
            class="streaming-content answer-content"
            v-html="renderedDisplayedAnswer"
          ></div>
          
          <!-- 打字机光标效果 -->
          <div v-if="isTyping" class="typing-cursor">|</div>
          
          <!-- AI决策详情按钮 -->
          <Transition name="details-button-appear">
            <div v-if="showDecisionDetails && message.retrievedContextPreview" class="decision-details">
              <div 
                class="details-toggle"
                @click="toggleDetails"
              >
                <span>查看AI决策详情</span>
                <el-icon :class="{ 'rotated': showDetails }">
                  <ArrowDown />
                </el-icon>
              </div>
              
              <Transition name="details-expand">
                <div 
                  v-show="showDetails"
                  class="details-content"
                  v-html="renderedContextPreview"
                ></div>
              </Transition>
            </div>
          </Transition>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { User, Upload, ArrowDown } from '@element-plus/icons-vue'
import { renderMarkdown, extractThinkContent, removeThinkTags } from '../utils/markdown'
import { useInquiryStore } from '../store/inquiry'
import type { Message } from '../store/inquiry'

interface Props {
  message: Message
  isLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false
})

const emit = defineEmits<{
  optionSelected: [option: string]
  otherSubmitted: [content: string]
  fileUploaded: [file: File]
  streamingStarted: []
  streamingEnded: []
  detailsToggled: [expanded: boolean]
  contentUpdated: [] // 新事件：内容更新，需要滚动
}>()

const store = useInquiryStore()

// 状态初始化：从消息数据中恢复状态，如果没有则使用默认值
const showOtherInput = ref(props.message.showOtherInput ?? false)
const otherInput = ref(props.message.otherInput ?? '')
const showDetails = ref(false)
const isUploading = ref(false)
const uploadRef = ref()
const selectedOption = ref<string | null>(props.message.selectedOption ?? null)
const isOptionsDisabled = ref(props.message.isOptionsDisabled ?? false)
const otherOptionText = ref(props.message.otherOptionText ?? '其他')
const isFileUploaded = ref(props.message.isFileUploaded ?? false)

// 流式输出相关状态
const displayedThinkContent = ref('')
const displayedAnswerContent = ref('')
const showDecisionDetails = ref(false)
const isTyping = ref(false)

const renderedContent = computed(() => {
  return renderMarkdown(props.message.content)
})

// 提取思考内容和诊断结果
const thinkContent = computed(() => {
  if (!props.message.finalAnswer) return ''
  return extractThinkContent(props.message.finalAnswer) || ''
})

const diagnosisContent = computed(() => {
  if (!props.message.finalAnswer) return ''
  return removeThinkTags(props.message.finalAnswer)
})

// 渲染显示的内容
const renderedDisplayedThink = computed(() => {
  if (!displayedThinkContent.value) return ''
  return `<div class="think-block"><div class="think-header">🤔 AI思考过程</div><div class="think-content">${displayedThinkContent.value}</div></div>`
})

const renderedDisplayedAnswer = computed(() => {
  if (!displayedAnswerContent.value) return ''
  return renderMarkdown(displayedAnswerContent.value)
})

const renderedContextPreview = computed(() => {
  if (!props.message.retrievedContextPreview) return ''
  return renderMarkdown(props.message.retrievedContextPreview)
})

// 同步按钮状态到store的辅助函数
const syncButtonStateToStore = () => {
  if (store.currentSessionId) {
    store.updateMessageButtonState(store.currentSessionId, props.message.id, {
      selectedOption: selectedOption.value,
      isOptionsDisabled: isOptionsDisabled.value,
      showOtherInput: showOtherInput.value,
      otherInput: otherInput.value,
      otherOptionText: otherOptionText.value,
      isFileUploaded: isFileUploaded.value
    })
  }
}

const handleOptionClick = (option: string) => {
  // 如果选项已被禁用，不做任何处理
  if (isOptionsDisabled.value) return
  
  if (option === '其他' || option === otherOptionText.value) {
    // 如果已经选择过其他选项，不做处理
    if (selectedOption.value === '其他') return
    
    showOtherInput.value = true
    selectedOption.value = '其他'
    syncButtonStateToStore() // 同步状态到store
    nextTick(() => {
      // 聚焦到输入框
      const input = document.querySelector('.other-input input') as HTMLInputElement
      if (input) input.focus()
    })
  } else {
    // 选择非"其他"选项
    selectedOption.value = option
    isOptionsDisabled.value = true
    syncButtonStateToStore() // 同步状态到store
    emit('optionSelected', option)
  }
}

const handleOtherSubmit = () => {
  if (otherInput.value.trim()) {
    // 更新"其他"选项的文字
    otherOptionText.value = `其他：${otherInput.value.trim()}`
    
    // 禁用所有选项
    isOptionsDisabled.value = true
    
    // 隐藏输入框
    showOtherInput.value = false
    
    // 同步状态到store
    syncButtonStateToStore()
    
    // 发送消息
    emit('otherSubmitted', otherInput.value.trim())
    
    // 清空输入框但不清空store中的值（保持状态）
    // otherInput.value = '' // 移除这行，保持输入内容
  }
}

const handleFileChange = (file: any) => {
  if (file && !isFileUploaded.value) {
    isFileUploaded.value = true
    syncButtonStateToStore() // 同步状态到store
    emit('fileUploaded', file.raw)
  }
}

const toggleDetails = () => {
  showDetails.value = !showDetails.value
  
  // 通知父组件详情状态已切换
  emit('detailsToggled', showDetails.value)
}

// 流式输出功能
const typeText = (text: string, targetRef: any, chunkSize = 15, delay = 50) => {
  return new Promise<void>((resolve) => {
    let currentIndex = 0
    targetRef.value = ''
    
    const typeNextChunk = () => {
      if (currentIndex >= text.length) {
        resolve()
        return
      }
      
      const nextChunk = text.slice(currentIndex, currentIndex + chunkSize)
      targetRef.value += nextChunk
      currentIndex += chunkSize
      
      // 每次添加内容后，通知父组件内容已更新，需要滚动
      nextTick(() => {
        emit('contentUpdated') // 新事件：内容更新，触发滚动
      })
      
      setTimeout(typeNextChunk, delay)
    }
    
    typeNextChunk()
  })
}

const startStreamingDisplay = async () => {
  if (!props.message.finalAnswer || isTyping.value) return
  
  // 检查是否已经播放过动画
  if (props.message.hasPlayedStreamingAnimation) {
    // 如果已经播放过，直接显示完整内容
    displayedThinkContent.value = thinkContent.value
    displayedAnswerContent.value = diagnosisContent.value
    if (props.message.retrievedContextPreview) {
      showDecisionDetails.value = true
    }
    
    // 即使已经播放过动画，也要确保页面能滚动到正确位置
    // 触发一个短暂的滚动事件来确保页面定位正确
    emit('streamingStarted')
    setTimeout(() => {
      emit('streamingEnded')
    }, 100) // 短暂延迟后结束，确保滚动生效
    
    return
  }
  
  isTyping.value = true
  
  // 通知父组件开始流式动画
  emit('streamingStarted')
  
  // 清除之前的内容
  displayedThinkContent.value = ''
  displayedAnswerContent.value = ''
  showDecisionDetails.value = false
  
  try {
    // 先显示思考内容
    if (thinkContent.value) {
      await typeText(thinkContent.value, displayedThinkContent, 10, 40)
      await new Promise(resolve => setTimeout(resolve, 300)) // 短暂停顿
    }
    
    // 再显示诊断结果
    if (diagnosisContent.value) {
      await typeText(diagnosisContent.value, displayedAnswerContent, 8, 30)
      await new Promise(resolve => setTimeout(resolve, 500)) // 稍长停顿
    }
    
    // 最后显示决策详情按钮
    if (props.message.retrievedContextPreview) {
      showDecisionDetails.value = true
    }
    
    // 标记动画已播放并保存到store
    if (store.currentSessionId) {
      store.updateMessageStreamingStatus(store.currentSessionId, props.message.id, true)
    }
  } finally {
    isTyping.value = false
    // 通知父组件流式动画结束
    emit('streamingEnded')
  }
}

// 监听消息变化，恢复按钮状态
watch(
  () => props.message,
  (newMessage) => {
    // 从新消息中恢复状态
    showOtherInput.value = newMessage.showOtherInput ?? false
    otherInput.value = newMessage.otherInput ?? ''
    selectedOption.value = newMessage.selectedOption ?? null
    isOptionsDisabled.value = newMessage.isOptionsDisabled ?? false
    otherOptionText.value = newMessage.otherOptionText ?? '其他'
    isFileUploaded.value = newMessage.isFileUploaded ?? false
  },
  { immediate: true, deep: true }
)

// 监听finalAnswer变化，启动流式显示
watch(
  () => props.message.finalAnswer,
  (newValue) => {
    if (newValue) {
      // 延迟启动，确保组件已经渲染
      nextTick(() => {
        // 减少延迟时间，让流式动画更快开始，避免滚动跳跃
        setTimeout(() => {
          startStreamingDisplay()
        }, 100)
      })
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.message-item {
  display: flex;
  padding: 16px 0;
  align-items: flex-start;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-content {
  flex: 1;
  max-width: calc(100% - 48px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bubble-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.message-item.user .bubble-row {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.25);
  font-size: 16px;
}

.ai-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 3px 10px rgba(16, 185, 129, 0.25);
  font-size: 16px;
  padding: 6px;
}

.ai-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: brightness(0) invert(1);
}

.message-text {
  line-height: 1.6;
  color: #1e293b;
  font-size: 14px;
}

.message-item.user .message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 3px 16px;
  border-radius: 18px;
  max-width: fit-content;
  margin-left: auto;
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.25);
  position: relative;
  word-wrap: break-word;
  word-break: break-word;
}



.message-item.assistant .message-text {
  background: rgba(255, 255, 255, 0.95);
  padding: 3px 16px;
  border-radius: 18px;
  max-width: fit-content;
  border: 1px solid rgba(102, 126, 234, 0.08);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.04);
  position: relative;
  word-wrap: break-word;
  word-break: break-word;
}

.uploaded-image-container {
  margin-top: 8px;
  margin-left: 48px;
}

.message-item.user .uploaded-image-container {
  margin-left: 0;
  margin-right: 48px;
  display: flex;
  justify-content: flex-end;
}

.uploaded-image {
  max-width: 250px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(102, 126, 234, 0.08);
}

.uploaded-image img {
  width: 100%;
  height: auto;
  display: block;
}

.image-name {
  padding: 8px 12px;
  font-size: 12px;
  color: #64748b;
  background: rgba(248, 250, 252, 0.9);
  border-top: 1px solid rgba(102, 126, 234, 0.05);
  text-align: center;
}

.options-container {
  margin-top: 8px;
  margin-left: 48px;
}

.message-item.user .options-container {
  margin-left: 0;
  margin-right: 48px;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.option-btn {
  height: 36px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  border: 1.5px solid rgba(102, 126, 234, 0.15);
  background: rgba(255, 255, 255, 0.9);
  color: #475569;
  transition: all 0.3s ease;
}

.option-btn:hover {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.25);
}

.option-btn.option-selected {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
  color: white !important;
  border-color: transparent !important;
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.25) !important;
  cursor: default;
}

.option-btn.option-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-btn.option-disabled:hover {
  background: rgba(255, 255, 255, 0.9) !important;
  color: #475569 !important;
  border-color: rgba(102, 126, 234, 0.15) !important;
  transform: none !important;
  box-shadow: none !important;
}

.other-input-container {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
}

.other-input {
  flex: 1;
  max-width: 280px;
  border-radius: 0;
  border: none;
  box-shadow: none;
  background: none;
}
:deep(.other-input) {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
}
:deep(.other-input .el-input__wrapper) {
  border-radius: 16px !important;
  border: 1.5px solid #d3d6db !important;
  background: #fff !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
  padding: 0 !important;
}
:deep(.other-input .el-input__inner) {
  border-radius: 16px !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 12px !important;
  height: 36px !important;
  font-size: 13px !important;
}

:deep(.other-input .el-input__wrapper:focus-within) {
  border-color: #667eea !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15), 0 4px 12px rgba(0, 0, 0, 0.08) !important;
  transform: translateY(-1px);
}

.other-submit-btn {
  height: 36px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%);
  border: none;
  color: white;
  transition: all 0.3s ease;
}

.other-submit-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(102, 126, 234, 0.25);
}

.other-submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-container {
  margin-top: 8px;
  margin-left: 48px;
}

.message-item.user .upload-container {
  margin-left: 0;
  margin-right: 48px;
}

.tongue-upload {
  display: inline-block;
}

.upload-tip {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 6px;
  font-weight: 500;
}

.upload-completed {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%) !important;
  border-color: transparent !important;
  cursor: not-allowed !important;
}

.upload-completed:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%) !important;
  transform: none !important;
  box-shadow: none !important;
}

.final-answer {
  margin-top: 8px;
  margin-left: 48px;
  border-top: 1px solid rgba(102, 126, 234, 0.08);
  padding-top: 12px;
}

.message-item.user .final-answer {
  margin-left: 0;
  margin-right: 48px;
}

.answer-content {
  line-height: 1.6;
  color: #1e293b;
  margin-bottom: 12px;
  font-size: 14px;
}

.decision-details {
  border-top: 1px solid rgba(102, 126, 234, 0.08);
  padding-top: 10px;
}

.details-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #667eea;
  font-size: 13px;
  font-weight: 500;
  user-select: none;
  transition: all 0.3s ease;
  padding: 6px 10px;
  border-radius: 6px;
}

.details-toggle:hover {
  color: #764ba2;
  background: rgba(102, 126, 234, 0.05);
}

.details-toggle .el-icon {
  transition: transform 0.3s ease;
}

.details-toggle .el-icon.rotated {
  transform: rotate(180deg);
}

.details-content {
  margin-top: 10px;
  padding: 12px;
  background: rgba(248, 250, 252, 0.9);
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  color: #475569;
  border: 1px solid rgba(102, 126, 234, 0.08);
}

/* Markdown 样式 */
:deep(.think-block) {
  margin: 12px 0;
  border: 1px solid rgba(102, 126, 234, 0.08);
  border-radius: 10px;
  overflow: hidden;
  background: rgba(248, 250, 252, 0.9);
}

:deep(.think-header) {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  padding: 10px 12px;
  font-size: 11px;
  color: #667eea;
  font-weight: 600;
}

:deep(.think-content) {
  padding: 12px;
  background: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  line-height: 1.5;
  color: #475569;
}

:deep(p) {
  margin: 10px 0;
}

:deep(strong) {
  font-weight: 600;
  color: #1e293b;
}

:deep(em) {
  font-style: italic;
  color: #64748b;
}

:deep(ul), :deep(ol) {
  margin: 10px 0;
  padding-left: 20px;
}

:deep(li) {
  margin: 5px 0;
  line-height: 1.5;
}

:deep(code) {
  background: rgba(102, 126, 234, 0.08);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  color: #667eea;
}

:deep(pre) {
  background: rgba(248, 250, 252, 0.9);
  padding: 12px;
  border-radius: 10px;
  overflow-x: auto;
  margin: 12px 0;
  border: 1px solid rgba(102, 126, 234, 0.08);
}

:deep(pre code) {
  background: none;
  padding: 0;
  color: #475569;
}

/* 消息入场动画 */
.message-appear-enter-active {
  transition: all 0.6s ease-out;
}

.message-appear-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.98);
}

.message-appear-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* 内容区域入场动画 */
.content-appear-enter-active {
  transition: all 0.5s ease-out;
  transition-delay: 0.2s;
}

.content-appear-enter-from {
  opacity: 0;
  transform: translateY(15px) scale(0.98);
}

.content-appear-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* AI决策详情展开收起动画 */
.details-expand-enter-active,
.details-expand-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  overflow: hidden;
}

.details-expand-enter-from,
.details-expand-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-10px);
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
}

.details-expand-enter-to,
.details-expand-leave-from {
  opacity: 1;
  max-height: 500px;
  transform: translateY(0);
}

/* 流式显示相关样式 */
.streaming-content {
  line-height: 1.6;
  color: #1e293b;
  font-size: 14px;
  margin-bottom: 12px;
}

.streaming-content:last-of-type {
  margin-bottom: 0;
}

/* 打字机光标效果 */
.typing-cursor {
  display: inline-block;
  color: #667eea;
  font-size: 16px;
  font-weight: bold;
  animation: cursor-blink 1s infinite;
  margin-left: 2px;
  vertical-align: baseline;
}

@keyframes cursor-blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

/* AI决策详情按钮出现动画 */
.details-button-appear-enter-active {
  transition: all 0.5s ease-out;
  transition-delay: 0.3s;
}

.details-button-appear-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.details-button-appear-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}
</style>