/**
 * Core mechanics and hostile-save regression gate. No browser or bundle needed.
 * node tools/core-regression-test.mjs
 */
import assert from 'node:assert/strict'
import { useBuildStore } from '../src/store/useBuildStore.js'
import { useUiStore } from '../src/store/useUiStore.js'
import { apply, basisX, basisY, ID, ORIENT_COUNT, stepWorld } from '../src/lib/orient.js'
import { boltEndpoints, chainTransform, flatsOverlap, halfThickness, orientedBottom, worldHole, worldNodes } from '../src/lib/geometry.js'
import { planAssembly } from '../src/lib/assembly.js'
import { CATEGORY, PART_SPECS } from '../src/lib/parts.js'
import { MOUNT, PITCH } from '../src/lib/config.js'
import { BLOCK_TYPES, toArduinoCode } from '../src/lib/program.js'
import { getTemplate } from '../src/lib/templates.js'

const b = () => useBuildStore.getState()
const near = (a, c) => assert.ok(Math.abs(a - c) < 1e-8, a + ' != ' + c)
const vec = (a, c) => a.forEach((v, i) => near(v, c[i]))
const slab = (id, { kind = 'strip5', pos = [0, 0, 0], y = 0.045, rot = ID } = {}) => ({ id, kind, pos, y, rot })
const save = (parts, extra = {}) => ({ format: 'arduinium-build', version: 3, parts, bolts: [], wires: [], program: [], ...extra })
const reset = (parts = [], extra = {}) => {
  b().loadBuildFromJSON(save(parts, extra))
  useBuildStore.setState({ snapEnabled: true })
}
const place = (kind, pos, hint) => {
  b().beginPlace(kind)
  b().movePending(pos, hint)
  b().commitPlace()
  return b().parts[b().selected]
}
let passed = 0, failed = 0
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name) }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack) }
}

test('all four fitting spins have exact local-basis transforms in all 24 orientations', () => {
  const directions = [[1,0,0], [0,0,-1], [-1,0,0], [0,0,1]]
  for (let rot = 0; rot < ORIENT_COUNT; rot++) {
    const host = slab('h', { rot, y: 3 })
    for (let spin = 0; spin < 4; spin++) {
      const t = chainTransform({ id: 'm', kind: 'motormount', hostId: 'h', hostHole: 4, spin }, { h: host })
      vec(t.axis, apply(rot, directions[spin]))
    }
  }
})

test('hinge anchors use actual hole height and surface normal in all 24 orientations', () => {
  for (let rot = 0; rot < ORIENT_COUNT; rot++) {
    const n = basisY(rot), offset = apply(rot, [1,0,0]), origin = [2,3,4]
    const a = slab('a', { pos: [2,0,4], y: 3, rot })
    const center = origin.map((v,i) => v + n[i] * 0.09)
    const c = slab('c', { pos: [center[0],0,center[2]], y: center[1], rot })
    const hinge = planAssembly({ a, c }, [{ id:'bolt', aId:'a', aHole:4, bId:'c', bHole:4 }]).hinges[0]
    assert.ok(hinge)
    vec(Object.values(hinge.anchorPart), origin.map((v,i) => v + offset[i] + n[i] * 0.045))
    assert.deepEqual(hinge.anchorPart, hinge.anchorGroup)
    vec(Object.values(hinge.axis), n)
  }
})

test('motor shaft nodes include the vertical axis component', () => {
  const host = slab('h', { rot: stepWorld(ID,'z'), y: 3 })
  const parts = { h: host,
    m: { id:'m', kind:'motormount', hostId:'h', hostHole:4 },
    motor: { id:'motor', kind:'motor', hostId:'m', hostHole:0 } }
  const t = chainTransform(parts.motor, parts)
  const node = worldNodes(parts.motor, parts)[0]
  vec(node.pos, t.pos.map((v,i) => v + t.axis[i] * (MOUNT.motorLength / 2 + MOUNT.shaftLength)))
  assert.notEqual(node.pos[1], t.pos[1])
})

