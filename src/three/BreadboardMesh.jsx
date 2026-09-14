import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BREADBOARD } from '../lib/config.js'
import { breadboardHoles } from '../lib/breadboard.js'
import { Toon } from '../lib/toon.jsx'

/**
 * One procedural, offline-safe 830-contact solderless breadboard.
 *
 * Every socket is a real electrical terminal (see breadboard.js), while all
 * 830 visible openings share one InstancedMesh. The visual therefore costs a
 * handful of draw calls instead of one draw call per hole.
 */
export default function BreadboardMesh({ selected = false }) {
  const holes = useMemo(() => breadboardHoles(), [])
  const sockets = useRef()

  useLayoutEffect(() => {
    if (!sockets.current) return
    const matrix = new THREE.Matrix4()
    holes.forEach((hole, index) => {
      matrix.makeTranslation(hole.local[0], hole.local[1] - 0.025, hole.local[2])
      sockets.current.setMatrixAt(index, matrix)
    })
    sockets.current.instanceMatrix.needsUpdate = true
    sockets.current.computeBoundingSphere()
  }, [holes])

  const body = selected ? '#fff3cc' : '#f2f0e8'
  const top = selected ? '#fffaf0' : '#fbfaf5'
  const railLength = BREADBOARD.width - 0.56

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[BREADBOARD.width, BREADBOARD.height, BREADBOARD.depth]} />
        <Toon color={body} xray />
      </mesh>

      {/* Raised terminal field and the centre DIP trench. */}
      <mesh position={[0, BREADBOARD.height / 2 + 0.012, 0]} receiveShadow>
        <boxGeometry args={[BREADBOARD.width - 0.18, 0.024, 1.33]} />
        <Toon color={top} outline={false} />
      </mesh>
      <mesh position={[0, BREADBOARD.height / 2 + 0.027, 0]}>
        <boxGeometry args={[BREADBOARD.width - 0.22, 0.035, 0.18]} />
        <meshBasicMaterial color="#d8d6cf" toneMapped={false} />
      </mesh>

      {/* Printed power-rail guides. Their centre break matches the net split. */}
      {[-0.98, 0.98].map((z) => (
        <group key={`outer-${z}`}>
          {[-1, 1].map((half) => (
            <mesh key={half} position={[half * 1.33, BREADBOARD.height / 2 + 0.033, z]}>
              <boxGeometry args={[2.42, 0.012, 0.025]} />
              <meshBasicMaterial color="#df3e3e" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {[-0.84, 0.84].map((z) => (
        <group key={`inner-${z}`}>
          {[-1, 1].map((half) => (
            <mesh key={half} position={[half * 1.33, BREADBOARD.height / 2 + 0.033, z]}>
              <boxGeometry args={[2.42, 0.012, 0.025]} />
              <meshBasicMaterial color="#3177c9" toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}

      {/* One draw call for every visible socket. */}
      <instancedMesh ref={sockets} args={[null, null, holes.length]} castShadow={false}>
        <cylinderGeometry args={[BREADBOARD.holeRadius, BREADBOARD.holeRadius * 0.72, 0.052, 6]} />
        <meshBasicMaterial color="#34383b" toneMapped={false} />
      </instancedMesh>

      {/* Subtle end marks stop the long white slab reading as a blank box. */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * railLength / 2, BREADBOARD.height / 2 + 0.034, 0]}>
          <boxGeometry args={[0.018, 0.012, 1.28]} />
          <meshBasicMaterial color="#c7c5bd" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

