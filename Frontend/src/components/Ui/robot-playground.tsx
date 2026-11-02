'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUpRight, Check, ChevronRight, Code2, Copy, Download, Feather, Maximize2, MousePointer2, Pause, Play, RotateCcw, Sparkles, Terminal, X, Zap } from 'lucide-react'
import {Button} from './button'
import { cn } from '../../lib/utills'
import { NotchRobot, RobotHead, useRobotPresence, type RobotState } from './robot-head'

const states: { id: RobotState; label: string; description: string; message: string }[] = [
  { id: 'idle', label: 'Idle', description: 'Just hanging out', message: 'A little curious. Always here.' },
  { id: 'active', label: 'Active', description: 'Ready for anything', message: 'All systems go. Let’s do this.' },
  { id: 'thinking', label: 'Thinking', description: 'Connecting the dots', message: 'Give me a moment. Connecting the dots.' },
  { id: 'sleeping', label: 'Sleeping', description: 'Recharging a little', message: 'A tiny break for a busy little brain.' },
  { id: 'happy', label: 'Happy', description: 'A little celebration', message: 'You just made my day.' },
  { id: 'listening', label: 'Listening', description: 'You have my attention', message: 'I’m all ears. What’s on your mind?' },
  { id: 'surprised', label: 'Surprised', description: 'Well, hello there', message: 'Oh! Didn’t see that coming.' },
  { id: 'error', label: 'Error', description: 'A tiny hiccup', message: 'A little hiccup. We’ll figure it out.' },
]
const colors = [
  { label: 'Tangerine', value: '#f57747' },
  { label: 'Lilac', value: '#ada0dd' },
  { label: 'Sage', value: '#a5bd9e' },
  { label: 'Cloud', value: '#d5d7d1' },
  { label: 'Graphite', value: '#686e73' },
]

function SettingSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="setting-row"><span><span className="setting-label">{label}</span><span className="setting-description">{description}</span></span><span className="toggle"><input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} aria-label={label} /><span className="toggle-track" /></span></label>
}

