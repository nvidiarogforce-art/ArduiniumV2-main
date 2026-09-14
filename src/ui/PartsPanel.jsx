import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { CATALOGUE } from '../lib/parts.js'
import { useT } from '../i18n/index.js'
import { sfx, unlockAudio } from '../lib/sfx.js'

/**
 * The parts palette. Two tabs, big cards, plain-language names — a student
 * should never have to know the words "instantiate" or "component library".
 *
 * The list itself comes straight from the snap matrix in `parts.js`, so the
 * palette can never drift out of step with what the builder actually accepts.
 */
const ICON_FOR = {
  led: 'led',
  ledRed: 'led', ledGreen: 'ledGreen', ledYellow: 'ledYellow', ledBlue: 'ledBlue', ledWhite: 'ledWhite', rgbLed: 'rgbLed',
  sensor: 'sensor',
  lineSensor: 'lineSensor',
  lightSensor: 'lightSensor',
  temperatureSensor: 'temperatureSensor',
  touchSensor: 'touchSensor',
  tiltSensor: 'tiltSensor',
  encoderSensor: 'encoderSensor',
  photoTransistor: 'lightSensor', tmp36: 'temperatureSensor', tiltSwitch: 'tiltSensor',
  potentiometer: 'potentiometer', pushButton: 'pushButton', resistor: 'resistor', diode: 'diode',
  capacitor: 'capacitor', transistor: 'transistor', mosfet: 'mosfet', optocoupler: 'chip',
  motorDriver: 'chip', piezo: 'piezo', servo: 'servo', lcd: 'lcd', battery9v: 'battery9v',
  breadboard: 'breadboard',
  board: 'board',
  strip5: 'strip',
  strip7: 'strip',
  strip11: 'strip',
  strip15: 'strip',
  deck: 'deck',
  plate3x5: 'deck',
  turntableBase: 'turntable', turntableTop: 'turntableTop',
  gearSmall: 'gearSmall', gearLarge: 'gearLarge',
  gripperPalm: 'gripperPalm', gripperJawL: 'gripperJawL', gripperJawR: 'gripperJawR',
  servoHorn: 'servoHorn',
  lbracket: 'lbracket',
  motormount: 'motormount',
  motor: 'motor',
  wheel: 'wheel',
  caster: 'caster',
  standoff: 'standoff',
  upright: 'upright',
}

