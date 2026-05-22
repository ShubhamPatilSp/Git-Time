# GitTime v2.0 — Undetectable Commit History Generator

Transform any completed project into a realistic, human-like Git commit history.

## What's New in v2.0

- **5-step wizard UI** — guided flow with live preview
- **GitHub heatmap preview** — see your contribution graph before generating
- **6 activity patterns** — Active Sprint, Side Project, Daily Grind, Weekend Warrior, Crunch Mode, Casual
- **3 commit message styles** — Descriptive, Terse, Conventional Commits
- **Multi-author support** — up to 3 authors with configurable commit share
- **Direct GitHub push** — push straight to a new repo using a Personal Access Token
- **Anti-detection engine** — Poisson-distributed commits, author/committer date offset, realistic working hours, merge commit injection
- **Smart file ordering** — config → types → utils → services → components → tests → docs
- **Auto-exclusion** — node_modules, dist, build, .next, lock files, binaries, images
- **Weekdays-only mode** — skip Saturday/Sunday for professional appearance
- **Custom date range** — pick exact start and end dates
- **Custom branch name** — main, master, or any name

## Setup

```bash
unzip gittime-v2.zip
cd gittime
npm install
npm run dev
# Open http://localhost:3000
```

**Requirements:** Node.js 18+, Git installed on host machine.

## How It Works

### Step 1 — Identity
Set your name + email (must match GitHub account email). Optionally add co-authors with weight sliders. Add a GitHub PAT for direct push.

### Step 2 — Upload
Drag & drop your project ZIP (max 250MB for Pro / 50MB for Free). The engine auto-excludes binaries, lock files, and build artifacts.

### Step 3 — Timeline
Pick start/end dates and an activity pattern. The heatmap preview updates live.

### Step 4 — Style
Choose commit message style, branch name, and whether to inject merge commits.

### Step 5 — Generate & Export
Download the ZIP or push directly to GitHub.

## Anti-Detection Techniques

1. **Non-uniform timing** — commits use hour-weighted distributions (morning/afternoon/night peaks per pattern), never perfectly spaced
2. **Author ≠ committer date** — committer timestamp is 1-3 min after author timestamp, like real git rebases
3. **Variable daily density** — Poisson-like distribution means some days have 0 commits, some have 8+
4. **Realistic file order** — config files committed first, tests and docs last
5. **Context-aware messages** — TypeScript files get `implement X module`, CSS gets `add styles for X`, avoids verb repetition
6. **Merge commits** — injected every 5-9 commits to simulate branch workflow
7. **Weekday bias** — patterns have different weekday/weekend probabilities

## GitHub PAT Setup

1. Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Check the `repo` scope
4. Copy the token and paste it in GitTime Step 1

## File Structure

```
gittime/
├── app/
│   ├── page.tsx                      ← Full 5-step wizard UI
│   ├── globals.css                   ← Terminal-green design system
│   ├── layout.tsx
│   └── api/
│       ├── upload/route.ts           ← POST: save + extract ZIP
│       ├── generate/route.ts         ← POST: full commit generation
│       ├── download/[filename]/      ← GET: stream output ZIP
│       └── github/
│           ├── validate/route.ts     ← POST: verify PAT token
│           └── push/route.ts         ← POST: create repo + push
├── lib/
│   ├── generator.ts                  ← Core git engine
│   ├── patterns.ts                   ← Activity pattern definitions + scheduling
│   ├── messages.ts                   ← Smart commit message generator
│   └── github.ts                     ← Octokit GitHub API wrapper
└── package.json
```
