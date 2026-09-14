import { useEffect, useRef, useState } from 'react'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { useI18n, useT, LOCALE_LIST } from '../i18n/index.js'
import { TEMPLATES } from '../lib/templates.js'
import { MISSIONS } from '../lib/missions.js'
import { MAPS, getMap } from '../lib/maps.js'
import { sfx, unlockAudio } from '../lib/sfx.js'

const VIEWS = [
  ['default', 'v34'],
  ['top', 'vTop'],
  ['front', 'vFront'],
  ['side', 'vSide'],
  ['frameAll', 'vFit'],
]

export default function TopBar() {
  const [menu, setMenu] = useState(null)
  const wrap = useRef(null)

  const loadBuildFromJSON = useBuildStore((s) => s.loadBuildFromJSON)
  const exportBuildToJSON = useBuildStore((s) => s.exportBuildToJSON)
  const undo = useBuildStore((s) => s.undo)
  const redo = useBuildStore((s) => s.redo)
  const canUndo = useBuildStore((s) => s.past.length > 0)
  const canRedo = useBuildStore((s) => s.future.length > 0)
  const clearAll = useBuildStore((s) => s.clearAll)

  const requestCamera = useUiStore((s) => s.requestCamera)
  const xray = useUiStore((s) => s.xray)
  const toggleXray = useUiStore((s) => s.toggleXray)
  const teach = useUiStore((s) => s.teach)
  const say = useUiStore((s) => s.say)
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const mission = useUiStore((s) => s.mission)
  const setMission = useUiStore((s) => s.setMission)
  const map = useUiStore((s) => s.map)
  const setMap = useUiStore((s) => s.setMap)
  const running = useBuildStore((s) => s.running)
  const toggleRun = useBuildStore((s) => s.toggleRun)

  const t = useT()
  const locale = useI18n((s) => s.locale)
  const setLocale = useI18n((s) => s.setLocale)

  useEffect(() => {
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setMenu(null)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  const toggleMenu = (id) => {
    unlockAudio()
    sfx.click()
    setMenu(menu === id ? null : id)
  }

  function save() {
    const json = exportBuildToJSON()
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(json.name || 'arduinium-build').replace(/\s+/g, '-').toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    teach('saved', {})
    say('saved', {}, 'good')
  }

  function load(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const ok = loadBuildFromJSON(JSON.parse(String(reader.result)), file.name)
        if (ok) say('loadedBuild', { name: file.name }, 'good')
      } catch {
        say('loadFailed', {}, 'warn')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  return (
    <header className="topbar" ref={wrap}>
      <div className="brand">
        <span className="brand-mark">◈</span>
        <span>
          <span className="brand-name">ARDUINIUM</span>
          <span className="brand-sub">{t('ui.tagline')}</span>
        </span>
      </div>

      {/* ---- task-specific maps ---- */}
      <div className="menu-wrap map-menu-wrap">
        <button
          className={menu === 'maps' ? 'btn primary-btn is-open' : 'btn primary-btn'}
          data-testid="maps"
          onClick={() => toggleMenu('maps')}
          title={t(`maps.${map}.name`)}
        >
          <span aria-hidden="true">{getMap(map).icon}</span>
          <span className="map-button-label">{t('ui.maps')}</span>
          <span className="caret">▾</span>
        </button>
        {menu === 'maps' && (
          <div className="menu wide map-menu">
            {MAPS.map((world) => (
              <button
                key={world.id}
                className={world.id === map ? 'menu-item is-on' : 'menu-item'}
                data-map={world.id}
                onClick={() => {
                  setMenu(null)
                  if (running) toggleRun()
                  setMap(world.id)
                  sfx.click()
                }}
              >
                <span className="menu-icon">{world.icon}</span>
                <span>
                  <strong>{t(`maps.${world.id}.name`)}</strong>
                  <span>{t(`maps.${world.id}.blurb`)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- missions ---- */}
      <div className="menu-wrap">
        <button
          className={menu === 'missions' ? 'btn is-open' : 'btn'}
          data-testid="missions"
          onClick={() => toggleMenu('missions')}
        >
          🎯 {t('ui.missions')} <span className="caret">▾</span>
        </button>
        {menu === 'missions' && (
          <div className="menu wide">
            {MISSIONS.filter((m) => m.kind === 'none' || m.map === map).map((m) => (
              <button
                key={m.id}
                className={m.id === mission ? 'menu-item is-on' : 'menu-item'}
                data-mission={m.id}
                onClick={() => {
                  setMenu(null)
                  setMission(m.id)
                  requestCamera('frameAll')
                  sfx.click()
                  if (m.kind !== 'none') {
                    teach('missionStart', {
                      name: t(`missions.${m.id}.name`),
                      goal: t(`missions.${m.id}.goal`),
                    })
                  }
                }}
              >
                <span className="menu-icon">{m.icon}</span>
                <span>
                  <strong>{t(`missions.${m.id}.name`)}</strong>
                  <span>{t(`missions.${m.id}.blurb`)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---- starter builds ---- */}
      <div className="menu-wrap">
        <button
          className={menu === 'templates' ? 'btn is-open' : 'btn'}
          data-testid="templates"
          onClick={() => toggleMenu('templates')}
        >
          ✨ {t('ui.starters')} <span className="caret">▾</span>
        </button>
        {menu === 'templates' && (
          <div className="menu wide">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                className="menu-item"
                data-template={tpl.id}
                onClick={() => {
                  setMenu(null)
                  loadBuildFromJSON(structuredClone(tpl.json), t(`templates.${tpl.id}.name`))
                  requestCamera('frameAll')
                  sfx.chime()
                }}
              >
                <span className="menu-icon">{tpl.icon}</span>
                <span>
                  <strong>{t(`templates.${tpl.id}.name`)}</strong>
                  <span>{t(`templates.${tpl.id}.blurb`)}</span>
                </span>
              </button>
            ))}
            <button
              className="menu-item"
              onClick={() => {
                setMenu(null)
                clearAll()
                say('cleared')
              }}
            >
              <span className="menu-icon">🧹</span>
              <span>
                <strong>{t('ui.emptyWorkshop')}</strong>
                <span>{t('ui.emptyWorkshopHint')}</span>
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="tool-group segmented">
        <span className="tool-label">{t('ui.view')}</span>
        {VIEWS.map(([id, key]) => (
          <button
            key={id}
            className="seg"
            data-view={id}
            onClick={() => {
              requestCamera(id)
              if (id !== 'frameAll') teach('camera', { view: t(`ui.${key}`) })
              sfx.click()
            }}
          >
            {t(`ui.${key}`)}
          </button>
        ))}
      </div>

      <span className="spacer" />

      <button
        className={xray ? 'btn utility-action is-on' : 'btn utility-action'}
        data-testid="xray"
        aria-label={t('ui.xray')}
        title={t('ui.xray')}
        onClick={() => {
          toggleXray()
          sfx.click()
        }}
      >
        <span aria-hidden="true">🩻</span><span className="button-label">{t('ui.xray')}</span>
      </button>

      <div className="tool-group history-tools">
        <button className="btn utility-action" onClick={undo} disabled={!canUndo} data-testid="undo" aria-label={t('ui.undo')} title={t('ui.undo')}>
          <span aria-hidden="true">↩︎</span><span className="button-label">{t('ui.undo')}</span>
        </button>
        <button className="btn utility-action" onClick={redo} disabled={!canRedo} data-testid="redo" aria-label={t('ui.redo')} title={t('ui.redo')}>
          <span aria-hidden="true">↪︎</span><span className="button-label">{t('ui.redo')}</span>
        </button>
      </div>

      <div className="tool-group file-tools">
        <button className="btn utility-action" onClick={save} data-testid="save" aria-label={t('ui.save')} title={t('ui.save')}>
          <span aria-hidden="true">💾</span><span className="button-label">{t('ui.save')}</span>
        </button>
        <label className="btn utility-action" style={{ cursor: 'pointer' }} aria-label={t('ui.load')} title={t('ui.load')}>
          <span aria-hidden="true">📂</span><span className="button-label">{t('ui.load')}</span>
          <input type="file" accept="application/json" onChange={load} style={{ display: 'none' }} />
        </label>
      </div>

      {/* ---- language ---- */}
      <div className="menu-wrap">
        <button
          className={menu === 'lang' ? 'btn is-open' : 'btn'}
          data-testid="language"
          onClick={() => toggleMenu('lang')}
        >
          🌐 <span className="language-label">{LOCALE_LIST.find((l) => l.code === locale)?.name}</span> <span className="caret">▾</span>
        </button>
        {menu === 'lang' && (
          <div className="menu right">
            {LOCALE_LIST.map((l) => (
              <button
                key={l.code}
                className={l.code === locale ? 'menu-item is-on' : 'menu-item'}
                data-locale={l.code}
                onClick={() => {
                  setLocale(l.code)
                  setMenu(null)
                  sfx.click()
                }}
              >
                <span className="menu-icon">{l.code === 'en' ? '🇬🇧' : l.code === 'ru' ? '🇷🇺' : '🇺🇿'}</span>
                <span>
                  <strong>{l.name}</strong>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="btn icon" onClick={() => setHelpOpen(true)} title={t('ui.help')}>
        ?
      </button>
    </header>
  )
}