test('cycles, incompatible mounts and out-of-range hole/seat/shaft indices are pruned with descendants', () => {
  reset([slab('root'),
    {id:'cycle-a',kind:'standoff',hostId:'cycle-b',hostHole:0},
    {id:'cycle-b',kind:'standoff',hostId:'cycle-a',hostHole:0},
    {id:'cycle-child',kind:'sensor',hostId:'cycle-a',hostHole:0},
    {id:'wrong',kind:'wheel',hostId:'root',hostHole:0},
    {id:'high',kind:'standoff',hostId:'root',hostHole:5},
    {id:'m',kind:'motormount',hostId:'root',hostHole:0},
    {id:'motor',kind:'motor',hostId:'m',hostHole:1},
    {id:'wheel',kind:'wheel',hostId:'motor',hostHole:0},
    {id:'proto',kind:'standoff',hostId:'constructor',hostHole:0}])
  assert.deepEqual(b().order, ['root','m'])
  assert.ok(Number.isFinite(b().buildLift()))
})

test('direct geometry callers safely reject a mount cycle', () => {
  const parts = { a:{id:'a',kind:'standoff',hostId:'c',hostHole:0}, c:{id:'c',kind:'standoff',hostId:'a',hostHole:0} }
  assert.equal(chainTransform(parts.a,parts),null)
})

test('duplicate mounts lose their dependent chains, while first legal claimant survives', () => {
  reset([slab('root'),
    {id:'m1',kind:'motormount',hostId:'root',hostHole:0},
    {id:'m2',kind:'motormount',hostId:'root',hostHole:0},
    {id:'motor',kind:'motor',hostId:'m2',hostHole:0}])
  assert.deepEqual(b().order,['root','m1'])
})

test('malformed required collection refuses import without clearing the existing build', () => {
  reset([slab('keep')])
  for (const parts of [null, {}, 'parts', 8]) assert.equal(b().loadBuildFromJSON(save(parts)),false)
  assert.deepEqual(b().order,['keep'])
})

test('optional collection and numeric defaults always produce finite safe state', () => {
  reset([slab('default',{y:undefined,rot:undefined}), slab('bad',{y:'0.2'}), slab('badpos',{pos:[0,NaN,0]}),
    {id:'__proto__',kind:'strip5',pos:[0,0,0]}, {id:'unknown',kind:'toString',pos:[0,0,0]}],
    {bolts:{},wires:'bad',program:{},name:{}})
  assert.deepEqual(b().order,['default'])
  near(b().parts.default.y,0.045)
  assert.equal(b().parts.default.rot,ID)
  assert.ok(Number.isFinite(b().buildLift()))
  assert.ok(Array.isArray(b().program))
  assert.equal(typeof b().buildName,'string')
  reset([{id:'yaw',kind:'strip5',pos:[0,0,0],rotY:Infinity}],{program:[null,{type:'forever',body:{},elseBody:[null]}]})
  assert.equal(b().parts.yaw.rot,ID)
  assert.deepEqual(b().program[0].body,[])
  assert.equal(b().program[0].elseBody,undefined) // forever has no else branch
})

test('legacy board-socket LEDs are dropped and the Uno exposes only bolt holes', () => {
  reset([{id:'led',kind:'led',socket:'s0'}])
  assert.equal(b().order.length,0)
  reset([slab('board',{kind:'board'}),{id:'a',kind:'led',socket:'s0'},
    {id:'duplicate',kind:'led',socket:'s0'},{id:'bad',kind:'led',socket:'nope'}])
  assert.deepEqual(b().order,['board'])
  assert.ok(worldNodes(b().parts.board,b().parts).every(node=>node.category===CATEGORY.HOLE))
})

