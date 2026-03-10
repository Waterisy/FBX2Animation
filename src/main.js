import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import GUI from 'lil-gui';

// ─── Scene Setup ───────────────────────────────────────────────────────────
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// ─── Lights ────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
fillLight.position.set(-5, 2, -5);
scene.add(fillLight);

// ─── Ground ────────────────────────────────────────────────────────────────
const groundGeo = new THREE.PlaneGeometry(100, 100);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x16213e, roughness: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Grid Helper
const grid = new THREE.GridHelper(50, 50, 0x334466, 0x223355);
scene.add(grid);

// ─── Controls ──────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.target.set(0, 1, 0);

// ─── State ─────────────────────────────────────────────────────────────────
let mixer = null;
let currentModel = null;
let animations = [];
let currentAction = null;
let clock = new THREE.Clock();
let gui = null;

const state = {
  animationName: 'None',
  speed: 1.0,
  playing: true,
  loop: true,
  showSkeleton: false,
  showGround: true,
  showGrid: true,
  wireframe: false,
  ambientIntensity: 0.6,
  dirIntensity: 1.2,
  bgColor: '#1a1a2e',
  resetCamera: () => resetCamera(),
};

// ─── GUI Setup ─────────────────────────────────────────────────────────────
function setupGUI() {
  if (gui) gui.destroy();
  gui = new GUI({ title: 'FBX2Animation 控制面板' });
  gui.domElement.style.zIndex = '200';

  // Animation Controls
  const animFolder = gui.addFolder('🎬 动画控制');
  const animNames = animations.length > 0
    ? animations.map(a => a.name || `Animation_${animations.indexOf(a)}`)
    : ['None'];

  animFolder.add(state, 'animationName', animNames)
    .name('当前动画')
    .onChange(name => playAnimation(name));

  animFolder.add(state, 'speed', 0.1, 3.0, 0.1)
    .name('播放速度')
    .onChange(v => { if (currentAction) currentAction.timeScale = v; });

  animFolder.add(state, 'playing')
    .name('播放中')
    .onChange(v => {
      if (currentAction) v ? currentAction.paused = false : currentAction.paused = true;
    });

  animFolder.add(state, 'loop')
    .name('循环播放')
    .onChange(v => {
      if (currentAction) {
        currentAction.setLoop(v ? THREE.LoopRepeat : THREE.LoopOnce);
        currentAction.clampWhenFinished = !v;
      }
    });

  const btnObj = {
    '⏮ 重置': () => { if (currentAction) { currentAction.reset(); currentAction.play(); } },
  };
  animFolder.add(btnObj, '⏮ 重置').name('重置动画');
  animFolder.open();

  // Scene Controls
  const sceneFolder = gui.addFolder('🌍 场景设置');
  sceneFolder.add(state, 'showGround').name('显示地面').onChange(v => { ground.visible = v; });
  sceneFolder.add(state, 'showGrid').name('显示网格').onChange(v => { grid.visible = v; });
  sceneFolder.add(state, 'wireframe').name('线框模式').onChange(v => {
    if (currentModel) currentModel.traverse(c => {
      if (c.isMesh) c.material.wireframe = v;
    });
  });

  // Lighting Controls
  const lightFolder = gui.addFolder('💡 灯光设置');
  lightFolder.add(state, 'ambientIntensity', 0, 2, 0.1).name('环境光强度')
    .onChange(v => ambientLight.intensity = v);
  lightFolder.add(state, 'dirIntensity', 0, 3, 0.1).name('主光源强度')
    .onChange(v => dirLight.intensity = v);
  lightFolder.addColor(state, 'bgColor').name('背景颜色')
    .onChange(v => { scene.background = new THREE.Color(v); scene.fog.color = new THREE.Color(v); });

  // Camera
  const camFolder = gui.addFolder('📷 相机');
  camFolder.add(state, 'resetCamera').name('重置视角');

  // Model Info
  if (currentModel) {
    const infoFolder = gui.addFolder('📊 模型信息');
    let polyCount = 0;
    let meshCount = 0;
    currentModel.traverse(c => {
      if (c.isMesh) {
        meshCount++;
        polyCount += c.geometry.index
          ? c.geometry.index.count / 3
          : c.geometry.attributes.position.count / 3;
      }
    });
    const infoState = {
      '网格数量': meshCount,
      '多边形数': Math.round(polyCount),
      '动画数量': animations.length,
    };
    infoFolder.add(infoState, '网格数量').disable();
    infoFolder.add(infoState, '多边形数').disable();
    infoFolder.add(infoState, '动画数量').disable();
    infoFolder.open();
  }
}

