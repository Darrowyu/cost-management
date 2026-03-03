#!/usr/bin/env node

// 帮助文档索引构建脚本
// 遍历 public/help/**/*.md 文件，生成搜索索引

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const HELP_DIR = path.join(__dirname, '..', 'public', 'help')
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'help', 'search-index.json')

// 提取 Markdown 纯文本内容
function extractPlainText(content) {
  return content
    .replace(/^#+ /gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 提取标题
function extractTitle(content) {
  const match = content.match(/^# (.+)$/m)
  return match ? match[1].trim() : ''
}

// 简单中文分词
function extractKeywords(text) {
  const words = new Set()

  for (let len = 2; len <= 4; len++) {
    for (let i = 0; i <= text.length - len; i++) {
      const word = text.slice(i, i + len)
      if (/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(word) && !/^\d+$/.test(word)) {
        words.add(word)
      }
    }
  }

  return Array.from(words).slice(0, 50)
}

// 递归获取所有 Markdown 文件
async function getMarkdownFiles(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true })
  const results = []

  for (const file of files) {
    const fullPath = path.join(dir, file.name)
    if (file.isDirectory()) {
      const subFiles = await getMarkdownFiles(fullPath)
      results.push(...subFiles)
    } else if (file.name.endsWith('.md')) {
      results.push(fullPath)
    }
  }

  return results
}

// 构建索引
async function buildIndex() {
  try {
    const files = await getMarkdownFiles(HELP_DIR)
    const documents = []

    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf-8')
      const relativePath = path.relative(HELP_DIR, filePath)
      const pathWithoutExt = relativePath.replace(/\.md$/, '')

      const urlPath = '/help/' + pathWithoutExt.replace(/\\/g, '/')

      const plainText = extractPlainText(content)
      const title = extractTitle(content) || path.basename(filePath, '.md')

      documents.push({
        path: urlPath,
        title: title,
        file: relativePath.replace(/\\/g, '/'),
        content: plainText,
        keywords: extractKeywords(plainText)
      })
    }

    const index = {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      documents: documents
    }

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(index, null, 2), 'utf-8')

    console.log(`索引构建成功: ${documents.length} 个文档`)
    console.log(`输出文件: ${OUTPUT_FILE}`)
  } catch (error) {
    console.error('索引构建失败:', error.message)
    process.exit(1)
  }
}

buildIndex()
