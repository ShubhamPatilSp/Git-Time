/**
 * test-api-push.mjs
 * 
 * Tests whether GitHub's Git Data API can bypass the `pushed_at` timestamp.
 * 
 * What it does:
 * 1. Creates a new empty repo on your GitHub
 * 2. Creates a blob, tree, and commit with a date from 2 MONTHS AGO via API
 * 3. Creates a ref (refs/heads/main) pointing to that commit via API
 * 4. Waits a few seconds for GitHub to process
 * 5. Fetches the repo metadata and checks `pushed_at`, `updated_at`, `created_at`
 * 6. Cleans up by deleting the test repo
 * 
 * Usage:
 *   node test-api-push.mjs <YOUR_GITHUB_TOKEN>
 * 
 * The token needs: repo (full control) scope — or for fine-grained: 
 *   Contents (write), Administration (write) permissions
 */

const TOKEN = process.argv[2]

if (!TOKEN) {
  console.error('\n❌ Usage: node test-api-push.mjs <GITHUB_TOKEN>\n')
  console.error('  Get a token from: https://github.com/settings/tokens')
  console.error('  Required scope: "repo" (full control)\n')
  process.exit(1)
}

const REPO_NAME = `gittime-api-test-${Date.now()}`
const TWO_MONTHS_AGO = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
}