test('bolt validation rejects null, negative/out-of-bounds holes, duplicates, self links and occupied nodes', () => {
  const a=slab('a'), c=slab('c',{y:0.135})
  const valid={id:'valid',aId:'a',aHole:1,bId:'c',bHole:1}
  reset([a,c,{id:'standoff',kind:'standoff',hostId:'a',hostHole:0}],{bolts:[
    null,{id:'negative',aId:'a',aHole:-1,bId:'c',bHole:2},
    {id:'high',aId:'a',aHole:5,bId:'c',bHole:2},
    {id:'self',aId:'a',aHole:2,bId:'a',bHole:2},
    {id:'occupied',aId:'a',aHole:0,bId:'c',bHole:0},valid,
    {...valid,id:'reversed',aId:'c',bId:'a'},
    {...valid,aHole:2,bHole:2}
  ]})
  assert.deepEqual(b().bolts,[valid])
  assert.equal(planAssembly(b().parts,b().bolts).hinges.length,1)
})

test('invalid, duplicate and shorted imported leads are discarded', () => {
  const json=structuredClone(getTemplate('rover').json)
  json.wires.push(null,{},json.wires[0],{id:'bad',a:{partId:'r-board',terminal:'5V'},b:{partId:'r-sensor',terminal:'GND'}})
  b().loadBuildFromJSON(json)
  assert.equal(b().wires.length,24)
  assert.doesNotThrow(()=>b().pinMap())
})

test('v2 rover keeps all bolts, 24 real leads and one welded chassis', () => {
  b().loadBuildFromJSON(getTemplate('rover').json)
  assert.equal(b().order.length,18)
  assert.equal(b().bolts.length,8)
  assert.equal(b().wires.length,24)
  assert.equal(planAssembly(b().parts,b().bolts).groups.length,1)
  const exported=b().exportBuildToJSON()
  assert.equal(exported.version,4)
  b().loadBuildFromJSON(exported)
  assert.equal(b().bolts.length,8)
})

test('flat hints cannot teleport across height or a remote parallel plane', () => {
  reset([slab('high',{y:15})])
  b().beginPlace('strip5')
  b().movePending([0,0,0],{partId:'high',index:2})
  assert.equal(b().pending.snap,null)
  near(b().pending.y,0.045)
  const rot=stepWorld(ID,'x')
  reset([slab('wall',{rot,pos:[0,0,25],y:0.25})])
  b().beginPlace('strip5'); b().rotatePending(1,'x')
  b().movePending([0,0,0],{partId:'wall',index:2})
  assert.equal(b().pending.snap,null)
})

test('mount hints also have a finite three-dimensional capture radius', () => {
  reset([slab('far',{y:20})])
  b().beginPlace('sensor')
  b().movePending([0,0,0],{partId:'far',index:2})
  assert.equal(b().pending.snap,null)
})

test('vertical snapping includes resting height before measuring holes', () => {
  const rot=stepWorld(ID,'z')
  const height=-orientedBottom('strip5',rot)
  reset([slab('vertical',{rot,y:height})])
  b().beginPlace('strip5'); b().rotatePending(1,'z')
  b().movePending([0,0,0],{partId:'vertical',index:4})
  assert.ok(b().pending.snap)
  assert.equal(b().pending.snap.myHole,4)
  near(b().pending.y,height)
})

test('fitting preview, commit, pickup and save/load preserve spin 3 and identity', () => {
  reset([slab('root')])
  b().beginPlace('sensor')
  b().movePending([1,0,0],{partId:'root',index:4})
  for(let i=0;i<3;i++)b().rotatePending(1)
  const preview=b().pending
  b().commitPlace()
  const id=b().selected
  assert.equal(b().parts[id].spin,3)
  let t=chainTransform(b().parts[id],b().parts)
  vec(t.pos,[preview.pos[0],preview.y,preview.pos[2]])
  assert.equal(t.orient,preview.snap.orient)
  b().pickUpPart(id)
  assert.equal(b().pending.spin,3)
  b().movePending([1,0,0],{partId:'root',index:4})
  b().commitPlace()
  assert.equal(b().selected,id)
  assert.equal(b().parts[id].spin,3)
  b().loadBuildFromJSON(b().exportBuildToJSON())
  assert.equal(b().parts[id].spin,3)
})

