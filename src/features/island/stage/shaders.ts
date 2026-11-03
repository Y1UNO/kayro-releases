/**
 * Kysland's music mode: the lab's shaders (`reference-labo.html`), as they are, for a transparent
 * window (SPEC §5): no background, vignette or grain; the light only is bent by the waves; the
 * output is premultiplied, its alpha the ink's coverage plus the light's luminance. Changed for
 * the app: the island is the real one (a rounded box against the screen's edges, melting into
 * them by its shoulders), `uLit` fades the light and the gloss in and out at the swaps, and the
 * light fades out before the window's region ends (`uFade`). The walls the island melts into
 * end two shoulders past it (whole, they lit the screen's top edge: grey bars). The ink is the island's black,
 * matte (2026-11-03, the user's choice): the lab's gloss (reflections, rim, highlights) only
 * with « Brillance » above 0, and the crash's flash spares the ink. The strings are drawn in the
 * final image only, sharp: in the light, its trails copied them into blurred ghosts (2026-11-03).
 * A string without its source rests on the ink as its outline (the user's friend Thomas's idea).
 * A pluck's ring index carries how sharp its note was (+0–0.09): a soft note's bump is wide, slow
 * and long, a chopped one's narrow, quick, short and fast-ringing.
 * No spikes anywhere.
 */

