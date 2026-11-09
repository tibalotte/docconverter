// Régénère les fixtures synthétiques : node fixtures/generate.mjs fixtures
import { writeFileSync } from 'node:fs';
const root = process.argv[2];
const crlf = (s) => s.replace(/\n/g, '\r\n');

function tyreSection(name, side, idx, o = {}) {
  const v = { width: 0.225, radius: 0.3125, rim: 0.2286, dxref: 1.26, dyref: 1.25, p: 26, pi: 33, ...o };
  return `[${name}]
NAME=${o.cname ?? 'Semislicks'}
SHORT_NAME=${o.short ?? 'SM'}
WIDTH=${v.width}
RADIUS=${v.radius}\t\t\t; tyre radius in meters
RIM_RADIUS=${v.rim}\t\t; rim radius in meters (use 1 inch more than nominal)
ANGULAR_INERTIA=1.2\t\t; angular inertia of ${side} rim+tyre+brake disc together
DAMP=500\t\t\t\t\t; Damping rate of ${side} tyre in N sec/m
RATE=275000\t\t\t\t\t; Spring rate of ${side} tyres in N/m
DY0=1.2564
DY1=-0.052
DX0=1.2933
DX1=-0.053
WEAR_CURVE=${(o.short ?? 'sm').toLowerCase()}_${side}.lut\t\t; file with lookup table to call
SPEED_SENSITIVITY=0.003124\t\t; speed sensitivity value
RELAXATION_LENGTH=0.07589
ROLLING_RESISTANCE_0=12\t\t; rolling resistance constant component
ROLLING_RESISTANCE_1=0.000877\t\t; rolling resistance velocity (squared) component
ROLLING_RESISTANCE_SLIP=4000\t\t; rolling resistance slip angle component
FLEX=0.000774\t\t\t\t; tire profile flex
CAMBER_GAIN=0.135\t\t\t; Camber gain value as slipangle multiplier
DCAMBER_0=1.2
DCAMBER_1=-13
FRICTION_LIMIT_ANGLE=7.68\t; Friction limit angle.
XMU=0.25
PRESSURE_STATIC=${v.p} ; STATIC (COLD) PRESSURE
PRESSURE_SPRING_GAIN=7570 ; INCREASE IN N/m per psi
PRESSURE_FLEX_GAIN=0.45 ; INCREASE IN FLEX per psi
PRESSURE_RR_GAIN=0.45 ; INCREASE IN RR RESISTANCE per psi
PRESSURE_D_GAIN=0.004\t;loss of tyre footprint with pressure rise.
PRESSURE_IDEAL=${v.pi}   ;Ideal pressure for grip
FALLOFF_LEVEL=0.84
FALLOFF_SPEED=4
CX_MULT=1.05
RADIUS_ANGULAR_K=0.01
BRAKE_DX_MOD=0.05
DX_REF=${v.dxref}
DY_REF=${v.dyref}
`;
}
function thermal(name, curve) {
  return `[${name}]
SURFACE_TRANSFER=0.0150
PATCH_TRANSFER=0.00027
CORE_TRANSFER=0.00090
INTERNAL_CORE_TRANSFER=0.0035
FRICTION_K=0.03806
ROLLING_K=0.17
PERFORMANCE_CURVE=${curve}
GRAIN_GAMMA=1
GRAIN_GAIN=0.10
BLISTER_GAMMA=1
BLISTER_GAIN=0.10
COOL_FACTOR=1.4
SURFACE_ROLLING_K=1.25
`;
}
const head = (idx) => `; Fixture SYNTHÉTIQUE pour acmod-web (structure inspirée des fichiers AC, valeurs inventées)
[HEADER]
VERSION=10

[COMPOUND_DEFAULT]
INDEX=${idx}

`;

