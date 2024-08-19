const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const ECPair = ECPairFactory(ecc);
const { createHTLC, redeemHTLC, refundHTLC } = require('./htlc')

// Generate keypairs
const recipientKeypair = ECPair.makeRandom()
const refundKeypair = ECPair.makeRandom()

// Create HTLC
const htlc = createHTLC({
  recipientAddress: 'bcrt1qfjwqqxmf6ajmwy48pzs7ml33udt0smhdc8seya',
  refundAddress: 'bcrt1q2yuazzncplkcexkzcayj886eugkttwxefvwvm3'
})
console.log(htlc)

// Create HTLC with custom expiration and hash on mainnet
const htlc2 = createHTLC({
  recipientAddress: 'bcrt1qfjwqqxmf6ajmwy48pzs7ml33udt0smhdc8seya',
  refundAddress: 'bcrt1q2yuazzncplkcexkzcayj886eugkttwxefvwvm3',
  hash: "368278313373e68a55c8361623fc06e1fa6c8251c90348fccac939879257144d",
  network: 'bitcoin',
  expiration: (Date.now() / 1000 | 0) + 3600, // 1 hour
})
console.log(htlc2)

// TODO: Redeem HTLC
