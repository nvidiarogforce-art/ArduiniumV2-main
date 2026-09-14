import { useEffect, useId, useRef, useState } from 'react';
import { useBuildStore } from '../store/useBuildStore.js';
import { useUiStore } from '../store/useUiStore.js';
import { useI18n } from '../i18n/index.js';
import { getWorkshopCopy } from '../i18n/workshopCopy.js';
import { CATALOGUE, PART_SPECS } from '../lib/parts.js';
import { sensorConnection } from '../lib/sensors.js';
import { isKitComponent, isLed } from '../lib/electronics.js';
import { candidateNodes } from '../lib/geometry.js';
import { getTemplate } from '../lib/templates.js';
import { rt } from '../three/runtime.js';
import { WORKSHOP_LESSONS, SENSOR_KINDS, WIRING_PLANS, PROGRESS_KEY, cleanProgress, createEvidence, observeWorkshop, lessonReady } from '../lib/workshopLessons.js';
import './workshop-guide.css';

function readProgress() {
  try { return cleanProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY))); }
  catch { return cleanProgress(null); }
}
function contextFor(build) {
  return {
    mission: useUiStore.getState().mission,
    connections: Object.fromEntries(Object.values(build.parts).filter(p => SENSOR_KINDS.includes(p.kind))
      .map(p => [p.id, sensorConnection(p, build.parts, build.wires)])),
  };
}

