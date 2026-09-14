/**
 * Arduino Starter Kit component catalogue.
 *
 * Geometry, wiring and teaching UI all read this table.  The names mirror the
 * parts in Arduino's official Starter Kit rather than inventing anonymous
 * sockets on the Uno.  Coordinates are local to the small chassis holder each
 * loose component uses in this robotics sandbox.
 */

const pin = (id, type, x, z = -0.17, label = id) => ({ id, label, type, local: [x, 0.035, z] })

export const LED_SPECS = {
  led:       { colour: '#e84f47', emissive: '#ff5140', light: '#ff6a4d', label: 'red' },
  ledRed:    { colour: '#e84f47', emissive: '#ff5140', light: '#ff6a4d', label: 'red' },
  ledGreen:  { colour: '#32a66a', emissive: '#3cff88', light: '#72ff9e', label: 'green' },
  ledYellow: { colour: '#e8b83f', emissive: '#ffd447', light: '#ffe276', label: 'yellow' },
  ledBlue:   { colour: '#377bd8', emissive: '#3b8cff', light: '#68a8ff', label: 'blue' },
  ledWhite:  { colour: '#e9eef4', emissive: '#ffffff', light: '#eaf4ff', label: 'white' },
  rgbLed:    { colour: '#dde5ed', emissive: '#ffffff', light: '#ffffff', label: 'RGB', rgb: true },
}

export const LED_KINDS = Object.keys(LED_SPECS)
export const isLed = (kind) => Object.hasOwn(LED_SPECS, kind)

const threePin = () => [
  pin('VCC', 'vcc', -0.18),
  pin('OUT', 'signal', 0),
  pin('GND', 'gnd', 0.18),
]

export const COMPONENT_SPECS = {
  resistor: {
    model: 'Axial resistor, 220 Ω', family: 'passive', value: 220, unit: 'Ω', size: [0.62, 0.16, 0.3],
    terminals: [pin('1', 'passive', -0.26, 0), pin('2', 'passive', 0.26, 0)],
  },
  diode: {
    model: '1N4007 rectifier diode', family: 'passive', size: [0.62, 0.16, 0.3],
    terminals: [pin('A', 'passive', -0.26, 0), pin('K', 'passive', 0.26, 0)],
  },
  capacitor: {
    model: '100 µF electrolytic capacitor', family: 'passive', size: [0.42, 0.36, 0.38],
    terminals: [pin('+', 'vcc', -0.08, 0), pin('-', 'gnd', 0.08, 0)],
  },
  transistor: {
    model: 'BC547 NPN transistor', family: 'switch', size: [0.46, 0.34, 0.34],
    terminals: [pin('C', 'signal', -0.14), pin('B', 'signal', 0), pin('E', 'gnd', 0.14)],
  },
  mosfet: {
    model: 'IRF520 N-channel MOSFET', family: 'switch', size: [0.5, 0.48, 0.34],
    terminals: [pin('G', 'signal', -0.14), pin('D', 'signal', 0), pin('S', 'gnd', 0.14)],
  },
  optocoupler: {
    model: '4N35 optocoupler', family: 'isolation', size: [0.54, 0.3, 0.36],
    terminals: [pin('A', 'signal', -0.2), pin('K', 'gnd', -0.12), pin('E', 'gnd', 0.12), pin('C', 'signal', 0.2)],
  },
  motorDriver: {
    model: 'L293D dual H-bridge', family: 'driver', size: [0.9, 0.26, 0.52],
    terminals: [
      pin('EN12', 'input', -0.36, -0.23), pin('IN1', 'input', -0.26, -0.23),
      pin('OUT1', 'output', -0.16, -0.23), pin('GND4', 'gnd', -0.06, -0.23),
      pin('GND5', 'gnd', 0.06, -0.23), pin('OUT2', 'output', 0.16, -0.23),
      pin('IN2', 'input', 0.26, -0.23), pin('VMOT', 'powerIn', 0.36, -0.23),
      pin('VCC', 'powerIn', -0.36, 0.23), pin('IN4', 'input', -0.26, 0.23),
      pin('OUT4', 'output', -0.16, 0.23), pin('GND13', 'gnd', -0.06, 0.23),
      pin('GND12', 'gnd', 0.06, 0.23), pin('OUT3', 'output', 0.16, 0.23),
      pin('IN3', 'input', 0.26, 0.23), pin('EN34', 'input', 0.36, 0.23),
    ],
  },
  photoTransistor: {
    model: 'Phototransistor on a protected holder', family: 'input', size: [0.44, 0.38, 0.36], terminals: threePin(),
  },
  tmp36: {
    model: 'TMP36 analogue temperature sensor', family: 'input', size: [0.44, 0.36, 0.36], terminals: threePin(),
  },
  tiltSwitch: {
    model: 'Ball tilt switch', family: 'input', size: [0.48, 0.4, 0.36], terminals: threePin(),
  },
  potentiometer: {
    model: '10 kΩ rotary potentiometer', family: 'input', size: [0.52, 0.42, 0.44], terminals: threePin(),
  },
  pushButton: {
    model: '6 mm tactile pushbutton', family: 'input', size: [0.42, 0.28, 0.38],
    terminals: [pin('NO', 'signal', -0.14), pin('COM', 'gnd', 0.14)],
  },
  piezo: {
    model: 'PKM22 piezo capsule', family: 'output', size: [0.58, 0.28, 0.5],
    terminals: [pin('+', 'signal', -0.11), pin('-', 'gnd', 0.11)],
  },
  servo: {
    model: 'Micro servo motor', family: 'output', size: [0.7, 0.56, 0.44],
    // The spline exits through the mounting face. Keeping this physical
    // point in the catalogue lets snapping, the horn mesh and the Rapier
    // joint all consume the same coordinate.
    mechanical: { shaft: [0, -0.28, 0] },
    terminals: [pin('VCC', 'vcc', -0.16), pin('SIG', 'signal', 0), pin('GND', 'gnd', 0.16)],
  },
  lcd: {
    model: 'HD44780 16×2 LCD', family: 'output', size: [1.2, 0.42, 0.68],
    terminals: [
      pin('VCC', 'vcc', -0.35), pin('GND', 'gnd', -0.25), pin('RS', 'signal', -0.15),
      pin('EN', 'signal', -0.05), pin('D4', 'signal', 0.05), pin('D5', 'signal', 0.15),
      pin('D6', 'signal', 0.25), pin('D7', 'signal', 0.35),
    ],
  },
  battery9v: {
    model: '9 V battery with snap lead', family: 'power', size: [0.72, 0.92, 0.42],
    terminals: [pin('+', 'vcc', -0.12), pin('-', 'gnd', 0.12)],
  },
}

export const COMPONENT_KINDS = Object.keys(COMPONENT_SPECS)
export const isKitComponent = (kind) => Object.hasOwn(COMPONENT_SPECS, kind)
export const componentTerminals = (kind) => COMPONENT_SPECS[kind]?.terminals?.map((t) => ({ ...t, local: [...t.local] })) ?? []
