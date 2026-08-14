import { useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three';
import type { SceneVariant } from '../sceneVariant';
import { AISLE_ORDER, AISLE_SPACING, AISLE_Z_START } from '../ServerRoom';

interface TrofferLightsProps {
  variant: SceneVariant;
}

export function TrofferLights({ variant }: TrofferLightsProps) {
  // Soft radial glow sprite (white → transparent) used additively for
  // the pool of light each portrait ceiling fixture casts on the
  // ceiling grid above it. One texture, reused by every fixture.
  const ceilGlowTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.26)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);

  const trofferPositions = useMemo(() => {
    const positions: Vector3[] = [];
    if (variant === 'portrait') {
      const trofferCount = Math.ceil((AISLE_ORDER.length * AISLE_SPACING) / 3.0) + 1;
      for (let i = 0; i < trofferCount; i++) {
        const z = AISLE_Z_START + 0.5 - i * 3.0;
        positions.push(new Vector3(0, 3.8, z));
      }
    }
    return positions;
  }, [variant]);

  if (variant !== 'portrait') return null;

  return (
    <group>
      {trofferPositions.map((pos, idx) => (
        <group key={idx} position={pos.toArray()}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.9, 0.08, 0.4]} />
            <meshStandardMaterial color="#0c0d18" roughness={0.7} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.041, 0]}>
            <boxGeometry args={[0.78, 0.005, 0.32]} />
            <meshStandardMaterial
              color="#e6fbff"
              emissive="#b8f5ff"
              emissiveIntensity={3.2}
              toneMapped={false}
            />
          </mesh>
          <sprite position={[0, 0.08, 0]} scale={[2.4, 2.4, 1]}>
            <spriteMaterial map={ceilGlowTex} transparent opacity={0.35} depthWrite={false} />
          </sprite>
        </group>
      ))}
    </group>
  );
}