/** Authored offline SVGs: visual features explain what each part does. */
export function PartIllustration({ kind, label, small = false }) {
  const holes = n => Array.from({ length: n }, (_, i) => <circle key={i} cx={40 + i * 120 / Math.max(1, n - 1)} cy="65" r="5" fill="#fff8e8" />);
  const sensor = SENSOR_KINDS.includes(kind);
  return <svg className={'workshop-guide-art' + (small ? ' workshop-guide-art-small' : '')} viewBox="0 0 200 130" role="img" aria-label={label}>
    <ellipse cx="103" cy="111" rx="65" ry="7" fill="#dfd4bd" opacity=".55" />
    <g stroke="#354653" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
      {kind.startsWith('strip') && <g transform="rotate(-14 100 65)"><rect x="26" y="50" width="148" height="30" rx="13" fill="#78a9bc" />{holes(Number(kind.slice(5)))}</g>}
      {kind === 'deck' && <g><path d="M30 46 142 30 176 84 64 103Z" fill="#83b3c4" />{[0,1,2].map(r => [0,1,2,3].map(c => <ellipse key={r+':'+c} cx={53+c*27+r*9} cy={53+r*16-c*4} rx="4" ry="3" fill="#fff8e8" />))}</g>}
      {kind === 'board' && <g><rect x="30" y="31" width="140" height="73" rx="10" fill="#388f88" /><rect x="24" y="47" width="29" height="28" rx="3" fill="#cfdbd9" /><rect x="78" y="55" width="62" height="23" rx="3" fill="#354653" /><path d="M60 39h94M60 94h94" strokeWidth="10" strokeDasharray="4 5" /><circle cx="52" cy="89" r="4" fill="#f5c05c" /><text x="125" y="89" stroke="none" fill="#fff8e8" fontSize="10">D13</text></g>}
      {isLed(kind) && <g><path d="M87 81v29m26-29v24" stroke="#8c9695" strokeWidth="5" /><path d="M77 80V53a23 23 0 0 1 46 0v27Z" fill={kind === 'ledGreen' ? '#51b77b' : kind === 'ledBlue' ? '#568dd5' : kind === 'ledYellow' ? '#e8bb55' : kind === 'ledWhite' || kind === 'rgbLed' ? '#e8eef0' : '#e86855'} /><rect x="73" y="78" width="54" height="9" rx="4" fill="#f8c677" /><path d="M85 56v-6q0-11 11-12" stroke="#fff7dd" strokeWidth="5" /><path d="M100 10v8m-42 8 8 8m76-8-8 8m-82 23h11m84 0h-10" stroke="#ba7937" /></g>}
      {kind === 'wheel' && <g><ellipse cx="101" cy="66" rx="45" ry="43" fill="#354653" strokeWidth="9" strokeDasharray="5 6" /><ellipse cx="101" cy="66" rx="27" ry="28" fill="#e6b662" /><circle cx="101" cy="66" r="9" fill="#fff3d9" /><path d="M101 39v15m0 25v15M74 66h14m26 0h14" /></g>}
      {kind === 'motor' && <g><rect x="43" y="45" width="91" height="49" rx="15" fill="#d3dddd" /><path d="M62 46v46" /><rect x="129" y="57" width="33" height="24" rx="3" fill="#edb753" /><path d="M162 69h20M43 56H31m12 28H31" strokeWidth="5" /><path d="M81 58h28m-28 10h28" stroke="#f6fbf8" /></g>}
      {kind === 'motormount' && <g><path d="M44 94V46h20v26q35 20 71-1V45h20v50Z" fill="#7da8b9" /><circle cx="54" cy="86" r="4" fill="#fff8e8" /><circle cx="145" cy="86" r="4" fill="#fff8e8" /><path d="M77 52q24 22 47 0" fill="none" stroke="#c88939" strokeDasharray="4 5" /></g>}
      {kind === 'caster' && <g><path d="M72 41h56l-9 25H81Z" fill="#81aabb" /><path d="M100 24v17" strokeWidth="8" /><circle cx="100" cy="83" r="24" fill="#c6d2d1" /><path d="M77 78q23-19 46 0" fill="none" /></g>}
      {kind === 'lbracket' && <g><path d="M57 98V27h25v45h66v26Z" fill="#86afbe" /><circle cx="69" cy="43" r="5" fill="#fff8e8" /><ellipse cx="128" cy="85" rx="6" ry="4" fill="#fff8e8" /><path d="M85 66v-9h10" fill="none" stroke="#b77537" /></g>}
      {kind === 'standoff' && <g><path d="m83 31 17-8 18 8v61l-18 10-17-10Z" fill="#dcb46a" /><path d="M100 42v59M83 31l17 11 18-11" fill="none" /><ellipse cx="100" cy="31" rx="6" ry="3" fill="#fff8e8" /></g>}
      {kind === 'upright' && <g><path d="M63 101h73V85h-28V22H86v63H63Z" fill="#83aabd" />{[35,54,73].map(y => <circle key={y} cx="97" cy={y} r="4" fill="#fff8e8" />)}</g>}
      {sensor && <g><rect x="42" y="43" width="116" height="49" rx="8" fill="#4c9d91" /><path d="M77 93v15m23-15v15m23-15v15" stroke="#be913d" strokeWidth="5" />
        {kind === 'sensor' ? <g>{[74,127].map(x => <g key={x}><circle cx={x} cy="65" r="22" fill="#cdd8d8" /><circle cx={x} cy="65" r="15" fill="#536573" /><path d={'M'+(x-9)+' 56l18 18m-18 0 18-18'} stroke="#8fa2ad" /></g>)}<path d="M86 26q14-11 29 0m-35-9q20-15 40 0" fill="none" stroke="#be8c40" /></g>
        : kind === 'lightSensor' ? <g><circle cx="100" cy="65" r="19" fill="#edbd68" /><path d="M90 54v20h7V54h7v20h7V54" fill="none" /><path d="M100 13v10m-26-2 6 8m46-8-6 8" stroke="#ba7937" /></g>
        : kind === 'temperatureSensor' ? <g><path d="M94 72V30a6 6 0 0 1 12 0v42a13 13 0 1 1-12 0Z" fill="#fff5df" /><path d="M100 44v35" stroke="#d46745" strokeWidth="5" /><circle cx="100" cy="82" r="6" fill="#d46745" stroke="none" /></g>
        : kind === 'touchSensor' ? <g><rect x="82" y="57" width="37" height="23" rx="3" fill="#354653" /><path d="m90 57 35-29 12 4" stroke="#d9ddce" strokeWidth="7" /></g>
        : kind === 'tiltSensor' ? <g transform="rotate(-24 100 65)"><rect x="72" y="54" width="58" height="23" rx="11" fill="#d7e1da" /><circle cx="116" cy="65" r="9" fill="#dca650" /><path d="M64 93h70" strokeDasharray="4 5" /></g>
        : kind === 'encoderSensor' ? <g><circle cx="100" cy="64" r="23" fill="#e6b863" strokeWidth="6" strokeDasharray="5 5" /><circle cx="100" cy="64" r="7" fill="#354653" /></g>
        : <g><circle cx="88" cy="67" r="9" fill="#293e49" /><circle cx="115" cy="67" r="9" fill="#b5d0c9" /><path d="M85 32h34m-29-8h24" stroke="#ba7937" /></g>}
      </g>}
      {isKitComponent(kind) && !sensor && <g><rect x="42" y="43" width="116" height="49" rx="8" fill="#4b83a6" /><rect x="72" y="52" width="56" height="31" rx="7" fill="#354653" /><path d="M58 92v16m28-16v16m28-16v16m28-16v16" stroke="#be913d" strokeWidth="5" /><circle cx="100" cy="67" r="7" fill="#e0b35e" /></g>}
    </g>
  </svg>;
}

