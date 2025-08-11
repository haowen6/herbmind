import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

// 创建markdown-it实例
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value
      } catch (__) {}
    }
    return '' // 使用默认的转义
  }
})

// 自定义think标签的渲染
md.renderer.rules.html_block = function (tokens, idx) {
  const token = tokens[idx]
  const content = token.content
  
  // 处理<think>标签
  if (content.includes('<think>')) {
    return content.replace(
      /<think>([\s\S]*?)<\/think>/g,
      '<div class="think-block"><div class="think-header">🤔 AI思考过程</div><div class="think-content">$1</div></div>'
    )
  }
  
  return content
}

// 渲染markdown内容
export const renderMarkdown = (content: string): string => {
  if (!content) return ''
  
  // 预处理think标签
  const processedContent = content.replace(
    /<think>([\s\S]*?)<\/think>/g,
    '<think>$1</think>'
  )
  
  return md.render(processedContent)
}

// 提取think内容
export const extractThinkContent = (content: string): string | null => {
  const match = content.match(/<think>([\s\S]*?)<\/think>/)
  return match ? match[1].trim() : null
}

// 移除think标签，获取纯文本内容
export const removeThinkTags = (content: string): string => {
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}