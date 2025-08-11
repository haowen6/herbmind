import axios from 'axios'

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  timeout: 30000,
  headers: {
    'X-Token': import.meta.env.VITE_API_TOKEN || 'zl',
    'Content-Type': 'application/json'
  }
})

// 获取会话ID接口
export const startSession = async () => {
  try {
    const response = await api.post('/inquiry/start', '')
    return response.data
  } catch (error) {
    console.error('获取会话ID失败:', error)
    throw error
  }
}

// 用户对话接口
export const sendMessage = async (sessionId, answer, llmDetail = null) => {
  try {
    const data = {
      session_id: sessionId,
      answer: answer
    }
    
    if (llmDetail) {
      data.llm_detail = llmDetail
    }
    
    const response = await api.post('/inquiry/respond', data)
    console.log(response.data)
    return response.data
  } catch (error) {
    console.error('发送消息失败:', error)
    throw error
  }
}

// 图片上传接口
export const uploadImage = async (sessionId, file) => {
  try {
    const formData = new FormData()
    formData.append('session_id', sessionId)
    formData.append('file', file)
    
    const response = await api.post('/inquiry/tongue_upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return response.data
  } catch (error) {
    console.error('上传图片失败:', error)
    throw error
  }
}
