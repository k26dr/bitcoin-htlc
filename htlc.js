const bitcoin = require('bitcoinjs-lib') 
const crypto = require('crypto');
const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const ECPair = ECPairFactory(ecc);


const HTLC_EXPIRATION = 86400

module.exports = {
  getPubKeyHash,
  getWitnessScript,
  createHTLC, 
  redeemHTLC,
  refundHTLC
}

function getPubKeyHash(address) {
   return bitcoin.address.fromBech32(address).data;
}

function getWitnessScript(recipientAddress, refundAddress, contractHash, expiration) {
  const recipientPubKeyHash = getPubKeyHash(recipientAddress)
  const refundPubKeyHash = getPubKeyHash(refundAddress)
  const OPS = bitcoin.script.OPS;

  // See https://en.bitcoin.it/wiki/BIP_0199 for full BIP-199 spec
  const script = bitcoin.script.compile([
      OPS.OP_IF,
      OPS.OP_SHA256,
      contractHash,
      OPS.OP_EQUALVERIFY,
      OPS.OP_DUP,
      OPS.OP_HASH160,
      recipientPubKeyHash,
      OPS.OP_ELSE,
      bitcoin.script.number.encode(expiration),
      OPS.OP_CHECKLOCKTIMEVERIFY,
      OPS.OP_DROP,
      OPS.OP_DUP,
      OPS.OP_HASH160,
      refundPubKeyHash,
      OPS.OP_ENDIF,
      OPS.OP_EQUALVERIFY,
      OPS.OP_CHECKSIG,
  ]);
  
  return script
}

/*
 * @param {Object} options
 * @param {String} options.recipientAddress: the address with the right to unlock the HTLC with the preimage
 * @param {String} options.refundAddress: the address to refund the HTLC to if remains unclaimed after the expiration
 * @param {String} options.expiration (optional): defaults to 1 day after the time of the function call. pass in a UNIX timestamp in seconds if you want a custom expiry.
 * @param {String} options.network (optional): 'regtest' (default) || 'testnet' || 'bitcoin'. Will add support for litecoin and other non-bitcoin chains later
 * @param {String} options.hash (optional): if you're in charge of producing the hash for your swap, leave this blank and we will generate one
 *       if your counterparty gave you one, pass it in as a hex string here
 * 
 * @returns {Object} swapParams
 *      @return swapParams.recipientAddress
 *      @return swapParams.refundAddress
 *      @return swapParams.preimage
 *      @return swapParams.contractHash
 *      @return swapParams.expiration     UNIX timestamp
 *      @return swapParams.network        'regtest' | 'testnet' | 'bitcoin'
 *      @return swapParams.addressType    'p2wsh'
 *      @return swapParams.witnessScript  you will need this to unlock the HTLC
 *      @return swapParams.htlcAddress    send coins to this address to lock them
 */
function createHTLC(options) {
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

  const script = getWitnessScript(swapParams.recipientAddress, swapParams.refundAddress, hash, swapParams.expiration)

  const p2wsh = bitcoin.payments.p2wsh({
      redeem: { output: script, network: network },
      network: network 
  });
  swapParams.witnessScript = script.toString('hex')
  swapParams.htlcAddress = p2wsh.address

  return swapParams
}


