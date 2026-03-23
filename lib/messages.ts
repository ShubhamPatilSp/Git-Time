// Smart context-aware commit message generator
// Varies vocabulary, avoids repetition, feels human

export interface MessageContext {
  filePath: string
  index: number
  total: number
  previousMessages: string[]
  authorStyle?: 'terse' | 'descriptive' | 'conventional'
}

const EXT_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'react-component', js: 'javascript', jsx: 'react-component',
  py: 'python', go: 'go', rs: 'rust', java: 'java', rb: 'ruby', php: 'php',
  css: 'style', scss: 'style', sass: 'style', less: 'style',
  html: 'template', vue: 'vue-component', svelte: 'svelte-component',
  md: 'docs', mdx: 'docs', txt: 'docs', rst: 'docs',
  json: 'config', yaml: 'config', yml: 'config', toml: 'config', ini: 'config',
  env: 'config', sh: 'script', bash: 'script', zsh: 'script', ps1: 'script',
  sql: 'database', prisma: 'database', graphql: 'api',
  test: 'test', spec: 'test',
  lock: 'lockfile', sum: 'lockfile',
}

const INITIAL_COMMITS = [
  'initial commit',
  'init project',
  'project scaffold',
  'bootstrap application',
  'initial project setup',
]

const CONFIG_VERBS = ['add', 'configure', 'setup', 'init', 'update']
const CODE_VERBS = ['implement', 'add', 'create', 'build', 'write', 'develop']
const REFACTOR_VERBS = ['refactor', 'clean up', 'reorganize', 'restructure', 'simplify']
const FIX_VERBS = ['fix', 'resolve', 'patch', 'correct', 'handle']
const STYLE_VERBS = ['add styles for', 'style', 'design', 'layout']
const DOC_VERBS = ['add docs for', 'document', 'update docs', 'add readme for']
const TEST_VERBS = ['add tests for', 'test', 'add unit tests for', 'add spec for']

function getBaseName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const file = parts[parts.length - 1]
  return file.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}

function getExt(filePath: string): string {
  const parts = filePath.split('.')
  return parts[parts.length - 1]?.toLowerCase() || ''
}

function getFileCategory(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  const ext = getExt(filePath)

  if (normalized.includes('test') || normalized.includes('spec') || normalized.includes('__tests__')) return 'test'
  if (normalized.includes('node_modules')) return 'skip'
  if (ext === 'lock' || normalized.endsWith('package-lock.json') || normalized.endsWith('yarn.lock')) return 'lockfile'
  if (normalized.includes('readme')) return 'readme'
  if (normalized.includes('license')) return 'license'
  if (normalized.includes('docker')) return 'docker'
  if (normalized.includes('github') || normalized.includes('.github')) return 'cicd'
  if (normalized.includes('migration') || normalized.includes('migrate')) return 'database'
  if (normalized.includes('component') || normalized.includes('components/')) return 'component'
  if (normalized.includes('util') || normalized.includes('helper') || normalized.includes('lib/')) return 'util'
  if (normalized.includes('hook') || normalized.includes('hooks/')) return 'hook'
  if (normalized.includes('service') || normalized.includes('services/')) return 'service'
  if (normalized.includes('route') || normalized.includes('router') || normalized.includes('api/')) return 'api'
  if (normalized.includes('store') || normalized.includes('redux') || normalized.includes('zustand')) return 'store'
  if (normalized.includes('type') || normalized.includes('interface') || normalized.includes('d.ts')) return 'types'
  if (normalized.includes('style') || normalized.includes('theme') || normalized.includes('css')) return 'style'
  if (normalized.includes('config') || normalized.includes('.config.') || normalized.includes('rc.')) return 'config'
  if (normalized.includes('middleware')) return 'middleware'
  if (normalized.includes('model') || normalized.includes('schema')) return 'model'
  if (normalized.includes('controller')) return 'controller'
  if (normalized.includes('context')) return 'context'

  return EXT_MAP[ext] || 'file'
}

function pickVerb(verbs: string[], usedMessages: string[]): string {
  const available = verbs.filter(v => !usedMessages.some(m => m.startsWith(v)))
  return available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : verbs[Math.floor(Math.random() * verbs.length)]
}

function conventionalCommit(type: string, scope: string, desc: string): string {
  return `${type}(${scope}): ${desc}`
}