test('a raised plate creates actual bolts to its supports and welds to their root body', () => {
  reset([slab('base',{kind:'strip7'}),
    {id:'left',kind:'standoff',hostId:'base',hostHole:2},
    {id:'right',kind:'standoff',hostId:'base',hostHole:4}])
  const top=worldNodes(b().parts.left,b().parts)[0]
  b().beginPlace('strip5')
  useBuildStore.setState(s=>({pending:{...s.pending,carryY:top.pos[1]}}))
  b().movePending([0,top.pos[1],0],{partId:'left',index:0})
  b().commitPlace()
  assert.equal(b().bolts.length,2)
  assert.deepEqual(new Set(b().bolts.map(x=>x.bId)),new Set(['left','right']))
  const plan=planAssembly(b().parts,b().bolts)
  assert.equal(plan.groups.length,1)
  assert.equal(plan.groupOf('base'),plan.groupOf(b().selected))
  b().loadBuildFromJSON(b().exportBuildToJSON())
  assert.equal(b().bolts.length,2)
  assert.equal(planAssembly(b().parts,b().bolts).groups.length,1)
})

test('one raised-hole attachment yields a hinge at the raised surface, not the root slab', () => {
  reset([slab('base'),{id:'support',kind:'standoff',hostId:'base',hostHole:2}])
  const node=worldNodes(b().parts.support,b().parts)[0]
  const deck=slab('deck',{y:node.pos[1]+0.045})
  const parts={...b().parts,deck}
  const bolt={id:'raised',aId:'deck',aHole:2,bId:'support',bHole:0}
  const plan=planAssembly(parts,[bolt])
  assert.equal(plan.hinges.length,1)
  vec(Object.values(plan.hinges[0].anchorPart),node.pos)
  assert.equal(boltEndpoints(parts,bolt).b.rootId,'base')
  assert.equal(plan.groups.length,2)
})

test('solid duplicate placements are refused while face-touching flat stacks are allowed', () => {
  reset()
  const first=place('strip5',[0,0,0])
  b().toggleSnap()
  b().beginPlace('strip5'); b().movePending([0,0,0]); b().commitPlace()
  assert.ok(b().pending)
  assert.equal(b().order.length,1)
  b().cancelPlace(); b().toggleSnap()
  const second=place('strip5',[0,0,0])
  assert.equal(b().order.length,2)
  near(second.y-first.y,0.09)
  assert.equal(flatsOverlap(first,second),false)
  assert.equal(b().bolts.length,5)
})

test('flat duplication carries orientation and height with no inherited identity or connections', () => {
  reset([slab('a',{rot:stepWorld(ID,'x'),y:2})])
  b().duplicatePart('a')
  assert.equal(b().pending.rot,b().parts.a.rot)
  near(b().pending.y,2)
  assert.equal(b().pending.from,null)
  assert.equal(b().past.length,0)
  b().movePending([10,0,10]); b().commitPlace()
  assert.notEqual(b().selected,'a')
  assert.equal(b().order.length,2)
  assert.equal(b().bolts.length,0)
  assert.equal(b().wires.length,0)
  assert.equal(b().past.length,1)
  b().undo(); assert.deepEqual(b().order,['a'])
})

test('canceling a pickup restores its leads and bolts exactly', () => {
  b().loadBuildFromJSON(getTemplate('rover').json)
  const original=b().exportBuildToJSON()
  b().pickUpPart('r-sensor')
  assert.equal(b().wires.length,20)
  b().cancelPlace()
  assert.deepEqual(b().exportBuildToJSON(),original)
  assert.equal(b().past.length,0)
})

test('nudge rejects malformed deltas and starts a fresh undo frame after undo', () => {
  reset([slab('a')])
  for(const delta of [null,[0,NaN,0],[1,2],[0,Infinity,0]])b().nudgePart('a',delta)
  assert.equal(b().past.length,0)
  b().nudgePart('a',[PITCH,0,0]); b().nudgePart('a',[PITCH,0,0])
  assert.equal(b().past.length,1)
  near(b().parts.a.pos[0],1)
  b().undo()
  b().nudgePart('a',[0,0.25,0])
  assert.equal(b().past.length,1)
  b().undo(); near(b().parts.a.y,0.045)
})

