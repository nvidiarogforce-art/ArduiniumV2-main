import { useEffect, useState } from 'react'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { useT, partName } from '../i18n/index.js'
import { SENSOR_KINDS, SENSOR_SPECS, sensorConnection } from '../lib/sensors.js'
import { rt } from '../three/runtime.js'
import { makeBlock } from '../lib/program.js'
import { isLed } from '../lib/electronics.js'
import './sensor-lab.css'

function addExperiment(part, pin) {
  const b = useBuildStore.getState()
  if (b.running || pin == null) return
  const led = Object.entries(b.pinMap()).find(([, owner]) => isLed(owner.kind))
  const pinLED = led ? Number(led[0]) : 13
  const sample = { ...makeBlock('setVar'), name: 'reading', a: { src: 'sensor', pin }, op: '' }
  const threshold = { sensor: 20, lineSensor: 50, lightSensor: 50, photoTransistor: 50,
    temperatureSensor: 28, tmp36: 28, touchSensor: 0.5, pushButton: 0.5,
    tiltSensor: 20, tiltSwitch: 0.5, encoderSensor: 90, potentiometer: 50 }[part.kind]
  const check = { ...makeBlock('ifCompare'), a: { src: 'sensor', pin }, op: '>', b: { src: 'num', value: threshold },
    body: [{ ...makeBlock('digitalWrite'), pin: pinLED, value: 'HIGH' }],
    elseBody: [{ ...makeBlock('digitalWrite'), pin: pinLED, value: 'LOW' }] }
  const experiment = { ...makeBlock('repeat'), times: 50, body: [sample, check, { ...makeBlock('wait'), ms: 200 }] }
  b.setProgram([experiment, ...b.program])
  useUiStore.getState().setDockTab('program')
}

function SensorCard({ part, reading, history, running, wires, parts }) {
  const t = useT()
  const connection = sensorConnection(part, parts, wires)
  const definition = SENSOR_SPECS[part.kind]
  const [lo, hi] = definition.range
  const value = running && reading?.ready ? reading.value : null
  const points = history.map((n, i) => `${i * 260 / 59},${48 - Math.max(0, Math.min(1, (n - lo) / (hi - lo))) * 42}`).join(' ')
  const missing = running ? reading?.missing ?? connection.missing : connection.missing
  const missingText = missing.map((key) => key.includes('_') || ['WHEEL', 'PHYSICS', 'ENVIRONMENT'].includes(key) ? t(`lab.${key}`) : key).join(', ')
  const note = { lineSensor: 'lineNote', touchSensor: 'touchNote', pushButton: 'touchNote', encoderSensor: 'encoderNote',
    lightSensor: 'thermalNote', photoTransistor: 'thermalNote', temperatureSensor: 'thermalNote', tmp36: 'thermalNote',
    tiltSensor: 'tiltNote', tiltSwitch: 'tiltNote', potentiometer: 'potNote' }[part.kind]
  return <article className="lab-sensor" data-sensor-card={part.kind}>
    <div className="lab-sensor-heading"><b>{partName(part.kind)}</b><span className={connection.ready ? 'lab-ready' : 'lab-warning'}>{connection.ready ? '●' : '○'} {connection.pin != null ? (connection.pin >= 14 ? `A${connection.pin - 14}` : `D${connection.pin}`) : '—'}</span></div>
    <div className="lab-readout"><strong>{value == null ? '—' : Number(value).toFixed(part.kind === 'lineSensor' || part.kind === 'touchSensor' ? 0 : 1)}</strong><span>{definition.unit}</span><small>{running ? (value == null ? t('lab.noSignal') : t('lab.live')) : t('lab.stopped')}</small></div>
    <svg viewBox="0 0 260 54" className="lab-chart" role="img" aria-label={t('lab.graph')}>
      {[6, 27, 48].map((y) => <line key={y} x1="0" x2="260" y1={y} y2={y} stroke="#dce7e3" strokeDasharray="3 5" />)}
      <polyline points={points} fill="none" stroke="#16805e" strokeWidth="2" strokeLinejoin="round" />
    </svg>
    <div className="lab-chart-caption"><span>{t('lab.graph')}</span><span>{lo}–{hi} {definition.unit}</span></div>
    {missing.length > 0 && <p className="lab-connection-warning">{t('lab.missing', { pins: missingText })}</p>}
    {note && <p>{t(`lab.${note}`)}</p>}
    <div className="lab-sensor-actions"><button onClick={() => { const ui = useUiStore.getState(); if (!ui.wireMode) ui.toggleWireMode(); useBuildStore.getState().select(part.id); ui.requestCamera('focus', part.id) }}>{t('lab.wiring')}</button>
      <button disabled={running || !connection.ready} onClick={() => { addExperiment(part, connection.pin); useUiStore.getState().toast(t('lab.added'), 'good') }}>{t('lab.testProgram')}</button></div>
  </article>
}