function CircuitPlan({ kind, c }) {
  const routes = WIRING_PLANS[kind] ?? [], [active, setActive] = useState(0);
  const selected = routes[active] ?? routes[0];
  if (!selected) return null;
  return <section className="workshop-guide-circuit" aria-label={c.plan}>
    <h4>{c.plan}</h4>
    <svg viewBox="0 0 320 174" role="img" aria-label={selected.from + ' → ' + selected.to}>
      <rect x="4" y="15" width="87" height="146" rx="12" fill="#dfeee7" stroke="#538978" />
      <rect x="229" y="15" width="87" height="146" rx="12" fill="#e4edf0" stroke="#658694" />
      <text x="47" y="37" textAnchor="middle" fill="#28463f" fontSize="12">{c.sensorLabel}</text>
      <text x="272" y="37" textAnchor="middle" fill="#284653" fontSize="12">UNO</text>
      {routes.map((route, i) => {
        const y = 58 + i * 27, on = active === i;
        return <g key={route.from} opacity={on ? 1 : .4}>
          <path d={'M84 '+y+' C130 '+y+' 175 '+(y+9)+' 236 '+y} fill="none" stroke={route.colour} strokeWidth={on ? 6 : 3} />
          <circle cx="84" cy={y} r={on ? 6 : 4} fill={route.colour} /><circle cx="236" cy={y} r={on ? 6 : 4} fill={route.colour} />
          <text x="69" y={y+4} textAnchor="end" fontSize="12" fill="#243b3b">{route.from}</text><text x="248" y={y+4} fontSize="12" fill="#243b3b">{route.to}</text>
          <path d={'M86 '+y+' C130 '+y+' 175 '+(y+9)+' 235 '+y} fill="none" stroke="transparent" strokeWidth="22" className="workshop-guide-wire-hit" onClick={() => setActive(i)} />
        </g>;
      })}
    </svg>
    <div className="workshop-guide-routes">{routes.map((route, i) => <button key={route.from} className="workshop-guide-route" style={{ '--workshop-guide-wire': route.colour }}
      data-guide-route={route.from} aria-pressed={active === i} onClick={() => setActive(i)}><span aria-hidden="true" />{route.from} → {route.to}</button>)}</div>
    <p className="workshop-guide-route-note" aria-live="polite"><b>{selected.from} → {selected.to}</b> · {c[selected.why]}</p><p className="workshop-guide-small">{c.planHint}</p>
  </section>;
}
function CopySection({ title, children, tone }) {
  return <section className={'workshop-guide-note' + (tone ? ' workshop-guide-note-' + tone : '')}><h4>{title}</h4><p>{children}</p></section>;
}

