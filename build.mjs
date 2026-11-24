js
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

// Fix: typing lost focus after one letter because the Credit App sections
// were rebuilt on every keystroke. Calling them as plain functions fixes it.
const original = fs.readFileSync('public/App.jsx', 'utf8')
let fixes = 0
const patched = original
  .replace(/<ApplicantSection\s+data=\{primary\}[\s\S]*?\/>/, () => {
    fixes++
    return '{ApplicantSection({data:primary,onChange:makeHandler(setPrimary),prefix:"pri",label:hasCosigner?(isBiz?"Authorized Signer / Primary":"Primary Applicant"):null,SHfn:SHP})}'
  })
  .replace(/<ApplicantSection\s+data=\{cosigner\}[\s\S]*?\/>/, () => {
    fixes++
    return 'ApplicantSection({data:cosigner,onChange:makeHandler(setCosigner),prefix:"co",label:"Co-Signer",SHfn:SHC})'
  })

if (fixes < 2 && !original.includes('ApplicantSection({data:primary')) {
  throw new Error(`Typing fix not applied (${fixes} of 2 spots found). Build stopped so the live site stays as it is.`)
}

const patchPlugin = {
  name: 'patch-app',
  setup(b) {
    b.onLoad({ filter: /public[\\/]App\.jsx$/ }, () => ({
      contents: patched,
      loader: 'jsx',
      resolveDir: path.resolve('public'),
    }))
  },
}

await build({
  entryPoints: ['entry.jsx'],
  bundle: true,
  minify: true,
  format: 'esm',
  jsx: 'automatic',
  outfile: 'public/assets/index-D_B0QEj0.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [patchPlugin],
})
console.log('Site built.')
