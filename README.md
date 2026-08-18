# ⏳ GitTime — Realistic Git Commit History & Timeline Generator

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

**GitTime** transforms any finished codebase into an organic, indistinguishable, human-like Git commit history. Whether you want to simulate months of agile development, backdate commits across realistic working hours, inject pull request feature branches, or generate context-aware AI commit messages, GitTime handles it automatically.

---

## 🌟 Key Features

- **Interactive 5-Step Wizard**: Guided setup with live contribution heatmap previews.
- **AI-Powered Commit Messages**: Context-aware commit messages generated using LLMs (Groq / Llama 3.1) by AST-analyzing real file snippets.
- **Anti-Detection Realism Engine**:
  - Poisson-distributed daily commit density with authentic gaps.
  - Realistic developer working hour distributions (Morning, Business Hours, Night Owl).
  - Author vs. Committer timestamp offsets (simulating authentic rebase/merge timestamps).
  - Smart chronological file order: Config & Schema → Types → Utils → Services → UI Components → Tests & Documentation.
  - Simulated Feature Branches & PR Merges with `Co-authored-by` git trailer support.
- **6 Activity Patterns**: Active Sprint, Side Project, Daily Grind, Weekend Warrior, Crunch Mode, and Casual.
- **Direct GitHub Integration**: Authenticate via GitHub OAuth and push created repositories straight to your GitHub profile.
- **Multi-Author Collaboration**: Distribute commits across up to 3 authors with custom timezone settings and weight sliders.

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js** 18+ installed
- **Git** installed and available in system `PATH`
- **MongoDB** instance (Atlas URI or local `mongodb://localhost:27017`)

### 1. Clone the Repository
```bash
git clone https://github.com/ShubhamPatilSp/Git-Time.git
cd Git-Time
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your configuration keys:
```env
GITHUB_ID=your_github_oauth_client_id
GITHUB_SECRET=your_github_oauth_client_secret
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/gittime
GROQ_API_KEY=your_groq_api_key
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY=your_web3forms_key
```

### 4. Start Development Server
```bash
npm run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Environment Variables Reference

| Variable | Required | Description |
| :--- | :---: | :--- |
| `GITHUB_ID` | **Yes** | GitHub OAuth Application Client ID |
| `GITHUB_SECRET` | **Yes** | GitHub OAuth Application Client Secret |
| `NEXTAUTH_SECRET` | **Yes** | NextAuth JWT encryption secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | **Yes** | Canonical app URL (e.g., `http://localhost:3000`) |
| `MONGODB_URI` | **Yes** | MongoDB connection string (Atlas or Local) |
| `GROQ_API_KEY` | Optional | Groq Cloud API Key for AI commit generation |
| `RAZORPAY_KEY_ID` | Optional | Razorpay Key ID for subscription billing |
| `RAZORPAY_KEY_SECRET` | Optional | Razorpay Key Secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Optional | Public Razorpay Key ID for client-side modal |
| `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` | Optional | Web3Forms access key for the support form |

<<<<<<< HEAD
### Step 2 — Upload
Drag & drop your project ZIP (max 250MB for Pro / 50MB for Free). The engine auto-excludes binaries, lock files, and build artifacts.
=======
---
>>>>>>> f2f0148 (feat: prepare repository for open source release and sanitize secrets)

## 📂 Project Architecture

```text
gittime/
├── app/
│   ├── api/                          # Next.js Serverless API Route handlers
│   │   ├── auth/[...nextauth]/       # NextAuth authentication provider
│   │   ├── generate/                 # Git repository generation background worker
│   │   ├── github/                   # GitHub token validation and push endpoints
│   │   ├── razorpay/                 # Razorpay order, verify & webhook handlers
│   │   └── upload/                   # Project ZIP extraction & ingestion
│   ├── components/                   # UI components & wizard layout
│   │   └── wizard/                   # 5-step wizard steps & heatmap preview
│   ├── globals.css                   # Tailwind and cyber-terminal styling system
│   ├── layout.tsx                    # Root layout & providers
│   └── page.tsx                      # Main landing & wizard experience
├── lib/
│   ├── ai.ts                         # Groq AST batch analysis and AI commit generator
│   ├── auth.ts                       # NextAuth session configuration and user callbacks
│   ├── db.ts                         # Mongoose connection manager with global cache
│   ├── generator.ts                  # Core Git simulation engine & feature branch manager
│   ├── geo.ts                        # Geo-based pricing and tier limits
│   ├── github.ts                     # Octokit API wrapper & remote push utility
│   ├── messages.ts                   # Context-aware fallback message generator
│   └── patterns.ts                   # Activity pattern definitions & Poisson scheduling
├── models/
│   ├── Job.ts                        # Job tracking schema for asynchronous generation
│   └── User.ts                       # User plan & monthly quota tracking schema
├── public/                           # Static assets, logos & output directory
├── .env.example                      # Environment configuration template
├── package.json
└── tsconfig.json
```

---

## 🛡️ Anti-Detection Simulation Details

1. **Non-Uniform Poisson Scheduling**: Commits vary in density day-by-day rather than rigid flat curves.
2. **Author ≠ Committer Offset**: Committer timestamps trail author dates by 1–3 minutes, perfectly matching natural Git workflows.
3. **Realistic Working Hours**: Commits are distributed across typical dev hours in the author's configured timezone.
4. **Context-Aware Vocabulary**: Uses file-specific conventions (`feat(auth):`, `fix(ui):`, `refactor:`, `test:`).
5. **Feature Branching & Merges**: Injects authentic feature branch merges with `--no-ff` history.

---

## 🤝 Contributing

We love contributions! Whether you want to add new activity patterns, improve anti-detection heuristics, fix a bug, or enhance the UI, check out **[CONTRIBUTING.md](CONTRIBUTING.md)** to see how you can get started:

- 🐛 **Report a Bug**: Open an issue describing the problem.
- 💡 **Suggest an Idea**: Propose new patterns or features.
- 🛠️ **Submit a PR**: Follow the step-by-step local setup and pull request guide.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
