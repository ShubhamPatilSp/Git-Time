/**
 * test-api-push-v2.mjs — Test MULTIPLE approaches in one script
 * 
 * Approach A: auto_init + update ref (already tested — fails)
 * Approach B: auto_init + create NEW branch (not update) — does this avoid pushed_at update?
 * Approach C: auto_init + change default_branch via PATCH repo settings — does settings change affect pushed_at?
 * Approach D: Contents API with backdated committer — does it accept dates?
 * 
 * Usage: node test-api-push-v2.mjs <GITHUB_TOKEN>
 */

const TOKEN = process.argv[2]
if (!TOKEN) { console.error('Usage: node test-api-push-v2.mjs <TOKEN>'); process.exit(1) }

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
}

const TWO_MONTHS_AGO = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function api(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${data.message || 'error'}`)
  return data
}

async function deleteRepo(owner, name) {
  await fetch(`https://api.github.com/repos/${owner}/${name}`, { method: 'DELETE', headers }).catch(() => {})
}

async function getTimestamps(owner, name) {
  const r = await api('GET', `/repos/${owner}/${name}`)
  return { created_at: r.created_at, pushed_at: r.pushed_at, updated_at: r.updated_at }
}

async function createBackdatedCommit(owner, repo) {
  const blob = await api('POST', `/repos/${owner}/${repo}/git/blobs`, {
    content: Buffer.from('# Test Project\nCreated to test timestamps.\n').toString('base64'),
    encoding: 'base64',
  })
  const tree = await api('POST', `/repos/${owner}/${repo}/git/trees`, {
    tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: blob.sha }],
  })
  const commit = await api('POST', `/repos/${owner}/${repo}/git/commits`, {
    message: 'initial setup',
    tree: tree.sha,
    parents: [],
    author: { name: 'dev', email: 'dev@test.com', date: TWO_MONTHS_AGO },
    committer: { name: 'dev', email: 'dev@test.com', date: TWO_MONTHS_AGO },
  })
  return commit
}