/**
 * Produces a raw transaction to redeem an existing HTLC
 * @param {Object} options
 * @param {String} options.preimage       Required to unlock HTLC. Must be in HEX format.
 * @param {String} options.recipientWIF   Private key of recipient address in WIF format
 * @param {String} options.witnessScript  Witness script for HTLC in hex format. If you used createHTLC, you can grab it from there, or you will have to ask your counterparty for it.
 * @param {String} options.txHash         Transacion hash with the HTLC output you want to unlock
 * @param {Number} options.value          The number of sats locked in the HTLC. IMPORTANT: If you send too low a number, the remainder of your sats will be burned. Proceed with caution. Test your code on regtest before using it in production.
 * @param {Number} options.feeRate        Fee rate in sat/vB. Must be provided manually because there's no RPC connection built into the library. 
 * @param {Number} options.vout           The index number of the UTXO in txHash to use. 
 * @return {String}                       Raw redeem transaction to broadcast to network. send it with `bitcoin-cli sendrawtransaction <transaction>`
*/
function redeemHTLC(options) {
  const recipientKeypair = ECPair.fromWIF(options.recipientWIF)
  const recipientAddress = bitcoin.payments.p2wpkh({
      pubkey: recipientKeypair.publicKey,
      network: bitcoin.networks[options.network],
  }).address;

  // This is equivaluent to OP_0 OP_20 WITNESS_SCRIPT_HASH
  const witnessScript = Buffer.from(options.witnessScript, 'hex')
  const witnessScriptHash = bitcoin.crypto.sha256(witnessScript)
  const witnessUtxoScript = Buffer.concat([Buffer.from([0x00, 0x20]), witnessScriptHash])

  // Segwit transactions require you to use Psbt to sign (afaik)
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks[options.network] })
  psbt.addInput({
    hash: options.txHash,
    index: options.vout, 
    witnessScript: Buffer.from(options.witnessScript, 'hex'),
    witnessUtxo: {
      script: witnessUtxoScript,
      value: options.value
    }
  })
  const txFee = options.feeRate * 320;
  psbt.addOutput({
    address: recipientAddress,
    value: (options.value - txFee),
  })

  psbt.signInput(0, recipientKeypair)

  const sig = psbt.data.inputs[0].partialSig[0].signature

  const witnessStack = [
    sig,
    recipientKeypair.publicKey,
    Buffer.from(options.preimage, 'hex'),
    Buffer.from([0x01]), // Segwit OP_TRUE is 0x01
    witnessScript
  ]

  // serialize witness
  let finalScriptWitness = Buffer.from([0x05]) // 1-byte: Number of items
  for (let i=0; i < 5; i++) {
    finalScriptWitness = Buffer.concat([ finalScriptWitness, new Uint8Array([witnessStack[i].length]), witnessStack[i] ])
  }

  psbt.updateInput(0, { finalScriptWitness })

  return psbt.extractTransaction().toHex()
}
  
/**
 * Produces a raw transaction to redeem an existing HTLC
 * @param {Object} options
 * @param {String} options.refundWIF      Private key of refund address in WIF format
 * @param {String} options.witnessScript  Witness script for HTLC in hex format. If you used createHTLC, you can grab it from there, or you will have to ask your counterparty for it.
 * @param {String} options.txHash         Transacion hash with the HTLC output you want to unlock
 * @param {Number} options.value          The number of sats locked in the HTLC. IMPORTANT: If you send too low a number, the remainder of your sats will be burned. Proceed with caution. Test your code on regtest before using it in production.
 * @param {Number} options.feeRate        Fee rate in sat/vB. Must be provided manually because there's no RPC connection built into the library. 
 * @param {Number} options.vout           The index number of the UTXO in txHash to use. 
 * @return {String}                       Raw refund transaction to broadcast to network. send it with `bitcoin-cli sendrawtransaction <transaction>`
*/
function refundHTLC(options) {
  const refundKeypair = ECPair.fromWIF(options.refundWIF)
  const refundAddress = bitcoin.payments.p2wpkh({
      pubkey: refundKeypair.publicKey,
      network: bitcoin.networks[options.network],
  }).address;

  // This is equivaluent to OP_0 OP_20 WITNESS_SCRIPT_HASH
  const witnessScript = Buffer.from(options.witnessScript, 'hex')
  const witnessScriptHash = bitcoin.crypto.sha256(witnessScript)
  const witnessUtxoScript = Buffer.concat([Buffer.from([0x00, 0x20]), witnessScriptHash])

  // Segwit transactions require you to use Psbt to sign (afaik)
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks[options.network] })
  psbt.addInput({
    hash: options.txHash,
    index: options.vout, 
    witnessScript: Buffer.from(options.witnessScript, 'hex'),
    witnessUtxo: {
      script: witnessUtxoScript,
      value: options.value
    }
  })
  const txFee = options.feeRate * 320;
  psbt.addOutput({
    address: refundAddress,
    value: (options.value - txFee),
  })

  psbt.signInput(0, refundKeypair)

  const sig = psbt.data.inputs[0].partialSig[0].signature

  const witnessStack = [
    sig,
    refundKeypair.publicKey,
    Buffer.from([]), // Segwit OP_FALSE is minimal, meaning no data is included
    witnessScript
  ]

  // serialize witness
  let finalScriptWitness = Buffer.from([0x04]) // 1-byte: Number of items
  for (let i=0; i < 4; i++) {
    finalScriptWitness = Buffer.concat([ finalScriptWitness, new Uint8Array([witnessStack[i].length]), witnessStack[i] ])
  }

  psbt.updateInput(0, { finalScriptWitness })

  return psbt.extractTransaction().toHex()
}
