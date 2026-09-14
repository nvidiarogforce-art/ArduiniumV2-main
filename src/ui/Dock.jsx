import { useEffect, useMemo, useRef, useState } from 'react'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { toArduinoCode } from '../lib/program.js'
import { parseArduino } from '../lib/arduinoParser.js'
import { sfx } from '../lib/sfx.js'
import ProgramEditor from './ProgramEditor.jsx'
import { useT } from '../i18n/index.js'

const TABS = [
  ['program', '🧩', 'tabBlocks'],
  ['code', '📄', 'tabCode'],
  ['serial', '🖥️', 'tabSerial'],
]

export default function Dock() {
  const tab = useUiStore((s) => s.dockTab)
  const setTab = useUiStore((s) => s.setDockTab)
  const open = useUiStore((s) => s.drawers.bottom)
  const toggleDrawer = useUiStore((s) => s.toggleDrawer)
  const toggle = () => toggleDrawer('bottom')
  const running = useBuildStore((s) => s.running)
  const t = useT()

  return (
    <>
      <div className="dock-bar">
        {TABS.map(([id, icon, key]) => (
          <button
            key={id}
            className={tab === id && open ? 'dock-tab is-on' : 'dock-tab'}
            data-dock={id}
            onClick={() => setTab(id)}
          >
            {icon} {t(`ui.${key}`)}
          </button>
        ))}
        <span className="spacer" />
        {running && (
          <span className="live-pill">● {t('ui.runningNow')}</span>
        )}
        <button className="btn ghost" onClick={toggle}>
          {open ? `${t('ui.hide')} ▾` : `${t('ui.show')} ▴`}
        </button>
      </div>

      <div className="dock-body">
        {tab === 'program' && <ProgramEditor />}
        {tab === 'code' && <CodeView />}
        {tab === 'serial' && <SerialView />}
      </div>
    </>
  )
}

/**
 * The Arduino sketch — the second way to program the robot.
 *
 * Two states, and the difference matters:
 *
 *   READING  the sketch is generated from the blocks and re-generated whenever
 *            they change. This is the teaching view: "here is what you just
 *            built, in the language you are learning to read".
 *   EDITING  the text is the student's. It is parsed on every keystroke so the
 *            verdict is live, but nothing happens to the program until they
 *            press the button — typing a half-finished line must never blow
 *            their blocks away.
 *
 * Applying parses the text into the SAME block tree the palette builds, so
 * there is no second interpreter and no way for the two modes to disagree
 * about what a program means.
 */
function CodeView() {
  const program = useBuildStore((s) => s.program)
  const setProgram = useBuildStore((s) => s.setProgram)
  const pinMap = useBuildStore((s) => s.pinMap)()
  const say = useUiStore((s) => s.say)
  const teach = useUiStore((s) => s.teach)
  const t = useT()

  const [draft, setDraft] = useState(null)

  const generated = useMemo(() => {
    const labels = {}
    for (const [pin, v] of Object.entries(pinMap)) labels[pin] = v.kind
    return toArduinoCode(program, labels)
  }, [program, pinMap])

  const editing = draft !== null
  const verdict = useMemo(() => (editing ? parseArduino(draft) : null), [editing, draft])

  const apply = () => {
    if (!verdict || verdict.error) {
      say('codeBroken', {}, 'warn')
      sfx.deny()
      return
    }
    setProgram(verdict.blocks)
    setDraft(null)
    teach('codeApplied', { n: verdict.blocks.length })
    sfx.snap()
  }

  return (
    <div className="code-pane">
      <div className="code-bar">
        {editing ? (
          <>
            <button className="btn primary" data-testid="code-apply" onClick={apply}>
              ✓ {t('ui.codeApply')}
            </button>
            <button className="btn ghost" data-testid="code-revert" onClick={() => setDraft(null)}>
              ↩ {t('ui.codeRevert')}
            </button>
            <span
              className={verdict?.error ? 'code-verdict bad' : 'code-verdict ok'}
              data-testid="code-verdict"
            >
              {verdict?.error
                ? t('ui.codeLine', { line: verdict.error.line, message: verdict.error.message })
                : t('ui.codeOk', { n: verdict?.blocks.length ?? 0 })}
            </span>
          </>
        ) : (
          <>
            <button
              className="btn"
              data-testid="code-edit"
              onClick={() => setDraft(generated)}
            >
              ✎ {t('ui.codeEdit')}
            </button>
            <span className="code-verdict">{t('ui.codeHint')}</span>
          </>
        )}
      </div>

      {editing ? (
        <textarea
          className="code-edit"
          data-testid="code-text"
          spellCheck={false}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : (
        <pre className="code-view">
          {generated.split('\n').map((line, i) => (
            <Line key={i} text={line} />
          ))}
        </pre>
      )}
    </div>
  )
}

function Line({ text }) {
  if (text.trim().startsWith('//')) return <span className="tok-com">{text + '\n'}</span>
  const parts = text.split(
    /\b(void|int|float|while|for|if|else|true|HIGH|LOW|OUTPUT|delay|digitalWrite|analogWrite|setMotor|setServo|Serial|pinMode|setup|loop|readDistanceCm)\b|(\d+)|(\/\/.*$)/g,
  )
  return (
    <span>
      {parts.map((p, i) => {
        if (p == null) return null
        if (/^\d+$/.test(p)) return <span key={i} className="tok-num">{p}</span>
        if (p.startsWith('//')) return <span key={i} className="tok-com">{p}</span>
        if (/^(void|int|float|while|for|if|else|true|HIGH|LOW|OUTPUT)$/.test(p))
          return <span key={i} className="tok-kw">{p}</span>
        if (/^(delay|digitalWrite|analogWrite|setMotor|setServo|Serial|pinMode|setup|loop|readDistanceCm)$/.test(p))
          return <span key={i} className="tok-fn">{p}</span>
        return <span key={i}>{p}</span>
      })}
      {'\n'}
    </span>
  )
}

function SerialView() {
  const serial = useBuildStore((s) => s.serial)
  const t = useT()
  const box = useRef(null)

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight
  }, [serial])

  return (
    <div className="serial-view" ref={box} data-testid="serial">
      {serial.length === 0 ? (
        <p className="sys">{t('ui.waitingSerial')}</p>
      ) : (
        serial.slice(-120).map((line, i) => (
          <p
            key={i}
            className={line.startsWith('!!') ? 'bad' : line.startsWith('---') ? 'sys' : undefined}
          >
            {line}
          </p>
        ))
      )}
    </div>
  )
}