export default function SensorLab() {
  const t = useT()
  const parts = useBuildStore((s) => s.parts)
  const wires = useBuildStore((s) => s.wires)
  const running = useBuildStore((s) => s.running)
  const [samples, setSamples] = useState({ readings: {}, history: {} })
  const [environment, setEnvironment] = useState(() => ({ ...rt.environment }))
  useEffect(() => {
    setSamples({ readings: {}, history: {} })
    if (!running) return
    const timer = setInterval(() => setSamples((previous) => {
      const readings = { ...rt.sensorReadings }
      const history = {}
      for (const [id, reading] of Object.entries(readings)) history[id] = reading.ready && Number.isFinite(reading.value)
        ? [...(previous.history[id] ?? []), reading.value].slice(-60) : []
      return { readings, history }
    }), 200)
    return () => clearInterval(timer)
  }, [running])
  const sensors = Object.values(parts).filter((p) => SENSOR_KINDS.includes(p.kind))
  const setCondition = (name, value) => { rt.environment = { ...rt.environment, [name]: value }; setEnvironment({ ...rt.environment }) }
  return <details className="sensor-lab" open data-testid="sensor-lab">
    <summary><span>◉ {t('lab.title')}</span><span className="lab-count">{sensors.length}</span></summary>
    {sensors.length === 0 ? <div className="lab-empty"><p>{t('lab.empty')}</p><button onClick={() => { const ui = useUiStore.getState(); ui.setPartsTab('electronics'); ui.setDrawer('left', true) }}>{t('lab.add')}</button></div>
      : sensors.map((part) => <SensorCard key={part.id} part={part} parts={parts} wires={wires} running={running} reading={samples.readings[part.id]} history={samples.history[part.id] ?? []} />)}
    <fieldset className="lab-environment"><legend>{t('lab.environment')}</legend>
      <label>{t('lab.light')}<output>{environment.light}%</output><input data-testid="lab-light" aria-label={t('lab.light')} type="range" min="0" max="100" value={environment.light} onChange={(e) => setCondition('light', Number(e.target.value))} /></label>
      <label>{t('lab.temperature')}<output>{environment.temperature} °C</output><input data-testid="lab-temperature" aria-label={t('lab.temperature')} type="range" min="-10" max="50" value={environment.temperature} onChange={(e) => setCondition('temperature', Number(e.target.value))} /></label>
      <label>{t('lab.potentiometer')}<output>{environment.potentiometer}%</output><input data-testid="lab-potentiometer" aria-label={t('lab.potentiometer')} type="range" min="0" max="100" value={environment.potentiometer} onChange={(e) => setCondition('potentiometer', Number(e.target.value))} /></label>
      <button className={environment.button ? 'is-pressed' : ''} data-testid="lab-button"
        onPointerDown={() => setCondition('button', 1)} onPointerUp={() => setCondition('button', 0)} onPointerLeave={() => setCondition('button', 0)}>
        {environment.button ? t('lab.buttonPressed') : t('lab.button')}
      </button>
      <p>{t('lab.simulated')}</p>
    </fieldset>
  </details>
}
