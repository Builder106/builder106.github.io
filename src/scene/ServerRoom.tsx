import { useMemo } from "react";
import { ANCHOR_PREFIX } from "./anchors";
import { projects } from "@/data/projects";

// Stand-in geometry for the server room. This is what renders before any
// Blender .glb is dropped in. Once you export from Blender, replace this
// component with a <Gltf> loader and the same anchor names will resolve.
//
// Layout: a back row and a front row of "racks" (tall boxes), with the
// central terminal desk + monitors at z=0. Project anchors are positioned
// in front of each rack so future raycasting / camera flies have something
// to target.

const FLOOR_SIZE = 14;
const RACK_WIDTH = 1.0;
const RACK_HEIGHT = 2.6;
const RACK_DEPTH = 0.8;

interface RackSpec {
  projectId: string;
  position: [number, number, number];
}

function buildRacks(): RackSpec[] {
  // Back row: quant + systems projects (the "trading" wall)
  const back = projects
    .filter((p) => p.cluster === "quant" || p.cluster === "systems")
    .map((p, i, arr) => {
      const offset = (i - (arr.length - 1) / 2) * (RACK_WIDTH + 0.4);
      return { projectId: p.id, position: [offset, RACK_HEIGHT / 2, -4] as [number, number, number] };
    });
  // Front row (left side): products
  const front = projects
    .filter((p) => p.cluster === "products")
    .map((p, i, arr) => {
      const offset = (i - (arr.length - 1) / 2) * (RACK_WIDTH + 0.4);
      return { projectId: p.id, position: [-3.5, RACK_HEIGHT / 2, offset] as [number, number, number] };
    });
  return [...back, ...front];
}

export function ServerRoom() {
  const racks = useMemo(buildRacks, []);

  return (
    <group>
      {/* Floor */}
      <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <meshStandardMaterial color="#0a0b15" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Subtle grid lines on the floor (using a second plane with a wireframe material) */}
      <gridHelper args={[FLOOR_SIZE, 28, "#1a1f3a", "#12162a"]} position={[0, 0.01, 0]} />

      {/* Server racks */}
      {racks.map((rack) => (
        <group key={rack.projectId} position={rack.position}>
          <mesh castShadow>
            <boxGeometry args={[RACK_WIDTH, RACK_HEIGHT, RACK_DEPTH]} />
            <meshStandardMaterial color="#11131f" metalness={0.7} roughness={0.35} />
          </mesh>
          {/* Stylized blinking-LED stand-in: a thin emissive strip */}
          <mesh position={[0, 0, RACK_DEPTH / 2 + 0.001]}>
            <planeGeometry args={[RACK_WIDTH * 0.85, RACK_HEIGHT * 0.9]} />
            <meshStandardMaterial
              color="#02060a"
              emissive="#4cf2ff"
              emissiveIntensity={0.45}
              metalness={0}
              roughness={1}
            />
          </mesh>
          {/* Anchor (invisible) for camera flies + panel pinning */}
          <object3D name={`${ANCHOR_PREFIX}${rack.projectId}`} position={[0, 0, RACK_DEPTH / 2 + 1.2]} />
        </group>
      ))}

      {/* Central terminal desk */}
      <group position={[0, 0, 2]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[3.4, 0.9, 1.2]} />
          <meshStandardMaterial color="#0d0f1a" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Curved monitor stand-in (single curved-ish plane) */}
        <mesh position={[0, 1.6, 0.1]} rotation={[-0.15, 0, 0]}>
          <planeGeometry args={[2.8, 1.0, 16, 1]} />
          <meshStandardMaterial
            color="#02060a"
            emissive="#4cf2ff"
            emissiveIntensity={0.6}
            metalness={0}
            roughness={1}
          />
        </mesh>
        <object3D name={`${ANCHOR_PREFIX}terminal`} position={[0, 1.6, 0.6]} />
      </group>

      {/* Ambient + neon key/fill lights */}
      <ambientLight intensity={0.25} color="#1a1f3a" />
      <pointLight position={[0, 5, 0]} intensity={1.2} color="#4cf2ff" distance={14} />
      <pointLight position={[-5, 3, 4]} intensity={0.8} color="#ff4cf2" distance={10} />
      <pointLight position={[5, 3, -4]} intensity={0.7} color="#ffb84c" distance={10} />
    </group>
  );
}
