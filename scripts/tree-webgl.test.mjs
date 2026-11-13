import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
const source = await readFile(new URL('../tree-webgl.js', import.meta.url), 'utf8');
const context = vm.createContext({ Float32Array });
vm.runInContext(source, context);
const renderer = context.QRTreeWebGL;
const qr = {size:25,getModule:(x,y)=>(x+y)%3===0};
test('seasonal geometry is deterministic, finite, and bounded with distinct spring blossoms',()=>{
 let springLength;
 for(const season of ['spring','summer','autumn']){
  const a=renderer.geometry(qr,season), b=renderer.geometry(qr,season);
  // Fixed botanical budget; extra triangles form the fuller flowers and curved scaffold.
  assert.equal(a.leafCount,5520); assert.ok(a.vertices.length < 5600000);
  assert.deepEqual(a.vertices,b.vertices);
  for(const value of a.vertices) assert.ok(Number.isFinite(value));
  let centers=0,greenLeaves=0;
  for(let i=0;i<a.vertices.length;i+=12){
   if(a.vertices[i+9]!==2)continue;
   if(a.vertices[i+10]>=6)centers++;
   else if(a.vertices[i+10]>=4)greenLeaves++;
  }
  if(season==='spring'){
   springLength=a.vertices.length;
   assert.equal(a.blossomCount,5060);
   assert.equal(centers,a.blossomCount*4*3);
   assert.ok(greenLeaves>0);
  }else{
   assert.equal(a.blossomCount,0);assert.equal(centers,0);assert.equal(greenLeaves,0);
   assert.notEqual(a.vertices.length,springLength);
  }
  const dense=renderer.geometry({size:177,getModule:()=>true},season);
  assert.ok(dense.vertices.length < 8000000);
 }
});
test('woody scaffold has a substantial curved trunk and tapered curved forks',()=>{
 const mesh=renderer.geometry(qr),wood=[];
 for(let i=0;i<mesh.vertices.length;i+=12)if(mesh.vertices[i+9]===1)wood.push(Array.from(mesh.vertices.slice(i,i+3)));
 assert.equal(wood.length%36,0,'each six-sided woody segment is a complete tube');
 const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
 const chains=[];let chain;
 for(let i=0;i<wood.length;i+=36){
  const roots=[],tips=[];
  for(let face=0;face<6;face++){roots.push(wood[i+face*6]);tips.push(wood[i+face*6+1]);}
  const center=points=>[0,1,2].map(k=>points.reduce((sum,p)=>sum+p[k],0)/points.length);
  const a=center(roots),b=center(tips);
  const radius=points=>points.reduce((sum,p)=>sum+distance(p,center(points)),0)/points.length;
  const segment={a,b,startRadius:radius(roots),endRadius:radius(tips)};
  if(!chain||distance(chain.at(-1).b,a)>1e-5){chain=[];chains.push(chain);}
  chain.push(segment);
 }
 const deviation=path=>{
  const a=path[0].a,b=path.at(-1).b,d=b.map((v,k)=>v-a[k]),length2=d.reduce((sum,v)=>sum+v*v,0);
  return Math.max(...path.map(({b:p})=>{
   const t=p.reduce((sum,v,k)=>sum+(v-a[k])*d[k],0)/length2;
   return distance(p,a.map((v,k)=>v+d[k]*t));
  }));
 };
 const trunk=chains[0];
 assert.ok(trunk.length>=12,'trunk resolves bends over multiple segments');
 assert.ok(trunk[0].startRadius>.06,'trunk retains visible volume instead of a fine line');
 assert.ok(trunk.at(-1).endRadius<trunk[0].startRadius*.25,'trunk tapers toward its crown');
 assert.ok(deviation(trunk)>trunk[0].startRadius*.5,'trunk centers deviate appreciably from a straight pole');
 const forks=chains.slice(1).filter(path=>path[0].startRadius>.02&&distance(path[0].a,path.at(-1).b)>.4);
 assert.ok(forks.length>=3,'several substantial forks support the crown');
 for(const fork of forks){
  assert.ok(fork.at(-1).endRadius<fork[0].startRadius*.4,'main forks taper into sprays');
  assert.ok(deviation(fork)>.025,'main forks bend instead of radiating as straight spokes');
 }
 const previousSegments=[...trunk];
 let secondaryForks=0;
 for(const child of chains.slice(1)){
  const root=child[0].a;
  if(Math.hypot(root[0],root[2])>.2&&child[0].startRadius>.008&&distance(root,child.at(-1).b)>.4)secondaryForks++;
  const attached=previousSegments.some(({a,b,startRadius,endRadius})=>{
   const d=b.map((v,k)=>v-a[k]),length2=d.reduce((sum,v)=>sum+v*v,0);
   const t=Math.max(0,Math.min(1,root.reduce((sum,v,k)=>sum+(v-a[k])*d[k],0)/length2));
   const parentRadius=startRadius+(endRadius-startRadius)*t;
   return distance(root,a.map((v,k)=>v+d[k]*t))<=parentRadius+.004;
  });
  assert.ok(attached,'child branch begins within its existing parent tube, not beside a disconnected straight guide');
  previousSegments.push(...child);
 }
 assert.ok(secondaryForks>=4,'substantial secondary limbs fork away from the trunk instead of all forming a radial whorl');
});

