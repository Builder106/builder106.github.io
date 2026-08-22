import { useMemo } from 'react';
import { BufferGeometry, Material, Object3D } from 'three';

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RackInstanceTransform {
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

function buildDistantRackTransforms(isMobile: boolean): RackInstanceTransform[] {
  const rng = mulberry32(0xcafe_babe);
  const count = isMobile ? 22 : 56;
  const out: RackInstanceTransform[] = [];
  for (let i = 0; i < count; i++) {
    const r = 26 + rng() * 26;
    const theta = rng() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    if (Math.abs(x) < 10 && Math.abs(z) < 10) continue;
    const facing = Math.atan2(-x, -z);
    const jitter = (rng() - 0.5) * Math.PI * 0.6;
    const rotationY = facing + jitter;
    out.push({
      position: [x, 0, z],
      rotationY,
      scale: 0.85 + rng() * 0.3,
    });
  }
  return out;
}

export interface DistantRacksProps {
  bodyGeom: BufferGeometry | null;
  bodyMat: Material | null;
  ledGeom: BufferGeometry | null;
  ledMat: Material | null;
  isMobile: boolean;
}

export function DistantRacks({ bodyGeom, bodyMat, ledGeom, ledMat, isMobile }: DistantRacksProps) {
  const transforms = useMemo(() => buildDistantRackTransforms(isMobile), [isMobile]);

  const matrices = useMemo(() => {
    const dummy = new Object3D();
    return transforms.map((t) => {
      dummy.position.set(t.position[0], t.position[1], t.position[2]);
      dummy.rotation.set(0, t.rotationY, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      return dummy.matrix.clone();
    });
  }, [transforms]);

  if (!bodyGeom || !bodyMat || !ledGeom || !ledMat) return null;

  return (
    <group>
      <instancedMesh
        args={[bodyGeom, bodyMat, matrices.length]}
        frustumCulled={false}
        ref={(m) => {
          if (!m) return;
          matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
          m.instanceMatrix.needsUpdate = true;
        }}
      />
      <instancedMesh
        args={[ledGeom, ledMat, matrices.length]}
        frustumCulled={false}
        ref={(m) => {
          if (!m) return;
          matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
          m.instanceMatrix.needsUpdate = true;
        }}
      />
    </group>
  );
}
