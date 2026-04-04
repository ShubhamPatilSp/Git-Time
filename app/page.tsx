'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useSession, signIn, signOut } from "next-auth/react"
import { WizardProvider, useWizard, STEPS, WizardStep } from './components/wizard/WizardContext'
import { StepIdentity } from './components/wizard/StepIdentity'
import { StepUpload } from './components/wizard/StepUpload'
import { StepTimeline } from './components/wizard/StepTimeline'
import { StepStyle } from './components/wizard/StepStyle'
import { StepGenerate } from './components/wizard/StepGenerate'
import { HeatmapPreview } from './components/wizard/HeatmapPreview'

function WizardLayout() {
  const { data: session, status } = useSession()
  const isPro = !!(session?.user as any)?.isPro

  const {
    step, setStep, stage, setStage, errorMsg, setErrorMsg,
    file, sessionId, setSessionId, setFile, uploadFile,
    fileCount, startDate, endDate, pattern, weekdaysOnly,
    toggledOffDates, setToggledOffDates, timezone, injectPRMerges,
    addMergeCommits, result, visibleCommits, authors, setAuthors, githubToken
  } = useWizard()

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportFormStatus, setSupportFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [repoName, setRepoName] = useState('')
  const [pricing, setPricing] = useState<any>(null)
  const runsThisMonth = (session?.user as any)?.runsThisMonth || 0
  const maxRuns = (session?.user as any)?.maxRuns || 3
  const maxCommits = (session?.user as any)?.maxCommits || 100
  const freeCommitsUsed = (session?.user as any)?.freeCommitsUsed || 0
  const creditsExhausted = (freeCommitsUsed + fileCount > maxCommits) || (runsThisMonth >= maxRuns)

  // Fetch geo-based pricing
  useEffect(() => {
    fetch('/api/pricing').then(r => r.json()).then(setPricing).catch(() => {})
  }, [])

  // Auto-fill author email from GitHub if available
  useEffect(() => {
    if (session?.user && authors[0].name === '' && authors[0].email === '') {
      setAuthors(prev => prev.map((a, i) => i === 0 ? {
        ...a,
        name: session.user?.name || session.user?.email?.split('@')[0] || 'Developer',
        email: session.user?.email || 'dev@example.com',
        timezone: a.timezone || (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' } })()
      } : a))
      setRepoName('my-project')
    }
  }, [session, authors, setAuthors])

  const handleUpgrade = async () => {
    try {
      const orderRes = await fetch('/api/razorpay/order', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) { alert(orderData.error || 'Could not initiate payment. Please try again.'); return }

      const rzpKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
      if (!rzpKey) { alert('Payment configuration error. Contact support.'); return }

      const options = {
        key: rzpKey,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: 'GitTime Pro',
        description: `Pro Monthly Subscription`,
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              planType: 'monthly',
            }),
          })
          const verifyData = await verifyRes.json()
          if (verifyData.success) {
            setShowUpgradeModal(false)
            window.location.reload()
          } else {
            alert('Payment verification failed. Contact support.')
          }
        },
        prefill: { email: session?.user?.email || '' },
        theme: { color: '#00ff87' },
        modal: {
          ondismiss: () => {
            console.log('Razorpay checkout dismissed by user')
          }
        },
      }

      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', (response: any) => {
        console.error('Razorpay payment failed:', response.error)
        alert(`Payment failed: ${response.error?.description || 'Unknown error'}`)
      })
      rzp.open()
    } catch (err: any) {
      console.error('Razorpay checkout error:', err)
      alert(`Something went wrong: ${err?.message || 'Please try again.'}`)
    }
  }

  const canProceed = () => {
    if (step === 1) return authors[0].name.trim() !== '' && authors[0].email.trim() !== ''
    if (step === 2) return sessionId !== null
    if (step === 3) return startDate && endDate && new Date(startDate) < new Date(endDate) && fileCount <= maxCommits
    if (step === 4) return true // Branch name handles internally or defaulting
    return false
  }

  const stepContent = [
    null,
    () => <StepIdentity setShowUpgradeModal={setShowUpgradeModal} />,
    () => <StepUpload />,
    () => <StepTimeline />,
    () => <StepStyle setShowUpgradeModal={setShowUpgradeModal} />,
    () => <StepGenerate setShowUpgradeModal={setShowUpgradeModal} />
  ]

  const renderUpgradeModal = () => !showUpgradeModal ? null : (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-[#0f0f17] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-[80px] opacity-30" style={{ background: 'radial-gradient(circle, #00ff87, #00d4ff)' }} />
        <div className="relative p-8">
          <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">✕</button>

          <div className="text-center mb-6">
            <h2 className="text-3xl font-black text-white mb-2">
              {creditsExhausted ? (
                <>You've hit your <span className="text-red-400">free limit!</span> 🚦</>
              ) : (
                <>Unlock <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] to-[#00d4ff]">GitTime Pro</span></>
              )}
            </h2>
            <p className="text-white/40 text-sm">
              {creditsExhausted 
                ? 'Upgrade to Pro to generate 500 commits per repo, 10 runs a month, and unlock the Gemini AI Engine.'
                : 'More power. More commits. More realism.'}
            </p>
          </div>

          {/* Price Display */}
          <div className="text-center mb-6">
            <div className="text-5xl font-black text-white">
              {pricing ? pricing.monthly.display : '$6.99'}
            </div>
            <p className="font-mono text-xs text-white/30 mt-1">
              per month (cancel anytime)
            </p>
          </div>

          {/* Feature Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-2xl border border-white/5 bg-white/2">
              <p className="font-mono text-xs text-white/40 uppercase tracking-widest mb-3">Free</p>
              <div className="space-y-2 text-sm">
                {['50 commits/gen', '2 runs/month', '10 MB uploads'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-white/40"><span className="text-white/20">–</span>{f}</div>
                ))}
                {['AI Messages', 'Fake PRs', 'Density Control'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-white/20 line-through"><span>✕</span>{f}</div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-[#00ff87]/20 bg-[#00ff87]/5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-gradient-to-r from-[#00ff87] to-[#00d4ff] text-[#050508]">PRO</div>
              <p className="font-mono text-xs text-[#00ff87] uppercase tracking-widest mb-3">Pro</p>
              <div className="space-y-2 text-sm">
                {['500 commits/gen', '10 runs/month', '150 MB uploads'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-white/70"><span className="text-[#00ff87]">✓</span>{f}</div>
                ))}
                {['AI Messages', 'Fake PRs', 'Density Control'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-white/70"><span className="text-[#00ff87]">✓</span>{f}</div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={handleUpgrade} className="group relative overflow-hidden w-full py-4 rounded-2xl font-mono text-lg font-bold text-[#050508] bg-gradient-to-r from-[#00ff87] to-[#00d4ff] hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-[0_0_40px_rgba(0,255,135,0.25)]">
            <div className="btn-shine-overlay" />
            <span className="relative z-10">
              {pricing ? `Subscribe ${pricing.monthly.display}/mo →` : 'Subscribe $6.99/mo →'}
            </span>
          </button>
          <p className="text-center font-mono text-xs text-white/20 mt-3">Cancel anytime · UPI · Cards · NetBanking · Powered by Razorpay</p>
        </div>
      </div>
    </div>
  )

  const handleSupportSubmit = async (e: any) => {
    e.preventDefault()
    setSupportFormStatus('loading')
    const formData = new FormData(e.target)
    formData.append("access_key", "e8faac32-eb2b-4d05-8b2b-e9ba18769dd8")

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        setSupportFormStatus('success')
        e.target.reset()
        setTimeout(() => { setShowSupportModal(false); setSupportFormStatus('idle') }, 3000)
      } else {
        setSupportFormStatus('error')
      }
    } catch {
      setSupportFormStatus('error')
    }
  }

  const renderSupportModal = () => !showSupportModal ? null : (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowSupportModal(false)}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0f0f17] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00d4ff]/10 to-transparent rounded-full blur-[60px] pointer-events-none" />
        <div className="relative p-8">
          <button onClick={() => setShowSupportModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all">✕</button>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Get in touch</h2>
            <p className="text-white/40 text-[13px]">Need help with GitTime? Send us a message and we'll get back to you shortly.</p>
          </div>

          <form onSubmit={handleSupportSubmit} className="space-y-4">
            <input type="hidden" name="subject" value="New Support Request from GitTime" />
            <input type="hidden" name="from_name" value="GitTime Support Portal" />
            
            <div>
              <label className="block text-[11px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Your Email</label>
              <input type="email" name="email" required className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00d4ff]/50 transition-colors" placeholder="dev@example.com" />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-white/30 uppercase tracking-widest mb-1.5">How can we help?</label>
              <textarea name="message" required rows={4} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00d4ff]/50 transition-colors resize-none" placeholder="Describe your issue or ask a question..." />
            </div>

            <button disabled={supportFormStatus === 'loading' || supportFormStatus === 'success'} className="w-full py-3.5 rounded-xl font-mono text-sm font-bold text-[#050508] bg-[#00d4ff] hover:bg-[#00d4ff]/90 transition-colors disabled:opacity-50 tracking-wide">
              {supportFormStatus === 'loading' ? 'Sending...' : supportFormStatus === 'success' ? 'Message Sent ✓' : 'Send Message'}
            </button>
            {supportFormStatus === 'error' && <p className="text-center font-mono text-xs text-red-400 mt-2">Failed to send message. Please try again.</p>}
          </form>
        </div>
      </div>
    </div>
  )

  // ── Typewriter effect for hero ──
  const heroLines = useMemo(() => [
    { text: 'The ultimate', gradient: false },
    { text: 'commit history', gradient: true },
    { text: 'generator.', gradient: false },
  ], [])
  const [displayedChars, setDisplayedChars] = useState(0)
  const totalChars = useMemo(() => heroLines.reduce((sum, l) => sum + l.text.length, 0), [heroLines])

  useEffect(() => {
    if (status !== 'unauthenticated') return
    let i = 0
    let direction: 'typing' | 'pausing' | 'erasing' | 'waiting' = 'typing'
    let timeout: ReturnType<typeof setTimeout>

    const tick = () => {
      if (direction === 'typing') {
        i++
        setDisplayedChars(i)
        if (i >= totalChars) {
          direction = 'pausing'
          timeout = setTimeout(tick, 2000)
        } else {
          timeout = setTimeout(tick, 55)
        }
      } else if (direction === 'pausing') {
        direction = 'erasing'
        timeout = setTimeout(tick, 30)
      } else if (direction === 'erasing') {
        i--
        setDisplayedChars(i)
        if (i <= 0) {
          direction = 'waiting'
          timeout = setTimeout(tick, 500)
        } else {
          timeout = setTimeout(tick, 25)
        }
      } else {
        direction = 'typing'
        timeout = setTimeout(tick, 55)
      }
    }

    timeout = setTimeout(tick, 400)
    return () => clearTimeout(timeout)
  }, [status, totalChars])

  const renderTypewriter = () => {
    let charIndex = 0
    return heroLines.map((line, lineIdx) => {
      const lineStart = charIndex
      charIndex += line.text.length
      const visibleCount = Math.max(0, Math.min(line.text.length, displayedChars - lineStart))
      const visibleText = line.text.slice(0, visibleCount)
      const isCurrentLine = displayedChars >= lineStart && displayedChars < lineStart + line.text.length

      return (
        <span key={lineIdx}>
          {line.gradient ? (
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] via-[#00d4ff] to-[#b026ff] animate-gradient-x">
              {visibleText}
            </span>
          ) : (
            visibleText
          )}
          {isCurrentLine && <span className="inline-block w-[3px] h-[0.85em] bg-[#00ff87] ml-1 align-middle animate-pulse" style={{ animationDuration: '0.8s' }} />}
          {lineIdx < heroLines.length - 1 && <br />}
        </span>
      )
    })
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center pt-20"><div className="w-10 h-10 border-2 border-brand-green rounded-full animate-spin border-t-transparent" /></div>
  }

  if (status === "unauthenticated") {
    return (
      <div className="relative min-h-screen bg-[#050508] flex flex-col items-center justify-between overflow-x-hidden selection:bg-brand-green/30 selection:text-brand-green">
        {renderSupportModal()}
        {/* Background mesh */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute inset-0 dot-grid opacity-60" />
          <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] rounded-full blur-[150px] opacity-[0.12] animate-float" style={{ background: 'radial-gradient(circle, #00ff87 0%, transparent 60%)' }} />
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.08] animate-float-delayed" style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 60%)' }} />
          <div className="absolute top-[30%] right-[20%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-[0.06] animate-float" style={{ background: 'radial-gradient(circle, #b026ff 0%, transparent 60%)' }} />
        </div>

        {/* Nav */}
        <nav className="w-full relative z-20 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GitTime" className="w-8 h-8 rounded-lg object-contain" />
            <span className="font-mono text-sm font-bold tracking-[0.2em] text-white/90">GITTIME</span>
            <span className="font-mono text-[10px] font-medium px-2.5 py-1 rounded-full border border-white/[0.06] text-white/30 bg-white/[0.03]">v2.0</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-white/40">
            <a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }} className="hover:text-white transition-colors duration-300">Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }) }} className="hover:text-white transition-colors duration-300">How it Works</a>
            <button onClick={() => setShowSupportModal(true)} className="hover:text-white transition-colors duration-300">Support</button>
            <button onClick={() => signIn('github')} className="px-5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.12] text-white text-[13px] font-medium transition-all duration-300">Sign In</button>
          </div>
        </nav>

        {/* Hero */}
        <main className="relative z-10 w-full max-w-5xl mx-auto px-6 pt-28 pb-36 flex flex-col items-center text-center">
          <div className="section-label mb-8 animate-hero-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse shadow-[0_0_6px_#00ff87]" />
            <span className="text-[#00ff87]/80">Powered by Llama AI</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-[5.5rem] font-extrabold text-white tracking-[-0.04em] leading-[1.1] mb-8 animate-hero-2 min-h-[3.6em]">
            {renderTypewriter()}
          </h1>

          <p className="text-lg md:text-xl text-white/40 mb-14 max-w-2xl leading-relaxed font-light animate-hero-3">
            Instantly turn empty portfolios into bustling, battle-tested repositories. Backdate highly-realistic, AI-generated commit workflows directly to your GitHub.
          </p>

          <div className="animate-hero-4 flex flex-col items-center">
            <button onClick={() => signIn('github')} className="group relative overflow-hidden inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-mono text-[15px] font-semibold text-[#050508] transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] shadow-[0_0_30px_rgba(0,255,135,0.25)] hover:shadow-[0_0_50px_rgba(0,255,135,0.4)] bg-gradient-to-r from-[#00ff87] to-[#00d4ff]">
              <div className="btn-shine-overlay" />
              <svg className="relative z-10 w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="relative z-10">Sign in with GitHub →</span>
            </button>
            {/* <p className="mt-5 font-mono text-[11px] text-white/20 tracking-[0.15em] uppercase">Free forever · No credit card</p> */}
          </div>
        </main>

        {/* ━━━━━━ BENTO BOX FEATURE GRID ━━━━━━ */}
        <section id="features" className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-40 pt-8">
          {/* Section header */}
          <div className="text-center mb-20 animate-hero-5">
            <div className="section-label mb-6 mx-auto w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
              Features
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-5 leading-tight">
              Everything you need to<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] to-[#00d4ff]">rewrite history</span>
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto leading-relaxed font-light">
              A complete simulation engine that makes generated repositories indistinguishable from real developer workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* AI Commits — Hero card */}
            <div className="md:col-span-2 premium-card p-10 rounded-[28px] group relative overflow-hidden">
              <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-[#00d4ff]/15 to-transparent rounded-full blur-[120px] animate-glow-pulse pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1.5s] ease-out z-0" />

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#00d4ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>
                  </div>
                  <span className="font-mono text-[10px] font-medium tracking-[0.2em] uppercase text-[#00d4ff]/60">Powered by Llama AI</span>
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight leading-snug">Context-Aware<br />AI Commits</h3>
                <p className="text-white/40 leading-relaxed mb-8 max-w-lg text-[15px]">The generator analyzes your actual code files to write highly specific, context-aware commit messages indistinguishable from senior developer logs.</p>

                <div className="font-mono text-[13px] p-5 rounded-2xl bg-[#050508] border border-white/[0.04] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00d4ff]/20 to-transparent" />
                  <p className="text-white/30 mb-2">$ gittime generate-commit --file auth.ts</p>
                  <p className="text-[#00d4ff]"><span className="text-[#00ff87]">✓</span> feat(auth): implement JWT token rotation and secure session cookies</p>
                  <p className="text-[#00d4ff] mt-1"><span className="text-[#00ff87]">✓</span> refactor: extract middleware chain into composable handlers</p>
                </div>
              </div>
            </div>

            {/* PR Branches */}
            <div className="premium-card p-10 rounded-[28px] group relative overflow-hidden">
              <div className="absolute -top-32 -left-32 w-80 h-80 bg-gradient-to-br from-[#b026ff]/15 to-transparent rounded-full blur-[100px] animate-glow-pulse pointer-events-none" style={{ animationDelay: '1s' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1.5s] ease-out z-0" />

              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-[#b026ff]/10 border border-[#b026ff]/20 flex items-center justify-center mb-8">
                  <svg className="w-5 h-5 text-[#b026ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>
                </div>

                <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Fake Pull<br />Requests</h3>
                <p className="text-white/40 leading-relaxed text-[15px]">It doesn't just push a straight line to main. GitTime automatically branches out, commits, and simulates PR merges.</p>

                <div className="mt-8 flex items-center gap-2">
                  <div className="flex -space-x-1">
                    <div className="w-2 h-2 rounded-full bg-[#b026ff]" />
                    <div className="w-2 h-2 rounded-full bg-[#b026ff]/60" />
                    <div className="w-2 h-2 rounded-full bg-[#b026ff]/30" />
                  </div>
                  <span className="font-mono text-[10px] text-white/20">feature/payments → main</span>
                </div>
              </div>
            </div>

            {/* Commit Density */}
            <div className="premium-card p-10 rounded-[28px] group relative overflow-hidden">
              <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-gradient-to-tl from-[#00ff87]/15 to-transparent rounded-full blur-[100px] animate-glow-pulse pointer-events-none" style={{ animationDelay: '2s' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1.5s] ease-out z-0" />

              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl bg-[#00ff87]/10 border border-[#00ff87]/20 flex items-center justify-center mb-8">
                  <svg className="w-5 h-5 text-[#00ff87]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" /></svg>
                </div>

                <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Commit Density<br />Targeting</h3>
                <p className="text-white/40 leading-relaxed text-[15px]">Dial up the <span className="text-white/60 font-mono text-[13px]">.tsx</span> and <span className="text-white/60 font-mono text-[13px]">.css</span> density. The engine weights the random selection pool based on your settings.</p>

                {/* Mini density bars */}
                <div className="mt-8 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-white/30 w-8">.tsx</span>
                    <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden"><div className="h-full w-[65%] bg-gradient-to-r from-[#00ff87] to-[#00ff87]/50 rounded-full" /></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-white/30 w-8">.css</span>
                    <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden"><div className="h-full w-[40%] bg-gradient-to-r from-[#00d4ff] to-[#00d4ff]/50 rounded-full" /></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-white/30 w-8">.ts</span>
                    <div className="flex-1 h-1 rounded-full bg-white/[0.04] overflow-hidden"><div className="h-full w-[25%] bg-gradient-to-r from-[#b026ff] to-[#b026ff]/50 rounded-full" /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Automated Push — Hero card */}
            <div className="md:col-span-2 premium-card p-10 rounded-[28px] group relative overflow-hidden">
              <div className="absolute -bottom-40 right-0 w-[400px] h-[400px] bg-gradient-to-tl from-white/[0.08] to-transparent rounded-full blur-[120px] animate-glow-pulse pointer-events-none" style={{ animationDelay: '3s' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[1.5s] ease-out z-0" />

              <div className="relative z-10 flex items-start gap-8">
                <div className="flex-shrink-0 hidden md:flex w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] items-center justify-center">
                  <svg className="w-10 h-10 text-white/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight flex items-center gap-3">
                    Automated Server-Side Push
                    <span className="text-[10px] bg-[#00ff87]/10 text-[#00ff87] border border-[#00ff87]/30 px-2.5 py-1 rounded-full font-mono uppercase tracking-widest animate-pulse">Now Free</span>
                  </h3>
                  <p className="text-white/40 leading-relaxed text-[15px] max-w-2xl">Forget downloading ZIP files. Authorize via OAuth and GitTime builds the <span className="font-mono text-white/50 text-[13px]">.git</span> directory in memory and pushes directly to a new repository on your profile.</p>

                  <div className="mt-6 flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00ff87]" />
                      <span className="font-mono text-[11px] text-white/30">OAuth 2.0</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff]" />
                      <span className="font-mono text-[11px] text-white/30">In-memory build</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#b026ff]" />
                      <span className="font-mono text-[11px] text-white/30">Direct push</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>


        {/* ━━━━━━ HOW IT WORKS ━━━━━━ */}
        <section id="how-it-works" className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-40 pt-20">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="text-center mb-20">
            <div className="section-label mb-6 mx-auto w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87]" />
              How it works
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-5 leading-tight">
              See it in action
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto leading-relaxed font-light">
              From an empty codebase to a breathtaking commit history graph in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Left: Terminal Animation */}
            <div className="premium-card rounded-[24px] overflow-hidden group">
              <div className="flex items-center px-5 py-3.5 border-b border-white/[0.04] bg-white/[0.02] relative">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="font-mono text-[11px] text-white/20 truncate px-4">gittime-engine ~ node generate.js</span>
                </div>
              </div>
              <div className="p-6 font-mono text-[13px] leading-7 text-[#00ff87]/70 min-h-[340px] flex flex-col justify-end overflow-hidden relative bg-[#050508]">
                <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-[#050508] to-transparent z-10 pointer-events-none" />
                <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#050508] to-transparent z-10 pointer-events-none" />

                <div className="animate-marquee-up space-y-2 whitespace-nowrap opacity-90 pb-2">
                  <p className="text-white/30">&gt; Authenticating GitHub scopes...</p>
                  <p className="text-white/70">✓ Token verified. User: &quot;Senior Dev&quot;</p>
                  <p className="text-[#00d4ff] mt-3">&gt; AI Batch Analyzing 4,120 lines of code...</p>
                  <p className="text-white/25">  - src/auth.ts <span className="text-white/15">(AST parsed)</span></p>
                  <p className="text-white/25">  - src/payment.tsx <span className="text-white/15">(AST parsed)</span></p>
                  <p className="text-[#b026ff] mt-3">&gt; Injecting Fake Pull Request #42...</p>
                  <p className="text-[#00ff87]">✓ <span className="text-white/30">[db4f1a]</span> feat(auth): implement JWT refresh</p>
                  <p className="text-[#00ff87]">✓ <span className="text-white/30">[9a2c3d]</span> fix(ui): resolve overflow on mobile</p>
                  <p className="text-[#00ff87]">✓ <span className="text-white/30">[e3b21c]</span> refactor: extract payment hook</p>
                  <p className="text-[#b026ff] mt-2">&gt; Merge branch &apos;feature/payments-42&apos; into main</p>
                  <p className="text-white mt-3 font-semibold">✓ 385 Commits generated across 89 active days.</p>
                  <p className="text-white font-semibold inline-flex items-center gap-2">Pushing to origin main... <span className="w-2 h-4 bg-[#00ff87] animate-pulse" /></p>
                </div>
              </div>
            </div>

            {/* Right: Result + Steps */}
            <div className="space-y-6">
              {/* GitHub Graph Result */}
              <div className="premium-card p-8 rounded-[24px] group relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-full bg-gradient-to-l from-[#050508] to-transparent z-10 pointer-events-none" />
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-[#00ff87]/10 to-transparent rounded-full blur-[80px] pointer-events-none" />

                <div className="flex items-center gap-2 mb-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00ff87] animate-pulse" />
                  <h4 className="font-mono text-[10px] text-[#00ff87]/60 tracking-[0.2em] uppercase font-medium">The Result</h4>
                </div>

                <div className="flex flex-col gap-[5px] opacity-80 group-hover:opacity-100 transition-opacity duration-500">
                  {Array.from({ length: 5 }).map((_, r) => (
                    <div key={r} className="flex gap-[5px]">
                      {Array.from({ length: 24 }).map((_, c) => {
                        const intensity = Math.random();
                        let bg = 'bg-white/[0.03]';
                        if (intensity > 0.8) bg = 'bg-[#39d353]';
                        else if (intensity > 0.6) bg = 'bg-[#26a641]';
                        else if (intensity > 0.4) bg = 'bg-[#006d32]';
                        else if (intensity > 0.2) bg = 'bg-[#0e4429]';
                        if (Math.random() > 0.95) bg = 'bg-[#b026ff] animate-pulse';
                        return <div key={c} className={`w-3 h-3 rounded-[3px] ${bg} transition-colors duration-500`} />
                      })}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between font-mono text-[10px] text-white/30">
                  <span>12 months of contributions</span>
                  <span className="text-[#00ff87]/60 font-mono text-[10px]">12 months of contributions</span>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                {[
                  { n: '01', color: 'text-white/60', accent: '#fff', text: 'Upload your clean, finished project ZIP. We extract all files securely in-memory.' },
                  { n: '02', color: 'text-[#00d4ff]', accent: '#00d4ff', text: 'Customize your developer profile. Choose from "Weekend Warrior" to "Crunch Mode".' },
                  { n: '03', color: 'text-[#00ff87]', accent: '#00ff87', text: 'Click Generate. We rewrite history, inject branches, and push instantly.' }
                ].map((s) => (
                  <div key={s.n} className="flex items-start gap-5 group">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center font-mono text-xs font-bold transition-all duration-300 group-hover:border-white/10" style={{ color: s.accent }}>
                      {s.n}
                    </div>
                    <p className="text-[14px] text-white/40 leading-relaxed pt-2 group-hover:text-white/60 transition-colors duration-300">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━━━ PRICING ━━━━━━ */}
        <section id="pricing" className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-40">
          <div className="text-center mb-16">
            <div className="section-label mb-6 mx-auto w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff87]" />
              Pricing
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-5 leading-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto leading-relaxed font-light">
              Free for casual use. A no-brainer upgrade for power users.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="premium-card p-8 rounded-[32px] flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white mb-2">Open Source</h3>
                <p className="text-white/40 text-[15px] mb-8">Perfect for a quick touch-up.</p>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl font-black text-white">Free</span>
                </div>
                <div className="space-y-4 mb-8">
                  {[
                    { text: '2 generated projects/mo', included: true },
                    { text: '100 total commits/mo pool', included: true },
                    { text: 'Context-Aware AI Commits', included: false },
                    { text: 'Fake PRs & Merges', included: false },
                    { text: 'Commit Density Control', included: false },
                    { text: 'Automated GitHub Push', included: false },
                  ].map((feat, i) => (
                    <div key={i} className={`flex items-center gap-3 ${feat.included ? 'text-white/70' : 'text-white/20 line-through'}`}>
                      <span className={feat.included ? 'text-white/40' : 'text-white/20'}>{feat.included ? '✓' : '✕'}</span>
                      <span className="text-[15px]">{feat.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => signIn('github')} className="w-full py-4 rounded-xl font-mono text-sm font-bold text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-colors">
                Sign in to start
              </button>
            </div>

            {/* Pro Tier */}
            <div className="relative premium-card p-8 rounded-[32px] flex flex-col justify-between overflow-hidden group/card">
              <div className="absolute inset-0 border-2 border-[#00ff87]/30 rounded-[32px] pointer-events-none" />
              <div className="absolute -top-32 -right-32 w-[300px] h-[300px] bg-gradient-to-br from-[#00ff87]/20 to-transparent rounded-full blur-[80px] pointer-events-none group-hover/card:scale-110 transition-transform duration-700" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl font-bold text-[#00ff87]">Contributor</h3>
                  <span className="font-mono text-[10px] uppercase tracking-wider bg-[#00ff87]/10 text-[#00ff87] px-3 py-1 rounded-full border border-[#00ff87]/30">Most Popular</span>
                </div>
                <p className="text-white/40 text-[15px] mb-8">Unrestricted access to the simulation engine.</p>
                <div className="flex items-baseline gap-2 mb-8">
                  <span className="text-5xl font-black text-white">{pricing ? pricing.monthly.display : '$6.99'}</span>
                  <span className="text-white/30 font-mono text-sm">/ mo</span>
                </div>
                <div className="space-y-4 mb-8">
                  {[
                    { text: '10 generated projects/mo', included: true },
                    { text: '1000 total commits/mo pool', included: true },
                    { text: 'Context-Aware AI Commits', included: true },
                    { text: 'Fake PRs & Merges', included: true },
                    { text: 'Commit Density Control', included: true },
                    { text: 'Automated GitHub Push', included: true },
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3 text-white/90">
                      <span className="text-[#00ff87]">✓</span>
                      <span className="text-[15px]">{feat.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => signIn('github')} className="relative z-10 group/btn overflow-hidden w-full py-4 rounded-xl font-mono text-sm font-bold text-[#050508] bg-gradient-to-r from-[#00ff87] to-[#00d4ff] hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-[0_0_30px_rgba(0,255,135,0.2)]">
                <div className="btn-shine-overlay" />
                <span className="relative z-10">Sign in to upgrade →</span>
              </button>
            </div>
          </div>
        </section>

        {/* ━━━━━━ SOCIAL PROOF STATS ━━━━━━ */}
        <section className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-32">
          <div className="premium-card rounded-[24px] p-12 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#00ff87]/[0.03] via-transparent to-[#00d4ff]/[0.03] pointer-events-none" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
              {[
                { value: '50K+', label: 'Commits Generated' },
                { value: '2.4K', label: 'Active Users' },
                { value: '99.8%', label: 'Undetectable Rate' },
                { value: '<3s', label: 'Average Push Time' }
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="stat-number text-3xl md:text-4xl font-extrabold mb-2">{stat.value}</div>
                  <p className="font-mono text-[11px] text-white/30 uppercase tracking-[0.15em]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ━━━━━━ FOOTER ━━━━━━ */}
        <footer className="w-full relative z-20 border-t border-white/[0.04] py-10 bg-[#050508]/90 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GitTime" className="w-6 h-6 rounded-lg object-contain" />
              <div className="flex items-center gap-6">
                <button onClick={() => setShowSupportModal(true)} className="font-mono text-xs text-white/40 hover:text-white transition-colors">Support</button>
                <span className="font-mono text-xs text-white/20">GitTime Pro © {new Date().getFullYear()}</span>
              </div>
            </div>
            {/* <p className="font-mono text-[11px] text-white/15">Built with Next.js & Gemini AI</p> */}
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />
      {renderUpgradeModal()}
      {renderSupportModal()}

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[30%] w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,255,135,0.05) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-[20%] w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="border-b border-white/5 px-6 py-4 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="GitTime" className="w-8 h-8 rounded-lg object-contain" />
              <span className="font-mono text-sm font-semibold tracking-wider text-white/90">GITTIME</span>
              <span className="font-mono text-xs text-white/20 border border-white/10 px-2 py-0.5 rounded-full">v2.0 PRO</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse-slow shadow-[0_0_8px_#00ff87]" />
              {!isPro && (
                <button onClick={() => setShowUpgradeModal(true)} className="font-mono text-xs font-bold px-3 py-1.5 rounded-lg border border-[#00ff87]/30 text-[#00ff87] bg-[#00ff87]/10 hover:bg-[#00ff87]/20 transition-all animate-pulse-slow">
                  ⚡ Free ({runsThisMonth}/{maxRuns} runs)
                </button>
              )}
              {isPro && <span className="font-mono text-xs text-[#00ff87] border border-[#00ff87]/30 bg-[#00ff87]/10 px-3 py-1.5 rounded-lg">✓ Pro ({runsThisMonth}/{maxRuns} runs)</span>}
              <button onClick={() => setShowSupportModal(true)} className="font-mono text-xs text-white/40 hover:text-white transition-colors">Help</button>
              <button onClick={() => signOut()} className="font-mono text-xs text-white/40 hover:text-white transition-colors">Sign Out</button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-1">
          <div className="grid lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              <div className="mb-8">
                <p className="font-mono text-xs text-brand-green/60 tracking-widest uppercase mb-2">$ git commit --backdate --realistic</p>
                <h1 className="text-3xl font-bold text-white leading-tight">
                  Undetectable commit<br />
                  <span style={{ color: '#00ff87' }} className="glow-text-green">history generator</span>
                </h1>
              </div>

              <div className="flex items-center gap-1 mb-8">
                {STEPS.map((s: { n: number, label: string }, i: number) => (
                  <div key={s.n} className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (s.n > step && step >= 3 && creditsExhausted) { setShowUpgradeModal(true); return }
                        if (s.n < step || (s.n === step + 1 && canProceed())) setStep(s.n as WizardStep)
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${step === s.n ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' :
                        step > s.n ? 'text-white/40 hover:text-white/60' : 'text-white/20'
                        }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${step > s.n ? 'bg-brand-green/20 text-brand-green' :
                        step === s.n ? 'bg-brand-green text-black' : 'bg-white/10 text-white/30'
                        }`}>
                        {step > s.n ? '✓' : s.n}
                      </span>
                      {s.label}
                    </button>
                    {i < STEPS.length - 1 && <div className={`w-4 h-px ${step > s.n ? 'bg-brand-green/30' : 'bg-white/10'}`} />}
                  </div>
                ))}
              </div>

              <div className="glass-card rounded-2xl p-6 min-h-[420px]">
                {stepContent[step]?.()}

                {stage === 'error' && (
                  <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/8 animate-fadeIn">
                    <p className="font-mono text-sm text-red-400 font-semibold mb-1">Error</p>
                    <p className="font-mono text-xs text-red-300/80">{errorMsg}</p>
                    <button onClick={() => { setStage('idle'); setErrorMsg('') }} className="mt-3 font-mono text-xs text-white/40 hover:text-white/60 transition-colors underline">dismiss & try again</button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setStep(s => Math.max(1, s - 1) as WizardStep)}
                  className={`font-mono text-sm text-white/30 hover:text-white/60 transition-colors ${step === 1 ? 'invisible' : ''}`}
                >
                  ← back
                </button>
                {step < 5 && (
                  <button
                    onClick={() => {
                      if (step === 2 && !sessionId) { (uploadFile as any)(); return }
                      // Block forward navigation from Timeline (step 3) onwards if credits exhausted
                      if (step >= 3 && creditsExhausted) { setShowUpgradeModal(true); return }
                      setStep(s => Math.min(5, s + 1) as WizardStep)
                    }}
                    disabled={!canProceed() && !(step === 2 && file)}
                    className="btn-primary px-6 py-2.5 rounded-xl text-sm disabled:opacity-30"
                  >
                    <span>{step === 2 && !sessionId ? 'Upload & Continue' : step === 4 ? 'Review & Generate →' : 'Continue →'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="font-mono text-xs text-white/40 uppercase tracking-widest">contribution preview</span>
                </div>
                <div className="p-4">
                  <HeatmapPreview
                    startDate={startDate} endDate={endDate} pattern={pattern} weekdaysOnly={weekdaysOnly} fileCount={fileCount}
                    toggledOffDates={toggledOffDates}
                    onToggleDate={dateStr => setToggledOffDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }))}
                    timezone={timezone}
                    showMilestones={injectPRMerges}
                  />
                </div>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="font-mono text-xs text-white/40 uppercase tracking-widest">git log</span>
                  {result && <span className="font-mono text-xs text-muted">{visibleCommits.length}/{result.totalCommits}</span>}
                </div>
                <div className="p-3 max-h-72 overflow-y-auto">
                  {visibleCommits.length > 0 ? (
                    <div className="space-y-0">
                      {visibleCommits.map((commit, i) => (
                        <div key={i} className="commit-dot flex items-start gap-2 py-1.5 border-b border-white/3 last:border-0">
                          <div className="flex flex-col items-center mt-1.5 flex-shrink-0">
                            <div className="w-2 h-2 rounded-full" style={{ background: i === 0 ? '#00ff87' : 'rgba(0,255,135,0.25)', boxShadow: i === 0 ? '0 0 6px #00ff87' : 'none' }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs text-white/75 truncate">{commit.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-xs text-muted truncate max-w-[90px]">{commit.file.split('/').pop()}</span>
                              <span className="font-mono text-xs text-subtle">{commit.date}</span>
                              {commit.author && <span className="font-mono text-xs text-white/20 truncate">{commit.author.split(' ')[0]}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="font-mono text-xs text-subtle">{stage === 'generating' ? 'generating...' : 'commits will appear here'}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card rounded-2xl p-4">
                <p className="font-mono text-xs text-white/30 uppercase tracking-widest mb-3">Realism checks</p>
                <div className="space-y-2">
                  {[
                    { label: 'Varied commit times', ok: true },
                    { label: 'Non-uniform daily density', ok: true },
                    { label: 'Author + committer date offset', ok: true },
                    { label: 'Realistic commit order', ok: true },
                    { label: 'Context-aware messages', ok: true },
                    { label: 'Merge commits', ok: addMergeCommits },
                    { label: 'Weekday bias', ok: weekdaysOnly || pattern !== 'casual' },
                  ].map((check, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${check.ok ? 'text-brand-green' : 'text-white/20'}`}>{check.ok ? '✓' : '○'}</span>
                      <span className={`font-mono text-xs ${check.ok ? 'text-white/50' : 'text-white/20'}`}>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-white/5 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="font-mono text-xs text-subtle">GITTIME v2.0 — undetectable commit history</span>
            <span className="font-mono text-xs text-subtle">files auto-deleted after 15 min</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <WizardProvider>
      <WizardLayout />
    </WizardProvider>
  )
}