test('foliage carries bounded varied occlusion without changing it across a flower',()=>{
 const mesh=renderer.geometry(qr);
 let min=Infinity,max=-Infinity,count=0,previousPhase,previousAo;
 for(let i=0;i<mesh.vertices.length;i+=12){
  if(mesh.vertices[i+9]!==2)continue;
  const ao=Math.hypot(...mesh.vertices.slice(i+6,i+9));
  assert.ok(Number.isFinite(ao)&&ao>=.77-1e-6&&ao<=1+1e-6,'foliage has a finite nonzero lighting normal and safe AO');
  min=Math.min(min,ao);max=Math.max(max,ao);count++;
  // Flowers are emitted contiguously. Float32 animation phases can collide
  // between distant flowers, so they are not globally unique identifiers.
  const phase=mesh.vertices[i+11];
  if(phase===previousPhase)assert.ok(Math.abs(previousAo-ao)<1e-6,'all petals and the center retain the same baked occlusion');
  previousPhase=phase;previousAo=ao;
 }
 assert.ok(count>0&&min<.86&&max>.97,'the crown contains both sheltered and exposed foliage');
});

test('petal pigment interpolates within faces rather than using one flat tone',()=>{
 const mesh=renderer.geometry(qr);let faces=0,gradientFaces=0;
 for(let i=0;i<mesh.vertices.length;i+=36){
  if(mesh.vertices[i+9]!==2||mesh.vertices[i+10]>=4)continue;
  const shades=[mesh.vertices[i+10],mesh.vertices[i+22],mesh.vertices[i+34]];
  assert.ok(shades.every(tone=>Number.isFinite(tone)&&tone>=0&&tone<1),'pigment stays inside the petal material range');
  faces++;
  if(Math.max(...shades)-Math.min(...shades)>.05)gradientFaces++;
  assert.equal(mesh.vertices[i+11],mesh.vertices[i+23]);
  assert.equal(mesh.vertices[i+11],mesh.vertices[i+35],'a gradient face still moves as one flower');
 }
 assert.equal(faces,mesh.blossomCount*20);
 assert.ok(gradientFaces>faces*.75,'most petal faces shade smoothly from their base toward the rim');
});

