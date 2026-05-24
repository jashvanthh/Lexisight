/**
 * Deploy Convex functions to the deployment matching VITE_CONVEX_URL in .env
 * Requires: npx convex login (once), then npm run convex:deploy
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const path = join(root, name)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      const key = m[1]
      let val = m[2].trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] == null) process.env[key] = val
    }
  }
}

loadEnv()

const url = process.env.VITE_CONVEX_URL || ''
const host = url.replace(/^https?:\/\//, '').replace(/\.convex\.cloud\/?$/, '')
if (!host) {
  console.error('Missing VITE_CONVEX_URL in .env')
  process.exit(1)
}

if (!process.env.CONVEX_DEPLOYMENT) {
  process.env.CONVEX_DEPLOYMENT = `prod:${host}`
}

console.log(`Deploying Convex to ${process.env.CONVEX_DEPLOYMENT} …`)

const r = spawnSync('npx', ['convex', 'deploy', '--yes'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

if (r.status !== 0) {
  console.error('\nDeploy failed. Run: npx convex login')
  console.error('Then: npm run convex:deploy')
  process.exit(r.status ?? 1)
}

console.log('\nConvex deploy complete. Feedback API is live.')
