# Contributing to GitTime

Thank you for your interest in contributing to **GitTime**! We welcome contributions from developers of all skill levels. Whether you are fixing a bug, adding a new feature, improving documentation, or suggesting new ideas, your help is appreciated.

---

## 💡 Ways You Can Contribute

You can contribute to GitTime in many ways:

1. **🐛 Report Bugs & Issues**: Found a bug or unexpected behavior? Open an issue on GitHub with detailed steps to reproduce it.
2. **💡 Propose New Features**: Have an idea for a new activity pattern, anti-detection algorithm, or export format? Share your feature request in GitHub Discussions or Issues.
3. **💻 Submit Code & Pull Requests**: Pick up an open issue or implement a requested feature (e.g., new commit styles, UI improvements, performance optimizations).
4. **📖 Improve Documentation**: Help improve the README, comments, code documentation, or setup instructions.
5. **🎨 UI & Design Polish**: Suggest or build enhancements for responsiveness, micro-animations, or dark-mode theme aesthetics.
6. **⭐ Star and Share**: Spread the word about GitTime in the open-source community!

---

## 🛠️ Getting Started Locally

### 1. Prerequisites
- **Node.js** (v18.x or higher)
- **Git** installed on your host machine
- **MongoDB** (Local instance or MongoDB Atlas free cluster)
- **GitHub Account** (to set up OAuth login)

### 2. Fork and Clone
```bash
git clone https://github.com/ShubhamPatilSp/Git-Time.git
cd Git-Time
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Copy the `.env.example` file to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the required values:
- `GITHUB_ID` and `GITHUB_SECRET` (from GitHub Developer Settings -> OAuth Apps)
- `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
- `MONGODB_URI` (your MongoDB connection string)
- `GROQ_API_KEY` (optional, for AI commit message generation)
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` (optional, for payments)

### 5. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌿 Branching & Development Workflow

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
2. Make your changes and test thoroughly.
3. Ensure TypeScript type checking passes without errors:
   ```bash
   npx tsc --noEmit
   ```
4. Commit your changes with meaningful commit messages (following conventional commits):
   ```bash
   git commit -m "feat(generator): add support for custom branch naming"
   ```
5. Push to your branch and submit a Pull Request!

---

## 📝 Pull Request Guidelines

- **Clear Description**: Explain the problem being solved or the feature added.
- **No Secrets**: Ensure no API keys, private tokens, or personal identifiers are committed.
- **Type Safety**: Maintain strict TypeScript typing.
- **Clean Code**: Follow existing project architecture and conventions.

---

## 📄 License
By contributing to GitTime, you agree that your contributions will be licensed under the [MIT License](LICENSE).
