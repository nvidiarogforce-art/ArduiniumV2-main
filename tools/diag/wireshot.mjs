import { chromium } from 'playwright'
import path from 'node:path'
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']})
const p = await b.newPage({viewport:{width:1500,height:950}})
await p.goto('file://'+path.resolve('dist-single/index.html')+'?quality=high',{waitUntil:'load'})
await p.waitForSelector('canvas'); await p.waitForTimeout(2500)
const tap = async (s)=>{await p.locator(s).first().dispatchEvent('click'); await p.waitForTimeout(400)}
await tap('[data-testid="skip-onboarding"]')
await tap('[data-testid="templates"]'); await tap('[data-template="rover"]')
await p.waitForTimeout(1400)
await tap('[data-testid="wire-mode"]')          // show the terminal spheres
for (const d of ['left','right','bottom']) {
  const h=p.locator(`[data-drawer-toggle="${d}"]`); if(await h.count()) await h.first().dispatchEvent('click')
}
await p.waitForTimeout(500)
await p.locator('button:has-text("Side")').first().dispatchEvent('click')
await p.waitForTimeout(2500)
await p.screenshot({path:'shots/diag-wire-side.png'})
await p.locator('button:has-text("Top")').first().dispatchEvent('click')
await p.waitForTimeout(2500)
await p.screenshot({path:'shots/diag-wire-top.png'})
console.log('OK')
await b.close()