export function RobotPlayground({ componentSource, styleSource }: { componentSource: string; styleSource: string }) {
  const [state, setState] = useState<RobotState>('idle')
  const [color, setColor] = useState(colors[0].value)
  const [size, setSize] = useState(40)
  const [blink, setBlink] = useState(true)
  const [followCursor, setFollowCursor] = useState(true)
  const [autoSleep, setAutoSleep] = useState(false)
  const [paused, setPaused] = useState(false)
  const [cycling, setCycling] = useState(false)
  const [tab, setTab] = useState<'preview' | 'code'>('preview')
  const [file, setFile] = useState<'usage' | 'component' | 'styles'>('usage')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const effectiveState = useRobotPresence(state, autoSleep)
  const current = states.find(item => item.id === effectiveState)!
  const colorName = colors.find(item => item.value === color)!.label
  const robotProps = { state: effectiveState, color, blink, followCursor, paused }
  const usage = `'use client'\n\nimport { NotchRobot, RobotHead } from './robot-head'\n\nexport default function MyWebsite() {\n  return (\n    <main className="min-h-screen">\n      <NotchRobot\n        state="${state}"\n        color="${color}"\n        size={${size}}\n        blink={${blink}}\n        followCursor={${followCursor}}\n        autoSleep={${autoSleep}}\n      />\n      {/* Or render a head anywhere: */}\n      <RobotHead state="${state}" size={80} />\n    </main>\n  )\n}`
  const source = file === 'usage' ? usage : file === 'component' ? componentSource : styleSource
  const filename = file === 'usage' ? 'example.tsx' : file === 'component' ? 'robot-head.tsx' : 'robot-head.module.css'

  useEffect(() => {
    if (!cycling || paused) return
    const timer = setInterval(() => setState(previous => states[(states.findIndex(item => item.id === previous) + 1) % states.length].id), 2400)
    return () => clearInterval(timer)
  }, [cycling, paused])
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  useEffect(() => {
    if (expanded) dialogRef.current?.showModal()
    else dialogRef.current?.close()
  }, [expanded])

  function selectState(next: RobotState) { setState(next); setCycling(false) }
  function reset() { setState('idle'); setColor(colors[0].value); setSize(40); setBlink(true); setFollowCursor(true); setAutoSleep(false); setPaused(false); setCycling(false) }
  function showCode() { setTab('code'); previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(source)
      setCopied(true); setCopyError(false)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch { setCopyError(true) }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="site-shell">
      <NotchRobot {...robotProps} size={size} autoSleep={false} onInteract={() => selectState('happy')} />
      <header className="site-header">
        <a href="#" className="brand" aria-label="Notch home"><span className="brand-mark"><span /><span /></span>notch<span className="brand-period">.</span></a>
        <nav className="header-links" aria-label="Main navigation"><a href="https://github.com/fayazara/robot-heads" target="_blank" rel="noreferrer" className="reference-link">The inspiration <ArrowUpRight size={13} /></a><span className="header-divider" /><span className="version">v1.0</span></nav>
      </header>

      <main className="main-container">
        <section className="intro">
          <div>
            <div className="eyebrow"><span className="tiny-dot" /> A LITTLE COMPANION FOR YOUR WEBSITE</div>
            <h1>Small head.<br /><span>Big personality.</span></h1>
            <p className="intro-description">Meet the little robot that lives in your notch.<br className="desktop-break" /> Expressive, lightweight, and a little too lovable.</p>
          </div>
          <div className="intro-aside"><span className="handwritten">psst… I’m up here <ArrowUpRight size={30} strokeWidth={1} /></span><div className="intro-actions"><Button size="lg" onClick={showCode}><Code2 data-icon="inline-start" /> Get the code <ArrowUpRight data-icon="inline-end" /></Button><span className="stack-note">React + TypeScript + CSS</span></div></div>
        </section>

        <div className="workspace">
          <section className="preview-panel" ref={previewRef} aria-label="Robot playground">
            <div className="panel-toolbar"><div role="tablist" aria-label="Playground view" className="view-tabs" onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'preview' : event.key === 'End' ? 'code' : tab === 'preview' ? 'code' : 'preview'; setTab(next); document.getElementById(`${next}-tab`)?.focus() } }}><button role="tab" tabIndex={tab === 'preview' ? 0 : -1} aria-selected={tab === 'preview'} id="preview-tab" aria-controls="preview-content" onClick={() => setTab('preview')}><span className="preview-icon" /> Playground</button><button role="tab" tabIndex={tab === 'code' ? 0 : -1} aria-selected={tab === 'code'} id="code-tab" aria-controls="code-content" onClick={() => setTab('code')}><Code2 size={14} /> Code</button></div><span className="live-label"><span /> LIVE PREVIEW</span></div>
            {tab === 'preview' ? <div role="tabpanel" id="preview-content" aria-labelledby="preview-tab" className="preview-canvas">
              <div className="canvas-topline"><span className="canvas-hint"><MousePointer2 size={13} /> {followCursor ? 'Move your cursor. Say hello.' : 'Pick a state. Meet your companion.'}</span><button className="icon-button" onClick={() => setExpanded(true)} aria-label="Expand robot preview"><Maximize2 size={15} /></button></div>
              <div className="robot-display"><button className="hero-robot-button" onClick={() => selectState(effectiveState === 'happy' ? 'idle' : 'happy')} aria-label="Make robot happy"><RobotHead {...robotProps} size={size * 4} /></button><div className="state-caption" aria-live="polite"><span className={cn('state-pill', effectiveState === 'error' && 'state-pill-error')}><span /> {current.label}</span><p>{current.message}</p></div></div>
              <div className="canvas-bottomline"><span><MousePointer2 size={11} className="keyboard-key" /> Click the little guy for a reaction</span><span className="canvas-scale">4× ACTUAL SIZE</span></div>
            </div> : <div role="tabpanel" id="code-content" aria-labelledby="code-tab" className="code-view"><div className="code-toolbar"><label className="sr-only" htmlFor="source-file">Source file</label><select id="source-file" value={file} onChange={event => { setFile(event.target.value as typeof file); setCopied(false); setCopyError(false) }}><option value="usage">example.tsx</option><option value="component">robot-head.tsx</option><option value="styles">robot-head.module.css</option></select><div className="flex gap-1"><button className="icon-button" onClick={download} aria-label="Download selected file"><Download size={15} /></button><button className="icon-button" onClick={copyCode} aria-label="Copy selected file">{copied ? <Check size={15} /> : <Copy size={15} />}</button></div></div><pre tabIndex={0}><code>{source}</code></pre><div className="code-help" role="status">{copyError ? 'Clipboard unavailable. Select the code or download the file.' : copied ? 'Copied to clipboard.' : 'Add robot-head.tsx and robot-head.module.css to the same folder. No extra packages.'}</div></div>}
            <div className="preview-footer"><span><span className="online-dot" /> {paused ? 'Motion paused' : 'A little life, in real time'}</span><div className="flex items-center gap-3"><button className="text-icon-button" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? <Play size={12} /> : <Pause size={12} />}{paused ? 'Resume' : 'Pause'}</button><span className="vertical-rule" /><button className="icon-button" onClick={reset} aria-label="Reset all settings"><RotateCcw size={13} /></button></div></div>
          </section>

          <aside className="customize-panel" aria-label="Customize your robot">
            <div className="customize-header"><h2>Make it yours</h2><span className="tiny-label">THE DETAILS</span></div>
            <fieldset className="color-control"><legend>Shell color <span>{colorName}</span></legend><div className="swatches">{colors.map(item => <label key={item.value} className="swatch" style={{ '--swatch': item.value } as React.CSSProperties}><input type="radio" name="shell-color" value={item.value} checked={color === item.value} onChange={() => setColor(item.value)} aria-label={item.label} /><span>{color === item.value && <Check size={15} strokeWidth={2.5} />}</span></label>)}</div></fieldset>
            <div className="size-control"><label htmlFor="robot-size">Notch size <span>{size}<span className="muted"> px</span></span></label><input id="robot-size" type="range" min={28} max={56} step={4} value={size} onChange={event => setSize(Number(event.target.value))} style={{ '--range-progress': `${(size - 28) / 28 * 100}%` } as React.CSSProperties} /><div className="range-labels"><span>Subtle</span><span>A little bolder</span></div></div>
            <div className="settings-group"><SettingSwitch label="Natural blinking" description="It’s the little things" checked={blink} onChange={setBlink} /><SettingSwitch label="Follow cursor" description="Curious by nature" checked={followCursor} onChange={setFollowCursor} /><SettingSwitch label="Auto sleep" description="A little nap after 15s of inactivity" checked={autoSleep} onChange={setAutoSleep} /></div>
            <div className="notch-tip"><Sparkles size={15} /><p>Your robot is already in the notch.<br /><span>Look up. It feels right at home.</span></p><ArrowUpRight size={15} /></div>
          </aside>
        </div>

        <section className="states-section" aria-labelledby="states-heading"><div className="section-heading"><div><h2 id="states-heading">A mood for every moment<span className="count-label">08 STATES</span></h2><p>Same little robot. A whole range of emotions.</p></div><button className={cn('cycle-button', cycling && 'is-cycling')} onClick={() => { setCycling(value => !value); setPaused(false) }} aria-pressed={cycling}>{cycling ? <Pause size={12} /> : <Play size={12} />} {cycling ? 'Stop cycling' : 'Cycle states'}</button></div><div className="state-grid">{states.map(item => <button key={item.id} className={cn('state-card', state === item.id && 'selected')} aria-pressed={state === item.id} onClick={() => selectState(item.id)}><span className="selected-dot" /><RobotHead state={item.id} color={color} size={61} blink={blink} paused={paused} /><span className="state-card-label">{item.label}</span><span className="state-card-description">{item.description}</span></button>)}</div></section>

        <section className="bottom-strip" aria-label="Component features"><div className="feature-list"><span><Feather size={14} /> Pure CSS motion</span><span><Zap size={14} /> Zero animation dependencies</span><span><Code2 size={14} /> Yours to customize</span></div><button onClick={showCode}>A tiny addition. A lot of character. <ChevronRight size={13} /></button></section>
        <section className="integration-note"><Terminal size={16} /><p><strong>From playground to your project.</strong> Copy the two source files, then drop <code>{'<NotchRobot />'}</code> into your layout.</p><button onClick={showCode} aria-label="View integration code"><ArrowDown size={15} /></button></section>
      </main>
      <footer className="site-footer"><span>Built small. Made to feel alive.</span><span>Inspired by <a href="https://github.com/fayazara/robot-heads" target="_blank" rel="noreferrer">fayazara/robot-heads <ArrowUpRight size={11} /></a></span><span className="footer-end"><span className="tiny-dot" /> A little more human.</span></footer>
      <dialog ref={dialogRef} className="expanded-dialog" onCancel={() => setExpanded(false)} onClose={() => setExpanded(false)} onClick={event => { if (event.target === event.currentTarget) setExpanded(false) }}><div className="expanded-inner"><button className="icon-button close-dialog" onClick={() => setExpanded(false)} aria-label="Close expanded preview"><X size={20} /></button><h2 className="sr-only">Expanded robot preview</h2><RobotHead {...robotProps} size={240} /><span className="state-pill">{current.label}</span><p>{current.message}</p><Button variant="outline" onClick={() => { selectState(states[(states.findIndex(item => item.id === state) + 1) % states.length].id) }}>Next expression <ChevronRight data-icon="inline-end" /></Button></div></dialog>
    </div>
  )
}
