// Secondary motion for the hair bone chains (Hair_Front_L_01..04, Hair_Back_L_01..03, Hair_Back_R_01..03).
// Usage:  const hair = createHairMotion(bones);  then every frame, AFTER mixer.update():  hair.update(dt);
import * as THREE from 'three';
export function createHairMotion(bones, opts = {}) {
  const stiffness = opts.stiffness ?? 28, damping = opts.damping ?? 7, gain = opts.gain ?? 0.55, sway = opts.sway ?? 0.012;
  const chains = ['Hair_Front_L', 'Hair_Back_L', 'Hair_Back_R'].map(n => Object.keys(bones).filter(k => k.startsWith(n + '_')).sort().map(k => bones[k])).filter(c => c.length);
  const rest = new Map(); chains.flat().forEach(b => rest.set(b, b.quaternion.clone()));
  const state = chains.map(c => c.map(() => ({ x: 0, z: 0, vx: 0, vz: 0 })));
  const driver = bones.chest || bones.head; const prev = new THREE.Quaternion(); const cur = new THREE.Quaternion(); const dq = new THREE.Quaternion(); const e = new THREE.Euler(); const q = new THREE.Quaternion();
  driver.getWorldQuaternion(prev); let t = 0; const prevPos = new THREE.Vector3(); const pos = new THREE.Vector3(); driver.getWorldPosition(prevPos);
  return { update(dt) {
    dt = Math.min(dt, 0.05); if (dt <= 0) return; t += dt;
    driver.getWorldQuaternion(cur); dq.copy(prev).invert().multiply(cur); e.setFromQuaternion(dq); prev.copy(cur);
    driver.getWorldPosition(pos); const vx = (pos.x - prevPos.x) / dt, vz = (pos.z - prevPos.z) / dt; prevPos.copy(pos);
    const kickX = -(e.x / dt) * gain * 0.05 - vz * 0.004, kickZ = -(e.z / dt + e.y / dt) * gain * 0.05 + vx * 0.004;
    chains.forEach((c, ci) => c.forEach((b, k) => { const s = state[ci][k]; const w = (k + 1) / c.length;
      s.vx += (-stiffness * s.x - damping * s.vx + kickX * 40 * w) * dt; s.vz += (-stiffness * s.z - damping * s.vz + kickZ * 40 * w) * dt;
      s.x = THREE.MathUtils.clamp(s.x + s.vx * dt, -0.35, 0.35); s.z = THREE.MathUtils.clamp(s.z + s.vz * dt, -0.35, 0.35);
      const idle = sway * w * Math.sin(t * 1.3 + ci * 1.7 + k * 0.6);
      b.quaternion.copy(rest.get(b)).multiply(q.setFromEuler(e.set(s.x + idle, 0, s.z + idle * 0.6))); })); } };
}
