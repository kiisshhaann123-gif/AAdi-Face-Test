import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const ARKIT = ['browDownLeft','browDownRight','browInnerUp','browOuterUpLeft','browOuterUpRight','eyeBlinkLeft','eyeBlinkRight','eyeLookDownLeft','eyeLookDownRight','eyeLookInLeft','eyeLookInRight','eyeLookOutLeft','eyeLookOutRight','eyeLookUpLeft','eyeLookUpRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','cheekPuff','cheekSquintLeft','cheekSquintRight','noseSneerLeft','noseSneerRight','jawForward','jawLeft','jawOpen','jawRight','mouthClose','mouthDimpleLeft','mouthDimpleRight','mouthFrownLeft','mouthFrownRight','mouthFunnel','mouthLeft','mouthLowerDownLeft','mouthLowerDownRight','mouthPressLeft','mouthPressRight','mouthPucker','mouthRight','mouthRollLower','mouthRollUpper','mouthShrugLower','mouthShrugUpper','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight','mouthUpperUpLeft','mouthUpperUpRight','tongueOut'];
const SIDE = ['clavicle','upper_arm','forearm','hand','thumb_01','thumb_02','thumb_03','index_01','index_02','index_03','middle_01','middle_02','middle_03','ring_01','ring_02','ring_03','little_01','little_02','little_03','thigh','shin','foot','toe','eye'];
export const BONES = ['root','pelvis','spine','spine_01','spine_02','chest','neck','head', ...SIDE.flatMap(n => [n + '_L', n + '_R'])];

