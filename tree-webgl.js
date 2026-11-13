/* Original procedural WebGL garden; no external assets or dependencies. */
(() => {
  'use strict';
  const cache = new WeakMap();
  const failed = new WeakSet();
  function diagnostic(stage, error) {
    // Only renderer/compiler diagnostics; never include QR payloads or matrix data.
    globalThis.console?.warn(`QR tree WebGL ${stage}: ${String(error?.message || error).slice(0, 1500)}`);
  }
  const backgrounds = [0.957, 0.941, 0.902];
  const colors = {
    natural: [1, 0.79, 0.89], lavender: [0.76, 0.63, 0.91], coral: [1, 0.46, 0.47],
    gold: [1, 0.74, 0.23], sky: [0, 150 / 255, 1], snow: [0.86, 0.91, 0.95],
  };
  function geometry(qr, season = 'spring') {
    if (!qr || !Number.isInteger(qr.size) || qr.size < 21 || qr.size > 177 || (qr.size - 21) % 4 || typeof qr.getModule !== 'function') throw new Error('无效的二维码矩阵。');
    let seed = qr.size;
    const dark = [];
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) { dark.push([x, y]); seed = (Math.imul(seed, 31) + x * 7 + y) >>> 0; }
    if (!dark.length) throw new Error('二维码没有码点。');
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const data = [];
    // interleaved position, target, normal, type/shade/phase (12 floats)
    function tri(a, b, c, type, shade = 0.5, targets, phase = 0, foliage) {
      const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
      let normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...normal) || 1; normal = normal.map((n) => n / len);
      if (foliage) {
        // Direction describes the whole flower spray; length carries baked AO.
        // A small share of the petal normal preserves its cupped surface.
        if (normal[1] < 0) normal = normal.map(n => -n);
        normal = normal.map((n,k) => n*.18 + foliage.normal[k]*.82);
        const length = Math.hypot(...normal) || 1;
        normal = normal.map(n => n / length * foliage.ao);
      }
      [a, b, c].forEach((p, i) => data.push(...p, ...(targets?.[i] || p), ...normal, type, Array.isArray(shade) ? shade[i] : shade, phase));
    }
    function quad(a, b, c, d, type, shade, targets) {
      tri(a, b, c, type, shade, targets && [targets[0],targets[1],targets[2]]);
      tri(a, c, d, type, shade, targets && [targets[0],targets[2],targets[3]]);
    }
    function tile(x, z, size, height, type, shade) {
      quad([x, height, z], [x, height, z + size], [x + size, height, z + size], [x + size, height, z], type, shade);
    }
    const extent = 1.35;
    tile(-extent, -extent, extent * 2, -0.006, 0, 1);
    const corners = [[-extent, -extent], [extent, -extent], [extent, extent], [-extent, extent]];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      quad([a[0], -0.006, a[1]], [b[0], -0.006, b[1]], [b[0], -0.09, b[1]], [a[0], -0.09, a[1]], 0, 0.22 + i * 0.07);
    }
    const module = 2.7 / (qr.size + 8), offset = -qr.size * module / 2;
    // Quiet stone variation is tree-only, bounded even for very dense codes.
    // Coordinate-based tones leave the seeded tree and falling petals unchanged.
    const floorCells = Math.min(qr.size, 45) + 8, floorStep = 2.7 / floorCells;
    for (let z = 0; z < floorCells; z++) for (let x = 0; x < floorCells; x++) {
      const tone = .5 + .28 * Math.sin(x * 2.31 + z * 5.17) + .17 * Math.cos(x * 4.73 - z * 1.91);
      tile(-extent + x * floorStep, -extent + z * floorStep, floorStep, -.003, 5, tone);
    }
    // Spatial garden colors, shared by every vertex of a module. The backing
    // remains complete even when a dense QR has more cells than flower meshes.
    for (const [x, z] of dark) {
      const nx = (x + .5) / qr.size * 2 - 1, nz = (z + .5) / qr.size * 2 - 1;
      const edge = Math.max(Math.abs(nx), Math.abs(nz));
      const patch = Math.sin(nx * 8 + nz * 3) * .09 + Math.cos(nz * 11 - nx * 4) * .07;
      const garden = edge + patch > .77;
      const olive = garden && Math.sin(nx * 17 + nz * 13) > .35;
      const tone = .5 + .24 * Math.sin(nx * 8 + nz * 6) + .20 * Math.cos(nz * 13 - nx * 5);
      tile(offset + x * module, offset + z * module, module, 0, 6, tone + (garden ? (olive ? 4 : 2) : 0));
    }
    function branch(a, b, radius, tipRadius, arc = 0, barkRadius = radius) {
      const dir = b.map((n, i) => n - a[i]), length = Math.hypot(...dir);
      const n = dir.map((v) => v / length), axis = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
      let u = [n[1] * axis[2] - n[2] * axis[1], n[2] * axis[0] - n[0] * axis[2], n[0] * axis[1] - n[1] * axis[0]];
      const ul = Math.hypot(...u); u = u.map((v) => v / ul);
      const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      function ring(p, r, angle) { return p.map((c, i) => c + r * (Math.cos(angle) * u[i] + Math.sin(angle) * v[i])); }
      for (let i = 0; i < 6; i++) {
        const u0=i*Math.PI/3*barkRadius,u1=(i+1)*Math.PI/3*barkRadius;
        quad(ring(a, radius, i * Math.PI / 3), ring(b, tipRadius, i * Math.PI / 3), ring(b, tipRadius, (i + 1) * Math.PI / 3), ring(a, radius, (i + 1) * Math.PI / 3), 1, .35+random()*.3,
          [[u0,arc,0],[u0,arc+length,0],[u1,arc+length,0],[u1,arc,0]]);
      }
    }
    // Catmull–Rom paths retain an uneven woody silhouette without long straight
    // spokes. Radius stays substantial through forks and tapers at the ends.
    function curvePoint(points, progress) {
      const scaled=Math.min(1,Math.max(0,progress))*(points.length-1);
      const interval=Math.min(points.length-2,Math.floor(scaled)),t=scaled-interval,t2=t*t,t3=t2*t;
      const a=points[Math.max(0,interval-1)],b=points[interval],c=points[interval+1],d=points[Math.min(points.length-1,interval+2)];
      return b.map((_,k)=>.5*((2*b[k])+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t2+(-a[k]+3*b[k]-3*c[k]+d[k])*t3));
    }
    function curvedBranch(points, radius, tipRadius) {
      const segments = (points.length - 1) * 3;
      let previous = points[0];
      let arc = 0;
      const thickness = (t) => tipRadius + (radius-tipRadius)*Math.pow(1-t,.85)*(1+.06*Math.sin(t*19));
      for(let step=1;step<=segments;step++) {
        const progress=step/segments,current=curvePoint(points,progress);
        branch(previous,current,thickness((step-1)/segments),thickness(progress),arc,radius);
        arc += Math.hypot(...current.map((v,k)=>v-previous[k]));
        previous=current;
      }
    }
    const stem = [
      [0,0,0],[.015,.18,-.015],[.03,.36,.005],[.01,.56,.035],
      [-.025,.78,.02],[-.045,1.0,-.005],[-.02,1.22,-.025],[.015,1.44,-.01],
      [.025,1.66,.02],[-.01,1.88,.025],[-.055,2.10,.005],[-.075,2.30,-.025],[-.06,2.49,-.04],
    ];
    curvedBranch(stem,.082,.008);
    curvedBranch([[.025,.23,-.015],[-.05,.11,.025],[-.18,.012,.09]],.047,.009);
    curvedBranch([[.025,.18,-.015],[.09,.07,-.06],[.18,.012,-.12]],.042,.008);
    function stemAt(height) {
      // Match the very same curve used to build the trunk, not its control cage.
      let low=0,high=1;
      for(let i=0;i<16;i++) { const mid=(low+high)*.5;if(curvePoint(stem,mid)[1]<height)low=mid;else high=mid; }
      return curvePoint(stem,(low+high)*.5);
    }
    const clusters = [];
    const scaffolds = [];
    // A few structural limbs carry many small sprays, rather than a regular whorl.
    const limbs = [
      [.72, -.35, .90], [.90, 2.10, .98], [1.13, 4.28, 1.01],
      [1.37, .46, 1.12], [1.58, 2.75, 1.11], [1.79, 4.73, .98],
      [2.02, 1.35, .65], [2.28, 3.40, .44], [2.47, 5.30, .24],
      [1.12, 1.16, 1.00], [1.34, 2.55, 1.11], [1.52, 5.34, 1.11],
      [1.72, 1.35, .93], [1.91, 3.12, .82], [2.12, 5.50, .60],
    ];
    for (let i = 0; i < limbs.length; i++) {
      const [h, theta, reach] = limbs[i];
      // Secondary limbs fork from established wood instead of making another
      // evenly spaced spoke at the trunk. The silhouette still uses the same tips.
      const parent = i >= 9 ? scaffolds[[0,1,3,4,5,6][i-9]] : null;
      const attachment = .42 + (i % 3)*.07;
      const root = parent ? curvePoint(parent.path,attachment) : stemAt(Math.max(.28,h-.57));
      const elbow = [root[0]*.55+Math.cos(theta-.16)*reach*.24, h-.22, root[2]*.55+Math.sin(theta-.16)*reach*.24];
      const shoulder = [Math.cos(theta+.05) * reach * .69, h-.08, Math.sin(theta+.05) * reach * .69];
      const tip = [Math.cos(theta) * reach, h, Math.sin(theta) * reach];
      const guide=[root,elbow,shoulder,tip];
      const baseRadius = parent ? (.0024+(parent.radius-.0024)*Math.pow(1-attachment,.85))*.68 : .021+Math.sqrt(reach)*.022;
      // Smaller limbs wander more; smooth displacements vanish at both ends.
      // Sprays sample this same path, so they remain connected to their parent.
      const path=Array.from({length:7},(_,step)=>{
        const t=step/6,point=curvePoint(guide,t),envelope=Math.sin(Math.PI*t);
        const bend=(.014+.00065/baseRadius)*envelope*Math.sin(t*7+i*2.3);
        point[0]-=Math.sin(theta)*bend;point[2]+=Math.cos(theta)*bend;
        point[1]+=envelope*(.045*Math.sin(t*5+i)-.035*t);
        return point;
      });
      curvedBranch(path,baseRadius,.0024);
      scaffolds.push({path,radius:baseRadius});
      for (let j = 0; j < 9; j++) {
        const along = [.24,.33,.40,.55,.61,.68,.82,.90,.98][j];
        const side = (j % 2 ? 1 : -1) * (.10 + random() * .20) * (1.15 - h * .22);
        const at = curvePoint(path,along);
        const ahead = curvePoint(path,Math.min(1,along+.06));
        const direction=ahead.map((v,k)=>v-at[k]),directionLength=Math.hypot(...direction)||1;
        const forward=direction.map(v=>v/directionLength*.08);
        const end = [at[0]+forward[0]-Math.sin(theta)*side, at[1]+forward[1]+(random()-.45)*.14, at[2]+forward[2]+Math.cos(theta)*side];
        // Short sprays support the main crown.
        const bend=at.map((v,k)=>v+(end[k]-v)*.38+forward[k]*.36);
        curvedBranch([at,bend,end],Math.max(.0022,baseRadius*Math.pow(1-along,.85)*.23),.0009);
        const droop = i === 9 && j >= 6 ? .18 + random() * .12 : (i < 3 && j > 5 ? .42 + random() * .36 : 0);
        const patch=.38+.08*Math.sin(end[0]*3.2+end[1]*2.1)+.04*Math.cos(end[2]*4.1-end[1]);
        const cluster = {tip:end, elbow:at, radius:(.24 + random() * .055) * (h > 2.1 ? .61 : (i === 9 && j < 5 ? .72 : 1)), droop, shade:Math.max(.10,Math.min(.90,patch+(random()-.5)*.08))};
        // A fuller middle/outer spray and a thin inner stem make connected masses
        // separated by air, rather than a uniform sprinkling along every twig.
        const weight = h>2.1 || j<2 || (i===9&&j<5) ? 1 : 4;
        for (let n = 0; n < weight; n++) clusters.push(cluster);
      }
    }
    const leafCount = 5520;
    const uniqueClusters = [...new Set(clusters)];
    for (const cluster of uniqueClusters) {
      cluster.neighbors = uniqueClusters.filter(other => other !== cluster && Math.hypot(...other.tip.map((v,k)=>v-cluster.tip[k])) < .65);
    }
    const petalSources = [];
    let blossomCount = 0;
    for (let i = 0; i < leafCount; i++) {
      const cluster = clusters[i % clusters.length], azimuth = random() * Math.PI * 2;
      const z = random() * 2 - 1, r = Math.pow(random(),.43), radial = Math.sqrt(1 - z * z) * r;
      // Blend sprays back along their supporting twig instead of crowding a ball
      // at every tip. Keep the explicit trunk opening and long drooping offsets.
      const inner = random() < .46, along = inner ? .48+random()*.52 : 1;
      const center = cluster.elbow.map((value, axis) => value + (cluster.tip[axis] - value) * along);
      const edgeShape=1+.10*Math.sin(azimuth*3+cluster.tip[1]*4)+.06*Math.cos(azimuth*5-cluster.tip[0]*5);
      const radius = cluster.radius * (inner ? 1.04 : 1) * edgeShape;
      const p = [center[0] + Math.cos(azimuth) * radial * radius * 1.20, Math.max(.045, center[1] + z * r * radius * .66 - cluster.droop * r), center[2] + Math.sin(azimuth) * radial * radius * 1.20];
      // Open an irregular gap below the front fork by moving the flowers to
      // its sides. This is fixed geometry, so the opening rotates with the tree.
      const across = (p[0] - p[2]) * Math.SQRT1_2;
      const front = (p[0] + p[2]) * Math.SQRT1_2;
      if (p[1] < 1.35 && front > -.08) {
        const opening = .23 + .035 * Math.sin(p[1] * 8 + front * 3);
        const strength = Math.min(1, Math.max(0, (1.35 - p[1]) / .35));
        if (Math.abs(across) < opening) {
          const shift = (across < 0 ? -1 : 1) * (opening - Math.abs(across)) * strength;
          p[0] += shift * Math.SQRT1_2;
          p[2] -= shift * Math.SQRT1_2;
        }
      }
      if (petalSources.length < 64 && i >= (petalSources.length + .5) * leafCount / 64 && i % 12 !== 0 && p[1]>.4) petalSources.push([...p]);
      const yaw = random() * Math.PI * 2, pitch = .08 + random() * .58, size = .038 + random() * .031;
      const u = [Math.cos(yaw), 0, Math.sin(yaw)];
      const v = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
      const cell = dark[i % dark.length];
      const target = [offset + (cell[0] + .5) * module, .015, offset + (cell[1] + .5) * module];
      const targets = [target, target, target];
      // Small overlapping pink/cream patches cross cluster boundaries. A mild
      // per-flower variation avoids both whole white balls and uniform speckling.
      const interleave=.16*Math.sin(p[0]*17+p[1]*12)*Math.cos(p[2]*14-p[1]*8);
      const shade = Math.max(.02,Math.min(.98,cluster.shade+interleave+(random()-.5)*.24)), phase = random();
      const botanicalScale = season === 'spring' ? (i % 12 === 0 ? .56 : 1.18) : 1;
      const sprayNormal=[Math.cos(azimuth)*radial,z*.82,Math.sin(azimuth)*radial];
      const normalLength=Math.hypot(...sprayNormal)||1;
      let cover=0;
      for (const other of cluster.neighbors) {
        const dy=other.tip[1]-p[1];
        if(dy < -.10) continue;
        const distance=Math.hypot(other.tip[0]-p[0],dy*.8,other.tip[2]-p[2]);
        cover+=Math.max(0,1-distance/(other.radius*1.65))*.12;
      }
      const foliage={normal:sprayNormal.map(n=>n/normalLength),ao:Math.max(.77,1-cover-(1-r)*.12)};
      const point = (a, b, lift = 0) => p.map((c, k) => c + (a * u[k] + b * v[k]) * size * botanicalScale + (k === 1 ? lift * size : 0));
      if (season === 'spring' && i % 12 !== 0) {
        blossomCount++;
        // Five rounded, slightly cupped petals, separate from the green leaves.
        // Their soft shoulders and shallow notch must read as flowers, not stars.
        for (let petal = 0; petal < 5; petal++) {
          const a = petal * Math.PI * 2 / 5 + Math.sin(phase * 17 + petal * 3.1) * .065;
          const shape = [[.10,0],[.62,-.38],[.95,-.22],[.88,0],[.95,.22],[.62,.38]];
          const length = .92 + .10 * Math.sin(petal * 2.4 + phase * 9);
          const rim = shape.map(([r,w]) => point((Math.cos(a)*r-Math.sin(a)*w)*length,(Math.sin(a)*r+Math.cos(a)*w)*length,.025+r*r*.17+Math.abs(w)*.11));
          const petalShade=shade+Math.sin(petal*2.4+phase*5)*.18;
          for(let j=1;j<rim.length-1;j++) {
            // Smooth pigment gradient: rosy attachment, light outer shoulders.
            const tone=index=>Math.max(.02,Math.min(.999,petalShade+(index===0?-.16:(index===2||index===4?.22:.09))));
            tri(rim[0],rim[j],rim[j+1],2,[tone(0),tone(j),tone(j+1)],targets,phase,foliage);
          }
        }
        const middle = point(0,0,.14);
        for(let j=0;j<4;j++) {
          const a=j*Math.PI/2,b=(j+1)*Math.PI/2;
          tri(middle,point(Math.cos(a)*.15,Math.sin(a)*.15,.13),point(Math.cos(b)*.15,Math.sin(b)*.15,.13),2,6+shade,targets,phase,foliage);
        }
      } else {
        // Broad palmate leaves: five pointed lobes, shallow sinuses, little fold.
        const outline = [[0,-1.05],[.28,-.48],[.72,-.73],[.62,-.17],[1.04,.02],[.54,.34],[.65,.76],[.17,.59],[0,1.0],[-.22,.58],[-.69,.73],[-.54,.29],[-1.0,-.02],[-.60,-.20],[-.74,-.70],[-.27,-.47]];
        const rim=outline.map(([a,b])=>point(a,b));
        const middle=point(0,.12,.055);
        for(let j=0;j<rim.length;j++)tri(middle,rim[j],rim[(j+1)%rim.length],2,shade+(season==='spring'?4:0),targets,phase,foliage);
      }
    }
    // Fallen petals connect the canopy to the garden without covering QR mode.
    for (let i = 0; i < 240; i++) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * 1.14;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, size = .018 + random() * .021;
      quad([x-size,.012,z],[x,.013,z-size*.6],[x+size,.012,z],[x,.013,z+size*.6],4,random());
    }
    for (let i = 0; i < 4400; i++) {
      let x, z;
      if (i < 2000) {
        const edge = i % 4, along = random() * 2.6 - 1.3, rim = 1.21 + random() * 0.12;
        x = edge < 2 ? along : rim * (edge === 2 ? 1 : -1); z = edge < 2 ? rim * (edge ? 1 : -1) : along;
      } else {
        const corner = i % 3;
        x = offset + (corner === 1 ? qr.size - 7 : 0) * module + random() * 7 * module;
        z = offset + (corner === 2 ? qr.size - 7 : 0) * module + random() * 7 * module;
      }
      // Broken tufts leave breathing room between grass patches.
      if (Math.sin(x * 19 + z * 11) + Math.cos(z * 23 - x * 7) < -1.1) continue;
      const h = 0.035 + random() * 0.12, width = 0.008 + random() * 0.011;
      const direction = random() * Math.PI * 2, tilt = .025 + random() * .065;
      tri([x - Math.cos(direction)*width, .008, z - Math.sin(direction)*width], [x + Math.sin(direction)*tilt, h, z + Math.cos(direction)*tilt], [x + Math.cos(direction)*width, .008, z + Math.sin(direction)*width], 3, random());
      if (i % 4 === 0) {
        const r = 0.013 + random() * 0.007;
        tri([x-r,h*0.65,z],[x+r,h*0.65,z],[x,h*0.65+r,z+r],4,random());
        tri([x,h*0.65-r,z-r],[x+r,h*0.65,z],[x-r,h*0.65,z],4,random());
      }
    }
    // Fixed-budget particles. Their motion is computed in the vertex shader;
    // no per-frame allocation, timers, textures, or new contexts are needed.
    for (let i = 0; i < 64; i++) {
      const phase = random(), origin = petalSources[i], [x,h,z] = origin, size = .014 + random() * .014;
      const targets = [origin,origin,origin], shade = random();
      tri([x-size,h,z],[x,h,z-size*.65],[x+size,h,z],7,shade,targets,phase);
      tri([x-size,h,z],[x+size,h,z],[x,h,z+size*.65],7,shade,targets,phase);
    }
    for (let i = 0; i < 220; i++) {
      const phase = random(), x = (random() - .5) * 2.65, z = (random() - .5) * 2.65, h = 0;
      quad([x,.02+h,z],[x+.0035,.02+h,z],[x+.022,.215+h,z],[x+.0185,.215+h,z],8,phase);
    }
    for (let i = 0; i < 24; i++) {
      const x = (random() - .5) * 2.55, z = (random() - .5) * 2.55, phase = random();
      for(let j = 0; j < 12; j++) {
        const a = j * Math.PI / 6, b = (j + 1) * Math.PI / 6;
        const point = (t,r) => [x+Math.cos(t)*r,.008,z+Math.sin(t)*r];
        // Target stores the ripple center, not a QR module.
        tri(point(a,.027),point(b,.027),point(b,.030),9,phase,[[x,.008,z],[x,.008,z],[x,.008,z]],phase);
        tri(point(a,.027),point(b,.030),point(a,.030),9,phase,[[x,.008,z],[x,.008,z],[x,.008,z]],phase);
      }
    }
    return { vertices: new Float32Array(data), leafCount, blossomCount, darkCount: dark.length, coloredCellCount: dark.length };
  }
  const vertexSource = `
    attribute vec3 aPosition; attribute vec3 aTarget; attribute vec3 aNormal; attribute vec3 aMeta;
    uniform mediump float uProgress; uniform float uAngle; uniform float uTime; uniform float uAspect; uniform float uFinalScale;
    varying mediump vec3 vNormal; varying mediump vec3 vMeta; varying mediump vec3 vPosition; varying mediump vec2 vBark;
    vec2 gardenWind(vec3 position,float time){
      return vec2(sin(time*.65+position.y*.8)*.018+sin(time*1.1+position.z)*.006,sin(time*.51+position.y)*.012);
    }
    void main(){
      float p=uProgress; float kind=aMeta.x; vec3 pos=aPosition; vec3 normal=aNormal;
      if(kind>0.5 && kind<2.5) pos.y*=mix(1.24,1.0,p);
      if(kind>0.5 && kind<1.5) pos*=1.0-smoothstep(0.0,0.62,p);
      if(kind>1.5 && kind<2.5){
        float t=smoothstep(aMeta.z*0.12,0.92+aMeta.z*0.08,p);
        pos=mix(pos,aTarget,t); pos.y+=sin(t*3.14159265)*0.30;
        pos.x+=sin(uTime*0.7+aPosition.y*3.0+aMeta.z*6.28)*0.009*(1.0-t);
        float ao=length(normal);
        normal=normalize(mix(normalize(normal),vec3(0.,1.,0.),t)+vec3(0.,.0001,0.))*mix(ao,1.,t);
      }
      if(kind>2.5 && kind<4.5) pos.y*=1.0-smoothstep(0.2,0.8,p);
      if(kind>.5 && kind<2.5){
        vec2 wind=gardenWind(aPosition,uTime);
        pos.x+=wind.x*aPosition.y*aPosition.y*(1.-p);
        pos.z+=wind.y*aPosition.y*(1.-p);
        if(kind>1.5) pos.y+=sin(uTime*2.2+aMeta.z*6.283)*.012*(1.-p);
      }
      if(kind>6.5 && kind<7.5){
        float rate=(.10+aMeta.z*.025)/(sqrt(aTarget.y*1.24)+.45);
        float cycle=fract(uTime*rate+aMeta.z);
        float flight=min(cycle/.82,1.);
        // Accelerate briefly, then approach terminal speed; reserve time to land.
        float fall=(flight-.12*(1.-exp(-flight/.12)))/(.88+.12*exp(-1./.12));
        vec3 origin=aTarget; origin.y*=1.24;
        vec3 landing=vec3(clamp(origin.x+sin(aMeta.z*19.)*.18,-1.23,1.23),.016,clamp(origin.z+cos(aMeta.z*13.)*.15,-1.23,1.23));
        vec3 offset=pos-aTarget;
        float flutter=sin(cycle*(22.+aMeta.z*14.)+aMeta.z*6.283)*(1.-smoothstep(.72,1.,fall));
        float spin=cycle*(9.+aMeta.z*8.);
        offset.xz=mat2(cos(spin),-sin(spin),sin(spin),cos(spin))*offset.xz;
        offset=vec3(offset.x*cos(flutter),offset.x*sin(flutter),offset.z);
        offset*=smoothstep(0.,.04,cycle)*(1.-smoothstep(.93,1.,cycle));
        pos=mix(origin,landing,fall)+offset;
        pos.x+=sin(cycle*12.+aMeta.z*9.)*.10*sin(fall*3.14159265);
        pos.z+=cos(cycle*10.+aMeta.z*7.)*.07*sin(fall*3.14159265);
        pos.xz+=gardenWind(aTarget,uTime)*3.*sin(fall*3.14159265);
      }
      if(kind>7.5 && kind<8.5){float fall=fract(aMeta.y-uTime*.85);pos.y+=fall*3.;pos.x-=fall*.22;}
      if(kind>8.5){float wave=fract(aMeta.z+uTime*.65);pos=aTarget+(pos-aTarget)*(.3+wave*2.4);}
      float angle=uAngle*(1.0-p);
      float c=cos(angle),s=sin(angle); float x=pos.x*c-pos.z*s; float z=pos.x*s+pos.z*c;
      float elevation=mix(0.50,1.5707963,smoothstep(0.0,1.0,p));
      float ce=cos(elevation),se=sin(elevation); float center=mix(1.21,0.0,p);
      float y=(pos.y-center)*ce-z*se; float depth=z*ce+(pos.y-center)*se;
      float scale=mix(0.47,uFinalScale,p);
      gl_Position=vec4(x*scale/uAspect,y*scale,-depth*0.12,1.0);
      vNormal=normal;vMeta=aMeta;vPosition=aPosition;vBark=aTarget.xy;
    }`;
  const fragmentSource = `
    precision mediump float; uniform mediump float uProgress; uniform vec3 uLeaf; uniform vec3 uGrass; uniform vec3 uHighlight; uniform vec3 uGrassHighlight; uniform float uRain;
    varying mediump vec3 vNormal; varying mediump vec3 vMeta; varying mediump vec3 vPosition; varying mediump vec2 vBark;
    void main(){
      float k=vMeta.x,s=mod(vMeta.y,2.),p=uProgress; vec3 color;
      if(k<0.5) color=mix(mix(vec3(.65,.64,.61),vec3(.97,.96,.92),s),vec3(.978,.969,.941),smoothstep(.35,1.,p));
      else if(k<1.5){
        float furrow=sin(vBark.x*390.+sin(vBark.y*8.)*1.4+sin(vBark.y*19.)*.35);
        float grain=sin(vBark.x*910.+sin(vBark.y*13.)*.6);
        color=mix(vec3(.32,.21,.14),vec3(.52,.36,.23),s)*(.92+.06*furrow+.025*grain);
      }
      else if(k<2.5){
        color=mix(uLeaf*vec3(1.,.89,.96),uHighlight,smoothstep(.02,.70,s));
        if(vMeta.y>3.5)color=mix(vec3(.62,.76,.43),vec3(.84,.91,.64),s);
        if(vMeta.y>5.5)color=mix(vec3(.98,.79,.32),vec3(1.,.94,.67),s);
        // Flowers collapse to module centers; complete backing cells take over.
        // No tiny white flower centers are allowed to punch holes in the QR.
        if(p>.995)discard;
      } else if(k<3.5) color=mix(uGrass*.75,uGrassHighlight,s)*mix(.82,1.04,smoothstep(.005,.10,vPosition.y));
      else if(k<4.5) color=mix(uLeaf,uHighlight,s*.65);
      else if(k<5.5) color=mix(vec3(.89,.88,.83),vec3(.98,.97,.93),s);
      else if(k<6.5){
        vec3 moduleColor=uLeaf*(.78+.22*s);
        if(vMeta.y>1.5)moduleColor=uGrass*(.78+.22*s);
        if(vMeta.y>3.5)moduleColor=mix(vec3(.35,.37,.16),vec3(.55,.55,.27),s);
        vec3 stone=mix(vec3(.73,.73,.67),vec3(.86,.85,.80),s);
        color=mix(stone,moduleColor,smoothstep(.40,1.,p));
      }
      else if(k<7.5) color=mix(uLeaf,uHighlight,s*.35);
      else color=vec3(.46,.62,.68);
      if(k<.5 || (k>4.5 && k<6.5)) {
        float grain=sin(vPosition.x*139.+vPosition.z*113.)*sin(vPosition.z*157.-vPosition.x*101.);
        float contact=exp(-dot(vPosition.xz,vPosition.xz)*19.);
        float texture=1.+grain*.014-contact*.065;
        if(k<.5 && abs(vNormal.y)<.5) texture*=mix(.91,1.04,clamp((vPosition.y+.09)/.084,0.,1.));
        color*=mix(texture,1.,smoothstep(.15,.65,p));
      }
      float light=.90+.12*abs(dot(normalize(vNormal),normalize(vec3(-.4,1.,-.3))));
      if(k>1.5 && k<2.5){
        float sunlight=dot(normalize(vNormal),normalize(vec3(-.4,1.,-.3)))*.5+.5;
        float open=clamp(length(vNormal),.77,1.);
        float diffuse=smoothstep(.18,.86,sunlight);
        // Cool rosy shade, warm lit shoulders, with soft transmission on the back.
        color=mix(color*vec3(.98,.93,.95),color,diffuse);
        light=(.97+.07*diffuse)*mix(.93,1.,(open-.77)/.23);
      }
      if(k<.5 || k>5.5) light=1.;
      if(k>4.5 && k<5.5){ if(p>.3)discard; light=1.; }
      if(k>2.5&&k<4.5&&p>.85)discard;
      if(k>6.5&&p>0.)discard;
      if(k>7.5&&uRain<.5)discard;
      gl_FragColor=vec4(color*mix(light,1.,p),1.);
    }`;
  function upload(r, scene, season) {
    r.mesh = geometry(scene.qr, season);
    r.gl.bindBuffer(r.gl.ARRAY_BUFFER,r.buffer);
    r.gl.bufferData(r.gl.ARRAY_BUFFER,r.mesh.vertices,r.gl.STATIC_DRAW);
    r.count = r.mesh.vertices.length / 12;
    r.mesh.vertices.fill(0);r.mesh=null;r.season=season;
  }
  function create(scene, season) {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    if (!gl) { diagnostic('context', 'WebGL context unavailable'); return null; }
    const resources = { canvas, gl, shaders: [], program: null, buffer: null, mesh: null };
    try {
      function shader(type, source) {
        const s = gl.createShader(type); resources.shaders.push(s); gl.shaderSource(s, source); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`树景着色器编译失败: ${gl.getShaderInfoLog(s)}`);
        return s;
      }
      const program = resources.program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexSource)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentSource)); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`树景着色器连接失败: ${gl.getProgramInfoLog(program)}`);
      resources.buffer = gl.createBuffer();
      upload(resources,scene,season);
      resources.attributes = ['aPosition','aTarget','aNormal','aMeta'].map((name) => gl.getAttribLocation(program,name));
      if (resources.attributes.some((location) => location < 0)) throw new Error('必需的顶点属性不可用');
      resources.uniforms = Object.fromEntries(['uProgress','uAngle','uTime','uAspect','uFinalScale','uLeaf','uGrass','uHighlight','uGrassHighlight','uRain'].map((name) => [name,gl.getUniformLocation(program,name)]));
      canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); dispose(scene); failed.add(scene); });
      return resources;
    } catch (error) { diagnostic('initialization', error); destroy(resources); return null; }
  }
  function destroy(r) {
    if (!r) return;
    const gl = r.gl;
    if (r.buffer) gl.deleteBuffer(r.buffer);
    if (r.program) gl.deleteProgram(r.program);
    for (const shader of r.shaders) gl.deleteShader(shader);
    r.mesh?.vertices.fill(0);
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    r.canvas.width = r.canvas.height = 1;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  function dispose(scene) { const r = cache.get(scene); cache.delete(scene); destroy(r); }
  function draw(output, scene, options = {}) {
    if (!scene?.qr || options.standardQr === true || failed.has(scene)) return false;
    if (!Number.isInteger(output.width) || !Number.isInteger(output.height) || output.width < 1 || output.height < 1 || output.width > 4096 || output.height > 4096) return false;
    const season = options.season === 'summer' || options.season === 'autumn' ? options.season : 'spring';
    let r = cache.get(scene);
    if (!r) { r = create(scene,season); if (!r) { failed.add(scene); return false; } cache.set(scene,r); }
    const gl = r.gl;
    if (gl.isContextLost()) { diagnostic('context', 'WebGL context lost'); dispose(scene); failed.add(scene); return false; }
    try {
      if(r.season!==season)upload(r,scene,season);
      if (r.canvas.width !== output.width || r.canvas.height !== output.height) { r.canvas.width=output.width;r.canvas.height=output.height; }
      gl.viewport(0,0,output.width,output.height);gl.clearColor(...backgrounds,1);gl.enable(gl.DEPTH_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(r.program);gl.bindBuffer(gl.ARRAY_BUFFER,r.buffer);
      r.attributes.forEach((location,i) => { gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,48,i*12); });
      const finite = (x,d) => Number.isFinite(x)?x:d;
      gl.uniform1f(r.uniforms.uProgress,Math.min(1,Math.max(0,finite(options.progress,0))));
      gl.uniform1f(r.uniforms.uAngle,finite(options.angle,Math.PI/4));gl.uniform1f(r.uniforms.uTime,finite(options.time,0)%4096);gl.uniform1f(r.uniforms.uAspect,output.width/output.height);
      const qrSide = Math.floor(Math.min(output.width, output.height) * 0.82 / (scene.qr.size + 8)) * (scene.qr.size + 8);
      gl.uniform1f(r.uniforms.uFinalScale, 2 * qrSide / output.height / 2.7);
      let leaf=colors[options.palette]||colors.natural;
      if (!options.palette || options.palette==='natural') { if(options.season==='summer')leaf=[.32,.65,.20];if(options.season==='autumn')leaf=[.98,.54,.15]; }
      gl.uniform3fv(r.uniforms.uLeaf,leaf);gl.uniform3fv(r.uniforms.uGrass,options.season==='autumn'?[.55,.49,.16]:[.23,.61,.14]);
      let highlight=[1,.98,.97];
      if(!options.palette||options.palette==='natural'){
        highlight=[1.,.965,.90];
        if(options.season==='summer')highlight=[.72,.94,.27];
        if(options.season==='autumn')highlight=[1,.79,.13];
      }
      gl.uniform3fv(r.uniforms.uHighlight,highlight);
      gl.uniform3fv(r.uniforms.uGrassHighlight,options.season==='autumn'?[.96,.77,.24]:[.72,.94,.33]);
      gl.uniform1f(r.uniforms.uRain,options.rain===true?1:0);
      gl.drawArrays(gl.TRIANGLES,0,r.count);
      const ctx=output.getContext('2d');if(!ctx)return false;
      ctx.save();try{ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.drawImage(r.canvas,0,0);}finally{ctx.restore();}
      return true;
    } catch (error) { diagnostic('draw', error);dispose(scene);failed.add(scene);return false; }
  }
  globalThis.QRTreeWebGL=Object.freeze({draw,dispose,geometry});
})();