// ─── Animation Player ──────────────────────────────────────────────────────
function playAnimation(name) {
  if (!mixer || animations.length === 0) return;

  const clip = animations.find(
    (a, i) => (a.name || `Animation_${i}`) === name
  );
  if (!clip) return;

  if (currentAction) {
    currentAction.fadeOut(0.3);
  }

  currentAction = mixer.clipAction(clip);
  currentAction.setLoop(state.loop ? THREE.LoopRepeat : THREE.LoopOnce);
  currentAction.clampWhenFinished = !state.loop;
  currentAction.timeScale = state.speed;
  currentAction.reset().fadeIn(0.3).play();
}

// ─── FBX Loader ────────────────────────────────────────────────────────────
function loadFBX(file) {
  const loader = new FBXLoader();
  const url = URL.createObjectURL(file);

  document.getElementById('info').textContent = '⏳ 正在加载 ' + file.name + ' ...';

  loader.load(url, (fbx) => {
    // Remove old model
    if (currentModel) {
      scene.remove(currentModel);
      if (mixer) mixer.stopAllAction();
    }

    currentModel = fbx;

    // Auto scale
    const box = new THREE.Box3().setFromObject(fbx);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 3 / maxDim;
    fbx.scale.setScalar(scale);

    // Center
    box.setFromObject(fbx);
    const center = box.getCenter(new THREE.Vector3());
    fbx.position.sub(center);
    fbx.position.y = 0;

    fbx.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    scene.add(fbx);

    // Animations
    animations = fbx.animations || [];
    mixer = new THREE.AnimationMixer(fbx);

    const animNames = animations.map((a, i) => a.name || `Animation_${i}`);
    if (animNames.length > 0) {
      state.animationName = animNames[0];
      playAnimation(animNames[0]);
    }

    setupGUI();
    resetCamera();

    document.getElementById('info').textContent =
      `✅ 已加载: ${file.name}  |  动画数: ${animations.length}  |  拖拽新文件可替换`;

    URL.revokeObjectURL(url);
  },
  (xhr) => {
    const pct = Math.round(xhr.loaded / xhr.total * 100);
    document.getElementById('info').textContent = `⏳ 加载中... ${pct}%`;
  },
  (err) => {
    document.getElementById('info').textContent = '❌ 加载失败: ' + err.message;
    console.error(err);
    URL.revokeObjectURL(url);
  });
}

// ─── Camera Reset ──────────────────────────────────────────────────────────
function resetCamera() {
  if (currentModel) {
    const box = new THREE.Box3().setFromObject(currentModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x, center.y + maxDim, center.z + maxDim * 2);
    controls.target.copy(center);
    controls.update();
  } else {
    camera.position.set(0, 2, 8);
    controls.target.set(0, 1, 0);
    controls.update();
  }
}

// ─── File Input ────────────────────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) loadFBX(e.target.files[0]);
});

// Drag & Drop
const overlay = document.getElementById('drop-overlay');

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  overlay.classList.add('active');
});

document.body.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) overlay.classList.remove('active');
});

document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  overlay.classList.remove('active');
  const file = e.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith('.fbx')) {
    loadFBX(file);
  } else {
    document.getElementById('info').textContent = '❌ 请拖入 .fbx 格式文件';
  }
});

// ─── Resize ────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Animate Loop ──────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  controls.update();
  renderer.render(scene, camera);
}

// ─── Init GUI (empty state) ─────────────────────────────────────────────────
setupGUI();
animate();
