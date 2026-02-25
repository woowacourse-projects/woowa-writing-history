import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const generationRepoConfigs = [
  { generation: 2, gitDir: '/tmp/woowa-writing-2.git', repoName: 'woowa-writing-2' },
  { generation: 3, gitDir: '/tmp/woowa-writing-3.git', repoName: 'woowa-writing-3' },
  { generation: 4, gitDir: '/tmp/woowa-writing-4.git', repoName: 'woowa-writing-4' },
  { generation: 5, gitDir: '/tmp/woowa-writing-5.git', repoName: 'woowa-writing-5' }
]

const splitGenerationConfig = {
  gitDir: '/tmp/woowa-writing.git',
  repoName: 'woowa-writing',
  targetGenerations: [6, 7],
  resolveGenerationFromYear: (year) => {
    if (year === 2024) return 6
    if (year >= 2025) return 7
    return null
  }
}

const excludedBranchNames = new Set(['main', 'master', 'develop', 'gh-pages'])
const generationYears = {
  2: 2020,
  3: 2021,
  4: 2022,
  5: 2023,
  6: 2024,
  7: 2025
}

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function safeToken(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'unknown'
}

function safeSlug(value) {
  return value
    .toLowerCase()
    .replace(/\.[^.]+$/g, '')
    .replace(/[^a-z0-9가-힣._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'writing'
}

function stripBom(value) {
  if (value.charCodeAt(0) === 0xfeff) {
    return value.slice(1)
  }
  return value
}

function detectLevel(filePath) {
  const lower = filePath.toLowerCase()
  const segments = lower.split('/')
  const base = segments[segments.length - 1]

  const levelRegexes = [
    /(?:^|[^a-z0-9])level\s*[-_ ]*([1-9])(?:[^a-z0-9]|$)/i,
    /(?:^|[^a-z0-9])lv\s*[-_ ]*([1-9])(?:[^a-z0-9]|$)/i,
    /(?:^|[^a-z0-9])step\s*[-_ ]*([1-9])(?:[^a-z0-9]|$)/i,
    /(?:^|[^a-z0-9])레벨\s*[-_ ]*([1-9])(?:[^a-z0-9]|$)/i
  ]

  for (const regex of levelRegexes) {
    const segmentHit = segments.find((segment) => regex.test(segment))
    if (segmentHit) {
      const match = segmentHit.match(regex)
      if (match) {
        return `level${Number(match[1])}`
      }
    }

    const baseMatch = base.match(regex)
    if (baseMatch) {
      return `level${Number(baseMatch[1])}`
    }
  }

  const leadingDigit = base.match(/^\s*([1-9])(?:[^0-9]|$)/)
  if (leadingDigit) {
    return `level${Number(leadingDigit[1])}`
  }

  return 'unclassified'
}

function encodeRepoPath(filePath) {
  return filePath.split('/').map((segment) => encodeURIComponent(segment)).join('/')
}

function buildBlobUrl(repoName, branchName, filePath) {
  const encodedBranch = encodeURIComponent(branchName)
  const encodedPath = encodeRepoPath(filePath)
  return `https://github.com/woowacourse/${repoName}/blob/${encodedBranch}/${encodedPath}`
}

function buildRawUrl(repoName, branchName, filePath) {
  const encodedBranch = encodeURIComponent(branchName)
  const encodedPath = encodeRepoPath(filePath)
  return `https://raw.githubusercontent.com/woowacourse/${repoName}/${encodedBranch}/${encodedPath}`
}

function isExternalTarget(target) {
  return /^(?:[a-z]+:|\/\/|#)/i.test(target)
}

function isImageTargetPath(targetPath) {
  return /\.(png|jpe?g|gif|svg|webp|bmp|ico|avif)$/i.test(targetPath)
}

function rewriteTarget(target, { repoName, branchName, sourcePath, treatAsImage = false }) {
  if (!target) return target
  if (target.startsWith('{')) return target

  const wrappedInAngle = target.startsWith('<') && target.endsWith('>')
  let plainTarget = wrappedInAngle ? target.slice(1, -1) : target

  if (isExternalTarget(plainTarget)) return target

  const qIndex = plainTarget.indexOf('?')
  const hIndex = plainTarget.indexOf('#')
  const splitCandidates = [qIndex, hIndex].filter((value) => value >= 0)
  const splitAt = splitCandidates.length === 0 ? -1 : Math.min(...splitCandidates)

  const pathname = splitAt >= 0 ? plainTarget.slice(0, splitAt) : plainTarget
  const suffix = splitAt >= 0 ? plainTarget.slice(splitAt) : ''
  if (!pathname || isExternalTarget(pathname)) return target

  const sourceDir = path.posix.dirname(sourcePath)
  let resolvedPath

  if (pathname.startsWith('/')) {
    const isImageRootPath = pathname.startsWith('/assets/') || pathname.startsWith('/asset/') || pathname.startsWith('/images/')
    const shouldRewriteRootPath = isImageRootPath || treatAsImage || isImageTargetPath(pathname)
    if (!shouldRewriteRootPath) return target
    resolvedPath = pathname.replace(/^\/+/, '')
  } else {
    const joined = path.posix.normalize(path.posix.join(sourceDir, pathname))
    resolvedPath = joined.replace(/^(\.\.\/)+/g, '')
  }

  if (!resolvedPath || resolvedPath.startsWith('.')) return target

  const useRaw = treatAsImage || isImageTargetPath(resolvedPath)
  const absoluteUrl = useRaw
    ? buildRawUrl(repoName, branchName, resolvedPath)
    : buildBlobUrl(repoName, branchName, resolvedPath)

  const rewritten = `${absoluteUrl}${suffix}`
  return wrappedInAngle ? `<${rewritten}>` : rewritten
}

function rewriteRelativeReferences(body, { repoName, branchName, sourcePath }) {
  let rewritten = body

  // Markdown inline links and images: [text](target), ![alt](target)
  rewritten = rewritten.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g, (match, bang, label, target, suffix) => {
    const nextTarget = rewriteTarget(target, {
      repoName,
      branchName,
      sourcePath,
      treatAsImage: bang === '!'
    })
    if (nextTarget === target) return match
    return `${bang}[${label}](${nextTarget}${suffix})`
  })

  // Markdown reference-style definitions: [id]: target
  rewritten = rewritten.replace(/^(\s*\[[^\]]+\]:\s*)(\S+)(.*)$/gm, (match, prefix, target, suffix) => {
    const nextTarget = rewriteTarget(target, {
      repoName,
      branchName,
      sourcePath,
      treatAsImage: isImageTargetPath(target)
    })
    if (nextTarget === target) return match
    return `${prefix}${nextTarget}${suffix}`
  })

  // HTML img src
  rewritten = rewritten.replace(/<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi, (match, before, quote, target, after) => {
    const nextTarget = rewriteTarget(target, {
      repoName,
      branchName,
      sourcePath,
      treatAsImage: true
    })
    if (nextTarget === target) return match
    return `<img${before}src=${quote}${nextTarget}${quote}${after}>`
  })

  // HTML a href
  rewritten = rewritten.replace(/<a\b([^>]*?)\bhref=(["'])([^"']+)\2([^>]*)>/gi, (match, before, quote, target, after) => {
    const nextTarget = rewriteTarget(target, {
      repoName,
      branchName,
      sourcePath,
      treatAsImage: false
    })
    if (nextTarget === target) return match
    return `<a${before}href=${quote}${nextTarget}${quote}${after}>`
  })

  return rewritten
}

function buildFrontmatter({ author, generation, level, originalFilename, source, sourcePath }) {
  return [
    '---',
    `author: "${author.replace(/"/g, '\\"')}"`,
    `generation: ${generation}`,
    `level: "${level}"`,
    `original_filename: "${originalFilename.replace(/"/g, '\\"')}"`,
    `source: "${source}"`,
    `source_path: "${sourcePath.replace(/"/g, '\\"')}"`,
    '---',
    ''
  ].join('\n')
}

function writeTextFile(filePath, content) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, content, 'utf8')
}

