const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const ECPair = ECPairFactory(ecc);
const { createHTLC, redeemHTLC, refundHTLC } = require('./htlc')
const bitcoin = require('bitcoinjs-lib')

// Generate keypairs
const recipientKeypair = ECPair.makeRandom()
const refundKeypair = ECPair.makeRandom()
const recipientAddress = bitcoin.payments.p2wpkh({
    pubkey: recipientKeypair.publicKey,
    network: bitcoin.networks.regtest,
}).address;
const refundAddress = bitcoin.payments.p2wpkh({
    pubkey: recipientKeypair.publicKey,
    network: bitcoin.networks.regtest,
}).address;

// Create HTLC
const htlc = createHTLC({
  recipientAddress,
  refundAddress,
})
console.log(htlc)

// Create HTLC with custom expiration and hash on mainnet
const htlc2 = createHTLC({
  recipientAddress,
  refundAddress,
  hash: "368278313373e68a55c8361623fc06e1fa6c8251c90348fccac939879257144d",
  network: 'bitcoin',
  expiration: (Date.now() / 1000 | 0) + 3600, // 1 hour
})
console.log(htlc2)

// Redeem HTLC
// This is a dummy redeem. It won't actually clear consensus if you try and send it with `bitcoin-core.cli sendrawtransaction` but it's here as a code example.
const TXID = "2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62"
const value = 1e8
const vout = 0
const redeemTxRaw = redeemHTLC({
  preimage: htlc.preimage,
  recipientWIF: recipientKeypair.toWIF(),
  witnessScript: htlc.witnessScript,
  txHash: TXID,
  value,
  feeRate: 10,
  vout
})
console.log(redeemTxRaw)
