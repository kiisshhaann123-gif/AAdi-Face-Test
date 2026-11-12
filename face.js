// Drives the character's 52 ARKit morph targets and head bone from a phone or laptop camera.
// Face tracking: Google MediaPipe Face Landmarker (runs in the browser; the video never leaves the device).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';

const $ = id => document.getElementById(id); const say = t => { $('status').textContent = t; };
const state = window.__face = { modelReady: false, glbReady: false, error: null, frames: 0 };
const view = $('view'); const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; view.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x24262c);
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500); camera.position.set(0, 14.0, 7.5);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 14.0, 0); controls.update();
scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.5)); const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(4, 18, 12); scene.add(key);
function resize(){ const w = innerWidth, h = innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); } addEventListener('resize', resize); resize();

const bones = {}, rest = {}, morphMeshes = [];
function setMorph(name, v){ for (const m of morphMeshes){ const i = m.morphTargetDictionary[name]; if (i !== undefined) m.morphTargetInfluences[i] = v; } }
const smooth = {};                       // name -> smoothed value
const swap = n => n.endsWith('Left') ? n.slice(0, -4) + 'Right' : (n.endsWith('Right') ? n.slice(0, -5) + 'Left' : n);
const headQ = new THREE.Quaternion(), targetQ = new THREE.Quaternion(), e = new THREE.Euler(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();

// One tracking result -> morphs + head. Exported on window so it can be tested without a camera.
function applyResult(res){
  const mirror = $('mirror').checked, gain = +$('gain').value;
  const cats = res.faceBlendshapes && res.faceBlendshapes[0] ? res.faceBlendshapes[0].categories : null;
  if (cats){ const top = [];
    for (const c of cats){ if (c.categoryName === '_neutral') continue; const name = mirror ? swap(c.categoryName) : c.categoryName;
      const v = Math.min(1, c.score * gain); smooth[name] = (smooth[name] ?? 0) * 0.45 + v * 0.55; setMorph(name, smooth[name]); if (smooth[name] > 0.15) top.push([name, smooth[name]]); }
    top.sort((a, b) => b[1] - a[1]); $('top').textContent = top.slice(0, 6).map(t => t[0].padEnd(20) + t[1].toFixed(2)).join('\n'); }
  const mats = res.facialTransformationMatrixes;
  if ($('headrot').checked && mats && mats[0] && bones.head){ m4.fromArray(mats[0].data); e.setFromRotationMatrix(m4, 'YXZ');
    const s = mirror ? -1 : 1; targetQ.setFromEuler(new THREE.Euler(-e.x * 0.5, e.y * 0.5 * s, -e.z * 0.5 * s, 'YXZ')); headQ.slerp(targetQ, 0.4);
  } else headQ.slerp(q.identity(), 0.2);
  state.frames++;
}
window.__applyResult = applyResult;

try {
  const gltf = await new GLTFLoader().loadAsync('./AAdi.glb'); scene.add(gltf.scene);
  gltf.scene.traverse(o => { if (o.isBone){ bones[o.name] = o; rest[o.name] = o.quaternion.clone(); } if (o.isMesh){ o.frustumCulled = false; if (o.morphTargetDictionary) morphMeshes.push(o); if (o.material && o.material.name === 'Dress_Outer') o.material.depthWrite = false; } });
  state.glbReady = true; state.morphMeshes = morphMeshes.length; say('Character loaded. Loading face tracker...');
} catch (err){ state.error = 'glb: ' + err.message; say('Could not load AAdi.glb: ' + err.message); }

let tracker = null;
try {
  const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
  tracker = await FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate: 'GPU' }, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true, runningMode: 'VIDEO', numFaces: 1 });
  state.modelReady = true; say('Ready. Press "Start camera" and allow camera access.');
} catch (err){ state.error = 'tracker: ' + err.message; say('Face tracker failed to load: ' + err.message); }

const video = $('cam'); let running = false, lastT = -1;
$('start').onclick = async () => {
  if (running){ video.srcObject.getTracks().forEach(t => t.stop()); running = false; $('start').textContent = 'Start camera'; $('start').classList.remove('on'); return; }
  if (!navigator.mediaDevices || !isSecureContext){ say('The browser blocks the camera on this address. It only allows it on https:// pages or on localhost / 127.0.0.1.'); return; }
  try { video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }); await video.play(); running = true; $('start').textContent = 'Stop camera'; $('start').classList.add('on'); say('Tracking. Keep your face in view and well lit.'); }
  catch (err){ say('Camera error: ' + err.message); }
};
renderer.setAnimationLoop(() => {
  if (running && tracker && video.readyState >= 2 && video.currentTime !== lastT){ lastT = video.currentTime; try { applyResult(tracker.detectForVideo(video, performance.now())); } catch (err){ say('Tracking error: ' + err.message); } }
  if (bones.head){ bones.head.quaternion.copy(rest.head).multiply(headQ); if (bones.neck) bones.neck.quaternion.copy(rest.neck).multiply(q.identity().slerp(headQ, 0.6)); }
  renderer.render(scene, camera);
});