export default function WorkshopGuide() {
  const locale = useI18n(s => s.locale), c = getWorkshopCopy(locale), id = useId();
  const parts = useBuildStore(s => s.parts), wires = useBuildStore(s => s.wires), running = useBuildStore(s => s.running);
  const [initial] = useState(readProgress);
  const [open, setOpen] = useState(false), [tab, setTab] = useState('lessons');
  const [progress, setProgress] = useState(initial), [storageOK, setStorageOK] = useState(true);
  const [lessonId, setLessonId] = useState(initial.active);
  const [stepIndex, setStepIndex] = useState(() => initial.completed[initial.active]?.length ?? 0);
  const [kind, setKind] = useState('board'), [query, setQuery] = useState(''), [group, setGroup] = useState('all');
  const [ready, setReady] = useState(false), [confirm, setConfirm] = useState(false);
  const launcher = useRef(null), closeButton = useRef(null), content = useRef(null), heading = useRef(null), confirmBox = useRef(null);
  const evidence = useRef(null), tabs = useRef({});
  const lesson = WORKSHOP_LESSONS.find(l => l.id === lessonId), step = lesson?.steps[stepIndex];
  const catalogue = [...new Set([...Object.values(CATALOGUE).flat(), ...SENSOR_KINDS])].filter(k => c.parts[k]);
  const matches = catalogue.filter(k => (group === 'all' || (PART_SPECS[k]?.group ?? 'electronics') === group)
    && c.parts[k].name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)));
  const currentPart = Object.values(parts).find(p => p.kind === kind);
  const connection = currentPart && SENSOR_KINDS.includes(kind) ? sensorConnection(currentPart, parts, wires) : null;

  useEffect(() => {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); setStorageOK(true); }
    catch { setStorageOK(false); }
  }, [progress]);
  useEffect(() => {
    evidence.current = createEvidence(useBuildStore.getState());
    if (!step) { setReady(false); return; }
    const check = () => {
      const b = useBuildStore.getState(), context = contextFor(b);
      observeWorkshop(evidence.current, b, rt, context);
      setReady(lessonReady(step, b, context, evidence.current));
    };
    check();
    // Reopening never resets evidence. Store subscriptions catch rapid XYZ edits.
    const unsubscribe = useBuildStore.subscribe(check), uiUnsubscribe = useUiStore.subscribe(check);
    const timer = setInterval(check, 160);
    return () => { unsubscribe(); uiUnsubscribe(); clearInterval(timer); };
  }, [step, lessonId]);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const escape = e => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); e.stopPropagation();
      if (confirm) { setConfirm(false); closeButton.current?.focus(); }
      else { setOpen(false); requestAnimationFrame(() => launcher.current?.focus()); }
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [open, confirm]);
  useEffect(() => { if (confirm) confirmBox.current?.querySelector('button')?.focus(); }, [confirm]);
  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [lessonId, stepIndex, tab, kind]);

  const close = () => { setOpen(false); setConfirm(false); requestAnimationFrame(() => launcher.current?.focus()); };
  const start = l => {
    setLessonId(l.id); setStepIndex(progress.completed[l.id]?.length ?? 0);
    setProgress(p => ({ ...p, active: l.id })); setConfirm(false);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const advance = () => {
    const b = useBuildStore.getState(), context = contextFor(b);
    observeWorkshop(evidence.current, b, rt, context);
    if (!lessonReady(step, b, context, evidence.current)) { setReady(false); return; }
    // This is the only completion write: recheck the real state on Next.
    setProgress(p => cleanProgress({ ...p, active: lesson.id, completed: {
      ...p.completed, [lesson.id]: [...new Set([...(p.completed[lesson.id] ?? []), step])],
    } }));
    setStepIndex(i => i + 1);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const focusPart = (targetKind = kind) => {
    const b = useBuildStore.getState();
    const target = b.parts[b.selected]?.kind === targetKind ? b.parts[b.selected] : Object.values(b.parts).find(p => p.kind === targetKind);
    if (!target) return;
    b.select(target.id); useUiStore.getState().requestCamera('focus', target.id);
  };
  const place = targetKind => {
    const b = useBuildStore.getState(), ui = useUiStore.getState(), spec = PART_SPECS[targetKind];
    if (b.running) return ui.toast(c.stopFirst, 'warn');
    if (!spec) return ui.toast(c.unavailable, 'warn');
    if ((spec.group === 'electronics' && !b.boardPart())
      || (spec.place !== 'flat' && candidateNodes(targetKind, b.parts, b.isNodeTaken).length === 0))
      return ui.toast(c.prerequisite, 'warn');
    // Never overwrite a part already being carried (especially one picked up).
    if (b.pending || b.wiring) return ui.toast(c.finishGesture, 'warn');
    b.beginPlace(targetKind);
    if (window.matchMedia('(max-width: 700px)').matches) close();
  };
  const action = value => {
    const ui = useUiStore.getState();
    if (value === 'program') { ui.setDockTab('program'); if (window.matchMedia('(max-width: 700px)').matches) close(); }
    else if (value === 'wiring') { if (!ui.wireMode) ui.toggleWireMode(); focusPart(tab === 'library' ? kind : lesson?.art ?? kind); }
    else if (value === 'focus') { const b = useBuildStore.getState(); if (b.selected) ui.requestCamera('focus', b.selected); else ui.requestCamera('frameAll'); }
    else place(value);
  };
  const loadStarter = () => {
    const b = useBuildStore.getState();
    if (b.running || !lesson?.starter) return;
    // Empty scenes can still contain valuable code: confirm all replacements.
    const template = getTemplate(lesson.starter);
    if (template) b.loadBuildFromJSON(JSON.parse(JSON.stringify(template.json)), c.lesson[lesson.id].title);
    setConfirm(false); closeButton.current?.focus();
  };
  const tabKey = e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const target = e.key === 'Home' ? 'lessons' : e.key === 'End' ? 'library' : tab === 'library' ? 'lessons' : 'library';
    setTab(target); tabs.current[target]?.focus();
  };

  return <div className="workshop-guide-root" onKeyDown={e => e.stopPropagation()}>
    <button className="workshop-guide-launcher" data-testid="workshop-guide" ref={launcher}
      aria-expanded={open} aria-controls={id + '-drawer'} onClick={() => open ? close() : setOpen(true)}>
      <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 6q6-3 11 1 5-4 11-1v17q-6-3-11 1-5-4-11-1Z" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M14 7v17M7 10h3m8 0h3M7 15h3m8 0h3" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      {c.academy}<span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <aside id={id + '-drawer'} className="workshop-guide-drawer" aria-label={c.academy} data-testid="workshop-guide-panel">
      <header className="workshop-guide-header"><div><span className="workshop-guide-eyebrow">ARDUINIUM / {c.academy}</span><p>{c.subtitle}</p></div>
        <button className="workshop-guide-icon" ref={closeButton} aria-label={c.close} onClick={close}>×</button></header>
      {!confirm && <div className="workshop-guide-tabs" role="tablist" aria-label={c.academy} onKeyDown={tabKey}>
        {['lessons', 'library'].map(t => <button key={t} role="tab" id={id + '-' + t} aria-selected={tab === t} aria-controls={id + '-content'}
          tabIndex={tab === t ? 0 : -1} ref={el => { tabs.current[t] = el; }} data-testid={'workshop-guide-' + t} onClick={() => setTab(t)}>{c[t]}</button>)}
      </div>}
      <div className="workshop-guide-content" ref={content} id={id + '-content'} role={confirm ? undefined : 'tabpanel'} aria-labelledby={confirm ? undefined : id + '-' + tab}>
        {confirm ? <section ref={confirmBox} className="workshop-guide-confirm" role="alertdialog" aria-labelledby={id + '-confirm'} aria-describedby={id + '-confirm-body'}
          onKeyDown={e => {
            if (e.key !== 'Tab') return;
            const buttons = [...e.currentTarget.querySelectorAll('button')];
            if ((e.shiftKey && document.activeElement === buttons[0]) || (!e.shiftKey && document.activeElement === buttons.at(-1))) {
              e.preventDefault(); (e.shiftKey ? buttons.at(-1) : buttons[0]).focus();
            }
          }}>
          <PartIllustration kind={lesson.art} label={c.parts[lesson.art].name} /><h3 id={id + '-confirm'}>{c.confirmTitle}</h3><p id={id + '-confirm-body'}>{c.confirmBody}</p>
          <button className="workshop-guide-button" onClick={() => { setConfirm(false); closeButton.current?.focus(); }}>{c.cancel}</button>
          <button className="workshop-guide-button workshop-guide-danger" data-testid="workshop-guide-confirm-starter" disabled={running} onClick={loadStarter}>{c.replace}</button>
        </section> : tab === 'library' ? <>
          <label className="workshop-guide-search">{c.search}<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <div className="workshop-guide-filters" role="group" aria-label={c.library}>{['all','structure','electronics','components'].map(g => <button key={g} aria-pressed={group === g} onClick={() => setGroup(g)}>{c[g]}</button>)}</div>
          <div className="workshop-guide-parts" aria-label={c.library}>{matches.map(k => <button className="workshop-guide-part" key={k} data-guide-part={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
            <PartIllustration kind={k} label={c.parts[k].name} small /><span>{c.parts[k].name}</span></button>)}{!matches.length && <p>{c.noResults}</p>}</div>
          <article className="workshop-guide-part-detail" data-testid="workshop-guide-part-detail">
            <div className="workshop-guide-detail-heading"><PartIllustration kind={kind} label={c.parts[kind].name} /><h3>{c.parts[kind].name}</h3></div>
            <CopySection title={c.purpose}>{c.parts[kind].purpose}</CopySection><CopySection title={c.connects}>{c.parts[kind].connects}</CopySection><CopySection title={c.pins}>{c.parts[kind].pins}</CopySection>
            {SENSOR_KINDS.includes(kind) && <CircuitPlan key={kind} kind={kind} c={c} />}
            {connection && <p className="workshop-guide-connection" data-ready={connection.ready}>{connection.ready ? '✓ ' + c.connectionReady : c.connectionMissing}
              {!connection.ready && <span> · {connection.missing.filter(k => ['VCC','GND','TRIG','ECHO','OUT'].includes(k)).join(', ')}</span>}</p>}
            <CopySection title={c.mistake} tone="warning">{c.parts[kind].mistake}</CopySection><CopySection title={c.try} tone="try">{c.parts[kind].try}</CopySection>
            <div className="workshop-guide-actions"><button className="workshop-guide-button workshop-guide-primary" disabled={running || !PART_SPECS[kind]} onClick={() => place(kind)}>{c.place}</button>
              <button className="workshop-guide-button" disabled={!currentPart} onClick={() => focusPart()}>{c.focus}</button>{SENSOR_KINDS.includes(kind) && <button className="workshop-guide-button" onClick={() => action('wiring')}>{c.wiring}</button>}</div>
            {SENSOR_KINDS.includes(kind) && <p className="workshop-guide-small">{c.sensorLab}</p>}
          </article>
        </> : !lesson ? <>
          <div className="workshop-guide-intro"><span className="workshop-guide-spark" aria-hidden="true">✳</span><h3>{c.lessonIntro}</h3><p>{c.lessonSub}</p></div>
          <div className="workshop-guide-lessons">{WORKSHOP_LESSONS.map(l => {
            const n = progress.completed[l.id]?.length ?? 0;
            return <button className="workshop-guide-lesson" key={l.id} data-guide-lesson={l.id} onClick={() => start(l)}><PartIllustration kind={l.art} label={c.parts[l.art].name} small />
              <span><b>{c.lesson[l.id].title}</b><small>{c.lesson[l.id].summary}</small><span className="workshop-guide-lesson-status">{n === l.steps.length ? '✓ ' + c.completed : n ? c.resume : c.start}<span>{n}/{l.steps.length}</span></span></span></button>;
          })}</div><p className="workshop-guide-small">{c.starterNote}</p>
        </> : <>
          <button className="workshop-guide-back" onClick={() => { setLessonId(null); setConfirm(false); }}>{'← ' + c.backLessons}</button>
          <h3 className="workshop-guide-lesson-title" ref={heading} tabIndex={-1}>{c.lesson[lesson.id].title}</h3>
          <div className="workshop-guide-progress" aria-label={c.completed} role="progressbar" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={progress.completed[lesson.id]?.length ?? 0}>
            {lesson.steps.map((s, i) => <span key={s} data-complete={progress.completed[lesson.id]?.includes(s)} data-current={i === stepIndex} />)}</div>
          {!step ? <section className="workshop-guide-complete" role="status"><span aria-hidden="true">✳</span><h3>{c.done}</h3><p>{c.doneBody}</p><CopySection title={c.try}>{c.steps[lesson.steps.at(-1)].try}</CopySection></section>
          : <article data-testid="workshop-guide-step" data-guide-step={step}>
            <div className="workshop-guide-step-heading"><PartIllustration kind={lesson.art} label={c.parts[lesson.art].name} small /><div><span className="workshop-guide-eyebrow">{c.step} {stepIndex + 1} / {lesson.steps.length}</span><h3>{c.steps[step].title}</h3></div></div>
            <CopySection title={c.current} tone="action">{c.steps[step].action}</CopySection>{['sonarWire', 'lineWire'].includes(step) && <CircuitPlan key={step} kind={lesson.art} c={c} />}
            <CopySection title={c.why}>{c.steps[step].why}</CopySection><CopySection title={c.mistake} tone="warning">{c.steps[step].mistake}</CopySection><CopySection title={c.try} tone="try">{c.steps[step].try}</CopySection>
            <button className="workshop-guide-button" data-testid="workshop-guide-action" onClick={() => action(lesson.actions[stepIndex])}>{['program','wiring','focus'].includes(lesson.actions[stepIndex]) ? c[lesson.actions[stepIndex]] : c.place + ' · ' + c.parts[lesson.actions[stepIndex]].name}</button>
            {step === 'lineWire' && <button className="workshop-guide-button" onClick={() => action('wiring')}>{c.wiring}</button>}
            <p className="workshop-guide-check" role="status" data-ready={ready}>{ready ? '✓ ' + c.ready : '○ ' + c.waiting}</p>
          </article>}
          {lesson.starter && <details className="workshop-guide-starter"><summary>{c.starter}</summary><p>{c.starterNote}</p><button className="workshop-guide-button" data-testid="workshop-guide-starter" disabled={running} onClick={() => setConfirm(true)}>{c.starter}</button></details>}
        </>}
      </div>
      {!confirm && tab === 'lessons' && lesson && step && <nav className="workshop-guide-navigation" aria-label={c.lessons}><button className="workshop-guide-button" disabled={stepIndex === 0} onClick={() => setStepIndex(i => i - 1)}>{c.back}</button>
        <button className="workshop-guide-button workshop-guide-primary" data-testid="workshop-guide-next" disabled={!ready} onClick={advance}>{stepIndex === lesson.steps.length - 1 ? c.finish : c.next}</button></nav>}
      <footer className="workshop-guide-footer">{storageOK ? c.saved : c.unsaved}</footer>
    </aside>}
  </div>;
}