function createGenerationMeta(generationDir) {
  const metaPath = path.join(generationDir, '_meta.ts')
  const content = `export default {\n  index: '개요',\n  writings: '글 모음'\n}\n`
  writeTextFile(metaPath, content)
}

function createWritingsMeta(writingsDir, levels) {
  const ordered = ['level1', 'level2', 'level3', 'level4', 'level5', 'unclassified']
  const levelLabels = {
    level1: '레벨 1',
    level2: '레벨 2',
    level3: '레벨 3',
    level4: '레벨 4',
    level5: '레벨 5',
    unclassified: '기타 분류'
  }

  const lines = ["export default {", "  index: '개요',"]
  for (const level of ordered) {
    if (!levels.has(level)) continue
    lines.push(`  ${level}: '${levelLabels[level]}',`)
  }
  lines.push('}')
  lines.push('')

  writeTextFile(path.join(writingsDir, '_meta.ts'), lines.join('\n'))
}

function createGenerationIndex(generationDir, generation, summary) {
  const year = generationYears[generation] ?? ''
  const levelOrder = ['level1', 'level2', 'level3', 'level4', 'level5', 'unclassified']
  const levelTitles = {
    level1: '레벨 1',
    level2: '레벨 2',
    level3: '레벨 3',
    level4: '레벨 4',
    level5: '레벨 5',
    unclassified: '기타 분류'
  }

  const cards = []
  for (const level of levelOrder) {
    const count = summary.levelCounts[level] ?? 0
    if (count === 0) continue
    cards.push(`  <Card title="${levelTitles[level]}" href="/tech-blog-book/generation-${generation}/writings/${level}" meta="${count}편">\n    ${level === 'unclassified' ? '파일명 규칙으로 분류되지 않은 글 모음' : `${levelTitles[level]} 글 모음`}\n  </Card>`)
  }

  const content = [
    `# ${generation}기 (${year})`,
    '',
    `${generation}기 크루 글쓰기 미션 아카이브입니다.`,
    '',
    '<Callout type="info">',
    `브랜치(크루 GitHub username) 기준으로 수집했습니다. 총 ${summary.totalFiles}편 · ${summary.branchCount}명`,
    '</Callout>',
    '',
    '## 글 모아보기',
    '',
    '<CardGrid>',
    ...cards,
    '</CardGrid>'
  ].join('\n') + '\n'

  writeTextFile(path.join(generationDir, 'index.mdx'), content)
}