const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x24262c);
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 500); camera.position.set(0, 8, 40);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 7.5, 0); controls.update();
scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(8, 20, 14); scene.add(sun);
const grid = new THREE.GridHelper(40, 40, 0x555555, 0x333333); grid.position.y = 0; scene.add(grid);
function resize(){ const w = view.clientWidth || 800, h = view.clientHeight || 600; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const gltf = await new GLTFLoader().loadAsync('./AAdi.glb');
const model = gltf.scene; scene.add(model);

// ---------- the three things an app needs ----------
const bones = {}; const rest = {};
const morphMeshes = []; const skinned = [];
model.traverse(o => {
  if (o.isBone) { bones[o.name] = o; rest[o.name] = { q: o.quaternion.clone(), p: o.position.clone() }; }
  if (o.isSkinnedMesh) skinned.push(o);
  if (o.isMesh && o.morphTargetDictionary) morphMeshes.push(o);
  if (o.isMesh && o.material && o.material.name === 'Dress_Outer') o.material.depthWrite = false; // sheer layer sorts better
  if (o.isMesh) o.frustumCulled = false;
});
// A morph name can live on several meshes (skin, teeth, eyes, tongue) - always set it on all of them.
export function setMorph(name, value){ let n = 0; for (const m of morphMeshes){ const i = m.morphTargetDictionary[name]; if (i !== undefined){ m.morphTargetInfluences[i] = value; n++; } } return n; }
const mixer = new THREE.AnimationMixer(model); const actions = {};
for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
let current = null;
function play(name){ if (current) current.fadeOut(0.3); current = name ? actions[name] : null; if (current) current.reset().fadeIn(0.3).play(); }
// procedural offsets, applied on top of whatever the clip did this frame
const proc = {}; // boneName -> THREE.Euler
function resetPose(){ for (const n in bones){ bones[n].quaternion.copy(rest[n].q); bones[n].position.copy(rest[n].p); } }
const _q = new THREE.Quaternion();
function applyProc(){ for (const n in proc){ const b = bones[n]; if (b) b.quaternion.multiply(_q.setFromEuler(proc[n])); } }
window.character = { THREE, model, bones, rest, setMorph, mixer, actions, play, proc, morphMeshes, skinned };

// ---------- UI ----------
const $ = id => document.getElementById(id);
$('status').textContent = `Loaded: ${Object.keys(bones).length} bones, ${gltf.animations.length} clips, ${morphMeshes.length} meshes with morph targets`;
for (const name of [null, ...Object.keys(actions)]){ const b = document.createElement('button'); b.textContent = name || 'Stop (rest pose)'; b.onclick = () => { play(name); document.querySelectorAll('#clips button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; $('clips').appendChild(b); }
function slider(parent, label, min, max, val, fn){ const r = document.createElement('div'); r.className = 'row'; const l = document.createElement('span'); l.textContent = label; const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = 0.01; i.value = val; const o = document.createElement('span'); o.textContent = (+val).toFixed(2); i.oninput = () => { o.textContent = (+i.value).toFixed(2); fn(+i.value); }; r.append(l, i, o); parent.appendChild(r); return i; }
const procSliders = [];
const P = (label, bone, axis, lim) => procSliders.push(slider($('bones'), label, -lim, lim, 0, v => { (proc[bone] ||= new THREE.Euler())[axis] = v; }));
P('head turn', 'head', 'y', 1.0); P('head nod', 'head', 'x', 0.6); P('head tilt', 'head', 'z', 0.5); P('neck turn', 'neck', 'y', 0.6);
P('chest twist', 'chest', 'y', 0.6); P('spine bend', 'spine_01', 'x', 0.6);
P('L shoulder', 'clavicle_L', 'z', 0.5); P('L upper arm', 'upper_arm_L', 'x', 1.4); P('L elbow', 'forearm_L', 'x', 1.6); P('L wrist', 'hand_L', 'x', 1.0); P('L index curl', 'index_01_L', 'x', 1.4);
P('R upper arm', 'upper_arm_R', 'x', 1.4); P('R elbow', 'forearm_R', 'x', 1.6);
P('L hip', 'thigh_L', 'x', 1.2); P('L knee', 'shin_L', 'x', 1.6); P('L ankle', 'foot_L', 'x', 0.8); P('L toe', 'toe_L', 'x', 0.6);
let rootX = 0, rootYaw = 0; procSliders.push(slider($('bones'), 'root move X', -10, 10, 0, v => rootX = v)); procSliders.push(slider($('bones'), 'root turn', -3.14, 3.14, 0, v => rootYaw = v));
const morphSliders = {}; for (const n of ARKIT) morphSliders[n] = slider($('morphs'), n, 0, 1, 0, v => setMorph(n, v));
let autoBlink = false, talk = false;
$('blink').onclick = e => { autoBlink = !autoBlink; e.target.classList.toggle('on', autoBlink); if (!autoBlink){ setMorph('eyeBlinkLeft', 0); setMorph('eyeBlinkRight', 0); } };
$('talk').onclick = e => { talk = !talk; e.target.classList.toggle('on', talk); if (!talk) for (const n of ['jawOpen','mouthFunnel','mouthSmileLeft','mouthSmileRight']) setMorph(n, 0); };
$('resetAll').onclick = () => { for (const n in proc) delete proc[n]; rootX = rootYaw = 0; procSliders.forEach(s => { s.value = 0; s.oninput(); }); for (const n of ARKIT){ setMorph(n, 0); morphSliders[n].value = 0; morphSliders[n].oninput(); } };

// ---------- render loop: clip -> procedural layer -> morphs ----------
const clock = new THREE.Clock(); let testing = false;
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta(), t = clock.elapsedTime;
  if (!testing){
    resetPose(); mixer.update(dt); applyProc();
    bones.root.position.x = rest.root.p.x + rootX; bones.root.quaternion.multiply(_q.setFromEuler(new THREE.Euler(0, rootYaw, 0)));
    if (autoBlink){ const ph = t % 3.5; const v = ph < 0.16 ? Math.sin(Math.PI * ph / 0.16) : 0; setMorph('eyeBlinkLeft', v); setMorph('eyeBlinkRight', v); }
    if (talk){ const a = 0.5 + 0.5 * Math.sin(t * 11), b = 0.5 + 0.5 * Math.sin(t * 4.3 + 1); setMorph('jawOpen', 0.1 + 0.45 * a * b); setMorph('mouthFunnel', 0.35 * (1 - b)); setMorph('mouthSmileLeft', 0.2 * b); setMorph('mouthSmileRight', 0.2 * b); }
  }
  renderer.render(scene, camera);
});

// ---------- automated checks ----------
const _v = new THREE.Vector3();
function sample(meshes, step){ model.updateMatrixWorld(true); const out = []; for (const m of meshes){ const n = m.geometry.attributes.position.count; for (let i = 0; i < n; i += step){ m.getVertexPosition(i, _v); out.push(_v.x, _v.y, _v.z); } } return out; }
function maxDelta(a, b){ let mx = 0, bad = 0; for (let i = 0; i < a.length; i += 3){ const d = Math.hypot(a[i]-b[i], a[i+1]-b[i+1], a[i+2]-b[i+2]); if (!Number.isFinite(d)) bad++; else if (d > mx) mx = d; } return { mx, bad }; }
function clearMorphs(){ for (const m of morphMeshes) m.morphTargetInfluences.fill(0); }
async function runTests(){
  testing = true; const R = []; const add = (id, name, pass, detail) => R.push({ id, name, pass: !!pass, detail });
  mixer.stopAllAction(); current = null; resetPose(); clearMorphs();
  // 1-2 skeleton + names
  const skel = skinned[0].skeleton; const missing = BONES.filter(n => !model.getObjectByName(n) || !model.getObjectByName(n).isBone);
  add(1, 'skeleton present', skel && skel.bones.length >= 56, `skeleton bones=${skel.bones.length}, skinned meshes=${skinned.length}, all share one skeleton=${skinned.every(m => m.skeleton.bones.length >= 56)}`);
  add(2, 'find all 56 bones by name', missing.length === 0, missing.length ? 'missing: ' + missing.join(',') : 'all found with getObjectByName');
  // 3 rotate every bone, mesh must follow
  const base = sample(skinned, 23); const dead = [], nan = [];
  for (const n of BONES){ if (n === 'root') continue; const b = bones[n]; b.quaternion.multiply(_q.setFromEuler(new THREE.Euler(0.5, 0.2, 0.1))); const d = maxDelta(base, sample(skinned, 23)); if (d.mx < 0.005) dead.push(n); if (d.bad) nan.push(n); b.quaternion.copy(rest[n].q); }
  add(3, 'rotate each bone -> mesh deforms', dead.length === 0 && nan.length === 0, `55 bones rotated one at a time; no effect: [${dead}] NaN: [${nan}]`);
  bones.forearm_L.position.y += 0.5; const dp = maxDelta(base, sample(skinned, 23)); bones.forearm_L.position.copy(rest.forearm_L.p);
  add(3.1, 'position a bone', dp.mx > 0.3, `forearm_L moved 0.5 -> max vertex shift ${dp.mx.toFixed(3)}`);
  // 4 combined
  for (const [n, e] of [['head',[0.2,0.6,0]],['neck',[0,0.3,0]],['chest',[0,-0.3,0]],['spine_01',[0.3,0,0]],['upper_arm_L',[1.0,0,0]],['forearm_L',[1.2,0,0]],['hand_L',[0.4,0,0]],['index_01_L',[1,0,0]],['thigh_R',[0.9,0,0]],['shin_R',[-1.2,0,0]],['foot_R',[0.4,0,0]],['toe_R',[0.3,0,0]]]) bones[n].quaternion.multiply(_q.setFromEuler(new THREE.Euler(...e)));
  const dc = maxDelta(base, sample(skinned, 23)); add(4, 'combine 12 bone rotations', dc.bad === 0 && dc.mx > 1, `max vertex shift ${dc.mx.toFixed(2)}, non-finite vertices ${dc.bad}`); resetPose();
  // 5 root
  bones.root.position.x += 2; const s5 = sample(skinned, 23); let mn = 1e9, mx = -1e9; for (let i = 0; i < s5.length; i += 3){ const d = s5[i] - base[i]; mn = Math.min(mn, d); mx = Math.max(mx, d); }
  bones.root.position.copy(rest.root.p); bones.root.quaternion.multiply(_q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))); const dr = maxDelta(base, sample(skinned, 23)); resetPose();
  add(5, 'root moves/turns whole character', Math.abs(mn - 2) < 1e-3 && Math.abs(mx - 2) < 1e-3 && dr.mx > 3, `root +2 on X -> every sampled vertex moved ${mn.toFixed(3)}..${mx.toFixed(3)}; root 90deg turn max shift ${dr.mx.toFixed(2)}`);
  // 6-7 morphs
  // AAdi: the skin carries 51 names; tongueOut lives on MouthWet (the tongue). All 52 must exist across the morph meshes.
  const noName = ARKIT.filter(n => !morphMeshes.some(m => m.morphTargetDictionary[n] !== undefined));
  const where = n => morphMeshes.filter(m => m.morphTargetDictionary[n] !== undefined).map(m => m.name).join('+');
  add(6, 'all 52 ARKit names in morphTargetDictionary (across meshes)', noName.length === 0, `morph meshes: ${morphMeshes.map(m => m.name + '(' + Object.keys(m.morphTargetDictionary).length + ')').join(', ')}; tongueOut on: ${where('tongueOut')}; jawOpen on: ${where('jawOpen')}; missing: [${noName}]`);
  const mb = sample(morphMeshes, 3); const rows = []; const flat = [], nonlin = [];
  for (const n of ARKIT){ const d = []; for (const v of [0.25, 0.5, 0.75, 1]){ setMorph(n, v); d.push(maxDelta(mb, sample(morphMeshes, 3)).mx); } const cnt = setMorph(n, 0); if (d[3] < 0.004) flat.push(n); if (Math.abs(d[1] - d[3] / 2) > 0.02 * d[3] + 1e-4 || Math.abs(d[0] - d[3] / 4) > 0.02 * d[3] + 1e-4) nonlin.push(n); rows.push(`${n}: meshes=${cnt} shift@.25/.5/.75/1 = ${d.map(x => x.toFixed(3)).join(' / ')}`); }
  add(7, 'each of 52 morphs deforms at 0.25/0.5/0.75/1.0', flat.length === 0 && nonlin.length === 0, `no visible deformation: [${flat}] not proportional: [${nonlin}]`);
  // 8 combos
  const combos = { 'blink + look down': ['eyeBlinkLeft','eyeBlinkRight','eyeLookDownLeft','eyeLookDownRight'], 'squint + smile': ['eyeSquintLeft','eyeSquintRight','mouthSmileLeft','mouthSmileRight','cheekSquintLeft','cheekSquintRight'], 'brows up + eyes wide': ['browInnerUp','browOuterUpLeft','browOuterUpRight','eyeWideLeft','eyeWideRight'], 'jaw open + funnel': ['jawOpen','mouthFunnel'], 'smile + cheek puff': ['mouthSmileLeft','mouthSmileRight','cheekPuff'], 'pucker + jaw open': ['mouthPucker','jawOpen'], 'left wink only': ['eyeBlinkLeft'] };
  const cres = []; let cok = true; for (const k in combos){ combos[k].forEach(n => setMorph(n, 1)); bones.head.quaternion.multiply(_q.setFromEuler(new THREE.Euler(0.2, 0.5, 0.1))); const d = maxDelta(mb, sample(morphMeshes, 3)); cres.push(`${k}: finite=${d.bad === 0}`); if (d.bad) cok = false; clearMorphs(); resetPose(); }
  add(8, 'morph combinations (with head turned)', cok, cres.join('; '));
  // 9 clips
  const cl = []; let clipsOk = gltf.animations.length > 0;
  for (const clip of gltf.animations){ const a = actions[clip.name]; a.reset().setEffectiveWeight(1).play(); let moved = 0, worst = 0, bad = 0; let prev = null; const N = 90;
    for (let i = 0; i <= N; i++){ mixer.setTime(clip.duration * i / N); const cur = BONES.map(n => bones[n].quaternion.clone()); if (i === Math.floor(N / 2)) moved = BONES.filter(n => bones[n].quaternion.angleTo(rest[n].q) > 0.01).length; if (prev) cur.forEach((q, j) => { const ang = q.angleTo(prev[j]); if (!Number.isFinite(ang)) bad++; else worst = Math.max(worst, ang); }); prev = cur; }
    mixer.setTime(0); const first = BONES.map(n => bones[n].quaternion.clone()); mixer.setTime(clip.duration - 1e-4); const seam = Math.max(...BONES.map((n, j) => bones[n].quaternion.angleTo(first[j])));
    a.stop(); resetPose(); const ok = bad === 0 && moved > 0 && worst < 0.6; if (!ok) clipsOk = false;
    cl.push(`${clip.name}: ${clip.duration.toFixed(2)}s, bones moving mid-clip=${moved}, biggest step between samples=${(worst * 57.3).toFixed(1)}deg, loop seam=${(seam * 57.3).toFixed(1)}deg ${ok ? 'ok' : 'CHECK'}`); }
  mixer.stopAllAction(); mixer.setTime(0);
  add(9, 'run all animation clips', clipsOk, `${gltf.animations.length} clips`);
  // 10 blend procedural + clip
  const idle = actions.Idle || Object.values(actions)[0]; idle.reset().play(); mixer.setTime(1.0); model.updateMatrixWorld(true); const q0 = bones.head.getWorldQuaternion(new THREE.Quaternion()); bones.head.quaternion.multiply(_q.setFromEuler(new THREE.Euler(0, 0.4, 0))); model.updateMatrixWorld(true); const q1 = bones.head.getWorldQuaternion(new THREE.Quaternion()); idle.stop(); resetPose();
  add(10, 'procedural offset on top of a playing clip', Math.abs(q0.angleTo(q1) - 0.4) < 0.01, `head turned ${q0.angleTo(q1).toFixed(3)} rad beyond the clip pose (asked 0.4)`);
  // 11 no blow-ups
  const a2 = actions.Walk || idle; a2.reset().play(); mixer.setTime(0.5); setMorph('jawOpen', 0.6); setMorph('mouthSmileLeft', 1); const dd = maxDelta(base, sample(skinned, 23)); a2.stop(); clearMorphs(); resetPose();
  model.updateMatrixWorld(true); const box = new THREE.Box3(); skinned.forEach(m => { m.computeBoundingBox(); box.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld)); }); const sz = box.getSize(new THREE.Vector3());
  add(11, 'clip + morphs together stays finite', dd.bad === 0 && dd.mx < 12, `max vertex travel ${dd.mx.toFixed(2)}; rest size ${sz.x.toFixed(1)} x ${sz.y.toFixed(1)} x ${sz.z.toFixed(1)} units`);
  const tris = skinned.reduce((s, m) => s + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
  const info = { drawCalls: renderer.info.render.calls, triangles: Math.round(tris), meshes: skinned.map(m => m.name) };
  testing = false; const passed = R.filter(r => r.pass).length;
  window.__results = { passed, total: R.length, tests: R, clips: cl, morphs: rows, info };
  $('results').innerHTML = R.map(r => `<span class="${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS' : 'FAIL'}</span> ${r.id} ${r.name}\n     ${r.detail}`).join('\n') + '\n\nClips:\n' + cl.join('\n') + '\n\nRender: ' + JSON.stringify(info);
  document.title = `checks ${passed}/${R.length}`; console.log('CHARACTER_TEST_RESULTS ' + JSON.stringify(window.__results));
}
$('rerun').onclick = runTests;
try { await runTests(); } catch (e) { testing = false; $('results').textContent = 'Test error: ' + e.stack; document.title = 'checks ERROR'; console.error(e); }