test('bark coordinates follow branch arc length continuously instead of world height',()=>{
 const mesh=renderer.geometry(qr),wood=[];
 for(let i=0;i<mesh.vertices.length;i+=12)if(mesh.vertices[i+9]===1)wood.push(Array.from(mesh.vertices.slice(i,i+12)));
 assert.equal(wood.length%36,0);
 const distance=(a,b)=>Math.hypot(...a.map((value,k)=>value-b[k]));
 const center=points=>[0,1,2].map(k=>points.reduce((sum,p)=>sum+p[k],0)/points.length);
 let previousEnd,previousTip,previousWidth,branches=0,continued=0;
 for(let i=0;i<wood.length;i+=36){
  const segment=wood.slice(i,i+36),start=segment[0][4],end=segment[1][4];
  assert.ok(start>=0&&end>start,'wood grain advances from the root ring toward the tip');
  const roots=[],tips=[];
  for(let face=0;face<6;face++){
   const [a,b,c,d,e,f]=segment.slice(face*6,face*6+6);
   roots.push(a);tips.push(b);
   assert.ok([a[4],d[4],f[4]].every(v=>Math.abs(v-start)<1e-6));
   assert.ok([b[4],c[4],e[4]].every(v=>Math.abs(v-end)<1e-6));
   assert.equal(a[3],b[3],'longitudinal grain stays at the same circumferential coordinate');
   assert.equal(c[3],f[3]);
   assert.ok(c[3]>a[3],'circumferential coordinates cover a real strip');
  }
  const root=center(roots),tip=center(tips),width=segment.at(-1)[3];
  assert.ok(Math.abs(end-start-distance(root,tip))<1e-5,'longitudinal UV measures curved branch distance, including nonvertical limbs');
  if(start<1e-7){branches++;}
  else{
   assert.ok(previousEnd!==undefined&&Math.abs(start-previousEnd)<1e-6,'adjacent sections share an uninterrupted grain coordinate');
   assert.ok(distance(root,previousTip)<1e-5,'UV continuation belongs to a physically connected section');
   assert.ok(Math.abs(width-previousWidth)<1e-6,'tapering does not rescale the bark pattern at every section');
   continued++;
  }
  previousEnd=end;previousTip=tip;previousWidth=width;
 }
 assert.ok(branches>15&&continued>branches,'both independent branches and multi-section bark paths are present');
});

test('restored drooping clusters stay above the base and preserve the main crown',()=>{
 const mesh=renderer.geometry(qr),middleFlowers=new Set(),lowFlowers=new Set();
 let minY=Infinity,maxY=-Infinity;
 for(let i=0;i<mesh.vertices.length;i+=12){
  if(mesh.vertices[i+9]!==2)continue;
  const [x,y,z]=mesh.vertices.slice(i,i+3);
  assert.ok(Math.abs(x)<1.7&&Math.abs(z)<1.7&&y>0&&y<2.8,'canopy stays within the garden framing and above its base');
  minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  if(mesh.vertices[i+10]<6)continue;
  const phase=mesh.vertices[i+11];
  if(y>.8&&y<1.8)middleFlowers.add(phase);
  if(y<.4)lowFlowers.add(phase);
 }
 assert.ok(minY>0&&minY<.1&&maxY>2.3,'the previous long drooping clusters reach close to the floor without penetrating it');
 assert.ok(lowFlowers.size>30,'low flowering clusters are restored alongside the independent falling petals');
 assert.ok(middleFlowers.size>mesh.blossomCount*.4,'the main crown retains substantial flowering mass');
});

test('stone mosaic has bounded varied tiles below the complete QR backing',()=>{
 for(const size of [25,177]){
  const mesh=renderer.geometry({size,getModule:()=>true}),tones=new Set();let tiles=0;
  for(let i=0;i<mesh.vertices.length;i+=72){
   if(mesh.vertices[i+9]!==5)continue;
   tiles++;tones.add(mesh.vertices[i+10].toFixed(3));
   for(let j=0;j<72;j+=12){
    assert.ok(mesh.vertices[i+j+1]>-.006&&mesh.vertices[i+j+1]<0);
    assert.ok(Math.abs(mesh.vertices[i+j])<1.351&&Math.abs(mesh.vertices[i+j+2])<1.351);
   }
  }
  assert.equal(tiles,(Math.min(size,45)+8)**2);
  assert.ok(tones.size>100,'stone cells have varied tones instead of one flat fill');
 }
});