function susp({ type = 'DWB', front = {}, rear = {} } = {}) {
  const side = (name, o) => `[${name}]
TYPE=${o.type ?? type}\t\t\t\t; Suspension type
BASEY=${o.basey ?? -0.05}\t\t\t; Distance of CG from the center of the wheel in meters
TRACK=${o.track ?? 1.48}\t\t\t; Track width in meters (from pivot 3D placement of the 3d model of a wheel)
ROD_LENGTH=0.0\t\t\t; push rod length in meters
HUB_MASS=${o.hub ?? 38}\t\t\t; masse of the suspension hub
RIM_OFFSET=0.0
WBCAR_TOP_FRONT=0.2, 0.18, -0.03\t\t; Wishbone car top front point
WBCAR_TOP_REAR=0.2, 0.18, 0.25
WBCAR_BOTTOM_FRONT=0.03, -0.09, -0.04
WBCAR_BOTTOM_REAR=0.03, -0.09, 0.30
WBTYRE_TOP=-0.07, 0.15, 0.0
WBTYRE_BOTTOM=-0.10, -0.11, 0.0
WBCAR_STEER=0.15, -0.025, -0.13
WBTYRE_STEER=-0.04, -0.03, -0.13
TOE_OUT=${o.toe ?? 0.0010}\t\t\t; Toe-out expressed as the length of the steering arm in meters
STATIC_CAMBER=${o.camber ?? -1.5}\t\t; Static Camber in degrees
SPRING_RATE=${o.spring ?? 90000}\t\t; Wheel rate stiffness in Nm
PROGRESSIVE_SPRING_RATE=0\t; progressive spring rate in N/m/m
BUMP_STOP_RATE=${o.bsr ?? 500000}\t\t; bump stop spring rate
BUMPSTOP_UP=0.08\t\t\t; meters to upper bumpstop from the 0 design of the suspension
BUMPSTOP_DN=0.08\t\t\t; meters to bottom bumpstop from the 0 design of the suspension
PACKER_RANGE=${o.packer ?? 0.1}\t\t; Total suspension movement range, before hitting packers
DAMP_BUMP=${o.bump ?? 3500}\t\t\t; Damper wheel rate stiffness in N sec/m in slow speed compression
DAMP_FAST_BUMP=${o.fbump ?? 2500}\t\t; Damper wheel rate stiffness in N sec/m in fast speed compression
DAMP_FAST_BUMPTHRESHOLD=0.15\t; Damper wheel rate speed threshold where fast speed compression starts
DAMP_REBOUND=${o.reb ?? 7000}\t\t; Damper wheel rate stiffness in N sec/m in slow speed rebound
DAMP_FAST_REBOUND=${o.freb ?? 4000}\t\t; Damper wheel rate stiffness in N sec/m in fast speed rebound
DAMP_FAST_REBOUNDTHRESHOLD=0.15\t; Damper wheel rate speed threshold where fast speed rebound starts
`;
  return `; Fixture SYNTHÉTIQUE pour acmod-web
[HEADER]
VERSION=4

[BASIC]
WHEELBASE=2.53\t\t\t; Wheelbase distance in meters
CG_LOCATION=0.52\t\t; Front Weight distribution in percentage

[ARB]
FRONT=${front.arb ?? 32000}\t\t\t; Front antiroll bar stifness. in Nm
REAR=${rear.arb ?? 12000}\t\t\t; Rear antiroll bar stifness. in Nm

${side('FRONT', front)}
${side('REAR', { track: 1.5, spring: 80000, camber: -1.0, ...rear })}
[GRAPHICS_OFFSETS]
WHEEL_LF=-0.01
SUSP_LF=0.0
`;
}

function setup(extra = '') {
  return `[DISPLAY_METHOD]
SHOW_CLICKS=0

[TYRES]
TAB=TYRES
NAME=Tyres

[PRESSURE_LF]
SHOW_CLICKS=0
TAB=TYRES
NAME=Pressure LF
MIN=15
MAX=40
STEP=1
POS_X=0
POS_Y=0
HELP=HELP_PRESSURE

[PRESSURE_RF]
SHOW_CLICKS=0
TAB=TYRES
NAME=Pressure RF
MIN=15
MAX=40
STEP=1
POS_X=1
POS_Y=0
HELP=HELP_PRESSURE

[CAMBER_LF]
SHOW_CLICKS=2
TAB=ALIGNMENT
NAME=Camber LF
MIN=-40
MAX=0
STEP=1
POS_X=0
POS_Y=0
HELP=HELP_LF_CAMBER

[SPRING_RATE_LF]
SHOW_CLICKS=0
TAB=SUSPENSION
NAME=Spring Rate LF
MIN=70000
MAX=110000
STEP=5000
POS_X=0
POS_Y=0
HELP=HELP_SPRING_RATE

[ARB_FRONT]
SHOW_CLICKS=0
TAB=SUSPENSION
NAME=ARB Front
MIN=20000
MAX=45000
STEP=2500
POS_X=0
POS_Y=1
HELP=HELP_ARB

[DAMP_BUMP_LF]
SHOW_CLICKS=2
TAB=DAMPERS
NAME=Bump LF
MIN=2000
MAX=6000
STEP=250
POS_X=0
POS_Y=0
HELP=HELP_DAMP_BUMP

[FUEL]
SHOW_CLICKS=0
TAB=GENERIC
NAME=Fuel
MIN=1
MAX=60
STEP=1
POS_X=0
POS_Y=0
HELP=HELP_FUEL
${extra}`;
}

