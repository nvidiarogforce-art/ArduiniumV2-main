import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { makeRunner } from '../lib/program.js'
import { PHYSICS, WHEEL } from '../lib/config.js'
import { rt, resetRuntime } from './runtime.js'
import { driveWheels } from './jointRegistry.js'
import { addVec, rotateByQuat } from './vec.js'
import { sfx } from '../lib/sfx.js'
import { t } from '../i18n/index.js'
import { getMission } from '../lib/missions.js'
import { outputConnection } from '../lib/circuits.js'
import { ledConnection } from '../lib/circuits.js'
import { isLed } from '../lib/electronics.js'
import { solveCircuit } from '../lib/electricalSolver.js'
import { getLineTrack } from '../lib/lineTracks.js'

const STEPS_PER_FRAME = 6
const SERIAL_INTERVAL = 500 // ms between sensor lines
const STALL_WINDOW = 1.6 // seconds of "told to move, isn't moving"
const STALL_COOLDOWN = 5
/**
 * The robot is dropped onto the terrain when Run is pressed, and its joints
 * are created over the first couple of frames. Driving a joint motor while
 * that is still settling injects a large impulse into a constraint system that
 * has not yet reached equilibrium — enough to throw the whole robot into the
 * air. So the motors stay off for a moment while everything comes to rest.
 */
const MOTOR_WARMUP_MS = 1000

/** left-side and right-side multipliers for each drive direction. */
const DRIVE_TABLE = {
  forward: [1, 1],
  back: [-1, -1],
  left: [-1, 1],
  right: [1, -1],
  stop: [0, 0],
}

/**
 * The bridge between the program and the machine.
 *
 * Every frame this does four things:
 *   1. advances the block program a few steps
 *   2. pushes the commanded motor speeds into the real Rapier wheel motors
 *   3. streams the sensor reading (measured in SensorRay.jsx) to the Serial
 *      Monitor
 *   4. watches for motors that are being told to spin but aren't (Part 12)
 */