test('falling petals have small independent shapes and emit from actual canopy positions',()=>{
 const mesh=renderer.geometry(qr),flowers=[],particles=[];
 for(let i=0;i<mesh.vertices.length;i+=12){
  if(mesh.vertices[i+9]===2&&mesh.vertices[i+10]>=6)flowers.push(Array.from(mesh.vertices.slice(i,i+3)));
  if(mesh.vertices[i+9]===7)particles.push(Array.from(mesh.vertices.slice(i,i+12)));
 }
 assert.equal(particles.length,64*6);
 const phases=new Set();
 for(let i=0;i<particles.length;i+=6){
  const origin=particles[i].slice(3,6),phase=particles[i][11];phases.add(phase);
  assert.ok(origin[1]>.3,'falling petals begin above the ground');
  assert.ok(flowers.some(p=>Math.hypot(...p.map((v,k)=>v-origin[k]))<.04),'emitter belongs to a flower in the canopy');
  for(const vertex of particles.slice(i,i+6)){
   assert.deepEqual(vertex.slice(3,6),origin);
   assert.equal(vertex[11],phase,'one petal moves as a single small shape');
   assert.ok(Math.hypot(...vertex.slice(0,3).map((v,k)=>v-origin[k]))<.03);
  }
 }
 assert.equal(phases.size,64,'petals fall at different times');
});
test('tree camera contains the canopy at every yaw within the full wind envelope',()=>{
 // Read camera parameters from the actual shader rather than freezing a second camera here.
 const parameter=pattern=>{
  const match=source.match(pattern);assert.ok(match,'tree camera parameter is available');return Number(match[1]);
 };
 const stretch=parameter(/pos\.y\*=mix\(([\d.]+),1\.0,p\)/);
 const elevation=parameter(/float elevation=mix\(([\d.]+),/);
 const center=parameter(/float center=mix\(([\d.]+),/);
 const scale=parameter(/float scale=mix\(([\d.]+),/);
 const mesh=renderer.geometry(qr);
 let extentX=0,extentY=0;
 for(let i=0;i<mesh.vertices.length;i+=12){
  const kind=mesh.vertices[i+9];if(kind!==1&&kind!==2)continue;
  const [x,y,z]=mesh.vertices.slice(i,i+3),leaf=kind===2;
  // Conservative sum-of-amplitudes wind bound from the current vertex shader.
  // The radial bound includes all yaw angles, including the default diagonal view.
  const windX=(.018+.006)*y*y+(leaf?.009:0),windZ=.012*y,windY=leaf?.012:0;
  const radius=Math.hypot(Math.abs(x)+windX,Math.abs(z)+windZ);
  extentX=Math.max(extentX,radius*scale);
  extentY=Math.max(extentY,(Math.abs(y*stretch-center)+windY)*Math.cos(elevation)*scale+radius*Math.sin(elevation)*scale);
  if(leaf)assert.ok(y*stretch-windY>0,'wind does not move flowering geometry below the garden');
 }
 assert.ok(extentX<1,`rotated canopy exceeds horizontal clip space: ${extentX}`);
 assert.ok(extentY<1,`wind/rotation exceeds vertical clip space: ${extentY}`);
});

test('renderer preserves explicit standard QR handoff and unsupported-context fallback',()=>{
 const scene={qr};
 assert.equal(renderer.draw({width:900,height:900},scene,{progress:1,standardQr:true}),false);
 assert.equal(renderer.draw({width:900,height:900},scene,{}),false);
 assert.doesNotThrow(()=>renderer.dispose(scene));
 assert.equal(renderer.draw({width:Infinity,height:1},{qr},{}),false);
});
test('colored backing covers every dark module even when the fixed leaf budget is insufficient',()=>{
 for(const size of [25,177]) {
  const q={size,getModule:(x,y)=>(x+y)%3!==0};
  const mesh=renderer.geometry(q), actual=new Set();
  const cell=2.7/(size+8),offset=-size*cell/2;
  for(let i=0;i<mesh.vertices.length;i+=72) {
   if(mesh.vertices[i+9]!==6)continue;
   let x=0,z=0;
   for(let j=0;j<6;j++){x+=mesh.vertices[i+j*12];z+=mesh.vertices[i+j*12+2];}
   const col=Math.floor((x/6-offset)/cell),row=Math.floor((z/6-offset)/cell);
   assert.ok(q.getModule(col,row));actual.add(`${col},${row}`);
  }
  assert.equal(actual.size,mesh.darkCount);
  assert.equal(mesh.coloredCellCount,mesh.darkCount);
  if(size===177)assert.ok(mesh.darkCount>mesh.leafCount);
 }
});
test('geometry rejects invalid QR dimensions and empty matrices',()=>{
 for(const size of [0,20,22,178,Infinity])assert.throws(()=>renderer.geometry({size,getModule:()=>true}));
 assert.throws(()=>renderer.geometry({size:21,getModule:()=>false}));
});

test('season changes reuse GPU resources and erase uploaded or failed CPU buffers',()=>{
 const uploads=[];let contexts=0,buffers=0,programs=0,deletes=0,throwUpload=false;
 const gl=new Proxy({
  getShaderParameter:()=>true,getProgramParameter:()=>true,isContextLost:()=>false,
  getAttribLocation:(_,name)=>['aPosition','aTarget','aNormal','aMeta'].indexOf(name),
  getUniformLocation:(_,name)=>name,createShader:()=>({}),
  createProgram:()=>{programs++;return{};},createBuffer:()=>{buffers++;return{};},
  bufferData:(_target,vertices)=>{uploads.push(vertices);assert.ok(vertices.some(v=>v!==0));if(throwUpload)throw new Error('test upload failure');},
  deleteBuffer:()=>{deletes++;},getExtension:()=>({loseContext(){}}),
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 const c=vm.createContext({Float32Array,console:{warn(){}},document:{createElement:()=>({getContext:()=>{contexts++;return gl;},addEventListener(){}})}});
 vm.runInContext(source,c);
 const api=c.QRTreeWebGL,scene={qr};
 const output={width:720,height:720,getContext:()=>({save(){},restore(){},setTransform(){},drawImage(){}})};
 for(const options of [{season:'spring'},{season:'spring',palette:'sky'},{season:'summer'},{season:'summer',angle:1},{season:'autumn'},{season:'spring'}])assert.equal(api.draw(output,scene,options),true);
 assert.equal(contexts,1);assert.equal(buffers,1);assert.equal(programs,1);assert.equal(uploads.length,4);
 for(const vertices of uploads)assert.ok(vertices.every(v=>v===0),'CPU geometry is wiped immediately after upload');
 api.dispose(scene);assert.equal(deletes,1);
 api.dispose(scene);assert.equal(deletes,1,'disposal is idempotent');
 const failedScene={qr};throwUpload=true;
 assert.equal(api.draw(output,failedScene,{season:'spring'}),false);
 assert.equal(deletes,2,'failed uploads also dispose their GPU buffer');
 assert.ok(uploads.at(-1).every(v=>v===0),'failed CPU geometry is wiped on disposal');
 const previous=uploads.length;
 assert.equal(api.draw(output,failedScene,{season:'summer'}),false);
 assert.equal(uploads.length,previous,'a failed scene does not keep retrying allocations');
});

test('particles stay bounded and modules have coherent spatial flower, grass, and olive colors',()=>{
 const q={size:29,getModule:()=>true},mesh=renderer.geometry(q),counts=new Map();
 const cell=2.7/(q.size+8),offset=-q.size*cell/2;
 const categories=new Set(),flowerTones=new Set();let grassOutsideFinder=false,flowersInsideFinder=false;
 for(let i=0;i<mesh.vertices.length;i+=12){
  const type=mesh.vertices[i+9];counts.set(type,(counts.get(type)||0)+1);
  if(type===6){
   // Boundary vertices belong to adjacent cells; test the first vertex of each tile.
   if(i%72!==0)continue;
   const x=Math.round((mesh.vertices[i]-offset)/cell),y=Math.round((mesh.vertices[i+2]-offset)/cell);
   const finder=(x<7&&y<7)||(x>=22&&y<7)||(x<7&&y>=22);
   const shade=mesh.vertices[i+10],category=Math.floor(shade/2);
   categories.add(category);
   for(let vertex=1;vertex<6;vertex++)assert.equal(mesh.vertices[i+vertex*12+10],shade,'one module has one color');
   if(category===0){flowerTones.add(shade.toFixed(3));if(finder)flowersInsideFinder=true;}
   if(category===1&&!finder)grassOutsideFinder=true;
  }
 }
 assert.equal(counts.get(7),64*6);
 assert.equal(counts.get(8),220*6);
 assert.equal(counts.get(9),24*12*6);
 assert.deepEqual([...categories].sort(),[0,1,2]);
 assert.ok(flowerTones.size>20);assert.ok(grassOutsideFinder);assert.ok(flowersInsideFinder);
});

test('CPU reconstruction of multitone endpoint colors decodes blue and summer palettes',async()=>{
 const uniforms={};
 const gl=new Proxy({
  getShaderParameter:()=>true,getProgramParameter:()=>true,isContextLost:()=>false,
  getAttribLocation:(_,name)=>['aPosition','aTarget','aNormal','aMeta'].indexOf(name),
  getUniformLocation:(_,name)=>name,uniform3fv:(name,value)=>{uniforms[name]=Array.from(value);},
  createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),
 },{get:(target,key)=>key in target?target[key]:()=>{}});
 const c=vm.createContext({Float32Array,Uint8ClampedArray,Uint8Array,TextEncoder,URL,Blob,DataView,
  document:{createElement:()=>({getContext:()=>gl,addEventListener(){}})}});
 for(const file of ['vendor/qrcodegen.js','vendor/jsqr.js','studio-core.js','tree-webgl.js'])vm.runInContext(await readFile(new URL(`../${file}`,import.meta.url),'utf8'),c);
 const text='愿你的每一天，都有新的花开。',q=c.QRStudioCore.encode(text,'M');
 const width=1024,cell=Math.floor(width*.82/(q.size+8)),offset=(width-cell*(q.size+8))/2+cell*4;
 const output={width,height:width,getContext:()=>({save(){},restore(){},setTransform(){},drawImage(){}})};
 for(const options of [{palette:'sky'},{palette:'natural',season:'summer'}]){
  const scene={qr:q};assert.equal(c.QRTreeWebGL.draw(output,scene,{...options,progress:1}),true);
  const pixels=new Uint8ClampedArray(width*width*4),mesh=c.QRTreeWebGL.geometry(q,options.season);
  const background=[.978,.969,.941].map(v=>Math.round(v*255));
  for(let i=0;i<pixels.length;i+=4)pixels.set([...background,255],i);
  const unit=2.7/(q.size+8),start=-q.size*unit/2;
  for(let i=0;i<mesh.vertices.length;i+=72){
   if(mesh.vertices[i+9]!==6)continue;
   const x=Math.round((mesh.vertices[i]-start)/unit),y=Math.round((mesh.vertices[i+2]-start)/unit);
   const shade=mesh.vertices[i+10],tone=shade%2;
   // Mirrors the fragment shader at progress=1; real GPU pixels are checked in the browser.
   const rgb=shade>3.5?[.35+.20*tone,.37+.18*tone,.16+.11*tone]:uniforms[shade>1.5?'uGrass':'uLeaf'].map(v=>v*(.78+.22*tone));
   const color=rgb.map(v=>Math.round(v*255));
   for(let dy=0;dy<cell;dy++)for(let dx=0;dx<cell;dx++)pixels.set([...color,255],((offset+y*cell+dy)*width+offset+x*cell+dx)*4);
  }
  assert.equal(c.jsQR(pixels,width,width)?.data,text);
  c.QRTreeWebGL.dispose(scene);
 }
 const scene={qr:q};
 for(const [options,highlight,grassHighlight] of [
  [{season:'spring',palette:'natural'},[1,.965,.90],[.72,.94,.33]],
  [{season:'summer',palette:'natural'},[.72,.94,.27],[.72,.94,.33]],
  [{season:'autumn',palette:'natural'},[1,.79,.13],[.96,.77,.24]],
  [{season:'autumn',palette:'sky'},[1,.98,.97],[.96,.77,.24]],
 ]){
  assert.equal(c.QRTreeWebGL.draw(output,scene,{...options,progress:0}),true);
  assert.deepEqual(uniforms.uHighlight,highlight);
  assert.deepEqual(uniforms.uGrassHighlight,grassHighlight);
 }
 c.QRTreeWebGL.dispose(scene);
});
