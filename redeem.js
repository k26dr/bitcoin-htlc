// TODO: Add some fee logic

const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const bitcoin = require('bitcoinjs-lib')
const ECPair = ECPairFactory(ecc);

/**
 * Produces a raw transaction to redeem an existing HTLC
 * @param {Object} options
 * @param {String} options.preimage       Required to unlock HTLC. Must be in HEX format.
 * @param {String} options.recipientWIF   Private key of recipient address in WIF format
 * @param {String} options.recipientAddress   Public address of recipient
 * @param {String} options.witnessScript  Witness script for HTLC in hex format. If you used createHTLC, you can grab it from there, or you will have to ask your counterparty for it.
 * @param {String} options.txHash         Transacion hash with the HTLC output you want to unlock
 * @param {Number} options.value          The number of sats locked in the HTLC. IMPORTANT: If you send too low a number, the remainder of your sats will be burned. Proceed with caution. Test your code on regtest before using it in production.
 * @param {Number} options.vout           (optional)(default: 0): the index number of the UTXO in txHash to use. will default to the first output. Specify an index number if you want to use a different output. 
 * @return {String}               Raw redeem transaction to broadcast to network. send it with `bitcoin-cli sendrawtransaction <transaction>`
*/
function redeemHTLC(options) {
  const vout = options.vout || 0
  const recipientKeypair = ECPair.fromWIF(options.recipientWIF)

  // This is equivaluent to OP_0 OP_20 WITNESS_SCRIPT_HASH
  const witnessScript = Buffer.from(options.witnessScript, 'hex')
  const witnessScriptHash = bitcoin.crypto.sha256(witnessScript)
  const witnessUtxoScript = Buffer.concat([Buffer.from([0x00, 0x20]), witnessScriptHash])

  // Segwit transactions require you to use Psbt to sign (afaik)
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks[options.network] })
  psbt.addInput({
    hash: options.txHash,
    index: vout, 
    witnessScript: Buffer.from(options.witnessScript, 'hex'),
    witnessUtxo: {
      script: witnessUtxoScript,
      value
    }
  })
  const txFee = 2000;
  psbt.addOutput({
    address: options.recipientAddress,
    value: (value - txFee),
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
  
