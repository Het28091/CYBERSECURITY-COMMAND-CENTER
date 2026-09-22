// Ambient3DBackground — subtle atmospheric 3D background layer.
//
// NOT a dashboard widget. NOT a topology diagram. NOT a content block.
//
// This is a position:fixed, pointer-events:none, z-index:0 background layer
// that renders slowly-moving abstract geometric forms behind the application
// content. It communicates "cybersecurity / network / intelligence"
// atmospherically, not by displaying data.
//
// The application content sits on top at z-index >= 1.
// If WebGL is unavailable, falls back to a CSS gradient.
// Respects prefers-reduced-motion (static positions, no animation).

'use client';

import { Suspense, useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Ambient scene ─────────────────────────────────────────────────────────

function AmbientScene({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  // Abstract nodes — very low density, no labels
  const nodes = useMemo(() => {
    const out: { pos: [number, number, number]; size: number; speed: number }[] = [];
    const count = 12; // very low density
    for (let i = 0; i < count; i++) {
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 3 + Math.random() * 2;
      out.push({
        pos: [r * Math.cos(theta) * Math.sin(phi), r * Math.sin(theta) * Math.sin(phi), r * Math.cos(phi)],
        size: 0.03 + Math.random() * 0.04,
        speed: 0.2 + Math.random() * 0.3,
      });
    }
    return out;
  }, []);

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.03; // very slow
      groupRef.current.rotation.x = Math.sin(t * 0.02) * 0.1;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.02;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.015;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Two large translucent rings — abstract orbital structures */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[3, 0.01, 16, 80]} />
        <meshBasicMaterial color="#4488aa" transparent opacity={0.08} />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 4, Math.PI / 6, 0]}>
        <torusGeometry args={[4, 0.008, 16, 80]} />
        <meshBasicMaterial color="#3a6a8a" transparent opacity={0.06} />
      </mesh>

      {/* Sparse abstract node points — no labels, no data */}
      {nodes.map((n, i) => (
        <FloatNode key={i} pos={n.pos} size={n.size} speed={n.speed} reducedMotion={reducedMotion} />
      ))}

      {/* Subtle wireframe sphere — represents "system boundary" */}
      <mesh>
        <sphereGeometry args={[2.5, 12, 12]} />
        <meshBasicMaterial color="#3a5a7a" wireframe transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

function FloatNode({ pos, size, speed, reducedMotion }: {
  pos: [number, number, number];
  size: number;
  speed: number;
  reducedMotion: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reducedMotion || !ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = pos[1] + Math.sin(t * speed + pos[0]) * 0.08;
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[size, 8, 8]} />
      <meshBasicMaterial color="#5a9abf" transparent opacity={0.15} />
    </mesh>
  );
}

// ─── Detection hooks ────────────────────────────────────────────────────────

function useWebGLSupport(): boolean {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setSupported(false); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      setSupported(false);
    }
  }, []);
  return supported;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches); // eslint-disable-line react-hooks/set-state-in-effect
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─── Main component ────────────────────────────────────────────────────────

export function Ambient3DBackground() {
  const webglSupported = useWebGLSupport();
  const reducedMotion = useReducedMotion();

  // Fallback: CSS gradient mesh (no WebGL)
  if (!webglSupported || reducedMotion) {
    return (
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          background: reducedMotion
            ? 'radial-gradient(ellipse at 30% 20%, rgba(68, 136, 170, 0.04) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(58, 90, 122, 0.03) 0%, transparent 50%)'
            : 'linear-gradient(135deg, rgba(68, 136, 170, 0.03) 0%, rgba(58, 90, 122, 0.02) 100%)',
        }}
        aria-hidden="true"
      />
    );
  }

  // 3D ambient background — position:fixed, pointer-events:none, z-index:0
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 1]}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <AmbientScene reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