async function api(method, path, body) {
  const url = `https://api.github.com${path}`
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) {
    console.error(`❌ API Error: ${method} ${path}`)
    console.error(`   Status: ${res.status}`)
    console.error(`   Response:`, JSON.stringify(data, null, 2))
    throw new Error(`API call failed: ${res.status}`)
  }
  return data
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  console.log('\n🔬 GitHub Git Data API — pushed_at Timestamp Test')
  console.log('='.repeat(55))

  // Step 0: Get authenticated user
  console.log('\n📋 Step 0: Getting authenticated user...')
  const user = await api('GET', '/user')
  console.log(`   ✓ Logged in as: ${user.login}`)

  // Step 1: Create repo WITH auto_init (GitHub needs an initial commit for the Git Data API to work)
  console.log(`\n📦 Step 1: Creating repo "${REPO_NAME}" with initial commit...`)
  const repo = await api('POST', '/user/repos', {
    name: REPO_NAME,
    private: true,
    auto_init: true,     // Need initial commit so Git Data API works
    description: 'GitTime API push test — will be deleted',
  })
  console.log(`   ✓ Repo created: ${repo.html_url}`)
  console.log(`   ✓ created_at (initial):  ${repo.created_at}`)
  console.log(`   ✓ pushed_at (initial):   ${repo.pushed_at}`)
  console.log(`   ✓ updated_at (initial):  ${repo.updated_at}`)

  // Wait a moment for GitHub to fully initialize
  await sleep(2000)

  try {
    // Step 2: Create blobs (file contents)
    console.log('\n📄 Step 2: Creating blobs...')
    const readmeBlob = await api('POST', `/repos/${user.login}/${REPO_NAME}/git/blobs`, {
      content: Buffer.from(`# My Project\n\nA lightweight expense tracking application.\n\n## Getting Started\n\nnpm install\nnpm run dev\n`).toString('base64'),
      encoding: 'base64',
    })
    console.log(`   ✓ README blob SHA: ${readmeBlob.sha}`)

    const pkgBlob = await api('POST', `/repos/${user.login}/${REPO_NAME}/git/blobs`, {
      content: Buffer.from(JSON.stringify({ name: 'my-project', version: '1.0.0', private: true, scripts: { dev: 'next dev', build: 'next build' } }, null, 2)).toString('base64'),
      encoding: 'base64',
    })
    console.log(`   ✓ package.json blob SHA: ${pkgBlob.sha}`)

    // Step 3: Create a tree referencing the blobs
    console.log('\n🌲 Step 3: Creating tree...')
    const tree = await api('POST', `/repos/${user.login}/${REPO_NAME}/git/trees`, {
      tree: [
        { path: 'README.md', mode: '100644', type: 'blob', sha: readmeBlob.sha },
        { path: 'package.json', mode: '100644', type: 'blob', sha: pkgBlob.sha },
      ],
    })
    console.log(`   ✓ Tree SHA: ${tree.sha}`)

    // Step 4: Create a commit with a date from 2 MONTHS AGO
    console.log(`\n💾 Step 4: Creating commit dated 2 months ago...`)
    console.log(`   Target date: ${TWO_MONTHS_AGO}`)
    const commit = await api('POST', `/repos/${user.login}/${REPO_NAME}/git/commits`, {
      message: 'initial project setup',
      tree: tree.sha,
      parents: [],   // root commit (orphan — replaces history)
      author: {
        name: user.login,
        email: `${user.login}@users.noreply.github.com`,
        date: TWO_MONTHS_AGO,
      },
      committer: {
        name: user.login,
        email: `${user.login}@users.noreply.github.com`,
        date: TWO_MONTHS_AGO,
      },
    })
    console.log(`   ✓ Commit SHA: ${commit.sha}`)
    console.log(`   ✓ Author date:    ${commit.author.date}`)
    console.log(`   ✓ Committer date: ${commit.committer.date}`)

    // Step 5: Update the existing ref to point to our backdated commit (force update)
    console.log('\n🔗 Step 5: Updating ref (refs/heads/main) to backdated commit...')
    const ref = await api('PATCH', `/repos/${user.login}/${REPO_NAME}/git/refs/heads/main`, {
      sha: commit.sha,
      force: true,   // Force because we're replacing history
    })
    console.log(`   ✓ Ref updated: ${ref.ref} → ${ref.object.sha}`)

    // Step 6: Wait for GitHub to process
    console.log('\n⏳ Step 6: Waiting 8 seconds for GitHub to process...')
    await sleep(8000)

    // Step 7: Check timestamps
    console.log('\n🔍 Step 7: Checking repo timestamps...')
    const updatedRepo = await api('GET', `/repos/${user.login}/${REPO_NAME}`)
    
    const createdAt = new Date(updatedRepo.created_at)
    const pushedAt = new Date(updatedRepo.pushed_at)
    const updatedAt = new Date(updatedRepo.updated_at)
    const targetDate = new Date(TWO_MONTHS_AGO)
    const now = new Date()

    // Calculate how far pushed_at is from the target date vs current time
    const diffFromTarget = Math.abs(pushedAt - targetDate) / (1000 * 60)  // minutes
    const diffFromNow = Math.abs(pushedAt - now) / (1000 * 60)  // minutes

    // Write clean results to a file
    const { writeFileSync } = await import('fs')
    const results = [
      '='.repeat(55),
      'RESULTS',
      '='.repeat(55),
      `Target date (2 months ago): ${TWO_MONTHS_AGO}`,
      `Current time:               ${now.toISOString()}`,
      '',
      `created_at:  ${updatedRepo.created_at}`,
      `pushed_at:   ${updatedRepo.pushed_at}`,
      `updated_at:  ${updatedRepo.updated_at}`,
      '',
      `diffFromTarget (minutes): ${Math.round(diffFromTarget)}`,
      `diffFromNow (minutes):    ${Math.round(diffFromNow)}`,
      '',
    ]

    if (diffFromTarget < 60) {
      results.push('SUCCESS! pushed_at matches the OLD commit date!')
      results.push('The Git Data API approach WORKS!')
    } else if (diffFromNow < 10) {
      results.push('FAILED: pushed_at is set to NOW (current time)')
      results.push('Even the Git Data API updates pushed_at to the server time')
      results.push('FALLBACK: Making repos private is the guaranteed solution.')
    } else {
      results.push(`UNCLEAR: pushed_at is ${Math.round(diffFromNow)} min from now, ${Math.round(diffFromTarget)} min from target`)
    }
    
    const resultText = results.join('\n')
    writeFileSync('test-api-push-results.txt', resultText)
    console.log('\n' + resultText)
    console.log('\n Results also saved to: test-api-push-results.txt')

    // Also test: Does contribution graph work?
    console.log('\n📈 Checking if the commit appears in contribution graph...')
    console.log('   → The contribution graph takes a few minutes to update.')
    console.log(`   → Check: https://github.com/${user.login}`)
    console.log(`   → Look for a green dot on: ${targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)
    console.log(`   → Make sure "Private contributions" is enabled in your profile settings!`)

  } finally {
    // Cleanup: Delete the test repo
    console.log(`\n🧹 Cleaning up: Deleting repo "${REPO_NAME}"...`)
    try {
      await fetch(`https://api.github.com/repos/${user.login}/${REPO_NAME}`, {
        method: 'DELETE',
        headers,
      })
      console.log('   ✓ Test repo deleted')
    } catch (e) {
      console.log(`   ⚠ Could not delete repo. Delete manually: https://github.com/${user.login}/${REPO_NAME}/settings`)
    }
  }

  console.log('\n✅ Test complete!\n')
}

run().catch(err => {
  console.error('\n💥 Fatal error:', err.message)
  process.exit(1)
})