async function run() {
  const user = await api('GET', '/user')
  const owner = user.login
  const results = []
  
  results.push(`\nTesting with user: ${owner}`)
  results.push(`Target date: ${TWO_MONTHS_AGO}`)
  results.push(`Current time: ${new Date().toISOString()}`)
  results.push('='.repeat(60))

  // ─── APPROACH B: Create NEW branch (not update existing) ───
  const repoB = `gt-test-branch-${Date.now()}`
  results.push(`\n--- APPROACH B: Create NEW branch on separate ref ---`)
  try {
    await api('POST', '/user/repos', { name: repoB, private: true, auto_init: true })
    await sleep(2000)
    const before = await getTimestamps(owner, repoB)
    results.push(`BEFORE: pushed_at=${before.pushed_at}`)
    
    const commit = await createBackdatedCommit(owner, repoB)
    
    // Create a NEW branch (not update main)
    await api('POST', `/repos/${owner}/${repoB}/git/refs`, {
      ref: 'refs/heads/old-feature',
      sha: commit.sha,
    })
    
    await sleep(5000)
    const after = await getTimestamps(owner, repoB)
    results.push(`AFTER new branch: pushed_at=${after.pushed_at}`)
    results.push(`pushed_at changed? ${before.pushed_at !== after.pushed_at ? 'YES ❌' : 'NO ✅'}`)
  } catch (e) { results.push(`ERROR: ${e.message}`) }
  finally { await deleteRepo(owner, repoB) }

  // ─── APPROACH C: Change default_branch after creating backdated branch ───
  const repoC = `gt-test-default-${Date.now()}`
  results.push(`\n--- APPROACH C: Change default_branch via PATCH settings ---`)
  try {
    await api('POST', '/user/repos', { name: repoC, private: true, auto_init: true })
    await sleep(2000)
    const before = await getTimestamps(owner, repoC)
    results.push(`BEFORE: pushed_at=${before.pushed_at}`)
    
    const commit = await createBackdatedCommit(owner, repoC)
    
    // Create new branch with old commits
    await api('POST', `/repos/${owner}/${repoC}/git/refs`, {
      ref: 'refs/heads/legacy',
      sha: commit.sha,
    })
    
    // Change default branch to the new one via repo settings
    await api('PATCH', `/repos/${owner}/${repoC}`, {
      default_branch: 'legacy',
    })
    
    // Delete old main branch
    try {
      await fetch(`https://api.github.com/repos/${owner}/${repoC}/git/refs/heads/main`, {
        method: 'DELETE', headers
      })
    } catch {}
    
    await sleep(5000)
    const after = await getTimestamps(owner, repoC)
    results.push(`AFTER default_branch change: pushed_at=${after.pushed_at}`)
    results.push(`pushed_at changed? ${before.pushed_at !== after.pushed_at ? 'YES ❌' : 'NO ✅'}`)
  } catch (e) { results.push(`ERROR: ${e.message}`) }
  finally { await deleteRepo(owner, repoC) }

  // ─── APPROACH D: Contents API with committer date ───
  const repoD = `gt-test-contents-${Date.now()}`
  results.push(`\n--- APPROACH D: Contents API with backdated committer ---`)
  try {
    await api('POST', '/user/repos', { name: repoD, private: true, auto_init: true })
    await sleep(2000)
    const before = await getTimestamps(owner, repoD)
    results.push(`BEFORE: pushed_at=${before.pushed_at}`)
    
    // Try Contents API with date in committer (may not be supported)
    try {
      await api('PUT', `/repos/${owner}/${repoD}/contents/test.md`, {
        message: 'add test file',
        content: Buffer.from('# test').toString('base64'),
        committer: { name: 'dev', email: 'dev@test.com', date: TWO_MONTHS_AGO },
        author: { name: 'dev', email: 'dev@test.com', date: TWO_MONTHS_AGO },
      })
      results.push(`Contents API accepted date field!`)
    } catch (e) {
      results.push(`Contents API date field: ${e.message}`)
    }
    
    await sleep(3000)
    const after = await getTimestamps(owner, repoD)
    results.push(`AFTER contents API: pushed_at=${after.pushed_at}`)
    
    // Check the actual commit date
    try {
      const commits = await api('GET', `/repos/${owner}/${repoD}/commits?per_page=1`)
      if (commits[0]) {
        results.push(`Last commit date: ${commits[0].commit.committer.date}`)
      }
    } catch {}
  } catch (e) { results.push(`ERROR: ${e.message}`) }
  finally { await deleteRepo(owner, repoD) }

  // ─── APPROACH E: Force push old-dated commits via git data, then DON'T touch ref ───
  const repoE = `gt-test-notouchref-${Date.now()}`
  results.push(`\n--- APPROACH E: Create backdated commits, DON'T update main ref ---`)
  results.push(`(Just create objects, see if pushed_at stays the same)`)
  try {
    await api('POST', '/user/repos', { name: repoE, private: true, auto_init: true })
    await sleep(2000)
    const before = await getTimestamps(owner, repoE)
    results.push(`BEFORE: pushed_at=${before.pushed_at}`)
    
    // Just create git objects but don't touch any ref
    const blob = await api('POST', `/repos/${owner}/${repoE}/git/blobs`, {
      content: Buffer.from('test content').toString('base64'),
      encoding: 'base64',
    })
    const tree = await api('POST', `/repos/${owner}/${repoE}/git/trees`, {
      tree: [{ path: 'test.md', mode: '100644', type: 'blob', sha: blob.sha }],
    })
    const commit = await api('POST', `/repos/${owner}/${repoE}/git/commits`, {
      message: 'old commit',
      tree: tree.sha,
      parents: [],
      author: { name: 'dev', email: 'dev@test.com', date: TWO_MONTHS_AGO },
      committer: { name: 'dev', email: 'dev@test.com', date: TWO_MONTHS_AGO },
    })
    results.push(`Created orphan commit: ${commit.sha} (date: ${commit.author.date})`)
    
    await sleep(3000)
    const after = await getTimestamps(owner, repoE)
    results.push(`AFTER creating objects only: pushed_at=${after.pushed_at}`)
    results.push(`pushed_at changed? ${before.pushed_at !== after.pushed_at ? 'YES ❌' : 'NO ✅'}`)
  } catch (e) { results.push(`ERROR: ${e.message}`) }
  finally { await deleteRepo(owner, repoE) }

  // Write results
  const { writeFileSync } = await import('fs')
  const output = results.join('\n')
  writeFileSync('test-api-push-v2-results.txt', output)
  console.log(output)
  console.log('\nResults saved to: test-api-push-v2-results.txt')
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
