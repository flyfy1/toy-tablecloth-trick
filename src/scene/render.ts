// The tablecloth scene in plain WebGL 1: the baked room, the cloth's floor shadow (planar projection,
// quarter resolution, blurred, multiplied over the floor), the table as depth only, the satin cloth
// (README 3.5 shading), the props' contact shadows and the props as painted quads.
import { buffer, program, target, texture, uniforms, type GL, type Target } from '../cloth/gl'
import { STRIDE } from '../cloth/mesh'
import type { Cam } from './camera'
import type { Sprite } from './paint'
import { FLOOR, TABLE, type World } from '../sim'

const LIGHT = (() => {
  const v = [-0.5, -0.35, 0.8]
  const l = Math.hypot(v[0], v[1], v[2])
  return v.map((c) => c / l)
})()

const HP = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`

const QUAD_VS = `attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}`
const BG_FS = `${HP}uniform sampler2D t;varying vec2 v;void main(){gl_FragColor=vec4(texture2D(t,vec2(v.x,1.-v.y)).rgb,1.);}`

const DEPTH_VS = `attribute vec3 a;uniform mat4 vp;void main(){gl_Position=vp*vec4(a,1.);}`
const DEPTH_FS = `precision mediump float;void main(){gl_FragColor=vec4(0.);}`

const CLOTH_VS = `
attribute vec3 aP;attribute vec3 aN;attribute vec3 aTu;attribute vec3 aTv;attribute float aK;attribute float aB;attribute vec2 aUV;
uniform mat4 vp;
varying vec3 vP;varying vec3 vN;varying vec3 vTu;varying vec3 vTv;varying float vK;varying float vB;varying vec2 vUV;
void main(){vP=aP;vN=aN;vTu=aTu;vTv=aTv;vK=aK;vB=aB;vUV=aUV;gl_Position=vp*vec4(aP,1.);}`

const CLOTH_FS = `${HP}
uniform sampler2D tex;uniform vec3 L;uniform vec3 eye;
uniform vec4 lobes; // e_u, k_u, e_v, k_v
uniform vec3 misc;  // k_rim, t0, k_ao
varying vec3 vP;varying vec3 vN;varying vec3 vTu;varying vec3 vTv;varying float vK;varying float vB;varying vec2 vUV;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  vec3 base=texture2D(tex,vUV).rgb;
  vec3 N=normalize(vN);
  vec3 V=normalize(eye-vP);
  bool front=gl_FrontFacing;
  if(!front){N=-N;base*=.75;}
  vec3 H=normalize(L+V);
  float ndl=dot(N,L);
  float d=clamp((ndl+.4)/1.4,0.,1.);
  vec3 shade=base*base*.55;
  vec3 col=mix(shade,base,d);
  vec3 Tu=normalize(vTu-N*dot(vTu,N));
  vec3 Tv=normalize(vTv-N*dot(vTv,N));
  float tu=dot(Tu,H);float tv=dot(Tv,H);
  float su=pow(sqrt(max(1.-tu*tu,0.)),lobes.x);
  float sv=pow(sqrt(max(1.-tv*tv,0.)),lobes.z);
  vec3 tint=mix(base,vec3(1.,.98,.92),.6);
  float sh=(lobes.y*su+lobes.w*sv)*(front?1.:.25);
  col+=sh*tint*d;
  col+=pow(1.-max(dot(N,V),0.),4.)*misc.x*mix(base,vec3(1.),.7);
  col+=misc.y*clamp(-ndl,0.,1.)*exp(-.9*(vB-1.))*base*1.6;
  col*=1.-misc.z*max(vK,0.);
  col+=.06*max(-vK,0.);
  col+=(hash(gl_FragCoord.xy)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`

// the cloth projected along the light onto the floor; parts lying on the table top cast nothing here
const SHADOW_VS = `
attribute vec3 aP;uniform mat4 vp;uniform vec3 L;uniform float floorZ;varying float w;
void main(){
  vec3 p=aP-L*((aP.z-floorZ)/L.z);
  w=(aP.z<-.006||abs(aP.x)>.4||aP.y<0.)?1.:0.;
  gl_Position=vp*vec4(p,1.);
}`
const SHADOW_FS = `precision mediump float;varying float w;void main(){gl_FragColor=vec4(w);}`
const BLUR_FS = `${HP}uniform sampler2D t;uniform vec2 dir;varying vec2 v;
void main(){float s=texture2D(t,v).r*.4026;s+=(texture2D(t,v+dir).r+texture2D(t,v-dir).r)*.2442;s+=(texture2D(t,v+dir*2.).r+texture2D(t,v-dir*2.).r)*.0545;gl_FragColor=vec4(s);}`
const COMP_FS = `${HP}uniform sampler2D t;uniform sampler2D m;varying vec2 v;
void main(){float s=texture2D(t,v).r*texture2D(m,vec2(v.x,1.-v.y)).r;gl_FragColor=vec4(mix(vec3(1.),vec3(.42,.36,.33),s*.85),1.);}`

// a contact shadow: an ellipse lying on the table plane
const CSH_VS = `attribute vec2 a;uniform mat4 vp;uniform vec4 c;uniform float zz;varying vec2 v;
void main(){v=a;gl_Position=vp*vec4(c.x+a.x*c.z,c.y+a.y*c.w,zz,1.);}`
const CSH_FS = `${HP}uniform sampler2D t;uniform float k;uniform vec3 col;varying vec2 v;
void main(){float s=texture2D(t,v*.5+.5).a*k*.34;gl_FragColor=vec4(mix(vec3(1.),col,s),1.);}`

// a painted prop: anchored at its base centre, squashed and rotated about a base rim pivot
const SPR_VS = `attribute vec2 a;
uniform vec2 res;uniform vec2 at;uniform vec2 size;uniform vec2 anc;uniform vec2 piv;uniform float rot;uniform float squash;uniform vec4 sub;
varying vec2 v;varying vec2 q0;
void main(){
  v=sub.xy+a*sub.zw;q0=a;
  vec2 p=(a-anc)*size;
  p.y*=squash;
  vec2 q=p-piv;float c=cos(rot),s=sin(rot);
  p=vec2(c*q.x-s*q.y,s*q.x+c*q.y)+piv;
  vec2 sc=at+p;
  gl_Position=vec4(sc.x/res.x*2.-1.,1.-sc.y/res.y*2.,0.,1.);
}`
const SPR_FS = `${HP}uniform sampler2D t;uniform float alpha;uniform vec4 tA;uniform vec3 tB;varying vec2 v;varying vec2 q0;
float cr(vec2 a,vec2 b,vec2 p){return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);}
void main(){
  if(tB.z>.5){vec2 p0=tA.xy,p1=tA.zw,p2=tB.xy;float d0=cr(p0,p1,q0),d1=cr(p1,p2,q0),d2=cr(p2,p0,q0);
    if(!((d0>=0.&&d1>=0.&&d2>=0.)||(d0<=0.&&d1<=0.&&d2<=0.)))discard;}
  gl_FragColor=texture2D(t,v)*alpha;}`

export interface PropView {
  sprites: Sprite[]
  tex: WebGLTexture[]
  /** per sprite: world height of its anchor above the base (the stacked bowls) and a screen jitter */
  lift: number[]
  jit: [number, number][]
  x: number
  y: number
  z: number
  /** tilt on screen (rad, + clockwise), squash, and which rim is the pivot (+1 right, -1 left) */
  rot: number
  squash: number
  pivot: number
  rb: number
  shadow: [number, number] // world half-axes of the contact shadow
  lean: [number, number] // where the leaning centre of mass moves the shadow (m, table plane)
  shadowK: number
  alpha: number
  /** screen size multiplier (props are painted at their real size and drawn larger, lead phase 2); -1 flips */
  vis: number
  flip?: boolean
}

/** a loose painted piece: a shard (a triangle cut from a prop's picture), the cork, the fish on the floor, the cat */
export interface Bill {
  sprite: Sprite
  tex: WebGLTexture
  x: number
  y: number
  z: number
  rot: number
  vis: number
  alpha: number
  flip?: boolean
  /** the part of the picture (u, v, w, h in 0..1) and a triangle inside it (in the part's own 0..1), if a shard */
  sub?: [number, number, number, number]
  tri?: [number, number, number, number, number, number]
  /** anchor in the part (0..1), default the sprite's own anchor */
  anc?: [number, number]
}

/** a flat stain: spilled tea, water, or the shadow of a thing on the floor */
export interface Stain {
  x: number
  y: number
  z: number
  rx: number
  ry: number
  k: number
  col: [number, number, number]
}

export class Renderer {
  gl: GL
  cv: HTMLCanvasElement
  dpr = 1
  cam!: Cam
  private quad!: WebGLBuffer
  private unit!: WebGLBuffer
  private box!: WebGLBuffer
  private boxN = 0
  private clothBuf!: WebGLBuffer
  private uvBuf!: WebGLBuffer
  private idxBuf!: WebGLBuffer
  private nIdx = 0
  private P!: Record<string, { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }>
  private roomTex: WebGLTexture | null = null
  private maskTex: WebGLTexture | null = null
  private patTex: WebGLTexture | null = null
  private shTex: WebGLTexture | null = null
  private sa: Target | null = null
  private sb: Target | null = null
  shadowDiv = 4
  blurPasses = 2
  /** satin lobe assignment: the strong narrow lobe on Tu (README 3.5, e_u 48) gives the streaks that run down
   *  the drape's folds; on Tv (one reading of tablecloth.md 3.4) it lights the table edge but not the folds */
  strongOnV = false

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv
    const gl = cv.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false, depth: true })
    if (!gl) throw new Error('no webgl')
    this.gl = gl
  }

  /** (re)build everything GL holds; the caller re-uploads textures after a context loss */
  init(world: World, pattern: HTMLCanvasElement, shadow: HTMLCanvasElement) {
    const gl = this.gl
    const mk = (vs: string, fs: string, names: string[]) => {
      const p = program(gl, vs, fs)
      return { p, u: uniforms(gl, p, names) }
    }
    this.P = {
      bg: mk(QUAD_VS, BG_FS, ['t']),
      depth: mk(DEPTH_VS, DEPTH_FS, ['vp']),
      cloth: mk(CLOTH_VS, CLOTH_FS, ['vp', 'tex', 'L', 'eye', 'lobes', 'misc']),
      shadow: mk(SHADOW_VS, SHADOW_FS, ['vp', 'L', 'floorZ']),
      blur: mk(QUAD_VS, BLUR_FS, ['t', 'dir']),
      comp: mk(QUAD_VS, COMP_FS, ['t', 'm']),
      csh: mk(CSH_VS, CSH_FS, ['vp', 'c', 't', 'k', 'col', 'zz']),
      spr: mk(SPR_VS, SPR_FS, ['res', 'at', 'size', 'anc', 'piv', 'rot', 'squash', 't', 'alpha', 'sub', 'tA', 'tB']),
    }
    this.quad = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]))
    this.unit = buffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]))
    // the table top as depth only (it hides the cloth hanging off the far edge). It sits well inside the
    // painted table: the cloth's chord across the rounded near edge cuts up to about 12 mm into the corner
    const x0 = TABLE.x0 + 0.006
    const x1 = TABLE.x1 - 0.006
    const y0 = TABLE.y0 + 0.03
    const y1 = TABLE.y1 - 0.006
    const zt = -0.012
    const tri: number[] = []
    const q = (a: number[], b: number[], c: number[], d: number[]) => tri.push(...a, ...b, ...c, ...a, ...c, ...d)
    q([x0, y0, zt], [x1, y0, zt], [x1, y1, zt], [x0, y1, zt])
    this.box = buffer(gl, new Float32Array(tri))
    this.boxN = tri.length / 3
    this.clothBuf = buffer(gl, world.mesh.attr, gl.DYNAMIC_DRAW)
    this.uvBuf = buffer(gl, world.mesh.uv)
    this.idxBuf = buffer(gl, world.mesh.index, gl.STATIC_DRAW, gl.ELEMENT_ARRAY_BUFFER)
    this.nIdx = world.mesh.index.length
    this.patTex = texture(gl, pattern, { mip: true })
    this.shTex = texture(gl, shadow)
  }

  setPattern(pattern: HTMLCanvasElement) {
    if (this.patTex) this.gl.deleteTexture(this.patTex)
    this.patTex = texture(this.gl, pattern, { mip: true })
  }

  resize(cam: Cam, dpr: number, room: { room: HTMLCanvasElement; mask: HTMLCanvasElement }) {
    const gl = this.gl
    this.cam = cam
    this.dpr = dpr
    this.cv.width = Math.round(cam.w * dpr)
    this.cv.height = Math.round(cam.h * dpr)
    if (this.roomTex) gl.deleteTexture(this.roomTex)
    if (this.maskTex) gl.deleteTexture(this.maskTex)
    this.roomTex = texture(gl, room.room)
    this.maskTex = texture(gl, room.mask)
    this.makeTargets()
  }

  makeTargets() {
    const gl = this.gl
    for (const t of [this.sa, this.sb]) if (t) (gl.deleteFramebuffer(t.fb), gl.deleteTexture(t.tex))
    const w = Math.max(1, Math.round(this.cv.width / this.shadowDiv))
    const h = Math.max(1, Math.round(this.cv.height / this.shadowDiv))
    this.sa = target(gl, w, h)
    this.sb = target(gl, w, h)
  }

  spriteTex(s: Sprite): WebGLTexture {
    return texture(this.gl, s.cv, { premul: true })
  }

  private bindQuad(p: WebGLProgram, buf: WebGLBuffer) {
    const gl = this.gl
    const a = gl.getAttribLocation(p, 'a')
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.enableVertexAttribArray(a)
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    return a
  }

  draw(world: World, props: PropView[], bills: Bill[] = [], stains: Stain[] = []) {
    const gl = this.gl
    const cam = this.cam
    const W = this.cv.width
    const H = this.cv.height
    let calls = 0
    // cloth vertices (also used by the shadow pass)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.clothBuf)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, world.mesh.attr)

    // ---- the cloth's floor shadow into the small target, blurred
    const sa = this.sa!
    const sb = this.sb!
    gl.bindFramebuffer(gl.FRAMEBUFFER, sa.fb)
    gl.viewport(0, 0, sa.w, sa.h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    {
      const { p, u } = this.P.shadow
      gl.useProgram(p)
      gl.uniformMatrix4fv(u.vp, false, cam.vp)
      gl.uniform3fv(u.L, LIGHT)
      gl.uniform1f(u.floorZ, FLOOR)
      const a = gl.getAttribLocation(p, 'aP')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.clothBuf)
      gl.enableVertexAttribArray(a)
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, STRIDE * 4, 0)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf)
      gl.drawElements(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0)
      gl.disableVertexAttribArray(a)
      calls++
    }
    {
      const { p, u } = this.P.blur
      gl.useProgram(p)
      const a = this.bindQuad(p, this.quad)
      gl.activeTexture(gl.TEXTURE0)
      gl.uniform1i(u.t, 0)
      for (let k = 0; k < this.blurPasses; k++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, sb.fb)
        gl.bindTexture(gl.TEXTURE_2D, sa.tex)
        gl.uniform2f(u.dir, 1.6 / sa.w, 0)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.bindFramebuffer(gl.FRAMEBUFFER, sa.fb)
        gl.bindTexture(gl.TEXTURE_2D, sb.tex)
        gl.uniform2f(u.dir, 0, 1.6 / sa.h)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        calls += 2
      }
      gl.disableVertexAttribArray(a)
    }

    // ---- the room
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, W, H)
    gl.clearColor(0.1, 0.07, 0.05, 1)
    gl.clearDepth(1)
    gl.depthMask(true)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    {
      const { p, u } = this.P.bg
      gl.useProgram(p)
      const a = this.bindQuad(p, this.quad)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.roomTex)
      gl.uniform1i(u.t, 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      calls++
      // the floor shadow, multiplied, only where the floor shows
      const c = this.P.comp
      gl.useProgram(c.p)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.DST_COLOR, gl.ZERO)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, sa.tex)
      gl.uniform1i(c.u.t, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex)
      gl.uniform1i(c.u.m, 1)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      gl.disable(gl.BLEND)
      gl.activeTexture(gl.TEXTURE0)
      gl.disableVertexAttribArray(a)
      calls++
    }

    // ---- table depth, then the cloth
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    {
      const { p, u } = this.P.depth
      gl.useProgram(p)
      gl.uniformMatrix4fv(u.vp, false, cam.vp)
      gl.colorMask(false, false, false, false)
      const a = gl.getAttribLocation(p, 'a')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.box)
      gl.enableVertexAttribArray(a)
      gl.vertexAttribPointer(a, 3, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, this.boxN)
      gl.disableVertexAttribArray(a)
      gl.colorMask(true, true, true, true)
      calls++
    }
    {
      const { p, u } = this.P.cloth
      gl.useProgram(p)
      gl.uniformMatrix4fv(u.vp, false, cam.vp)
      gl.uniform3fv(u.L, LIGHT)
      gl.uniform3fv(u.eye, cam.eye)
      // satin: a strong narrow lobe (e 48, k 0.55) and a weak wide one (e 10, k 0.10)
      if (this.strongOnV) gl.uniform4f(u.lobes, 10, 0.1, 48, 0.55)
      else gl.uniform4f(u.lobes, 48, 0.55, 10, 0.1)
      gl.uniform3f(u.misc, 0.22, 0.12, 0.5)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.patTex)
      gl.uniform1i(u.tex, 0)
      const at: [string, number, number][] = [
        ['aP', 3, 0],
        ['aN', 3, 3],
        ['aTu', 3, 6],
        ['aTv', 3, 9],
        ['aK', 1, 12],
        ['aB', 1, 13],
      ]
      const locs: number[] = []
      gl.bindBuffer(gl.ARRAY_BUFFER, this.clothBuf)
      for (const [n, s, o] of at) {
        const l = gl.getAttribLocation(p, n)
        if (l < 0) continue
        gl.enableVertexAttribArray(l)
        gl.vertexAttribPointer(l, s, gl.FLOAT, false, STRIDE * 4, o * 4)
        locs.push(l)
      }
      const lu = gl.getAttribLocation(p, 'aUV')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuf)
      gl.enableVertexAttribArray(lu)
      gl.vertexAttribPointer(lu, 2, gl.FLOAT, false, 0, 0)
      locs.push(lu)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.idxBuf)
      gl.drawElements(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0)
      for (const l of locs) gl.disableVertexAttribArray(l)
      calls++
    }
    gl.disable(gl.DEPTH_TEST)

    // ---- contact shadows (multiply), then the props far to near
    {
      const { p, u } = this.P.csh
      gl.useProgram(p)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.DST_COLOR, gl.ZERO)
      gl.uniformMatrix4fv(u.vp, false, cam.vp)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.shTex)
      gl.uniform1i(u.t, 0)
      const a = this.bindQuad(p, this.quad)
      for (const st of stains) {
        gl.uniform1f(u.zz, st.z + 0.003)
        gl.uniform3fv(u.col, st.col)
        gl.uniform4f(u.c, st.x, st.y, st.rx, st.ry)
        gl.uniform1f(u.k, st.k)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        calls++
      }
      gl.uniform1f(u.zz, 0.003)
      gl.uniform3f(u.col, 10 / 255, 20 / 255, 18 / 255)
      for (const pv of props) {
        if (pv.shadowK <= 0 || pv.z < -0.02) continue
        // the soft cast ellipse (right and away), then a tight dark contact line right at the base
        gl.uniform4f(u.c, pv.x + 0.012 + pv.lean[0], pv.y + 0.012 + pv.lean[1], pv.shadow[0], pv.shadow[1])
        gl.uniform1f(u.k, pv.shadowK * pv.alpha)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.uniform4f(u.c, pv.x + pv.lean[0] * 0.3, pv.y + pv.lean[1] * 0.3, pv.shadow[0] * 0.92, pv.shadow[1] * 0.92)
        gl.uniform1f(u.k, pv.shadowK * 1.6 * pv.alpha)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        calls += 2
      }
      gl.disableVertexAttribArray(a)
    }
    {
      const { p, u } = this.P.spr
      gl.useProgram(p)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.uniform2f(u.res, cam.w, cam.h)
      gl.uniform1i(u.t, 0)
      const a = this.bindQuad(p, this.unit)
      gl.uniform4f(u.sub, 0, 0, 1, 1)
      gl.uniform3f(u.tB, 0, 0, 0)
      const items: (PropView | Bill)[] = [...props, ...bills]
      // far to near; things on the floor in front of the table come last
      items.sort((A, B) => B.y - A.y)
      const pt = [0, 0, 0]
      for (const it of items) {
        if (it.alpha <= 0) continue
        const base = cam.project(it.x, it.y, it.z, pt)
        const sc = cam.scale(base[2]) * it.vis
        const bx = base[0]
        const by = base[1]
        const fx = it.flip ? -1 : 1
        if ('sprites' in it) {
          const pv = it
          pv.sprites.forEach((s, i) => {
            const lift = pv.lift[i] * sc // the painters draw heights unforeshortened, so the stack lifts the same way
            const sw = (s.cv.width / s.k) * sc
            const sh = (s.cv.height / s.k) * sc
            gl.bindTexture(gl.TEXTURE_2D, pv.tex[i])
            gl.uniform2f(u.at, bx + pv.jit[i][0], by - lift * pv.squash + pv.jit[i][1])
            gl.uniform2f(u.size, sw * fx, sh)
            gl.uniform2f(u.anc, s.ax / s.cv.width, s.ay / s.cv.height)
            gl.uniform2f(u.piv, pv.pivot * pv.rb * sc, lift * pv.squash)
            gl.uniform1f(u.rot, pv.rot)
            gl.uniform1f(u.squash, pv.squash)
            gl.uniform1f(u.alpha, pv.alpha)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
            calls++
          })
        } else {
          const b = it
          const s = b.sprite
          const sub = b.sub ?? [0, 0, 1, 1]
          const sw = ((s.cv.width * sub[2]) / s.k) * sc
          const sh = ((s.cv.height * sub[3]) / s.k) * sc
          const anc = b.anc ?? [(s.ax / s.cv.width - sub[0]) / sub[2], (s.ay / s.cv.height - sub[1]) / sub[3]]
          gl.bindTexture(gl.TEXTURE_2D, b.tex)
          gl.uniform4f(u.sub, sub[0], sub[1], sub[2], sub[3])
          if (b.tri) {
            gl.uniform4f(u.tA, b.tri[0], b.tri[1], b.tri[2], b.tri[3])
            gl.uniform3f(u.tB, b.tri[4], b.tri[5], 1)
          } else gl.uniform3f(u.tB, 0, 0, 0)
          gl.uniform2f(u.at, bx, by)
          gl.uniform2f(u.size, sw * fx, sh)
          gl.uniform2f(u.anc, anc[0], anc[1])
          gl.uniform2f(u.piv, 0, 0)
          gl.uniform1f(u.rot, b.rot)
          gl.uniform1f(u.squash, 1)
          gl.uniform1f(u.alpha, b.alpha)
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          gl.uniform4f(u.sub, 0, 0, 1, 1)
          gl.uniform3f(u.tB, 0, 0, 0)
          calls++
        }
      }
      gl.disableVertexAttribArray(a)
      gl.disable(gl.BLEND)
    }
    return calls
  }
}