test('all available sensorModule kinds use centered module bounds and host-relative rise', () => {
  const kinds=Object.entries(PART_SPECS).filter(([,s])=>s.form==='sensorModule').map(([k])=>k)
  assert.equal(kinds.length,6,'Parent must supply the six sensorModule specs')
  for(const kind of kinds) {
    for(let rot=0;rot<ORIENT_COUNT;rot++) {
      const host=slab('host',{kind:'board',rot,y:3})
      const t=chainTransform({id:'sensor',kind,hostId:'host',hostHole:0},{host})
      const base=worldHole(host,0), n=basisY(rot)
      vec(t.pos,base.map((v,i)=>v+n[i]*(halfThickness('board')+0.08)))
      const half=[0.3,0.06,0.2]
      const expected=-Math.max(...half.map((v,i)=>Math.abs(apply(rot,[i===0?v:0,i===1?v:0,i===2?v:0])[1])))
      near(orientedBottom(kind,rot),expected)
    }
  }
})


test('minimal and malformed imported blocks always produce safe editable Arduino code', () => {
  const program = Object.keys(BLOCK_TYPES).map(type => ({ type }))
  program.push({type:'unknown'}, {type:'drive',id:'same',dir:{},speed:Infinity,ms:'oops'},
    {type:'repeat',id:'same',times:-2,body:[{type:'drive'}]},
    {type:'setVar',name:{},op:'; bad code',a:{src:'num',value:Infinity},b:{src:'sensor',pin:NaN}},
    {type:'ifCompare',body:{},elseBody:[null],a:{src:'var',name:{}},op:'unknown'})
  reset([slab('root')],{program})
  const code=toArduinoCode(b().program, b().pinMap())
  assert.ok(code.includes('drive(FORWARD, 200)'))
  assert.ok(!/undefined|NaN|Infinity|bad code|unknown block/.test(code))
  const ids=[]
  const walk=(blocks)=>{ for(const block of blocks) { ids.push(block.id); walk(block.body ?? []); walk(block.elseBody ?? []) } }
  walk(b().program)
  assert.equal(new Set(ids).size,ids.length)
  assert.ok(ids.every(id=>typeof id==='string' && id.length))
  assert.ok(!b().program.some(block=>block.type==='unknown'))
})

test('valid block defaults, nested IDs and finite operands survive import unchanged', () => {
  const program=[{id:'set',type:'setVar',name:'count',a:{src:'sensor',pin:14},op:'+',b:{src:'num',value:2}},
    {id:'repeat',type:'repeat',times:3,body:[{id:'drive',type:'drive',dir:'left',speed:140,ms:1200}]}]
  reset([],{program})
  assert.deepEqual(b().program,program)
  assert.doesNotThrow(()=>toArduinoCode(b().program, b().pinMap()))
})

test('program import caps deeply nested malformed containers', () => {
  let program=[{type:'drive'}]
  for(let i=0;i<100;i++) program=[{type:'forever',body:program}]
  reset([],{program})
  assert.doesNotThrow(()=>toArduinoCode(b().program, b().pinMap()))
})

test('lifting a fitting refreshes its capture height without a mouse event', () => {
  reset([slab('high',{y:5})])
  b().beginPlace('sensor'); b().movePending([0,0.5,0],{partId:'high',index:2})
  assert.equal(b().pending.snap,null)
  for(let i=0;i<12;i++)b().liftPending(1)
  assert.equal(b().pending.snap?.hostId,'high')
})

