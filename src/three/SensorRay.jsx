import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { interactionGroups, useRapier } from '@react-three/rapier'
import { driveWheels, sensorRays } from './jointRegistry.js'
import { rt } from './runtime.js'
import { addVec, rotateByQuat } from './vec.js'
import { useBuildStore } from '../store/useBuildStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { isSensor, SENSOR_SPECS, sensorConnection, sampleSensor } from '../lib/sensors.js'
import { getMission } from '../lib/missions.js'
import { isPointOnLegacyRing, isPointOnTrack } from '../lib/lineTracks.js'

// Physics exists only during Run. WORLD membership excludes the robot itself.
const WORLD_QUERY = interactionGroups(0, [0])
const SAMPLE_SECONDS = 0.1

export default function SensorRay() {
  const { world, rapier } = useRapier()
  const ray = useRef(null)
  const elapsed = useRef(SAMPLE_SECONDS)
  const encoderZeros = useRef(new Map())

  useEffect(() => () => {
    rt.sensorReadings = {}
    rt.distance = SENSOR_SPECS.sensor.range[1]
    rt.sensorDebug = null
    encoderZeros.current.clear()
  }, [])

  useFrame((_, delta) => {
    const build = useBuildStore.getState()
    const ui = useUiStore.getState()
    if (!build.running) return
    elapsed.current += Math.min(delta, 0.25)
    if (elapsed.current < SAMPLE_SECONDS) return
    elapsed.current = 0
    const readings = {}
    let distance = null
    let firstDebug = null
    for (const id of build.order) {
      const part = build.parts[id]
      if (!part || !isSensor(part.kind)) continue
      const spec = SENSOR_SPECS[part.kind]
      const connection = sensorConnection(part, build.parts, build.wires)
      const entry = sensorRays.get(id)
      const body = entry?.body?.current
      const missing = [...connection.missing]
      if (!body) missing.push('PHYSICS')
      let result = { value: null, missing: [] }
      if (missing.length === 0) {
        const rotation = body.rotation()
        const origin = addVec(body.translation(), rotateByQuat(entry.localPos, rotation))
        const dir = rotateByQuat(entry.localDir, rotation)
        const up = rotateByQuat(entry.localUp, rotation)
        let wheelRadians
        if (part.kind === 'encoderSensor') {
          const wheel = driveWheels.get(entry.wheelId)
          if (wheel?.body === entry.body && wheel.forward && Number.isFinite(wheel.spin)) {
            const zero = encoderZeros.current.get(id)
            if (!zero || zero.wheel !== wheel || zero.pin !== connection.pin) {
              encoderZeros.current.set(id, { wheel, pin: connection.pin, spin: wheel.spin })
            }
            wheelRadians = wheel.spin - encoderZeros.current.get(id).spin
            // Expose the source and its actual motion, not the commanded speed.
            entry.wheelRadians = wheel.spin
            entry.wheelVelocity = rt.wheelTelemetry[entry.wheelId]?.actual ?? 0
          }
        }
        const cast = (maxToi) => {
          if (!ray.current) ray.current = new rapier.Ray(origin, dir)
          else { ray.current.origin = origin; ray.current.dir = dir }
          const hit = world.castRay(ray.current, maxToi, true, undefined, WORLD_QUERY)
          if (!hit) return null
          return { timeOfImpact: hit.timeOfImpact, point: ray.current.pointAt(hit.timeOfImpact) }
        }
        const mission = getMission(ui.mission)
        const lineTest = ui.map === 'lineLab'
          ? (point) => isPointOnTrack(mission.track, point.x, point.z)
          : ui.map === 'provingGround'
            ? (point) => isPointOnLegacyRing(point.x, point.z)
            : () => false
        result = sampleSensor(part.kind, { cast, origin, up, gravity: world.gravity, environment: rt.environment, wheelRadians, lineTest })
        if (part.kind === 'sensor' && result.missing.length === 0 && distance === null) {
          distance = result.value
          firstDebug = { partId: id, origin, dir, hit: Boolean(result.hit), toi: result.hit?.timeOfImpact ?? null }
        }
      }
      missing.push(...result.missing)
      const ready = missing.length === 0
      if (!ready) encoderZeros.current.delete(id)
      readings[id] = { value: ready ? result.value : null, unit: spec.unit, ready, pin: connection.pin, kind: part.kind, missing: [...new Set(missing)] }
    }
    for (const id of encoderZeros.current.keys()) if (!readings[id]) encoderZeros.current.delete(id)
    // Replace the entire snapshot: deleted or disconnected sensors never retain
    // a stale value. The compatibility API uses the first READY ultrasonic.
    rt.sensorReadings = readings
    rt.distance = distance ?? SENSOR_SPECS.sensor.range[1]
    rt.sensorDebug = firstDebug
  })
  return null
}
