const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const ECPair = ECPairFactory(ecc);

// Generate keypairs
const recipientKeypair = ECPair.makeRandom()
const refundKeypair = ECPair.makeRandom()

// Create HTLC
const htlc = createHTLCAddress({
  recipientAddress: 'bcrt1qfjwqqxmf6ajmwy48pzs7ml33udt0smhdc8seya',
  refundAddress: 'bcrt1q2yuazzncplkcexkzcayj886eugkttwxefvwvm3'
})
console.log(htlc)

// Redeem HTLC
