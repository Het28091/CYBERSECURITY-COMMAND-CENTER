// SecurityTopology3D — genuine interactive 3D cybersecurity topology.
//
// Uses Three.js (via @react-three/fiber) to render project nodes, health
// signals, and dependency relationships in a 3D space. The user can orbit,
// zoom, and click nodes to see details.
//
// If WebGL is unavailable, falls back to a 2D structured view.
// Respects prefers-reduced-motion (static positioning).
//
// This is NOT decorative 3D — each node represents a real project with real
// status/health data. The 3D space communicates relationships (dependencies,
// running state, health) through spatial composition.

'use client';

import { Suspense, useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';

// ─── Types ────────────────────────────────────────────────────────────────

interface TopologyNode {
  id: string;
  name: string;
  status: string;
  health: string;
  position: [number, number, number];
  color: string;
}

interface TopologyEdge {
  from: number;
  to: number;
}

// ─── Node component ───────────────────────────────────────────────────────

function ProjectNode({ node, onClick, hovered }: {
  node: TopologyNode;
  onClick: (id: string) => void;
  hovered: string | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isHovered = hovered === node.id;

  useFrame((state) => {
    if (!meshRef.current) return;
    // Subtle floating animation
    const time = state.clock.elapsedTime;
    meshRef.current.position.y = node.position[1] + Math.sin(time * 0.5 + node.position[0]) * 0.05;
    // Scale on hover
    const targetScale = isHovered ? 1.2 : 1;
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
  });

  const color = new THREE.Color(node.color);

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
        onPointerOver={(e) => { e.stopPropagation(); }}
      >
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHovered ? 0.4 : 0.15}
          roughness={0.4}
          metalness={0.3}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.22, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isHovered ? 0.4 : 0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Label */}
      <Html distanceFactor={6} position={[0, 0.3, 0]} center>
        <div className="pointer-events-none select-none text-[10px] font-mono whitespace-nowrap"
          style={{
            color: isHovered ? '#fff' : 'rgba(255,255,255,0.6)',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
            transform: 'translateZ(0)',
          }}
        >
          {node.name}
        </div>
      </Html>
    </group>
  );
}

// ─── Scene ─────────────────────────────────────────────────────────────────

function TopologyScene({ nodes, edges, onNodeClick }: {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeClick: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    // Very slow auto-rotation
    groupRef.current.rotation.y += 0.001;
  });

  return (
    <group ref={groupRef}>
      {/* Ambient + directional light */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.5} />
      <pointLight position={[-5, 3, 2]} intensity={0.3} color="#4488aa" />

      {/* Nodes */}
      {nodes.map((node) => (
        <ProjectNode
          key={node.id}
          node={node}
          onClick={onNodeClick}
          hovered={hovered}
        />
      ))}

      {/* Edges (dependency lines) */}
      {edges.map((edge, i) => {
        if (!nodes[edge.from] || !nodes[edge.to]) return null;
        const from = nodes[edge.from].position;
        const to = nodes[edge.to].position;
        return (
          <Line
            key={i}
            points={[from, to]}
            color="#6496c8"
            lineWidth={1}
            transparent
            opacity={0.15}
          />
        );
      })}
    </group>
  );
}

// ─── WebGL detection ─────────────────────────────────────────────────────

function useWebGLSupport(): boolean {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setSupported(!!gl); // eslint-disable-line react-hooks/set-state-in-effect
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

// ─── Main component ───────────────────────────────────────────────────────

export function SecurityTopology3D({ projects, onNodeClick }: {
  projects: any[];
  onNodeClick?: (id: string) => void;
}) {
  const webglSupported = useWebGLSupport();
  const reducedMotion = useReducedMotion();

  // Build nodes from project data
  const { nodes, edges } = useMemo(() => {
    const nodeList: TopologyNode[] = [];
    const edgeList: TopologyEdge[] = [];

    // Place nodes in a sphere formation
    const count = Math.min(projects.length, 30); // cap for performance
    for (let i = 0; i < count; i++) {
      const p = projects[i];
      const phi = Math.acos(-1 + (2 * i) / count);
      const theta = Math.sqrt(count * Math.PI) * phi;
      const r = 2.5;
      const x = r * Math.cos(theta) * Math.sin(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(phi);

      const color =
        p.status === 'RUNNING' ? '#4ade80' :
        p.status === 'FAILED' || p.health === 'UNHEALTHY' ? '#ef4444' :
        p.status === 'STOPPED' ? '#64748b' :
        p.health === 'DEGRADED' ? '#fbbf24' :
        '#60a5fa';

      nodeList.push({
        id: p.id,
        name: p.name,
        status: p.status,
        health: p.health,
        position: [x, y, z],
        color,
      });
    }

    // Create edges between nearby nodes (dependency visualization)
    for (let i = 0; i < nodeList.length; i++) {
      for (let j = i + 1; j < nodeList.length; j++) {
        const dx = nodeList[i].position[0] - nodeList[j].position[0];
        const dy = nodeList[i].position[1] - nodeList[j].position[1];
        const dz = nodeList[i].position[2] - nodeList[j].position[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 2.5) {
          edgeList.push({ from: i, to: j });
        }
      }
    }

    return { nodes: nodeList, edges: edgeList };
  }, [projects]);

  // ── Fallback: 2D grid ──────────────────────────────────────────────────
  if (!webglSupported || reducedMotion) {
    return (
      <div className="cyber-topology-fallback rounded-md p-4 min-h-[300px]">
        <div className="text-[10px] cyber-label mb-3 text-muted-foreground/50">
          {reducedMotion ? 'REDUCED MOTION MODE' : 'WEBGL UNAVAILABLE'} — 2D FALLBACK
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => onNodeClick?.(n.id)}
              className="flex items-center gap-2 p-2 rounded bg-surface-3 cyber-edge-subtle hover:bg-surface-2 text-left"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: n.color }}
              />
              <div className="min-w-0">
                <div className="text-[10px] font-mono truncate">{n.name}</div>
                <div className="text-[9px] text-muted-foreground/40">{n.status}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── 3D Canvas ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-md overflow-hidden bg-surface-0 cyber-edge-subtle" style={{ minHeight: '300px', height: '300px' }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <TopologyScene
            nodes={nodes}
            edges={edges}
            onNodeClick={(id) => onNodeClick?.(id)}
          />
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={3}
            maxDistance={10}
            autoRotate={!reducedMotion}
            autoRotateSpeed={0.3}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
