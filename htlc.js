const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const bitcoin = require('bitcoinjs-lib') 
const crypto = require('crypto');
const fs = require('fs')

const ECPair = ECPairFactory(ecc);

// SETTINGS: MODIFY AS NEEDED
// It sets the HTLC expiration to a specified number of seconds in the future
// Default: 1 day
const HTLC_EXPIRATION = 86400
const NETWORK = 'regtest'

function getPubKeyHash(address) {
   return bitcoin.address.fromBech32(address).data;
}

// Preimage for HTLC. Must be unique every time. 
const preimage = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
const hash = crypto.createHash('sha256').update(preimage).digest()

// Generate keys
const recipientKeyPair = ECPair.makeRandom({ network: bitcoin.networks[NETWORK] })
const refundKeyPair = ECPair.makeRandom({ network: bitcoin.networks[NETWORK] })

const swapParams = {
  recipientPrivateWIF: recipientKeyPair.toWIF(),
  recipientAddress: bitcoin.payments.p2wpkh({ pubkey: recipientKeyPair.publicKey }).address,
  refundPrivateWIF: refundKeyPair.toWIF(),
  refundAddress: bitcoin.payments.p2wpkh({ pubkey: refundKeyPair.publicKey }).address,
  preimage: preimage.toString('hex'),
  contractHash: hash.toString('hex'),
  expiration: (Date.now() / 1000 | 0) + HTLC_EXPIRATION,
  network: NETWORK,
  addressType: 'p2wsh'
}

// Network for transaction: bitcoin, regtest, or testnet
const network = bitcoin.networks[swapParams.network]

const recipientPubKeyHash = getPubKeyHash(swapParams.recipientAddress)
const refundPubKeyHash = getPubKeyHash(swapParams.refundAddress)
const OPS = bitcoin.script.OPS;

const script = bitcoin.script.compile([
    OPS.OP_IF,
    OPS.OP_SIZE,
    bitcoin.script.number.encode(32),
    OPS.OP_EQUALVERIFY,
    OPS.OP_SHA256,
    hash,
    OPS.OP_EQUALVERIFY,
    OPS.OP_DUP,
    OPS.OP_HASH160,
    recipientPubKeyHash,
    OPS.OP_ELSE,
    bitcoin.script.number.encode(swapParams.expiration),
    OPS.OP_CHECKLOCKTIMEVERIFY,
    OPS.OP_DROP,
    OPS.OP_DUP,
    OPS.OP_HASH160,
    refundPubKeyHash,
    OPS.OP_ENDIF,
    OPS.OP_EQUALVERIFY,
    OPS.OP_CHECKSIG,
]);

if (![97, 98].includes(Buffer.byteLength(script))) {
    throw new Error('Invalid swap script');
}

const p2wsh = bitcoin.payments.p2wsh({
    redeem: { output: script, network: network },
    network: network 
});
swapParams.witnessScript = script.toString('hex')
swapParams.htlcAddress = p2wsh.address
console.log(swapParams)
fs.writeFileSync("data.json", JSON.stringify(swapParams, null, 2))