function createWritingsIndex(writingsDir, generation, summary) {
  const levelOrder = ['level1', 'level2', 'level3', 'level4', 'level5', 'unclassified']
  const levelTitles = {
    level1: '레벨 1',
    level2: '레벨 2',
    level3: '레벨 3',
    level4: '레벨 4',
    level5: '레벨 5',
    unclassified: '기타 분류'
  }

  const lines = [
    `# ${generation}기 글 모음`,
    '',
    `총 ${summary.totalFiles}편 · ${summary.branchCount}명`,
    '',
    '| 구분 | 글 수 |',
    '|---|---:|'
  ]

  for (const level of levelOrder) {
    const count = summary.levelCounts[level] ?? 0
    if (count === 0) continue
    lines.push(`| [${levelTitles[level]}](/tech-blog-book/generation-${generation}/writings/${level}) | ${count} |`)
  }

  lines.push('')
  writeTextFile(path.join(writingsDir, 'index.mdx'), lines.join('\n'))
}

function shouldIncludeMarkdown(filePath) {
  const base = path.basename(filePath)
  const lowerBase = base.toLowerCase()

  if (!/\.(md|mdx)$/i.test(base)) return false
  if (/^readme(\.|$)/i.test(lowerBase)) return false

  const segments = filePath.split('/')
  if (segments.some((segment) => segment.startsWith('.'))) return false

  return true
}

function listBranches(gitDir) {
  return run(`git --git-dir=${gitDir} for-each-ref --format='%(refname:short)' refs/heads`)
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((branch) => !excludedBranchNames.has(branch))
}