export default function PartsPanel() {
  const tab = useUiStore((s) => s.partsTab)
  const setTab = useUiStore((s) => s.setPartsTab)
  const mode = useUiStore((s) => s.workflowMode)
  const beginPlace = useBuildStore((s) => s.beginPlace)
  const pending = useBuildStore((s) => s.pending)
  const t = useT()

  return (
    <>
      <div className="panel-head">{t('ui.parts')}</div>

      <div className="tabs">
        {['electronics', 'components', 'structure'].map((id) => (
          <button
            key={id}
            className={tab === id ? 'tab is-on' : 'tab'}
            onClick={() => setTab(id)}
            data-tab={id}
          >
            {t(`ui.${id}`)}
          </button>
        ))}
      </div>

      <div className="panel-body">
        <div className="part-grid">
          {CATALOGUE[tab].map((kind) => (
            <button
              key={kind}
              className={pending?.kind === kind ? 'part-card is-held' : 'part-card'}
              data-part={kind}
              title={t(`parts.${kind}.desc`)}
              onClick={() => {
                unlockAudio()
                sfx.pick()
                beginPlace(kind)
              }}
            >
              <span className="part-thumb">
                <PartIcon type={ICON_FOR[kind]} />
              </span>
              <span>
                <span className="part-name">{t(`parts.${kind}.name`)}</span>
                <span className="part-desc">{t(`parts.${kind}.desc`)}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="hint-box">
          <b>{t(mode === 'circuit' ? 'ui.circuitHowTitle' : 'ui.howTitle')}</b>
          {t(mode === 'circuit' ? 'ui.circuitHowBody' : 'ui.howBody')}
        </div>
      </div>
    </>
  )
}

function PartIcon({ type }) {
  switch (type) {
    case 'breadboard':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="2" y="6" width="28" height="20" rx="2.5" fill="#f7f5ed" stroke="#bfc3c5" />
          <path d="M4 9h24M4 23h24" stroke="#d84a45" strokeWidth="1" />
          <path d="M4 11h24M4 21h24" stroke="#3d78bd" strokeWidth="1" />
          <path d="M3 16h26" stroke="#d2d0c8" strokeWidth="1.5" />
          {Array.from({ length: 11 }, (_, c) => [13, 15, 17, 19].map((y) => (
            <circle key={`${c}-${y}`} cx={5 + c * 2.2} cy={y} r=".55" fill="#3a3e42" />
          )))}
        </svg>
      )
    case 'led':
    case 'ledGreen':
    case 'ledYellow':
    case 'ledBlue':
    case 'ledWhite': {
      const colour = { led: '#dd5346', ledGreen: '#32a66a', ledYellow: '#e8b83f', ledBlue: '#377bd8', ledWhite: '#e9eef4' }[type]
      return (
        <svg viewBox="0 0 32 32">
          <path d="M11 18a5 5 0 0 1 10 0v4H11z" fill={colour} />
          <path d="M13 22v6M19 22v6" stroke="#9aa3ad" strokeWidth="2" strokeLinecap="round" />
          <path d="M16 4v4M9 7l2 3M23 7l-2 3" stroke="#ef8b2c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    }
    case 'rgbLed':
      return <svg viewBox="0 0 32 32"><defs><linearGradient id="rgb" x1="0" x2="1"><stop stopColor="#e34b43"/><stop offset=".5" stopColor="#35a768"/><stop offset="1" stopColor="#377bd8"/></linearGradient></defs><path d="M10 18a6 6 0 0 1 12 0v4H10z" fill="url(#rgb)"/><path d="M11 22v6M14 22v6M18 22v6M21 22v6" stroke="#9aa3ad" strokeWidth="1.5"/></svg>
    case 'sensor':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="3" y="10" width="26" height="13" rx="2" fill="#2f6fd9" />
          <circle cx="11" cy="16.5" r="4.4" fill="#e9eef4" />
          <circle cx="21" cy="16.5" r="4.4" fill="#e9eef4" />
          <circle cx="11" cy="16.5" r="2" fill="#22303c" />
          <circle cx="21" cy="16.5" r="2" fill="#22303c" />
        </svg>
      )
    case 'lineSensor':
    case 'lightSensor':
    case 'temperatureSensor':
    case 'touchSensor':
    case 'tiltSensor':
    case 'encoderSensor':
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <rect x="4" y="8" width="24" height="19" rx="2" fill={{ lineSensor: '#174b9c', lightSensor: '#166343', temperatureSensor: '#236fa5', touchSensor: '#932b37', tiltSensor: '#573589', encoderSensor: '#174e66' }[type]} />
          <path d="M9 6v5M16 6v5M23 6v5" stroke="#dcba56" strokeWidth="2" />
          {type === 'lineSensor' && <><path d="M9 24l3-9h8l3 9" fill="none" stroke="#f4ead7" strokeWidth="2" /><circle cx="12" cy="16" r="3" fill="#151f30" /><circle cx="20" cy="16" r="3" fill="#9bd0d7" /></>}
          {type === 'lightSensor' && <><circle cx="16" cy="18" r="6" fill="#e6b97f" /><path d="M13 14v8h3v-8h3v8" fill="none" stroke="#874830" strokeWidth="1.5" /><path d="M4 3l4 2M28 3l-4 2M16 1v3" stroke="#e9a62f" strokeWidth="1.5" /></>}
          {type === 'temperatureSensor' && <><path d="M14 13a2 2 0 0 1 4 0v6a4 4 0 1 1-4 0z" fill="#e8e1d2" /><path d="M16 14v7" stroke="#db443c" strokeWidth="2" /><circle cx="16" cy="22" r="2" fill="#db443c" /></>}
          {type === 'touchSensor' && <><rect x="8" y="16" width="16" height="8" rx="1" fill="#222b35" /><path d="M9 16l12-4" stroke="#dadfe1" strokeWidth="2" /><rect x="14" y="14" width="6" height="4" fill="#f16858" /></>}
          {type === 'tiltSensor' && <><rect x="10" y="13" width="12" height="11" rx="2" fill="#222b35" /><path d="M16 15v7M12 19h8" stroke="#f2e8d7" strokeWidth="1.5" /><path d="M24 12l2 3-3 1" fill="none" stroke="#e9b844" strokeWidth="1.5" /></>}
          {type === 'encoderSensor' && <><circle cx="16" cy="18" r="7" fill="#e0b747" /><circle cx="16" cy="18" r="3.5" fill="none" stroke="#25323c" strokeWidth="2" strokeDasharray="2 2" /><rect x="23" y="14" width="3" height="8" fill="#222b35" /></>}
        </svg>
      )
    case 'motor':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="4" y="10" width="17" height="13" rx="4" fill="#8f98a4" />
          <rect x="21" y="14.5" width="8" height="4" rx="2" fill="#ef8b2c" />
          <path d="M8 10v13M13 10v13" stroke="#6d7783" strokeWidth="1.6" />
        </svg>
      )
    case 'resistor':
    case 'diode':
      return <svg viewBox="0 0 32 32"><path d="M2 16h8M22 16h8" stroke="#929da7" strokeWidth="2"/><rect x="9" y="11" width="14" height="10" rx="4" fill={type === 'diode' ? '#252b31' : '#d8b17a'}/><path d="M13 11v10M18 11v10" stroke={type === 'diode' ? '#e6ebef' : '#7a4d2d'} strokeWidth="2"/></svg>
    case 'capacitor':
      return <svg viewBox="0 0 32 32"><ellipse cx="16" cy="9" rx="7" ry="3" fill="#5372a0"/><path d="M9 9v13c0 4 14 4 14 0V9" fill="#334c78"/><path d="M13 25v5M19 25v5" stroke="#9aa3ad" strokeWidth="2"/></svg>
    case 'transistor':
    case 'mosfet':
      return <svg viewBox="0 0 32 32"><path d="M10 24V10h12v14" fill="#202831"/><path d="M12 24v6M16 24v6M20 24v6" stroke="#aab4bd" strokeWidth="2"/>{type === 'mosfet' && <rect x="12" y="7" width="8" height="4" fill="#bdc7cf"/>}</svg>
    case 'chip':
      return <svg viewBox="0 0 32 32"><rect x="8" y="7" width="16" height="18" rx="2" fill="#202831"/><path d="M5 10h3M5 15h3M5 20h3M24 10h3M24 15h3M24 20h3" stroke="#bdc7cf" strokeWidth="2"/><circle cx="12" cy="11" r="1.5" fill="#6f7a83"/></svg>
    case 'potentiometer':
      return <svg viewBox="0 0 32 32"><rect x="7" y="13" width="18" height="13" rx="2" fill="#2b71bd"/><circle cx="16" cy="13" r="7" fill="#bdc7cf"/><path d="M16 7v6" stroke="#3d4750" strokeWidth="2"/></svg>
    case 'pushButton':
      return <svg viewBox="0 0 32 32"><rect x="7" y="13" width="18" height="13" rx="2" fill="#bdc7cf"/><rect x="11" y="7" width="10" height="10" rx="2" fill="#343a40"/></svg>
    case 'piezo':
      return <svg viewBox="0 0 32 32"><circle cx="16" cy="17" r="11" fill="#202831"/><circle cx="16" cy="17" r="3" fill="#090d11"/><path d="M25 8l4-3M27 13h4" stroke="#ef8b2c" strokeWidth="2"/></svg>
    case 'servo':
      return <svg viewBox="0 0 32 32"><rect x="7" y="11" width="18" height="15" rx="3" fill="#2765a8"/><circle cx="18" cy="10" r="4" fill="#dce3e8"/><path d="M6 6h24" stroke="#eef1eb" strokeWidth="3"/></svg>
    case 'servoHorn':
      return <svg viewBox="0 0 32 32"><path d="M4 16h24M16 4v24" stroke="#eef1eb" strokeWidth="5" strokeLinecap="round"/><circle cx="16" cy="16" r="4" fill="#aeb8c2" stroke="#263746" strokeWidth="1.5"/><circle cx="7" cy="16" r="1.5" fill="#263746"/><circle cx="25" cy="16" r="1.5" fill="#263746"/></svg>
    case 'lcd':
      return <svg viewBox="0 0 32 32"><rect x="2" y="7" width="28" height="19" rx="2" fill="#176b78"/><rect x="6" y="11" width="20" height="11" fill="#b8cf69"/><path d="M9 14h6M17 14h6M9 18h5M16 18h7" stroke="#47633f" strokeWidth="2"/></svg>
    case 'battery9v':
      return <svg viewBox="0 0 32 32"><rect x="8" y="7" width="16" height="22" rx="2" fill="#353a40"/><rect x="8" y="10" width="16" height="7" fill="#d99a32"/><circle cx="13" cy="6" r="2" fill="#bdc7cf"/><circle cx="19" cy="6" r="2.7" fill="#bdc7cf"/></svg>
    case 'board':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="3" y="7" width="26" height="18" rx="2.5" fill="#23a06a" />
          <rect x="6" y="9.5" width="17" height="2.6" rx="1.3" fill="#22303c" />
          <rect x="6" y="20" width="20" height="2.6" rx="1.3" fill="#22303c" />
          <rect x="19" y="14" width="7" height="4" rx="1" fill="#1a6b48" />
        </svg>
      )
    case 'strip':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="2" y="12" width="28" height="8" rx="4" fill="#2f6fd9" />
          {[7, 13, 19, 25].map((x) => (
            <circle key={x} cx={x} cy="16" r="2.1" fill="#f2ece1" />
          ))}
        </svg>
      )
    case 'deck':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="3" y="6" width="26" height="20" rx="3" fill="#2f6fd9" />
          {[10, 16, 22].map((y) =>
            [8, 14, 20, 26].map((x) => (
              <circle key={`${x}-${y}`} cx={x - 1} cy={y} r="1.9" fill="#f2ece1" />
            )),
          )}
        </svg>
      )
    case 'turntable':
    case 'turntableTop':
      return <svg viewBox="0 0 32 32"><ellipse cx="16" cy="19" rx="13" ry="8" fill={type === 'turntable' ? '#2f6fd9' : '#e5a62f'}/><ellipse cx="16" cy="16" rx="9" ry="6" fill="none" stroke="#cbd3da" strokeWidth="2"/><circle cx="16" cy="16" r="2" fill="#f2ece1"/><circle cx="9" cy="18" r="1.4" fill="#f2ece1"/><circle cx="23" cy="18" r="1.4" fill="#f2ece1"/></svg>
    case 'gearSmall':
    case 'gearLarge': {
      const teeth = type === 'gearLarge' ? 12 : 9
      const points = Array.from({ length: teeth * 2 }, (_, i) => {
        const a = i / (teeth * 2) * Math.PI * 2
        const r = i % 2 ? 10 : 13
        return `${16 + Math.cos(a) * r},${16 + Math.sin(a) * r}`
      }).join(' ')
      return <svg viewBox="0 0 32 32"><polygon points={points} fill={type === 'gearLarge' ? '#e7b13c' : '#394550'}/><circle cx="16" cy="16" r="3" fill="#f2ece1"/></svg>
    }
    case 'gripperPalm':
      return <svg viewBox="0 0 32 32"><rect x="5" y="11" width="22" height="10" rx="3" fill="#3d7fd5"/><circle cx="10" cy="16" r="2" fill="#f2ece1"/><circle cx="16" cy="16" r="2" fill="#f2ece1"/><circle cx="22" cy="16" r="2" fill="#f2ece1"/></svg>
    case 'gripperJawL':
    case 'gripperJawR':
      return <svg viewBox="0 0 32 32"><path d={type === 'gripperJawL' ? 'M25 9H10v7H5v9h7v-4h13z' : 'M7 9h15v7h5v9h-7v-4H7z'} fill="#d2a23c"/><circle cx={type === 'gripperJawL' ? 22 : 10} cy="15" r="2" fill="#f2ece1"/></svg>
    case 'lbracket':
      return (
        <svg viewBox="0 0 32 32">
          <path d="M6 26V6h7v13h13v7z" fill="#2f6fd9" />
          <circle cx="9.5" cy="10" r="1.9" fill="#f2ece1" />
          <circle cx="22" cy="22.5" r="1.9" fill="#f2ece1" />
        </svg>
      )
    case 'motormount':
      return (
        <svg viewBox="0 0 32 32">
          <path d="M7 5h4v22H7z" fill="#4d5a68" />
          <path d="M11 5h13v4H11zM11 23h13v4H11z" fill="#4d5a68" />
          <circle cx="20" cy="16" r="5.5" fill="none" stroke="#8d97a3" strokeWidth="2.4" />
        </svg>
      )
    case 'wheel':
      return (
        <svg viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="#2f343c" />
          <circle cx="16" cy="16" r="5" fill="#c9d1da" />
          <circle cx="16" cy="16" r="2" fill="#7c8c99" />
        </svg>
      )
    case 'caster':
      return (
        <svg viewBox="0 0 32 32">
          <rect x="8" y="4" width="16" height="4" rx="1.5" fill="#8d97a3" />
          <path d="M13.5 8h5v7h-5z" fill="#8d97a3" />
          <circle cx="16" cy="21" r="6.5" fill="#3c444e" />
          <circle cx="13.6" cy="18.6" r="1.7" fill="#6b7683" />
        </svg>
      )
    case 'standoff':
      return (
        <svg viewBox="0 0 32 32">
          <path d="M16 4l7 4v16l-7 4-7-4V8z" fill="#8d97a3" />
          <path d="M16 4l7 4-7 4-7-4z" fill="#b6bfc9" />
          <circle cx="16" cy="8" r="2.4" fill="#2c333b" />
        </svg>
      )
    case 'upright':
      // A vertical post with a hole every PITCH — the part that had a blank
      // thumbnail because no icon row existed for it.
      return (
        <svg viewBox="0 0 32 32">
          <rect x="12" y="3" width="8" height="23" rx="2" fill="#2f6fd9" />
          <rect x="8" y="26" width="16" height="3.4" rx="1.6" fill="#25549f" />
          {[8, 15, 22].map((y) => (
            <circle key={y} cx="16" cy={y} r="2" fill="#f2ece1" />
          ))}
        </svg>
      )
    default:
      return null
  }
}
