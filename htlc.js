const bitcoin = require('bitcoinjs-lib') 
const crypto = require('crypto');

const HTLC_EXPIRATION = 86400

function getPubKeyHash(address) {
   return bitcoin.address.fromBech32(address).data;
}

// options:
//  recipientAddress: the address with the right to unlock the HTLC with the preimage
//  refundAddress: the address to refund the HTLC to if remains unclaimed after the expiration
//  expiration (optional): defaults to 1 day after the time of the function call. pass in a UNIX timestamp in seconds if you want a custom expiry.
//  network (optional): 'regtest' (default) || 'testnet' || 'bitcoin'
//     will add support for litecoin and other non-bitcoin chains later
//  hash (optional): if you're in charge of producing the hash for your swap, leave this blank and we will generate one
//     if your counterparty gave you one, pass it in as a hex string here
function createHTLCAddress(options) {
  const NETWORK = options.network || 'regtest'

  // Preimage for HTLC. Must be unique every time. If a hash is specified, the counterparty has the preimage and this field can be left null
  const preimage = options.hash ? Buffer.alloc(0) : Buffer.from(crypto.getRandomValues(new Uint8Array(32))) 

  // if a hash is specified use that. otherwise generate one and return the hash + preimage
  const hash = options.hash ? Buffer.from(options.hash, 'hex') : bitcoin.crypto.sha256(preimage)

  const swapParams = {
    recipientAddress: options.recipientAddress,
    refundAddress: options.refundAddress,
    preimage: preimage.toString('hex'),
    contractHash: hash.toString('hex'),
    expiration: options.expiration || (Date.now() / 1000 | 0) + HTLC_EXPIRATION,
    network: NETWORK,
    addressType: 'p2wsh'
  }

  // Network for transaction: bitcoin, regtest, or testnet
  const network = bitcoin.networks[swapParams.network]

  const recipientPubKeyHash = getPubKeyHash(swapParams.recipientAddress)
  const refundPubKeyHash = getPubKeyHash(swapParams.refundAddress)
  const OPS = bitcoin.script.OPS;


  // See https://en.bitcoin.it/wiki/BIP_0199 for full BIP-199 spec
  const script = bitcoin.script.compile([
      OPS.OP_IF,
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

  const p2wsh = bitcoin.payments.p2wsh({
      redeem: { output: script, network: network },
      network: network 
  });
  swapParams.witnessScript = script.toString('hex')
  swapParams.htlcAddress = p2wsh.address

  return swapParams
}

