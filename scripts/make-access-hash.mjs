#!/usr/bin/env node
// Compute the ACCESS_CODE_HASH that the Edge Function checks against.
// The plaintext code is never stored anywhere — only this HMAC is.
//
// Usage:
//   node scripts/make-access-hash.mjs "<your-team-access-code>" "<your-pepper>"
//
// Then set as Edge Function secrets:
//   ACCESS_CODE_HASH = <the printed hash>
//   ACCESS_CODE_PEPPER = <the same pepper>   (reuse your Task Hub pepper if you like)
//
// Give the plaintext code to the team; they type it once in the web app.

import { createHmac, randomBytes } from 'node:crypto'

const [, , code, pepperArg] = process.argv
if (!code) {
  console.error('Usage: node scripts/make-access-hash.mjs "<code>" "<pepper>"')
  process.exit(1)
}
const pepper = pepperArg || randomBytes(24).toString('hex')
const hash = createHmac('sha256', pepper).update(code).digest('hex')

console.log('\nACCESS_CODE_HASH   =', hash)
console.log('ACCESS_CODE_PEPPER =', pepper)
if (!pepperArg) console.log('\n(No pepper supplied — generated one above. Back it up: losing it invalidates the code.)')
console.log()
