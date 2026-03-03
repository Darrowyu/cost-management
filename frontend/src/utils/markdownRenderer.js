import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'

// 配置 marked 选项
marked.setOptions({
  gfm: true,
  breaks: true,
  async: false
})

// 创建自定义 renderer
const renderer = new marked.Renderer()

// 标题锚点：为 h1-h6 添加 id 属性
// 注意：tokens 包含原始 token，可以用来渲染内联内容
renderer.heading = ({ tokens, depth }) => {
  // 渲染内联内容（包括链接）
  const text = marked.Parser.parseInline(tokens)
  // 从纯文本生成 id（移除 HTML 标签）
  const plainText = text.replace(/<[^>]+>/g, '')
  const id = plainText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
  return `<h${depth} id="${id}" class="scroll-mt-20">${text}</h${depth}>`
}

// 代码高亮：使用 highlight.js
renderer.code = ({ text, lang }) => {
  const language = lang || 'plaintext'
  let highlighted = text

  if (lang && hljs.getLanguage(lang)) {
    highlighted = hljs.highlight(text, { language: lang }).value
  } else {
    highlighted = hljs.highlightAuto(text).value
  }

  return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
}

/**
 * 预处理 Markdown，转换特殊标记
 * @param {string} markdown - Markdown 文本
 * @returns {string} - 处理后的 Markdown
 */
const preProcessMarkdown = (markdown) => {
  // 将 📷 截图位置 标记转换为带样式的 HTML
  return markdown.replace(/📷\s*截图位置[：:]\s*(.+)/g, '<div class="screenshot-placeholder"><span class="screenshot-icon">📷</span><span class="screenshot-text">截图位置：$1</span></div>')
}

/**
 * 渲染 Markdown 为安全的 HTML
 * @param {string} markdown - Markdown 文本
 * @returns {string} - 安全的 HTML
 */
export const renderMarkdown = (markdown) => {
  if (!markdown) return ''

  try {
    // 预处理特殊标记
    const processedMarkdown = preProcessMarkdown(markdown)
    // 使用自定义 renderer 渲染
    const rawHtml = marked.parse(processedMarkdown, { renderer })

    // 使用 DOMPurify 净化（允许截图标记的 class 属性）
    return DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre',
        'a', 'img', 'blockquote', 'table', 'thead', 'tbody',
        'tr', 'th', 'td', 'div', 'span'
      ],
      ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'id', 'class', 'target', 'rel'],
      ALLOWED_CLASSES: {
        'div': ['screenshot-placeholder'],
        'span': ['screenshot-icon', 'screenshot-text']
      }
    })
  } catch (err) {
    console.error('Markdown 渲染错误:', err)
    return `<p class="text-red-500">内容渲染失败: ${err.message}</p>`
  }
}

/**
 * 提取标题生成目录
 * @param {string} markdown - Markdown 文本
 * @returns {Array<{id: string, text: string, level: number}>} - 目录项列表
 */
export const extractTOC = (markdown) => {
  if (!markdown) return []

  const headings = []
  const lines = markdown.split('\n')

  for (const line of lines) {
    // 匹配 ATX 风格标题 (## 标题)
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length // 2 或 3
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      headings.push({ id, text, level })
    }
  }

  return headings
}

export default renderMarkdown
