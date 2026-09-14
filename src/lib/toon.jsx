import * as THREE from 'three'
import { Outlines } from '@react-three/drei'
import { C, OUTLINE_THICKNESS } from './config.js'
import { useUiStore } from '../store/useUiStore.js'

/**
 * The single cel-shading recipe used by every mesh in the project.
 *
 * MeshToonMaterial samples its lighting through a tiny 4-pixel gradient
 * texture, so a smooth light falloff becomes four flat bands. That is the
 * whole trick — no custom shader needed, and it stays cheap enough that the
 * FPS guard (Part 10) rarely has to do anything.
 */
const ramp = new Uint8Array([80, 140, 200, 255])
export const gradientMap = new THREE.DataTexture(ramp, ramp.length, 1, THREE.RedFormat)
gradientMap.minFilter = THREE.NearestFilter
gradientMap.magFilter = THREE.NearestFilter
gradientMap.generateMipmaps = false
gradientMap.needsUpdate = true

/**
 * Drop inside any <mesh>:
 *   <mesh><boxGeometry /><Toon color={C.strip} /></mesh>
 *
 * Both children attach to the parent mesh — the material by `attach`, the
 * inverted-hull outline as a sibling object.
 *
 * `xray` opts the mesh into Part 13's inspection mode.
 * `outline={false}` for tiny details where a hull outline just muddies things.
 */
export function Toon({
  color,
  emissive = '#000000',
  emissiveIntensity = 0,
  outline = true,
  xray = false,
  materialRef,
  opacity = 1,
  ...rest
}) {
  const xrayOn = useUiStore((s) => s.xray)
  const lowQuality = useUiStore((s) => s.quality) === 'low'
  const seeThrough = xray && xrayOn
  const finalOpacity = seeThrough ? 0.28 : opacity

  return (
    <>
      <meshToonMaterial
        ref={materialRef}
        color={color}
        gradientMap={gradientMap}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={finalOpacity < 1}
        opacity={finalOpacity}
        depthWrite={finalOpacity >= 1}
        {...rest}
      />
      {outline && !seeThrough && !lowQuality && (
        <Outlines
          // drei's `screenspace` flag is misleadingly named: true offsets the
          // hull along its normals in WORLD units (what we want); the default
          // offsets by a pixel width that needs a drawing-buffer uniform.
          screenspace
          thickness={OUTLINE_THICKNESS}
          color={C.outline}
          toneMapped={false}
        />
      )}
    </>
  )
}