function listMarkdownFiles(gitDir, branch) {
  return run(`git --git-dir=${gitDir} ls-tree -r --name-only refs/heads/${JSON.stringify(branch)}`)
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter(shouldIncludeMarkdown)
}

function getUpdatedYear(gitDir, branch, filePath) {
  const committedAt = run(
    `git --git-dir=${gitDir} log -1 --format=%cI refs/heads/${JSON.stringify(branch)} -- ${JSON.stringify(filePath)}`
  ).trim()
  if (!committedAt) return null

  const year = Number(committedAt.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

function importGeneration({ generation, gitDir, repoName }) {
  if (!fs.existsSync(gitDir)) {
    throw new Error(`missing git dir: ${gitDir}`)
  }

  const generationDir = path.join('content', 'tech-blog-book', `generation-${generation}`)
  const writingsDir = path.join(generationDir, 'writings')

  fs.rmSync(writingsDir, { recursive: true, force: true })
  ensureDir(writingsDir)

  const branches = listBranches(gitDir)

  const levelsSeen = new Set()
  const levelCounts = {}
  const usedDestNames = new Set()
  let totalFiles = 0

  for (const branch of branches) {
    const files = listMarkdownFiles(gitDir, branch)

    const rows = files.map((filePath) => {
      const level = detectLevel(filePath)
      const slug = safeSlug(path.basename(filePath))
      return { filePath, level, slug }
    })

    const grouped = new Map()
    for (const row of rows) {
      const key = `${branch}::${row.level}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(row)
    }

    for (const [key, entries] of grouped.entries()) {
      const [, level] = key.split('::')
      const safeAuthor = safeToken(branch)
      const singleWithoutSlug = entries.length === 1 && level !== 'unclassified'

      entries.sort((a, b) => a.filePath.localeCompare(b.filePath, 'en'))

      for (const entry of entries) {
        const ext = '.md'
        let baseName = singleWithoutSlug
          ? `${level}-${safeAuthor}`
          : `${level}-${safeAuthor}-${entry.slug}`

        let candidate = `${baseName}${ext}`
        let serial = 2
        while (usedDestNames.has(`${level}/${candidate}`)) {
          candidate = `${baseName}-${serial}${ext}`
          serial += 1
        }
        usedDestNames.add(`${level}/${candidate}`)

        const source = buildBlobUrl(repoName, branch, entry.filePath)
        const bodyRaw = run(`git --git-dir=${gitDir} show refs/heads/${JSON.stringify(branch)}:${JSON.stringify(entry.filePath)}`)
        const normalizedBody = stripBom(bodyRaw).replace(/\r\n/g, '\n').trimEnd() + '\n'
        const body = rewriteRelativeReferences(normalizedBody, {
          repoName,
          branchName: branch,
          sourcePath: entry.filePath
        })

        const frontmatter = buildFrontmatter({
          author: branch,
          generation,
          level,
          originalFilename: path.basename(entry.filePath),
          source,
          sourcePath: entry.filePath
        })

        const targetDir = path.join(writingsDir, entry.level)
        const targetPath = path.join(targetDir, candidate)
        writeTextFile(targetPath, `${frontmatter}\n${body}`)

        levelsSeen.add(entry.level)
        levelCounts[entry.level] = (levelCounts[entry.level] ?? 0) + 1
        totalFiles += 1
      }
    }
  }

  createGenerationMeta(generationDir)
  createWritingsMeta(writingsDir, levelsSeen)
  createWritingsIndex(writingsDir, generation, { totalFiles, branchCount: branches.length, levelCounts })
  createGenerationIndex(generationDir, generation, { totalFiles, branchCount: branches.length, levelCounts })

  return {
    generation,
    branchCount: branches.length,
    totalFiles,
    levelCounts
  }
}

function importGenerationsByUpdatedYear({ gitDir, repoName, targetGenerations, resolveGenerationFromYear }) {
  if (!fs.existsSync(gitDir)) {
    throw new Error(`missing git dir: ${gitDir}`)
  }

  const generations = [...new Set(targetGenerations)].sort((a, b) => a - b)
  const generationSet = new Set(generations)
  const generationStates = new Map()

  for (const generation of generations) {
    const generationDir = path.join('content', 'tech-blog-book', `generation-${generation}`)
    const writingsDir = path.join(generationDir, 'writings')

    fs.rmSync(writingsDir, { recursive: true, force: true })
    ensureDir(writingsDir)

    generationStates.set(generation, {
      generation,
      generationDir,
      writingsDir,
      levelsSeen: new Set(),
      levelCounts: {},
      usedDestNames: new Set(),
      totalFiles: 0,
      branches: new Set()
    })
  }

  const branches = listBranches(gitDir)

  for (const branch of branches) {
    const files = listMarkdownFiles(gitDir, branch)

    const rows = []
    for (const filePath of files) {
      const updatedYear = getUpdatedYear(gitDir, branch, filePath)
      if (!updatedYear) continue

      const generation = resolveGenerationFromYear(updatedYear)
      if (!generationSet.has(generation)) continue

      rows.push({
        generation,
        filePath,
        level: detectLevel(filePath),
        slug: safeSlug(path.basename(filePath))
      })
    }

    const grouped = new Map()
    for (const row of rows) {
      const key = `${row.generation}::${row.level}`
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key).push(row)
    }

    for (const [key, entries] of grouped.entries()) {
      const [generationValue, level] = key.split('::')
      const generation = Number(generationValue)
      const state = generationStates.get(generation)
      if (!state) continue

      state.branches.add(branch)

      const safeAuthor = safeToken(branch)
      const singleWithoutSlug = entries.length === 1 && level !== 'unclassified'

      entries.sort((a, b) => a.filePath.localeCompare(b.filePath, 'en'))

      for (const entry of entries) {
        const ext = '.md'
        const baseName = singleWithoutSlug
          ? `${level}-${safeAuthor}`
          : `${level}-${safeAuthor}-${entry.slug}`

        let candidate = `${baseName}${ext}`
        let serial = 2
        while (state.usedDestNames.has(`${level}/${candidate}`)) {
          candidate = `${baseName}-${serial}${ext}`
          serial += 1
        }
        state.usedDestNames.add(`${level}/${candidate}`)

        const source = buildBlobUrl(repoName, branch, entry.filePath)
        const bodyRaw = run(`git --git-dir=${gitDir} show refs/heads/${JSON.stringify(branch)}:${JSON.stringify(entry.filePath)}`)
        const normalizedBody = stripBom(bodyRaw).replace(/\r\n/g, '\n').trimEnd() + '\n'
        const body = rewriteRelativeReferences(normalizedBody, {
          repoName,
          branchName: branch,
          sourcePath: entry.filePath
        })

        const frontmatter = buildFrontmatter({
          author: branch,
          generation,
          level,
          originalFilename: path.basename(entry.filePath),
          source,
          sourcePath: entry.filePath
        })

        const targetDir = path.join(state.writingsDir, entry.level)
        const targetPath = path.join(targetDir, candidate)
        writeTextFile(targetPath, `${frontmatter}\n${body}`)

        state.levelsSeen.add(entry.level)
        state.levelCounts[entry.level] = (state.levelCounts[entry.level] ?? 0) + 1
        state.totalFiles += 1
      }
    }
  }

  const results = []

  for (const generation of generations) {
    const state = generationStates.get(generation)
    if (!state) continue

    const summary = {
      totalFiles: state.totalFiles,
      branchCount: state.branches.size,
      levelCounts: state.levelCounts
    }

    createGenerationMeta(state.generationDir)
    createWritingsMeta(state.writingsDir, state.levelsSeen)
    createWritingsIndex(state.writingsDir, generation, summary)
    createGenerationIndex(state.generationDir, generation, summary)

    results.push({
      generation,
      branchCount: state.branches.size,
      totalFiles: state.totalFiles,
      levelCounts: state.levelCounts
    })
  }

  return results
}

const results = []
for (const config of generationRepoConfigs) {
  const result = importGeneration(config)
  results.push(result)
}

const splitResults = importGenerationsByUpdatedYear(splitGenerationConfig)
results.push(...splitResults)

console.log(JSON.stringify(results, null, 2))