if (process.argv.includes('--browser')) {
  const { chromium } = await import('playwright')
  const { pathToFileURL } = await import('node:url')
  const path = await import('node:path')
  const { mkdir } = await import('node:fs/promises')
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width:1440, height:960 } })
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  const check=(name,ok)=>{assert.ok(ok,name);passed++;console.log('PASS '+name)}
  try {
    await page.goto(pathToFileURL(path.resolve('dist-single/index.html')).href+'?quality=low')
    await page.waitForFunction(()=>Boolean(window.__ARDUINIUM_BUILD__) && Boolean(window.__ARDUINIUM_SCENE__))
    await page.locator('[data-testid="skip-onboarding"]').first().dispatchEvent('click')
    await page.evaluate(()=>{
      window.__ARDUINIUM_LOAD__({format:'arduinium-build',version:3,parts:[
        {id:'base',kind:'strip11',pos:[0,0,0],y:0.045,rot:0},
        {id:'up',kind:'upright',hostId:'base',hostHole:7}],bolts:[],wires:[],program:[]})
      window.__ARDUINIUM_UI__().soloView()
      window.__ARDUINIUM_BUILD__().beginPlace('sensor')
    })
    await page.waitForTimeout(500)
    const target=await page.evaluate(()=>{
      const node=window.__ARDUINIUM_NODES__('sensor').find(n=>n.partId==='up'&&n.index===2)
      const lift=window.__ARDUINIUM_BUILD__().buildLift()
      return {node,screen:window.__ARDUINIUM_SCENE__().project([node.pos[0],node.pos[1]+lift,node.pos[2]])}
    })
    await page.mouse.move(target.screen.x,target.screen.y)
    for(let i=0;i<4;i++)await page.keyboard.press('e')
    await page.waitForTimeout(150)
    let pending=await page.evaluate(()=>window.__ARDUINIUM_BUILD__().pending)
    check('real E key reprojects the fixed pointer onto a nearby high mount',pending.snap?.hostId==='up'&&pending.snap.index===2)
    check('carry cursor tracks the raised plane without another mouse event',pending.cursor[1]===pending.carryY&&pending.carryY===1)
    for(let i=0;i<3;i++)await page.keyboard.press('r')
    await page.waitForTimeout(100)
    pending=await page.evaluate(()=>window.__ARDUINIUM_BUILD__().pending)
    await page.mouse.click(target.screen.x,target.screen.y)
    const placed=await page.evaluate(()=>{
      const b=window.__ARDUINIUM_BUILD__()
      return {pending:b.pending,part:b.parts[b.selected],transform:window.__ARDUINIUM_XFORM__(b.selected)}
    })
    check('real mouse commit preserves high mount preview spin and transform',!placed.pending&&placed.part.spin===3&&placed.transform.orient===pending.snap.orient)
    vec(placed.transform.pos,[pending.pos[0],pending.y,pending.pos[2]])
    await page.evaluate((id)=>{
      window.__ARDUINIUM_BUILD__().deletePart(id)
      window.__ARDUINIUM_BUILD__().beginPlace('strip5')
    },placed.part.id)
    await page.waitForTimeout(200)
    await page.mouse.move(target.screen.x+1,target.screen.y)
    for(let i=0;i<6;i++)await page.keyboard.press('e')
    await page.waitForTimeout(150)
    pending=await page.evaluate(()=>window.__ARDUINIUM_BUILD__().pending)
    check('raised flat pointer hint resolves after six real height steps',pending.snap?.hostId==='up'&&pending.snap.index===2)
    check('raised flat preview rests outside the support surface',Math.abs(pending.y-target.node.pos[1]-0.045)<1e-8)
    await page.mouse.click(target.screen.x+1,target.screen.y)
    const flat=await page.evaluate(()=>{
      const b=window.__ARDUINIUM_BUILD__()
      return {pending:b.pending,bolts:b.bolts,parts:b.parts}
    })
    check('real raised slab placement records its physical support bolt',!flat.pending&&flat.bolts.some(x=>x.bId==='up'&&x.bHole===2))
    assert.equal(planAssembly(flat.parts,flat.bolts).hinges.length,1)
    await mkdir('shots',{recursive:true})
    await page.screenshot({path:'shots/core-high-node.png'})
    check('high-node placement emits no browser errors',errors.length===0)
  } catch(error) {failed++;console.error('FAIL browser core pointer path\n'+error.stack)}
  finally {await browser.close()}
}
console.log('\n'+passed+'/'+(passed+failed)+' core checks passed')
process.exitCode=failed?1:0