export default function Runtime() {
  const running = useBuildStore((s) => s.running)
  const iterator = useRef(null)
  const finished = useRef(false)
  const lastSerialAt = useRef(0)
  const taught = useRef({})
  const stallTimers = useRef({})

  useEffect(() => {
    const build = useBuildStore.getState()
    const ui = useUiStore.getState()

    if (!running) {
      resetRuntime()
      sfx.piezoOff()
      iterator.current = null
      return
    }

    resetRuntime()
    const mission = getMission(ui.mission)
    const progressTotal = mission.kind === 'checkpoints' ? mission.checkpoints.length
      : mission.kind === 'line' ? getLineTrack(mission.track).checkpoints.length
        : 0
    ui.setMissionProgress(0, progressTotal)
    taught.current = {}
    stallTimers.current = {}
    finished.current = false
    lastSerialAt.current = 0

    /** Teach a lesson at most `max` times per run, so a loop can't flood. */
    const teachOnce = (key, params, max = 3) => {
      const k = key + JSON.stringify(params)
      taught.current[k] = (taught.current[k] ?? 0) + 1
      if (taught.current[k] <= max) ui.teach(key, params)
    }

    const pinMap = build.pinMap()

    iterator.current = makeRunner(build.program, {
      now: () => rt.programClock,

      digitalWrite: (pin, value) => {
        rt.pinHigh[pin] = value === 'HIGH'
        build.pushSerial(`digitalWrite(${pin}, ${value})`)
        if (pinMap[pin]) teachOnce(value === 'HIGH' ? 'ledOn' : 'ledOff', { pin }, 2)
        sfx.tick()
      },

      /**
       * The Drive block. It resolves to plain pin writes — the same thing a
       * student would do by hand with two Motor blocks — so the Serial Monitor
       * shows exactly what it did and nothing is hidden behind a black box.
       */
      drive: (dir, speed) => {
        // Recorded as a standing order rather than applied on the spot. The
        // program can reach its first Drive block before the physics wheels
        // have finished registering, and a fire-and-forget write would simply
        // vanish — which is exactly how "the drive block does nothing" bugs
        // happen. The frame loop re-applies this to whatever wheels exist.
        rt.driveCommand = dir === 'stop' ? null : { dir, speed }
        // A fresh Drive order re-claims every pin a Motor block had overridden.
        rt.motorOverride = {}
        const [l, r] = DRIVE_TABLE[dir] ?? [0, 0]
        if (dir === 'stop') for (const k of Object.keys(rt.motorSpeed)) rt.motorSpeed[k] = 0
        build.pushSerial(`drive(${dir}, ${speed})`)
        if (dir === 'stop') sfx.motorOff()
        else {
          sfx.motorOn()
          teachOnce('driveBlock', {
            dir: t(`blocks.dir${dir[0].toUpperCase()}${dir.slice(1)}`),
            left: l * speed,
            right: r * speed,
          }, 2)
        }
      },

      motor: (pin, speed) => {
        rt.motorSpeed[pin] = speed
        // This pin now belongs to the Motor block until the next Drive block,
        // or the standing Drive order would overwrite it on the next frame.
        rt.motorOverride[pin] = true
        build.pushSerial(`setMotor(${pin}, ${speed})`)
        teachOnce('motorSpeed', { pin, speed }, 2)
        if (speed !== 0) sfx.motorOn()
        else sfx.motorOff()
      },

      servo: (pin, angle) => {
        rt.servoAngle[pin] = angle
        build.pushSerial(`setServo(${pin}, ${angle})`)
        teachOnce('servoAngle', { pin, angle }, 2)
        sfx.tick()
      },

      print: (text) => {
        rt.displayText = String(text)
        build.pushSerial(text)
      },

      distance: () => {
        const reading = Object.values(rt.sensorReadings).find((r) => r.kind === 'sensor' && r.ready)
        if (!reading) throw new Error(t('lab.connectDistance'))
        return reading.value
      },
      sensor: (pin) => {
        const readings = Object.values(rt.sensorReadings).filter((r) => r.pin === pin && r.ready)
        if (readings.length !== 1) throw new Error(t('lab.connectSensor', { pin }))
        return readings[0].value
      },
    })

    build.pushSerial('--- ARDUINIUM virtual serial, 9600 baud ---')
    sfx.start()
  }, [running])

  useFrame((_, rawDelta) => {
    if (!running) return
    const delta = Math.min(rawDelta, 0.05)
    rt.clock += delta * 1000
    rt.programClock = Math.max(0, rt.clock - MOTOR_WARMUP_MS)

    const build = useBuildStore.getState()
    const ui = useUiStore.getState()
    const pinMap = build.pinMap()

    // A piezo is an electrical output, not a global UI sound. It only hums
    // when both of its legs are wired and its assigned pin is active.
    let piezoActive = false
    let piezoFrequency = 880
    for (const part of Object.values(build.parts)) {
      if (part.kind !== 'piezo') continue
      const connection = outputConnection(part, build.parts, build.wires)
      if (!connection.ready) continue
      const pwm = Math.abs(rt.motorSpeed[connection.pin] ?? 0)
      if (rt.pinHigh[connection.pin] || pwm > 0) {
        piezoActive = true
        piezoFrequency = 440 + pwm * 4
        break
      }
    }
    if (piezoActive) sfx.piezoOn(piezoFrequency)
    else sfx.piezoOff()

    // ---- 1. stream the ultrasonic reading -------------------------------
    // The measuring itself happens in SensorRay.jsx, inside the physics
    // world — a real ray from the sensor's transducers to whatever the arena
    // puts in the way. This loop only narrates it to the Serial Monitor. A
    // sensor that claims no pin (unwired, or wired only to power) never
    // measures, so there is nothing to print either.
    const hasSensor = Object.values(rt.sensorReadings).some((v) => v.kind === 'sensor' && v.ready)
    if (hasSensor && rt.distance > 0 && rt.clock - lastSerialAt.current >= SERIAL_INTERVAL) {
      lastSerialAt.current = rt.clock
      build.pushSerial(`Distance: ${rt.distance.toFixed(1)} cm`)
    }

    // ---- 2. advance the program ----------------------------------------
    if (rt.clock > MOTOR_WARMUP_MS && iterator.current && !finished.current) {
      try {
        for (let i = 0; i < STEPS_PER_FRAME; i++) {
          const step = iterator.current.next()
          if (step.done) {
            finished.current = true
            build.pushSerial('--- program finished ---')
            ui.teach('programFinished', {})
            sfx.chime()
            break
          }
        }
      } catch (err) {
        finished.current = true
        rt.driveCommand = null
        for (const pin of Object.keys(rt.motorSpeed)) rt.motorSpeed[pin] = 0
        sfx.motorOff()
        build.pushSerial(`!! ${err.message}`)
        ui.teach('programError', { message: err.message })
        ui.toast(err.message, 'warn')
        sfx.error()
      }
    }

    // ---- 3. drive the wheels -------------------------------------------
    //
    // Each driven wheel gets a force along its rolling direction, applied at
    // the wheel itself. Because the force acts where the wheel touches the
    // ground rather than at the centre of the robot, driving the left and
    // right sides at different speeds produces a genuine turn.
    // A standing Drive order is turned into plain pin speeds every frame, so
    // it keeps working as wheels appear, get re-pinned or are added mid-run.
    const activeDrive = rt.manualDrive ?? rt.driveCommand
    if (activeDrive) {
      const [l, r] = DRIVE_TABLE[activeDrive.dir] ?? [0, 0]
      for (const entry of driveWheels.values()) {
        if (entry.pin == null) continue
        if (!rt.manualDrive && rt.motorOverride[entry.pin]) continue // a Motor block owns this pin
        rt.motorSpeed[entry.pin] =
          (entry.side === 'left' ? l : r) * activeDrive.speed
      }
    }

    const warm = rt.clock > MOTOR_WARMUP_MS
    let sumX = 0
    let sumY = 0
    let sumZ = 0
    let counted = 0

    for (const [wheelId, entry] of driveWheels) {
      const body = entry.body?.current
      if (!body) continue

      const rotation = body.rotation()
      const rel = rotateByQuat(entry.localPos, rotation)
      const worldPos = addVec(body.translation(), rel)

      sumX += worldPos.x
      sumY += worldPos.y
      sumZ += worldPos.z
      counted++

      // A wheel with no rolling direction (mounted flat, driveFrame returned
      // null) still anchors robotPos above, but takes no force.
      if (!entry.forward) continue
      const forward = rotateByQuat(entry.forward, rotation)

      /*
       * The speed each wheel FEELS is the velocity of its own contact point,
       * v + ω×r — not the body's centre-of-mass velocity. The difference is
       * the whole story of a turn: during a spin the COM barely moves, so a
       * controller reading linvel() alone saw "speed 0, target 0, nothing to
       * do" and let the assembly windmill on its own angular momentum for
       * seconds after every turn command. Reading the contact point makes the
       * differential honest — each side saturates at its own commanded speed,
       * so turn rate self-limits, and a commanded stop brakes rotation too.
       */
      const v = body.linvel()
      const av = body.angvel()
      const vpx = v.x + av.y * rel.z - av.z * rel.y
      const vpy = v.y + av.z * rel.x - av.x * rel.z
      const vpz = v.z + av.x * rel.y - av.y * rel.x
      const along = vpx * forward.x + vpy * forward.y + vpz * forward.z
      const forwardPwm = entry.pin != null ? (rt.motorSpeed[entry.pin] ?? 0) : 0
      const reversePwm = entry.reversePin != null ? (rt.motorSpeed[entry.reversePin] ?? 0) : 0
      const digitalDrive = (entry.pin != null && rt.pinHigh[entry.pin] ? 255 : 0) -
        (entry.reversePin != null && rt.pinHigh[entry.reversePin] ? 255 : 0)
      const speed = forwardPwm || reversePwm ? forwardPwm - reversePwm : digitalDrive
      const targetV = speed * PHYSICS.speedToUnitsPerSec

      // Roll the visible wheel by however far the robot really moved.
      entry.spin += (along / WHEEL.radius) * delta

      rt.wheelTelemetry[wheelId] = { commanded: targetV, actual: along }
      /*
       * An UNDRIVEN wheel coasts. A DRIVEN wheel commanded to zero BRAKES:
       * the controller below drives (0 - along) to zero, which is what a DC
       * motor on an H-bridge really does when you write 0. Skipping the force
       * whenever speed was 0 — as this used to — made "drive stop" mean
       * "glide on", and the rover slid three or four units past every stop
       * into whatever was in front of it.
       */
      if (!warm || entry.pin == null) {
        resetStall(stallTimers.current, wheelId)
        continue
      }

      const force = clamp(
        (targetV - along) * PHYSICS.driveGain,
        -PHYSICS.driveMaxForce,
        PHYSICS.driveMaxForce,
      )
      const impulse = force * delta
      body.applyImpulseAtPoint(
        { x: forward.x * impulse, y: 0, z: forward.z * impulse },
        worldPos,
        true,
      )

      // ---- 4. stall watch -------------------------------------------------
      const s = (stallTimers.current[wheelId] ??= { stuck: 0, cooldown: 0 })
      s.cooldown = Math.max(0, s.cooldown - delta)
      const wants = Math.abs(targetV) > 0.3
      const barelyMoving = Math.abs(along) < Math.abs(targetV) * 0.15
      s.stuck = wants && barelyMoving ? s.stuck + delta : 0

      if (s.stuck > STALL_WINDOW && s.cooldown === 0) {
        s.stuck = 0
        s.cooldown = STALL_COOLDOWN
        rt.puffs.push({
          id: `${wheelId}-${Math.round(rt.clock)}`,
          pos: [worldPos.x, worldPos.y + 0.4, worldPos.z],
        })
        ui.teach('stall', { pin: entry.pin })
        // Through the dictionary, not a literal — RU/UZ readers were getting
        // English here while toasts.stuck sat translated and unused.
        ui.say('stuck', {}, 'warn')
        build.pushSerial(`!! motor on pin ${entry.pin} is stalled`)
        sfx.error()
      }
    }

    // ---- 5. mission goal ------------------------------------------------
    const mission = getMission(ui.mission)
    if (!rt.missionWon && mission.kind !== 'none' && rt.clock > 400) {
      // A ring mission's constraint accrues while driving: time spent inside
      // the radial band. This is what makes "follow the circle" a rule the
      // simulation checks rather than a caption it hopes for.
      if (counted > 0) rt.robotPos = [sumX / counted, sumY / counted, sumZ / counted]
      if (mission.ring && counted > 0) {
        const r = Math.hypot(rt.robotPos[0], rt.robotPos[2])
        if (r >= mission.ring.min && r <= mission.ring.max) rt.ringTime += delta
        else rt.ringTime = 0
      }
      let won = false
      if (mission.kind === 'reach' && counted > 0) {
        won =
          Math.hypot(rt.robotPos[0] - mission.flag[0], rt.robotPos[2] - mission.flag[1]) <
            mission.reachRadius &&
          (!mission.ring || rt.ringTime >= mission.ring.seconds)
      } else if (mission.kind === 'push' && rt.cratePos) {
        won =
          Math.hypot(
            rt.cratePos[0] - mission.props.crate[0],
            rt.cratePos[2] - mission.props.crate[1],
          ) > mission.pushDistance
      } else if (mission.kind === 'deliver' && rt.cratePos) {
        won = Math.hypot(rt.cratePos[0] - mission.target[0], rt.cratePos[2] - mission.target[1]) < mission.targetRadius
      } else if (mission.kind === 'lift' && rt.cratePos) {
        rt.liftTime = rt.cratePos[1] >= mission.liftHeight ? rt.liftTime + delta : 0
        won = rt.liftTime >= mission.holdSeconds
      } else if (mission.kind === 'checkpoints' && counted > 0) {
        const next = mission.checkpoints[rt.checkpointIndex]
        if (next && Math.hypot(rt.robotPos[0] - next[0], rt.robotPos[2] - next[1]) < mission.checkpointRadius) {
          rt.checkpointIndex++
          ui.setMissionProgress(rt.checkpointIndex, mission.checkpoints.length)
          sfx.tick()
        }
        won = rt.checkpointIndex >= mission.checkpoints.length
      } else if (mission.kind === 'line' && counted > 0) {
        const track = getLineTrack(mission.track)
        const next = track.checkpoints[rt.checkpointIndex]
        const lineReady = Object.values(rt.sensorReadings).some((reading) => reading.kind === 'lineSensor' && reading.ready && reading.value >= 50)
        if (next && lineReady && Math.hypot(rt.robotPos[0] - next[0], rt.robotPos[2] - next[1]) < 2.2) {
          rt.checkpointIndex++
          ui.setMissionProgress(rt.checkpointIndex, track.checkpoints.length)
          sfx.tick()
        }
        won = rt.checkpointIndex >= track.checkpoints.length
      } else if (mission.kind === 'circuit') {
        const pinLevels = Object.fromEntries(Object.entries(rt.pinHigh).map(([pin, high]) => [pin, high ? 1 : 0]))
        const report = solveCircuit(build.parts, build.wires, { pinLevels })
        const hasBreadboard = Object.values(build.parts).some((part) => part.kind === 'breadboard')
        const liveLed = Object.values(build.parts).some((part) => {
          if (!isLed(part.kind) || !part.breadboardId) return false
          const connection = ledConnection(part, build.parts, build.wires)
          return connection.ready && Object.values(connection.pins).some((pin) => rt.pinHigh[pin])
        })
        won = hasBreadboard && report.severity !== 'danger' && liveLed
      }
      if (won) {
        rt.missionWon = true
        const seconds = (rt.clock / 1000).toFixed(1)
        ui.winMission(seconds)
        ui.teach('missionDone', { name: t(`missions.${mission.id}.name`), seconds })
        ui.say('missionDone', {}, 'good')
        sfx.chime()
      }
    }

    if (counted > 0) {
      rt.robotPos = [sumX / counted, sumY / counted, sumZ / counted]
      // Safety net: if the simulation ever does something wild, stop calmly
      // instead of showing a child their robot disappearing into orbit.
      if (
        rt.clock > 1500 &&
        (Math.abs(rt.robotPos[1]) > 25 || Math.hypot(rt.robotPos[0], rt.robotPos[2]) > 60)
      ) {
        build.toggleRun()
        ui.say('runaway', {}, 'warn')
      }
    }
  })

  return null
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function resetStall(timers, id) {
  const s = (timers[id] ??= { stuck: 0, cooldown: 0 })
  s.stuck = 0
}
