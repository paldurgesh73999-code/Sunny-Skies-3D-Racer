import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';
import { chooseObstacleLanes, chooseStarLane, getDistanceProgress, getLevelRules, LANE_COUNT, LANE_SPACING } from './gameRules';

type SceneProps = {
  active: boolean;
  session: number;
  level: number;
  onStats: (distance: number) => void;
  onStar: () => void;
  onCrash: () => void;
  onClear: () => void;
  onReady: (ready: boolean) => void;
};
type MovingThing = { mesh: THREE.Group; lane: number; collected?: boolean };

const laneX = (lane: number) => (lane - 1) * LANE_SPACING;

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function roundedBox(width: number, height: number, depth: number, color: number, radius = 0.16) {
  const shape = new THREE.Shape();
  const x = -width / 2; const y = -height / 2;
  shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y); shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: radius * 0.24, bevelThickness: radius * 0.24 });
  geometry.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.08 }));
}

function makeCar(color = 0xff9f43) {
  const car = new THREE.Group();
  const body = roundedBox(1.55, 0.56, 2.55, color, 0.28);
  body.position.y = 0.55; car.add(body);
  const cabin = roundedBox(1.13, 0.66, 1.18, 0x9fe4eb, 0.22);
  cabin.position.set(0, 1.08, 0.12); car.add(cabin);
  const bumper = roundedBox(1.3, 0.2, 0.18, 0xffe2a4, 0.08); bumper.position.set(0, 0.39, -1.25); car.add(bumper);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x35516a, roughness: 0.8 });
  for (const x of [-0.79, 0.79]) for (const z of [-0.78, 0.82]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.2, 16), tireMat);
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.34, z); car.add(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff5bb, emissive: 0x8c6821, emissiveIntensity: 0.22 });
  for (const x of [-0.48, 0.48]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), headMat);
    lamp.scale.set(1.1, 0.65, 0.38); lamp.position.set(x, 0.61, -1.31); car.add(lamp);
  }
  return car;
}

function makeStar() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? 0.52 : 0.24;
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffc644, emissive: 0x80500c, emissiveIntensity: 0.17, roughness: 0.28 }));
  mesh.rotation.x = -0.12;
  const group = new THREE.Group(); group.add(mesh); group.position.y = 1.65;
  return group;
}

function makeFriendlyObstacle() {
  const group = new THREE.Group();
  const colors = [0x79c99b, 0xf29b80, 0x93b6eb, 0xe9b953];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.78, 0.86, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.72 }));
  base.position.y = 0.46; group.add(base);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.43, 14, 12), new THREE.MeshStandardMaterial({ color: 0xffe4a8, roughness: 0.45 }));
  cap.scale.set(1.18, 0.72, 1); cap.position.y = 0.92; group.add(cap);
  for (const x of [-0.17, 0.17]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshStandardMaterial({ color: 0x38536a }));
    eye.position.set(x, 0.98, 0.36); group.add(eye);
  }
  return group;
}

function makeTree(scene: THREE.Scene, x: number, z: number) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.15, 8), new THREE.MeshStandardMaterial({ color: 0xb98b5e }));
  trunk.position.y = 0.55; tree.add(trunk);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), new THREE.MeshStandardMaterial({ color: Math.random() > .5 ? 0x69c99d : 0x8bd4ac, roughness: 0.9 }));
  crown.scale.set(1, 1.25, 0.85); crown.position.y = 1.7; tree.add(crown);
  tree.position.set(x, 0, z); scene.add(tree); return tree;
}