export const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes;uniform float uPx;uniform vec2 uSize;uniform float uTime;
uniform vec4 uBalls[32];uniform int uN;uniform float uK;
uniform vec4 uSegA[50];uniform vec4 uSegB[50];uniform int uNS;
uniform vec4 uCore;uniform vec4 uModeA;uniform vec4 uModeP;uniform vec4 uRipple;uniform vec2 uShear;
uniform vec4 uIsle;uniform vec4 uIsleR;uniform vec3 uC1;uniform vec3 uC2;uniform vec4 uHalo;
uniform vec4 uRings[3];uniform vec4 uPk[16];uniform int uNPk;
uniform vec4 uWaveA[6];uniform vec4 uWaveB[6];uniform int uNW;
uniform float uFlash;uniform float uCA;uniform float uGloss;uniform float uBuild;uniform vec2 uShake;
uniform vec4 uCover;uniform sampler2D uCoverTex;uniform vec2 uFC;uniform float uLit;uniform float uFade;
out vec4 o;
const float PI=3.14159265;
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float coreRel(float th){
  float r=1.+uModeA.x*cos(2.*(th-uModeP.x))+uModeA.y*cos(3.*(th-uModeP.y))+uModeA.z*cos(4.*(th-uModeP.z))+uModeA.w*cos(5.*(th-uModeP.w));
  r+=uRipple.x*sin(uRipple.y*th-uRipple.z);
  return r;
}
vec2 coreQ(vec2 p){vec2 q=p-uCore.xy;return vec2(q.x+uShear.x*q.y,q.y+uShear.y*q.x);}
float sdCore(vec2 p){vec2 q=coreQ(p);float th=atan(q.y,q.x);return length(q)-uCore.z*coreRel(th);}
float sdIsle(vec2 p){
  vec2 c=(uIsle.xy+uIsle.zw)*.5;vec2 b=(uIsle.zw-uIsle.xy)*.5;float rr=min(uIsleR.x,min(b.x,b.y));
  vec2 q=abs(p-c)-b+rr;float d=length(max(q,0.))+min(max(q.x,q.y),0.)-rr;
  if(uIsleR.y>.5){float rc=uIsleR.y*2.;float w=max(p.y-uIsleR.z,abs(p.x-c.x)-b.x-rc);
    if(uIsleR.w<-.5)w=min(w,max(p.x,p.y-uIsle.w-rc));if(uIsleR.w>.5)w=min(w,max(uSize.x-p.x,p.y-uIsle.w-rc));
    d=smin(d,w,uIsleR.y);}
  return d;
}
// A segment from a to b, its radius ra at a and rb at b (iq's uneven capsule).
float sdSeg(vec2 p,vec2 a,vec2 b,float ra,float rb){
  p-=a;b-=a;float h=max(dot(b,b),1e-4);vec2 q=vec2(dot(p,vec2(b.y,-b.x)),dot(p,b))/h;
  q.x=abs(q.x);float dr=ra-rb;vec2 c=vec2(sqrt(max(h-dr*dr,0.)),dr);
  float k=c.x*q.y-c.y*q.x,m=dot(c,q),n=dot(q,q);
  if(k<0.)return sqrt(h*n)-ra;if(k>c.x)return sqrt(h*(n+1.-2.*q.y))-rb;return m-ra;
}
float sdScene(vec2 p){
  float d=1e4;
  if(uCore.w>.5&&uCore.z>.5)d=sdCore(p);
  if(uIsle.z>uIsle.x+.5)d=smin(d,sdIsle(p),uK);
  for(int i=0;i<32;i++){if(i>=uN)break;vec4 b=uBalls[i];if(b.z<.35)continue;d=smin(d,length(p-b.xy)-b.z,uK*b.w);}
  for(int i=0;i<50;i++){if(i>=uNS)break;vec4 a=uSegA[i],b=uSegB[i];d=smin(d,sdSeg(p,a.xy,a.zw,b.x,b.y),uK*b.z);}
  return d;
}
vec3 ringCol(float w){return w<.5?uC1:(w<1.5?uC2:mix(uC1,vec3(1.),.55));}
// The strings: a circle round the core, or, at rest (its fraction in R.w: string + 0–0.99), the
// ink's own outline a few px out (d: the ink's distance here), one after the other inside out.
vec3 rings(vec2 p,float d){
  vec3 acc=vec3(0.);if(uCore.w<.5)return acc;
  vec2 q=p-uCore.xy;float L=length(q),th=atan(q.y,q.x);
  for(int i=0;i<3;i++){vec4 R=uRings[i];if(R.y<.003)continue;float disp=0.;
    for(int k=0;k<16;k++){if(k>=uNPk)break;vec4 P=uPk[k];if(abs(P.x-float(i))>.1)continue;
      float sh=clamp((P.x-float(i))/.09,0.,1.);float tr=P.z*(1.8+1.8*sh),wd=9.+55.*sh;
      float a1=mod(th-P.y-tr+PI,2.*PI)-PI,a2=mod(th-P.y+tr+PI,2.*PI)-PI;
      disp+=P.w*exp(-P.z*(2.+3.5*sh))*(exp(-a1*a1*wd)+exp(-a2*a2*wd))*cos(P.z*(18.+20.*sh));}
    float dr=abs(L-R.x-disp);float line=exp(-dr*dr/(R.z*R.z));
    float rest=clamp((R.w-float(i))/.99,0.,1.);
    float dc=abs(d-uSize.y*(.006+.0045*float(i))-disp*.35);float hug=exp(-dc*dc/(R.z*R.z*.6));
    acc+=ringCol(float(i))*R.y*mix(line,hug,rest);}
  return acc;
}
vec3 waves(vec2 p,out vec2 disp){
  vec3 acc=vec3(0.);disp=vec2(0.);
  for(int i=0;i<6;i++){if(i>=uNW)break;vec4 A=uWaveA[i];vec4 B=uWaveB[i];if(B.x<.002)continue;
    vec2 q=p-A.xy;float L=length(q)+1e-3,th=atan(q.y,q.x);
    float wob=1.+.045*sin(3.*th+A.z*.013+B.w)+.03*sin(5.*th-A.z*.021);
    float dr=(L-A.z*wob)/A.w;float band=exp(-dr*dr);
    float pieces=.55+.45*sin(th*4.+A.z*.01+B.w);
    acc+=(mix(uC1,uC2,B.y)*1.1+vec3(.15))*band*B.x*pieces;
    disp+=(q/L)*(-dr*band)*B.z;}
  return acc;
}
vec3 haloCol(vec2 p){float th=atan(p.y-uFC.y,p.x-uFC.x);return mix(uC1,uC2,.5+.5*sin(th+uTime*.4));}
float fadeOut(vec2 p){return smoothstep(uFade,uFade*.8,length(p-uFC));}
`;

export const FS_LIGHT = `${COMMON}
uniform sampler2D uPrev;uniform float uDecay;uniform float uZoom;uniform float uRot;
void main(){
  vec2 ps=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uPx;vec2 p=ps+uShake;
  vec2 q=ps-uFC;float c=cos(uRot),s=sin(uRot);q=vec2(c*q.x-s*q.y,s*q.x+c*q.y)/uZoom;vec2 pp=q+uFC;
  vec2 uv=vec2(pp.x/uSize.x,1.-pp.y/uSize.y);
  vec3 prev=(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.)?texture(uPrev,uv).rgb*uDecay:vec3(0.);
  float d=sdScene(p);float dd=max(d,0.);
  float th=atan(p.y-uFC.y,p.x-uFC.x);
  float g=exp(-dd/uHalo.y)*uHalo.x;
  float ray=pow(.5+.5*sin(9.*th+uTime*.5+2.*sin(4.*th-uTime*.37)),6.)*exp(-dd/(uHalo.y*3.))*uHalo.z;
  vec2 wd;vec3 e=(haloCol(p)*(g+ray*.8)+waves(p,wd)*.8)*uLit;
  o=vec4(max(prev,e)*fadeOut(ps),1.);
}`;

export const FS_FINAL = `${COMMON}
uniform sampler2D uLight;
float hgt(float d,float W){float s=clamp(-d/W,0.,1.);return W*sqrt(1.-(1.-s)*(1.-s));}
void main(){
  vec2 fc=gl_FragCoord.xy;vec2 ps=vec2(fc.x,uRes.y-fc.y)/uPx;vec2 p=ps+uShake;
  vec2 wd;vec3 wv=waves(p,wd);
  vec2 uv=vec2((ps.x+wd.x)/uSize.x,1.-(ps.y+wd.y)/uSize.y);vec2 dc=(uv-.5)*uCA;
  vec3 L=vec3(texture(uLight,uv+dc).r,texture(uLight,uv).g,texture(uLight,uv-dc).b);
  float m=fadeOut(ps)*uLit;
  float d=sdScene(p);
  vec3 col=(L*.9+wv*.35+rings(p,d)*1.25)*m;
  float aa=max(fwidth(d)*.75,.35/uPx);float a=smoothstep(aa,-aa,d);
  if(a>.001){
    vec3 ink=vec3(0.);
    if(uCover.z>.01&&uCore.w>.5){vec2 q=coreQ(p);float cl=length(q),lr=uCover.x;if(cl<lr+2.){float cs=cos(uCover.y),sn=sin(uCover.y);vec2 r=vec2(cs*q.x+sn*q.y,-sn*q.x+cs*q.y)/(2.*lr)+.5;vec3 cvv=texture(uCoverTex,r).rgb;float la=smoothstep(lr+.8,lr-.8,cl)*uCover.z;ink=mix(ink,cvv*.9,la);ink=mix(ink,vec3(0.),smoothstep(uCover.w+.8,uCover.w-.8,cl)*la);}}
    if(uGloss>.001){
      float W=uSize.y*.055,e=.8;
      float h0=hgt(d,W),hx=hgt(sdScene(p+vec2(e,0.)),W),hy=hgt(sdScene(p+vec2(0.,e)),W);
      vec3 n=normalize(vec3(-(hx-h0)/e,(hy-h0)/e,1.));
      vec3 Ld=normalize(vec3(-.42,.62,.66));vec3 Hh=normalize(Ld+vec3(0.,0.,1.));
      float nh=max(dot(n,Hh),0.);float spec=pow(nh,60.)*.35+pow(nh,700.)*1.6;
      float fres=pow(1.-clamp(n.z,0.,1.),2.5);
      vec3 env=mix(vec3(.015,.017,.024),vec3(.20,.21,.25),smoothstep(-.1,.9,n.y));
      ink+=(env*fres*.85+haloCol(p)*fres*(.35+uHalo.w+uHalo.x*.25)+vec3(spec)+L*.02)*uGloss*uLit;
    }
    col=mix(col,ink,a);
  }
  col+=(uC1*.5+.2)*uFlash*.35*m*(1.-a*(1.-uGloss));
  col=1.-exp(-col*1.25);
  float lum=dot(col,vec3(.2126,.7152,.0722));
  o=vec4(col,a+(1.-a)*clamp(lum,0.,1.));
}`;

export const VS = `#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

export const UNIFORMS = [
  "uRes",
  "uPx",
  "uSize",
  "uTime",
  "uBalls",
  "uN",
  "uSegA",
  "uSegB",
  "uNS",
  "uK",
  "uCore",
  "uModeA",
  "uModeP",
  "uRipple",
  "uShear",
  "uIsle",
  "uIsleR",
  "uC1",
  "uC2",
  "uHalo",
  "uRings",
  "uPk",
  "uNPk",
  "uWaveA",
  "uWaveB",
  "uNW",
  "uFlash",
  "uCA",
  "uGloss",
  "uBuild",
  "uShake",
  "uCover",
  "uCoverTex",
  "uFC",
  "uLit",
  "uFade",
  "uPrev",
  "uDecay",
  "uZoom",
  "uRot",
  "uLight",
] as const;