// 1. Kunos simple : CRLF, un composé.
const k = `${root}/kunos_simple`;
writeFileSync(`${k}/tyres.ini`, crlf(head(0) + tyreSection('FRONT', 'front') + '\n' + tyreSection('REAR', 'rear', 0, { width: 0.245, radius: 0.3175 }) + '\n' + thermal('THERMAL_FRONT', 'tcurve_semis.lut') + '\n' + thermal('THERMAL_REAR', 'tcurve_semis.lut')));
writeFileSync(`${k}/suspensions.ini`, crlf(susp()));
writeFileSync(`${k}/setup.ini`, crlf(setup()));

// 2. Plusieurs composés : CRLF, commentaire avec accent en Windows-1252.
const m = `${root}/multi_compounds`;
const comps = [['Street', 'ST', 26, 30], ['Semislicks', 'SM', 26, 33], ['Slicks Medium', 'M', 22, 26]];
let t = head(1).replace('VERSION=10', 'VERSION=10\n; Composés : Street / Semi / Slick (réglés à la main)');
comps.forEach(([n, s, p, pi], i) => {
  const sfx = i === 0 ? '' : `_${i}`;
  t += tyreSection(`FRONT${sfx}`, 'front', i, { cname: n, short: s, p, pi }) + '\n';
  t += tyreSection(`REAR${sfx}`, 'rear', i, { cname: n, short: s, p, pi, width: 0.255, radius: 0.32 }) + '\n';
});
comps.forEach(([, s], i) => {
  const sfx = i === 0 ? '' : `_${i}`;
  t += thermal(`THERMAL_FRONT${sfx}`, `tcurve_${s.toLowerCase()}.lut`) + '\n';
  t += thermal(`THERMAL_REAR${sfx}`, `tcurve_${s.toLowerCase()}.lut`) + '\n';
});
writeFileSync(`${m}/tyres.ini`, Buffer.from(crlf(t), 'latin1'));
writeFileSync(`${m}/suspensions.ini`, crlf(susp({ front: { type: 'STRUT', arb: 25000 }, rear: { type: 'DWB' } })));
writeFileSync(`${m}/setup.ini`, crlf(setup('\n[TYRES_COMPOUND]\nTAB=TYRES\nNAME=Compound\n')));

// 3. Mod « sale » : LF, BOM UTF-8, casse variable, clé dupliquée, commentaires //,
//    espaces autour de =, pas de saut de ligne final.
const d = `${root}/mod_messy`;
let mt = tyreSection('front', 'front', 0, { cname: 'Mod Tyre', short: 'MT' })
  .replace('WIDTH=0.225', 'Width = 0.230   // largeur modifiée')
  .replace('DX_REF=1.26', 'DX_REF=1.20\ndx_ref=1.28 ; doublon : la dernière ligne fait foi');
mt = '﻿// Mod de test — fichier volontairement « sale »\n[Header]\nVERSION=10\n\n' + mt + '\n' +
  tyreSection('Rear', 'rear', 0, { cname: 'Mod Tyre', short: 'MT', width: 0.28 }) + '\n' + thermal('thermal_front', 'mod.lut');
writeFileSync(`${d}/tyres.ini`, mt.replace(/\n$/, ''));
writeFileSync(`${d}/suspensions.ini`, susp({ type: 'AXLE' }).replace('SPRING_RATE=90000', 'Spring_Rate =  95000\t// ressort')
  .replace(/\n$/, ''));
writeFileSync(`${d}/setup.ini`, setup().replace('MIN=15', 'min = 15'));
writeFileSync(`${d}/data.acd.README`, 'Ce mod a été dépaqueté : pas de data.acd ici.\n');