export function GameScene({ active, session, level, onStats, onStar, onCrash, onClear, onReady }: SceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const callbacks = useRef({ onStats, onStar, onCrash, onClear, onReady });
  callbacks.current = { onStats, onStar, onCrash, onClear, onReady };
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const rules = getLevelRules(level);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a9e1ef');
    scene.fog = new THREE.Fog('#a9e1ef', 54, 190);
    const camera = new THREE.PerspectiveCamera(55, host.clientWidth / host.clientHeight, 0.1, 260);
    camera.position.set(0, 7.5, 13);
    camera.lookAt(0, 1, -12);
    const renderer: THREE.WebGLRenderer | SVGRenderer = canUseWebGL()
      ? new THREE.WebGLRenderer({ antialias: true, alpha: false })
      : new SVGRenderer();
    if (renderer instanceof THREE.WebGLRenderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    } else {
      renderer.setQuality('low');
    }
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xf4fcff, 0x65a884, 2.05));
    const sun = new THREE.DirectionalLight(0xfff3d1, 2.25);
    sun.position.set(-9, 17, 8); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(300, 360), new THREE.MeshStandardMaterial({ color: 0x8bd7ae, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.18, -105); grass.receiveShadow = true; scene.add(grass);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 360), new THREE.MeshStandardMaterial({ color: 0x789a9d, roughness: 0.92 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, -0.08, -105); road.receiveShadow = true; scene.add(road);
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xfff3cd });
    for (const x of [-5.45, 5.45]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 360), edgeMat); edge.position.set(x, 0, -105); scene.add(edge);
    }
    const dashes: THREE.Mesh[] = [];
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xeaf5e4 });
    for (let z = -270; z < 25; z += 10) {
      for (const x of [-LANE_SPACING / 2, LANE_SPACING / 2]) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 4.4), dashMat);
        dash.position.set(x, 0.015, z); scene.add(dash); dashes.push(dash);
      }
    }
    const trees: THREE.Group[] = [];
    for (let i = 0; i < 34; i += 1) for (const side of [-1, 1]) trees.push(makeTree(scene, side * (8.1 + Math.random() * 3.5), -i * 10 - 12));
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 11; i += 1) {
      const cloud = new THREE.Group();
      for (let p = 0; p < 4; p += 1) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
        puff.scale.set(1.4, 0.7, 0.7); puff.position.set((p - 1.5) * 1.05, p % 2 ? 0.4 : 0, 0); cloud.add(puff);
      }
      cloud.position.set((Math.random() - 0.5) * 56, 12 + Math.random() * 9, -i * 23 - 24); scene.add(cloud); clouds.push(cloud);
    }
    const player = makeCar();
    player.position.set(0, 0, 5); player.traverse((node) => { if ((node as THREE.Mesh).isMesh) (node as THREE.Mesh).castShadow = true; });
    scene.add(player);

    const obstacles: MovingThing[] = [];
    const stars: MovingThing[] = [];
    const clock = new THREE.Clock();
    let elapsed = 0; let distance = 0; let spawnTimer = 0; let starTimer = 0; let lane = 1; let lastStats = 0; let cleared = false;
    let collisionLock = 0;
    const speed = rules.speed * 1.18;
    const spawnObstacle = (obstacleLane: number, z: number) => {
      const mesh = makeFriendlyObstacle(); mesh.position.set(laneX(obstacleLane), 0, z); scene.add(mesh); obstacles.push({ mesh, lane: obstacleLane });
    };
    const spawnStar = (starLane: number, z: number) => {
      const mesh = makeStar(); mesh.position.x = laneX(starLane); mesh.position.z = z; scene.add(mesh); stars.push({ mesh, lane: starLane });
    };
    const moveLane = (dir: number) => { if (!activeRef.current || cleared) return; lane = Math.max(0, Math.min(LANE_COUNT - 1, lane + dir)); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(event.key)) event.preventDefault();
      if (event.repeat) return;
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') moveLane(-1);
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') moveLane(1);
    };
    const onLaneStep = (event: Event) => moveLane((event as CustomEvent<number>).detail);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('sunny-lane-step', onLaneStep);
    let animationId = 0;
    const animate = () => {
      animationId = window.requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.04);
      if (activeRef.current && !cleared) {
        elapsed += dt; distance += speed * dt;
        spawnTimer += dt; starTimer += dt; collisionLock = Math.max(0, collisionLock - dt);
        if (spawnTimer >= rules.obstacleInterval) {
          if (distance > 25) chooseObstacleLanes(level).forEach((blockedLane) => spawnObstacle(blockedLane, -105));
          spawnTimer = 0;
        }
        if (starTimer > Math.max(1.05, 2.05 - level * 0.08)) {
          const avoid = distance > 25 ? chooseObstacleLanes(level) : [];
          const starLane = chooseStarLane(avoid);
          for (let i = 0; i < rules.starLineLength; i += 1) spawnStar(starLane, -72 - i * 3.25);
          starTimer = 0;
        }
        const move = speed * dt * 1.55;
        dashes.forEach((dash) => { dash.position.z += move; if (dash.position.z > 16) dash.position.z -= 300; });
        trees.forEach((tree) => { tree.position.z += move; if (tree.position.z > 20) tree.position.z -= 350; });
        clouds.forEach((cloud) => { cloud.position.z += move * 0.18; if (cloud.position.z > 24) cloud.position.z -= 280; });
        player.position.x += (laneX(lane) - player.position.x) * Math.min(1, dt * 9);
        player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, (laneX(lane) - player.position.x) * 0.08, dt * 8);
        player.position.y = Math.sin(elapsed * 8) * 0.025;

        for (let i = obstacles.length - 1; i >= 0; i -= 1) {
          const item = obstacles[i]; item.mesh.position.z += move; item.mesh.rotation.y = Math.sin(elapsed * 1.4 + i) * 0.09;
          if (Math.abs(item.mesh.position.z - player.position.z) < 2.15 && Math.abs(item.mesh.position.x - player.position.x) < 1.42 && collisionLock === 0) {
            collisionLock = 1.25; callbacks.current.onCrash();
            player.position.x += (player.position.x <= item.mesh.position.x ? -0.27 : 0.27);
          }
          if (item.mesh.position.z > 20) { scene.remove(item.mesh); obstacles.splice(i, 1); }
        }
        for (let i = stars.length - 1; i >= 0; i -= 1) {
          const item = stars[i]; item.mesh.position.z += move; item.mesh.rotation.y += dt * 1.8; item.mesh.position.y = 1.62 + Math.sin(elapsed * 3 + i) * 0.13;
          if (!item.collected && Math.abs(item.mesh.position.z - player.position.z) < 1.8 && Math.abs(item.mesh.position.x - player.position.x) < 1.42) {
            item.collected = true; callbacks.current.onStar();
            item.mesh.scale.setScalar(0.01);
          }
          if (item.mesh.position.z > 18 || item.collected) { scene.remove(item.mesh); stars.splice(i, 1); }
        }
        if (elapsed - lastStats > 0.12) { lastStats = elapsed; callbacks.current.onStats(Math.floor(distance)); }
        if (getDistanceProgress(distance, rules.goalDistance) >= 1 && !cleared) {
          cleared = true; callbacks.current.onStats(rules.goalDistance); callbacks.current.onClear();
        }
      } else {
        player.position.y = Math.sin(clock.elapsedTime * 2) * 0.025;
      }
      camera.position.x += (player.position.x * 0.24 - camera.position.x) * 0.025;
      camera.lookAt(player.position.x * 0.16, 1.05, -12);
      renderer.render(scene, camera);
    };
    const resize = () => {
      const width = host.clientWidth; const height = host.clientHeight;
      camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height);
    };
    window.addEventListener('resize', resize);
    callbacks.current.onReady(true);
    animate();
    return () => {
      window.cancelAnimationFrame(animationId); window.removeEventListener('resize', resize); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('sunny-lane-step', onLaneStep);
      callbacks.current.onReady(false);
      scene.traverse((node) => {
        if ((node as THREE.Mesh).geometry) (node as THREE.Mesh).geometry.dispose();
        const material = (node as THREE.Mesh).material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose()); else if (material) material.dispose();
      });
      if (renderer instanceof THREE.WebGLRenderer) renderer.dispose();
      renderer.domElement.remove();
    };
  }, [session, level]);

  return <div className="scene-root" ref={hostRef} aria-label="Three-dimensional sunny race track" />;
}
