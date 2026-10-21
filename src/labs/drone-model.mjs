// Учебная модель 5″, не CAD конкретного изделия. Единицы — сантиметры.
import { Mesh, M4 } from "../gl3d.mjs";

export const MODEL_SPEC = Object.freeze({ diagonal: 22.5, propDiameter: 12.7, stackSpacing: 3.05 });
const R = MODEL_SPEC.diagonal / (2 * Math.sqrt(2));
export const MOTOR_POSITIONS = { fl: [-R, R], fr: [R, R], rl: [-R, -R], rr: [R, -R] };
export const MOTOR_SPIN = { fl: "cw", rr: "cw", fr: "ccw", rl: "ccw" };

// Объёмная лопасть: сужение законцовки, изгиб в плане и переменный геометрический наклон.
// Профиль иллюстративный; по этой геометрии не рассчитывают тягу и не изготовляют винты.
function blade(mesh, spin, angle) {
  const rows = 15, rings = [], pos = [], normals = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows, radius = 0.5 + t * 5.85;
    const chord = 0.22 + 1.04 * Math.pow(Math.sin(Math.PI * t), 0.65);
    const sweep = spin * 0.6 * t * t, pitch = spin * (0.48 - 0.28 * t);
    rings.push([[-chord / 2, 0.055], [chord / 2, 0.055], [chord / 2, -0.055], [-chord / 2, -0.055]].map(([z, h]) =>
      M4.apply(M4.ry(angle), [radius, 2.5 + h * Math.cos(pitch) - z * Math.sin(pitch), sweep + z * Math.cos(pitch) + h * Math.sin(pitch)])));
  }
  const quad = (a, b, c, d) => {
    const u = b.map((v, i) => v - a[i]), v = c.map((v, i) => v - a[i]);
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
    const length = Math.hypot(...n) || 1, start = pos.length / 3;
    for (const p of [a,b,c,d]) { pos.push(...p); normals.push(...n.map(x => x / length)); }
    idx.push(start,start+1,start+2,start,start+2,start+3);
  };
  for (let j = 0; j < rows; j++) for (let k = 0; k < 4; k++) quad(rings[j][k],rings[j][(k+1)%4],rings[j+1][(k+1)%4],rings[j+1][k]);
  quad(...rings[0].slice().reverse()); quad(...rings[rows]);
  mesh.push(pos, normals, idx, M4.id());
}

