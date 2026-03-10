import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// ── Scene ──────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f0f1a);
window.scene = scene;

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 2000);
camera.position.set(0, 2, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;

// ── Lights ─────────────────────────────────────────────
window.ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(window.ambient);

window.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(5, 10, 5);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

scene.add(new THREE.DirectionalLight(0x8899ff, 0.35).position.set(-4, 2, -4) && dirLight);

// ── Ground & Grid ──────────────────────────────────────
window.ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0x111120, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

window.gridHelper = new THREE.GridHelper(60, 60, 0x223355, 0x1a2240);
scene.add(gridHelper);

// ── State ──────────────────────────────────────────────
let mixer = null, clock = new THREE.Clock();
let model = null, skeletonHelper = null;
let actions = {}, currentAction = null, currentClip = null;
let isPlaying = true, isLooping = true, seeking = false;
window.THREE = THREE;

// ── GUI helpers ────────────────────────────────────────
window.toggleSection = (id) => {
  const b = document.getElementById('body-' + id);
  const a = document.getElementById('arrow-' + id);
  b.classList.toggle('collapsed');
  a.textContent = b.classList.contains('collapsed') ? '▶' : '▼';
};

window.toggleWire = (v) => {
  if (!model) return;
  model.traverse(n => { if (n.isMesh) [].concat(n.material).forEach(m => m.wireframe = v); });
};

window.toggleSkeleton = (v) => { if (skeletonHelper) skeletonHelper.visible = v; };

window.resetCamera = () => {
  if (!model) { camera.position.set(0, 2, 8); controls.target.set(0, 1, 0); controls.update(); return; }
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const d = Math.max(size.x, size.y, size.z);
  camera.position.set(center.x, center.y + d * 0.5, center.z + d * 1.8);
  controls.target.copy(center);
  controls.update();
};

// ── Animation controls ─────────────────────────────────
window.switchAnim = (name) => playClip(name);

window.setSpeed = (v) => {
  document.getElementById('speed-val').textContent = (+v).toFixed(1) + 'x';
  if (currentAction) currentAction.timeScale = +v;
};

window.togglePlay = () => {
  isPlaying = !isPlaying;
  if (currentAction) currentAction.paused = !isPlaying;
  const btn = document.getElementById('btn-play');
  btn.textContent = isPlaying ? '⏸ 暂停' : '▶ 播放';
  btn.classList.toggle('active', isPlaying);
};

window.resetAnim = () => {
  if (currentAction) { currentAction.reset(); currentAction.play(); currentAction.paused = !isPlaying; }
};

window.toggleLoop = () => {
  isLooping = !isLooping;
  document.getElementById('btn-loop').classList.toggle('active', isLooping);
  if (currentAction) {
    currentAction.setLoop(isLooping ? THREE.LoopRepeat : THREE.LoopOnce);
    currentAction.clampWhenFinished = !isLooping;
  }
};

window.seekAnim = (v) => {
  if (currentAction && currentClip) currentAction.time = +v * currentClip.duration;
};

function playClip(name) {
  if (!mixer || !actions[name]) return;
  const clips = window._animClips || [];
  const clip = clips.find(c => c.name === name);
  if (!clip) return;
  if (currentAction) currentAction.fadeOut(0.25);
  currentClip = clip;
  currentAction = actions[name];
  currentAction.setLoop(isLooping ? THREE.LoopRepeat : THREE.LoopOnce);
  currentAction.clampWhenFinished = !isLooping;
  currentAction.timeScale = +document.getElementById('speed-slider').value;
  currentAction.reset().fadeIn(0.25).play();
  currentAction.paused = !isPlaying;
  document.getElementById('anim-select').value = name;
}

// ── Load FBX ───────────────────────────────────────────
function loadFBX(file) {
  const pw = document.getElementById('prog-wrap');
  const pb = document.getElementById('prog-bar');
  pw.style.display = 'block'; pb.style.width = '0%';
  document.getElementById('file-info').textContent = '⏳ 读取: ' + file.name;

  const reader = new FileReader();
  reader.onprogress = e => { if (e.lengthComputable) pb.style.width = (e.loaded / e.total * 60) + '%'; };
  reader.onerror = () => { document.getElementById('file-info').textContent = '❌ 读取失败'; pw.style.display='none'; };
  reader.onload = e => {
    pb.style.width = '70%';
    document.getElementById('file-info').textContent = '⏳ 解析FBX...';
    try {
      if (model) { scene.remove(model); model = null; }
      if (skeletonHelper) { scene.remove(skeletonHelper); skeletonHelper = null; }
      if (mixer) { mixer.stopAllAction(); mixer = null; }
      actions = {}; currentAction = null; currentClip = null;

      const loader = new FBXLoader();
      const fbx = loader.parse(e.target.result, '');
      pb.style.width = '85%';

      // scale
      const box = new THREE.Box3().setFromObject(fbx);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) fbx.scale.setScalar(4 / maxDim);

      // place on ground
      const box2 = new THREE.Box3().setFromObject(fbx);
      const c = box2.getCenter(new THREE.Vector3());
      fbx.position.set(-c.x, -box2.min.y, -c.z);

      fbx.traverse(n => {
        if (n.isMesh) {
          n.castShadow = n.receiveShadow = true;
          [].concat(n.material).forEach(m => m.side = THREE.DoubleSide);
        }
      });

      scene.add(fbx);
      model = fbx;

      skeletonHelper = new THREE.SkeletonHelper(fbx);
      skeletonHelper.visible = false;
      scene.add(skeletonHelper);

      const clips = fbx.animations || [];
      window._animClips = clips;
      mixer = new THREE.AnimationMixer(fbx);
      actions = {};
      clips.forEach((clip, i) => {
        if (!clip.name) clip.name = 'Animation_' + i;
        actions[clip.name] = mixer.clipAction(clip);
      });

      // update select
      const sel = document.getElementById('anim-select');
      sel.innerHTML = '';
      if (clips.length === 0) {
        sel.innerHTML = '<option>无动画</option>';
      } else {
        clips.forEach(c => { const o = document.createElement('option'); o.value = o.textContent = c.name; sel.appendChild(o); });
        playClip(clips[0].name);
      }

      // model info
      let meshes=0, polys=0, bones=0;
      fbx.traverse(n => {
        if (n.isMesh) { meshes++; const g=n.geometry; polys += g.index ? g.index.count/3 : g.attributes.position.count/3; }
        if (n.isBone) bones++;
      });
      document.getElementById('info-meshes').textContent = meshes;
      document.getElementById('info-polys').textContent = polys>999?(polys/1000).toFixed(1)+'k':Math.round(polys);
      document.getElementById('info-anims').textContent = clips.length;
      document.getElementById('info-bones').textContent = bones;

      document.getElementById('gui-panel').style.display = 'block';
      document.getElementById('welcome').classList.add('hidden');
      resetCamera();
      pb.style.width = '100%';
      document.getElementById('file-info').textContent = `✅ ${file.name}  |  动画: ${clips.length}  |  拖拽新文件可替换`;
      setTimeout(() => { pw.style.display='none'; pb.style.width='0%'; }, 600);
    } catch(err) {
      pb.style.width='0%'; pw.style.display='none';
      document.getElementById('file-info').textContent = '❌ 解析失败: ' + err.message;
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ── File input ─────────────────────────────────────────
const fileInput = document.getElementById('file-input');
document.getElementById('load-btn').onclick = () => fileInput.click();
document.getElementById('drop-zone').onclick = () => fileInput.click();
fileInput.onchange = e => { if (e.target.files[0]) loadFBX(e.target.files[0]); e.target.value=''; };

document.addEventListener('dragover', e => { e.preventDefault(); document.getElementById('drag-overlay').classList.add('active'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) document.getElementById('drag-overlay').classList.remove('active'); });
document.addEventListener('drop', e => {
  e.preventDefault();
  document.getElementById('drag-overlay').classList.remove('active');
  const f = e.dataTransfer.files[0];
  if (f && f.name.toLowerCase().endsWith('.fbx')) loadFBX(f);
  else document.getElementById('file-info').textContent = '❌ 请拖入 .fbx 文件';
});

// ── Resize ─────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Progress slider ────────────────────────────────────
const ps = document.getElementById('prog-slider');
ps.addEventListener('mousedown', () => seeking = true);
ps.addEventListener('mouseup', () => seeking = false);

// ── Render loop ────────────────────────────────────────
(function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) {
    mixer.update(dt);
    if (currentAction && currentClip && !seeking) {
      const t = currentAction.time, d = currentClip.duration;
      ps.value = d > 0 ? t / d : 0;
      document.getElementById('time-val').textContent = t.toFixed(1) + 's';
    }
  }
  controls.update();
  renderer.render(scene, camera);
})();