export function generateMessage(ctx: MessageContext): string {
  const { filePath, index, previousMessages, authorStyle = 'descriptive' } = ctx
  const base = getBaseName(filePath)
  const category = getFileCategory(filePath)
  const ext = getExt(filePath)

  // First commit always
  if (index === 0) {
    return INITIAL_COMMITS[Math.floor(Math.random() * INITIAL_COMMITS.length)]
  }

  // Skip lockfiles silently
  if (category === 'lockfile') return 'update dependencies'

  // Conventional commits style
  if (authorStyle === 'conventional') {
    const typeMap: Record<string, string> = {
      test: 'test', config: 'chore', docs: 'docs', readme: 'docs',
      style: 'style', database: 'feat', cicd: 'ci', docker: 'chore',
      api: 'feat', component: 'feat', util: 'feat', hook: 'feat',
      service: 'feat', store: 'feat', types: 'chore', middleware: 'feat',
      model: 'feat', controller: 'feat', context: 'feat',
    }
    const type = typeMap[category] || 'feat'
    const scope = base.split(' ')[0].toLowerCase()
    const descMap: Record<string, string> = {
      test: `add tests for ${base}`,
      config: `add ${base} config`,
      docs: `add ${base} documentation`,
      style: `add ${base} styles`,
      api: `add ${base} endpoint`,
      component: `add ${base} component`,
      util: `add ${base} utility`,
      hook: `add ${base} hook`,
      service: `add ${base} service`,
    }
    return conventionalCommit(type, scope, descMap[category] || `add ${base}`)
  }

  // Terse style
  if (authorStyle === 'terse') {
    const terseMap: Record<string, string[]> = {
      config: [`${base} config`, `configure ${base}`, `add ${base}`],
      test: [`${base} tests`, `test ${base}`],
      style: [`${base} styles`, `style ${base}`],
      docs: [`${base} docs`, `document ${base}`],
      component: [`${base} component`, `add ${base}`],
      api: [`${base} api`, `${base} endpoint`],
      util: [`${base} util`, `${base} helpers`],
    }
    const options = terseMap[category] || [`${base}`, `add ${base}`, `update ${base}`]
    return options[Math.floor(Math.random() * options.length)]
  }

  // Descriptive style (default)
  const rand = Math.random()

  // 5% chance of a "fix" commit for realism
  if (rand < 0.05 && index > 3) {
    const verb = pickVerb(FIX_VERBS, previousMessages)
    return `${verb} ${base} issue`
  }

  // 8% chance of a refactor commit
  if (rand < 0.13 && index > 5) {
    const verb = pickVerb(REFACTOR_VERBS, previousMessages)
    return `${verb} ${base}`
  }

  const messageMap: Record<string, () => string> = {
    config: () => `${pickVerb(CONFIG_VERBS, previousMessages)} ${base} configuration`,
    test: () => `${pickVerb(TEST_VERBS, previousMessages)} ${base}`,
    style: () => `${pickVerb(STYLE_VERBS, previousMessages)} ${base}`,
    docs: () => `${pickVerb(DOC_VERBS, previousMessages)} ${base}`,
    readme: () => `add project readme`,
    license: () => `add license`,
    docker: () => `add docker configuration`,
    cicd: () => `add CI/CD pipeline`,
    database: () => `add ${base} migration`,
    component: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} component`,
    util: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} utilities`,
    hook: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} hook`,
    service: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} service`,
    api: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} endpoint`,
    store: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} store`,
    types: () => `add ${base} type definitions`,
    middleware: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} middleware`,
    model: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} model`,
    controller: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} controller`,
    context: () => `${pickVerb(CODE_VERBS, previousMessages)} ${base} context`,
  }

  const fn = messageMap[category]
  if (fn) return fn()

  // Generic fallback based on ext
  const verb = pickVerb(CODE_VERBS, previousMessages)
  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) return `${verb} ${base} module`
  if (['py', 'go', 'rs', 'java', 'rb'].includes(ext)) return `${verb} ${base}`
  if (['html', 'vue', 'svelte'].includes(ext)) return `${verb} ${base} template`

  return `${verb} ${base}`
}

// Sort files in realistic commit order
export function sortFilesRealistically(files: string[]): string[] {
  const order: Record<string, number> = {
    config: 0,    // package.json, tsconfig etc first
    lockfile: 1,  // lock files right after
    docker: 2,    // docker/ci setup
    cicd: 3,
    types: 4,     // type definitions
    database: 5,  // db/schema
    model: 6,     // models
    util: 7,      // utilities
    service: 8,   // services
    api: 9,       // api routes
    store: 10,    // state management
    hook: 11,     // hooks
    context: 12,  // context
    middleware: 13,
    controller: 14,
    component: 15, // UI components
    style: 16,    // styles
    template: 17, // html templates
    test: 18,     // tests near end
    docs: 19,     // docs last
    readme: 20,
    license: 21,
  }

  return [...files].sort((a, b) => {
    const catA = getFileCategory(a)
    const catB = getFileCategory(b)
    const orderA = order[catA] ?? 10
    const orderB = order[catB] ?? 10
    if (orderA !== orderB) return orderA - orderB
    return a.localeCompare(b)
  })
}

// Files to always skip
const SKIP_PATTERNS = [
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage',
  '.DS_Store', 'Thumbs.db', '.env.local', '.env.production',
  '__pycache__', '.pytest_cache', 'venv', '.venv',
  '.turbo', '.vercel', '.netlify',
]

const SKIP_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp',
  'mp4', 'mp3', 'wav', 'avi', 'mov',
  'zip', 'tar', 'gz', 'rar', '7z',
  'exe', 'dll', 'so', 'dylib',
  'pyc', 'pyo', 'class',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
]

export function shouldSkipFile(filePath: string, excludeFolders: string[] = []): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  const ext = getExt(filePath)

  // Check skip patterns
  for (const pattern of [...SKIP_PATTERNS, ...excludeFolders]) {
    if (normalized.includes(`/${pattern}/`) || normalized.includes(`/${pattern}`) || normalized.startsWith(pattern)) {
      return true
    }
  }

  // Check skip extensions
  if (SKIP_EXTENSIONS.includes(ext)) return true

  // Skip very large indicator files
  if (normalized.endsWith('package-lock.json')) return true
  if (normalized.endsWith('yarn.lock')) return true
  if (normalized.endsWith('pnpm-lock.yaml')) return true

  return false
}