export function buildDroneParts(dark = false) {
  const list = [];
  const color = {
    carbon: dark ? [0.27,0.30,0.34] : [0.12,0.15,0.19], edge: [0.36,0.4,0.45],
    metal: dark ? [0.72,0.75,0.8] : [0.58,0.63,0.69], copper: [0.81,0.43,0.17],
    chip: [0.12,0.14,0.18], gold: [0.86,0.65,0.25], rubber: [0.22,0.23,0.27],
    red: [0.8,0.2,0.23], black: [0.16,0.17,0.2], pcb: [0.12,0.4,0.32], blue: [0.17,0.36,0.64],
  };
  const add = (id, mesh, c, off = [0,0,0], center = [0,0,0], extra = {}) => {
    const p = { id, mesh, color: typeof c === "string" ? color[c] : c, off, center, ...extra }; list.push(p); return p;
  };
  const box = (w,h,d,x,y,z) => new Mesh().box(w,h,d,M4.t(x,y,z));
  const bolts = (points, y, r = .12) => { const m = new Mesh(); for (const [x,z] of points) m.cyl(r,.12,6,M4.t(x,y,z)); return m; };
  const post = [[-1.6,-3.4],[1.6,-3.4],[-1.6,3.4],[1.6,3.4]];
  const stack = [[-1.525,-1.525],[1.525,-1.525],[-1.525,1.525],[1.525,1.525]];
  const frame = box(4.4,.35,8.6,0,0,0);
  for (const [x,z] of Object.values(MOTOR_POSITIONS)) {
    frame.box(1.35,.4,Math.hypot(x,z),M4.chain(M4.t(x/2,0,z/2),M4.ry(Math.atan2(x,z))));
    frame.cyl(1.48,.4,24,M4.t(x,0,z));
  }
  for (const [x,z] of post) frame.tube([x,.2,z],[x,2.9,z],.19,10);
  for (const x of [-1.35,1.35]) frame.box(.22,2.1,1.5,M4.t(x,1.25,3.15));
  add("frame",frame,"carbon",[0,0,0],[0,.3,0]);
  add("frame",bolts(post,3.1),"metal",[0,6.5,0],[0,3,0]);
  // Две перемычки и боковые рёбра верхней пластины: окна позволяют видеть стек.
  const deck = new Mesh();
  for (const x of [-1.65,1.65]) deck.box(.5,.3,7.6,M4.t(x,3,0));
  for (const z of [-3.3,3.3]) deck.box(3.8,.3,1,M4.t(0,3,z));
  add("frame",deck,"carbon",[0,6.5,0],[0,3,0]);
  add("frame",bolts([[-2,-1],[-2,1],[2,-1],[2,1]],.26),"metal");

  const eo=[0,1.2,0], fo=[0,2.8,0];
  add("esc",box(3.6,.16,3.6,0,.9,0),"pcb",eo,[0,.9,0]);
  const fet = new Mesh(), pads = new Mesh();
  for (let i=0;i<3;i++) for (const x of [-1.05,1.05]) for (const z of [-1.15+i*.45,.25+i*.45]) fet.box(.6,.18,.32,M4.t(x,1.08,z));
  for (const x of [-1.67,1.67]) for (let i=0;i<6;i++) pads.box(.22,.04,.18,M4.t(x,1.01,-1.25+i*.5));
  add("esc",fet,"chip",eo); add("esc",pads,"gold",eo);
  add("fc",box(3.6,.15,3.6,0,1.9,0),"blue",fo,[0,1.9,0]);
  add("fc",box(1,.17,1,0,2.06,0).box(.38,.12,.38,M4.t(1.05,2.04,1.05)),"chip",fo);
  const pins=new Mesh(), damping=new Mesh();
  for (const [x,z] of stack) damping.cyl(.22,.46,12,M4.t(x,1.8,z));
  for(let i=0;i<7;i++) for(const x of [-1.57,1.57]) pins.box(.18,.06,.16,M4.t(x,2.01,-1.2+i*.4));
  // Стрелка ориентации на плате (вперёд +Z).
  pins.box(.06,.04,.7,M4.t(0,2.01,1.02));
  for(const sign of [-1,1]) pins.box(.06,.04,.35,M4.chain(M4.t(sign*.11,2.01,1.24),M4.ry(sign*-.65)));
  add("fc",pins,"gold",fo); add("fc",damping,"red",fo);
  add("fc",box(.7,.24,.5,0,2.03,-1.6),"metal",fo);
  add("esc",bolts(stack,1.16,.1),"metal",eo);
  add("fc",bolts(stack,2.14,.1),"metal",fo);
  const capM=M4.chain(M4.t(0,.85,-2.65),M4.rz(Math.PI/2));
  add("cap",new Mesh().cyl(.52,1.8,24,capM),"black",[0,.6,-2.5],[0,.85,-2.65]);
  add("cap",new Mesh().cyl(.48,.05,24,M4.chain(capM,M4.t(0,.92,0))),"metal",[0,.6,-2.5]);
  add("cap",box(1.7,.05,.13,0,1.36,-2.65),"metal",[0,.6,-2.5]);

  const motor=new Mesh(), coils=new Mesh(), vents=new Mesh(), caps=new Mesh();
  for(const [x,z] of Object.values(MOTOR_POSITIONS)) {
    motor.lathe([[1.33,.25],[1.42,.42],[1.42,1.38],[1.23,1.7],[.4,1.85],[.28,2.22]],32,M4.t(x,0,z));
    motor.cyl(1.48,.14,28,M4.t(x,.28,z));
    caps.cyl(.32,.14,6,M4.t(x,2.27,z));
    for(let k=0;k<12;k++) {
      const a=k*Math.PI/6;
      coils.cyl(.2,.35,8,M4.t(x+Math.cos(a)*1.12,1.55,z+Math.sin(a)*1.12));
      vents.box(.3,.48,.055,M4.chain(M4.t(x,0,z),M4.ry(a),M4.t(0,1.02,1.425)));
    }
  }
  add("motor",motor,"metal",[0,1.3,0],[R,1.2,R]);
  add("motor",coils,"copper",[0,1.3,0]); add("motor",vents,"chip",[0,1.3,0]); add("motor",caps,"gold",[0,1.3,0]);
  for(const [key,[x,z]] of Object.entries(MOTOR_POSITIONS)) {
    const m=new Mesh().cyl(.59,.28,24,M4.t(0,2.5,0));
    for(let b=0;b<3;b++) blade(m,MOTOR_SPIN[key]==="cw"?-1:1,b*Math.PI*2/3);
    const p=add(`prop_${key}`,m,MOTOR_SPIN[key]==="cw"?[.18,.56,.65]:[.4,.48,.61],[0,3,0],[x,2.5,z],{spin:MOTOR_SPIN[key],pivot:[x,z]});
    p.materialNote="Форма лопасти условная; направление задано схемой props-in.";
  }
  const camM=M4.chain(M4.t(0,1.3,3.7),M4.rx(-.44));
  const cm=new Mesh().box(1.9,1.9,1.9);
  add("camera",new Mesh().push(cm.p,cm.n,cm.i,camM),"black",[0,.5,3.5],[0,1.5,4.6]);
  add("camera",new Mesh().cyl(.66,.85,24,M4.chain(camM,M4.t(0,0,1.22),M4.rx(Math.PI/2))),"metal",[0,.5,3.5]);
  add("camera",new Mesh().cyl(.49,.06,28,M4.chain(camM,M4.t(0,0,1.68),M4.rx(Math.PI/2))),[.07,.17,.23],[0,.5,3.5]);
  for(const x of [-1.4,1.4]) add("camera",new Mesh().cyl(.13,.12,6,M4.chain(M4.t(x,1.4,3.7),M4.rz(Math.PI/2))),"metal",[0,.5,3.5]);
  add("vtx",box(2.2,.25,1.8,0,2.35,-3),"pcb",[0,3.5,-2.5],[0,2.35,-3]);
  const sink=box(1.8,.12,1.4,0,2.55,-3);
  for(let i=0;i<7;i++) sink.box(.09,.23,1.4,M4.t(-.75+i*.25,2.7,-3));
  add("vtx",sink,"metal",[0,3.5,-2.5]);
  add("rx",box(1,.18,1.5,1.75,2.4,-3),"pcb",[2,3.5,-2.5],[1.75,2.4,-3]);
  add("rx",box(.6,.1,.65,1.75,2.54,-3),"chip",[2,3.5,-2.5]);
  add("ant_vtx",new Mesh().tube([0,2.4,-3.9],[0,4.3,-6.2],.13,12).lathe([[.01,-.5],[.8,-.3],[.9,0],[.8,.3],[.01,.5]],24,M4.chain(M4.t(0,4.55,-6.5),M4.rx(.7))),"red",[0,3.5,-2.5],[0,4.2,-6.2]);
  add("ant_rx",new Mesh().tube([1.75,2.35,-3.6],[3.4,2,-5.6],.09,10).tube([4.48,2,-4.7],[2.32,2,-6.5],.09,10),"rubber",[2,3.5,-2.5],[3.4,2,-5.6]);
  add("battery",box(3.5,3.2,7.2,0,4.75,-.3),"gold",[0,9,0],[0,4.75,-.3]);
  for(const z of [-2,1.4]) {
    const strap=new Mesh().box(3.7,.12,.65,M4.t(0,6.4,z)).box(3.7,.12,.65,M4.t(0,3.1,z));
    for(const x of [-1.81,1.81]) strap.box(.12,3.3,.65,M4.t(x,4.75,z));
    add("battery",strap,"black",[0,9,0]);
  }
  add("battery",box(2.6,.04,2.4,0,6.42,-.3),"metal",[0,9,0]);
  add("battery",box(1.15,.65,.85,1.7,2.4,-4.5),"gold",[0,9,0]);
  // Провода показаны в собранном виде; при разборке скрываются, а не тянутся сквозь платы.
  for(const [color,x] of [["red",1.65],["black",2]]) {
    const m=new Mesh().tube([x,3.6,-3.8],[x,1.5,-4.4],.1,8).tube([x,1.5,-4.4],[x*.65,1.05,-1.6],.1,8);
    add("battery",m,color,[0,0,0],[x,2,-4],{assembledOnly:true});
  }
  const signal=new Mesh().tube([1.4,1.93,-1.1],[2.15,1.45,-1.1],.055,8).tube([2.15,1.45,-1.1],[1.4,1.02,-1.1],.055,8);
  add("fc",signal,"gold",[0,0,0],[1.5,1.5,-1],{assembledOnly:true});
  for(const [x,z] of Object.values(MOTOR_POSITIONS)) {
    const wire=new Mesh();
    for(let phase=-1;phase<=1;phase++) wire.tube([Math.sign(x)*1.7,1,phase*.22],[x*.83,.48,z*.83+phase*.2],.065,8).tube([x*.83,.48,z*.83+phase*.2],[x,.65,z],.065,8);
    add("esc",wire,"black",[0,0,0],[x*.6,.5,z*.6],{assembledOnly:true});
  }
  return list;
}
