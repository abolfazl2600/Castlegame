import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GameState } from './state/GameState';
import type { TileKind, ToolKind, TerrainKind } from './core/types';

const SIZE = 16;
const TILE = 4;
const WORLD = SIZE * TILE;

const COLORS: Record<TileKind, number> = {
  wall: 0xd8c1a5, gate: 0x9a5c35, tower: 0xe4d4c1,
  road: 0x8b6d55, cottage: 0xc98362, house: 0xb79bd8, manor: 0xd8758a,
};

export class ThreeGame {
  private readonly root: HTMLElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 500);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  private readonly controls: OrbitControls;
  private readonly state = new GameState();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly buildLayer = new THREE.Group();
  private readonly groundHit = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  private selectedTool: ToolKind = 'wall';
  private saveTimer: number | null = null;
  private lastTime = performance.now();

  constructor(root: HTMLElement) {
    this.root = root;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    root.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x071b2a);
    this.scene.fog = new THREE.Fog(0x071b2a, 75, 170);
    this.camera.position.set(48, 58, 52);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 28;
    this.controls.maxDistance = 105;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.set(0, 0, 0);

    this.addLights();
    this.createWorld();
    this.scene.add(this.buildLayer);
    this.groundHit.rotation.x = -Math.PI / 2;
    this.groundHit.position.y = 2.05;
    this.scene.add(this.groundHit);
    this.load();
    this.redraw();
    this.bindUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', e => this.onPointer(e));
    requestAnimationFrame(t => this.animate(t));
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0x9edfff, 0x183047, 2.2));
    const sun = new THREE.DirectionalLight(0xffe4c2, 4.2);
    sun.position.set(30, 70, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
    this.scene.add(sun);
    const rim = new THREE.PointLight(0x4cc9ff, 55, 90);
    rim.position.set(-35, 25, -30);
    this.scene.add(rim);
  }

  private createWorld(): void {
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(WORLD * 0.76, 64),
      new THREE.MeshStandardMaterial({ color: 0x0b6f91, roughness: 0.25, metalness: 0.08 })
    );
    water.rotation.x = -Math.PI / 2; water.position.y = -0.8; water.receiveShadow = true;
    this.scene.add(water);

    const island = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD * 0.49, WORLD * 0.55, 2.6, 64),
      new THREE.MeshStandardMaterial({ color: 0x7e9f55, roughness: 0.95 })
    );
    island.receiveShadow = true; island.castShadow = true; this.scene.add(island);

    const grass = new THREE.Mesh(
      new THREE.CylinderGeometry(WORLD * 0.46, WORLD * 0.49, 1.2, 64),
      new THREE.MeshStandardMaterial({ color: 0xb3c968, roughness: 0.9 })
    );
    grass.position.y = 1.55; grass.receiveShadow = true; this.scene.add(grass);

    const grid = new THREE.GridHelper(WORLD, SIZE, 0xe8f7ff, 0x7eb8bd);
    grid.position.y = 2.18;
    (grid.material as THREE.Material).opacity = 0.13;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);

    for (let i = 0; i < 28; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(THREE.MathUtils.randFloat(.45, 1.1)),
        new THREE.MeshStandardMaterial({ color: 0x6d766b, roughness: 1 })
      );
      const a = Math.random() * Math.PI * 2;
      const r = THREE.MathUtils.randFloat(WORLD * .28, WORLD * .45);
      rock.position.set(Math.cos(a) * r, 2.1, Math.sin(a) * r);
      rock.scale.y = .65; rock.castShadow = true; this.scene.add(rock);
    }
  }

  private terrainAt(x: number, y: number): TerrainKind {
    const nx = x / SIZE - .5, ny = y / SIZE - .5;
    const radial = Math.sqrt(nx * nx + ny * ny);
    const noise = Math.sin(x * .19) * .03 + Math.cos(y * .16) * .04;
    const value = .43 - radial + noise;
    if (value < -.04) return 'water';
    if (value < .015) return 'shore';
    const forest = (x < SIZE*.32 && y > SIZE*.42) || (x > SIZE*.62 && y > SIZE*.58);
    if (forest && Math.sin(x*.31) + Math.cos(y*.29) > 1) return 'forest';
    return 'plains';
  }

  private redraw(): void {
    this.buildLayer.clear();
    for (const cell of this.state.entries()) this.buildLayer.add(this.makeBuilding(cell.kind, cell.x, cell.y));
  }

  private makeBuilding(kind: TileKind, gx: number, gy: number): THREE.Group {
    const g = new THREE.Group();
    const x = (gx - SIZE / 2 + .5) * TILE, z = (gy - SIZE / 2 + .5) * TILE;
    const mat = new THREE.MeshStandardMaterial({ color: COLORS[kind], roughness: .72 });
    const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS[kind]).multiplyScalar(.62), roughness: .8 });

    const add = (geo: THREE.BufferGeometry, material=mat, y=2.3) => {
      const m = new THREE.Mesh(geo, material);
      m.position.y = y; m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };

    if (kind === 'road') {
      add(new THREE.BoxGeometry(3.1, .18, 2.8), mat, 2.25);
    } else if (kind === 'wall') {
      add(new THREE.BoxGeometry(2.9, 3.8, 2.0), mat, 4);
      add(new THREE.BoxGeometry(2.9, .55, 2.2), dark, 6);
      for (const dx of [-1.05, 0, 1.05]) { const merlon=add(new THREE.BoxGeometry(.48,.7,2.25),mat,6.55); merlon.position.x=dx; }
    } else if (kind === 'gate') {
      const left=add(new THREE.BoxGeometry(.65,3.8,2.5),mat,4); left.position.x=-1.18;
      const right=add(new THREE.BoxGeometry(.65,3.8,2.5),mat,4); right.position.x=1.18;
      add(new THREE.BoxGeometry(2.9,.65,2.5),dark,6);
      add(new THREE.BoxGeometry(1.7,2.6,.35),new THREE.MeshStandardMaterial({color:0x55321f}),3.2).position.z=-1.3;
    } else if (kind === 'tower') {
      add(new THREE.CylinderGeometry(1.65,1.8,5.3,12),mat,4.8);
      add(new THREE.ConeGeometry(2.05,2,12),new THREE.MeshStandardMaterial({color:0x8d5b69}),8.45);
    } else {
      const h = kind === 'cottage' ? 3.5 : kind === 'house' ? 5 : 7;
      add(new THREE.BoxGeometry(3.1,h,2.9),mat,2.2+h/2);
      add(new THREE.ConeGeometry(kind==='manor'?2.55:2.2,kind==='manor'?2.8:2.2,4),dark,2.2+h+1.1);
      const windowMat=new THREE.MeshStandardMaterial({color:0x8de7ff,emissive:0x155a68,emissiveIntensity:.6});
      for(const sx of [-.75,.75]) { const w=add(new THREE.BoxGeometry(.5,.7,.08),windowMat,3.1+h*.25); w.position.x=sx; w.position.z=-1.48; }
    }
    g.position.set(x,0,z);
    return g;
  }

  private onPointer(event: PointerEvent): void {
    if (event.button !== 0) return;
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
    this.pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const hit=this.raycaster.intersectObject(this.groundHit,false)[0];
    if(!hit) return;
    const gx=Math.floor(hit.point.x/TILE+SIZE/2), gy=Math.floor(hit.point.z/TILE+SIZE/2);
    if(gx<0||gy<0||gx>=SIZE||gy>=SIZE) return;
    const terrain=this.terrainAt(gx,gy);
    const current=this.state.getCell(gx,gy);
    if(this.selectedTool==='erase') { if(current) this.state.removeCell(gx,gy); }
    else if(terrain!=='water'&&terrain!=='forest'&&current?.kind!==this.selectedTool) this.state.setCell(gx,gy,this.selectedTool);
    else return;
    this.redraw(); this.scheduleSave();
  }

  private scheduleSave(): void {
    if(this.saveTimer!==null) window.clearTimeout(this.saveTimer);
    this.setStatus('Unsaved changes…');
    this.saveTimer=window.setTimeout(()=>{this.save();this.saveTimer=null;},450);
  }

  private save(): void {
    localStorage.setItem('castle-role-save-v1',JSON.stringify({version:1,updatedAt:Date.now(),cells:this.state.entries()}));
    this.setStatus('Saved');
  }

  private load(): void {
    const raw=localStorage.getItem('castle-role-save-v1');
    if(!raw) return;
    try {
      const data=JSON.parse(raw) as {cells?:Array<{x:number,y:number,kind:TileKind}>};
      this.state.replace(data.cells ?? []); this.setStatus('Loaded');
    } catch { this.setStatus('Could not load save'); }
  }

  private bindUI(): void {
    const q=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
    const toolbar=q<HTMLElement>('toolbar');
    const tools:Array<[ToolKind,string,string]>=[['wall','🧱','Wall'],['gate','🚪','Gate'],['tower','🏰','Tower'],['road','🛣️','Road'],['cottage','🏠','Cottage'],['house','🏡','House'],['manor','🏯','Manor'],['erase','⌫','Remove']];
    toolbar.innerHTML='<div class="toolbar-title"><span>Build</span><small>3D structures</small></div>'+tools.map(([id,icon,label],i)=>`<button class="tool-button${i===0?' is-selected':''}" data-tool="${id}"><span class="tool-icon">${icon}</span><span class="tool-copy"><strong>${label}</strong><small>Place in 3D</small></span><kbd>${i+1}</kbd></button>`).join('');
    toolbar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach(b=>b.onclick=()=>this.selectTool(b.dataset.tool as ToolKind));
    const help=q<HTMLElement>('help-modal');
    q<HTMLButtonElement>('help-button').onclick=()=>{help.hidden=false;};
    q<HTMLButtonElement>('help-close-button').onclick=()=>{help.hidden=true;};
    q<HTMLButtonElement>('save-button').onclick=()=>this.save();
    q<HTMLButtonElement>('load-button').onclick=()=>{this.load();this.redraw();};
    q<HTMLButtonElement>('reset-button').onclick=()=>{if(confirm('Reset the entire island?')){this.state.clear();this.redraw();this.save();}};
    q<HTMLButtonElement>('fullscreen-button').onclick=async()=>{if(document.fullscreenElement) await document.exitFullscreen();else await document.documentElement.requestFullscreen();};
    window.addEventListener('keydown',e=>{const n=Number(e.key);if(n>=1&&n<=8)this.selectTool(tools[n-1][0]);if(e.key==='Escape')help.hidden=true;});
  }

  private selectTool(tool:ToolKind):void {
    this.selectedTool=tool;
    document.querySelectorAll('[data-tool]').forEach(e=>e.classList.toggle('is-selected',(e as HTMLElement).dataset.tool===tool));
    this.setStatus(`Selected: ${tool}`);
  }

  private setStatus(text:string):void { const el=document.getElementById('save-status');if(el)el.textContent=text; }

  private resize():void {
    const w=Math.max(1,this.root.clientWidth),h=Math.max(1,this.root.clientHeight);
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);
  }

  private animate(time:number):void {
    this.lastTime=time;
    this.controls.update();
    this.renderer.render(this.scene,this.camera);
    requestAnimationFrame(t=>this.animate(t));
  }
}
