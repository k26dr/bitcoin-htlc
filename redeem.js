// Credit to Eunovo for a lot of the help here: 
// https://github.com/Eunovo/scripting-with-bitcoinjs/blob/main/src/pay_to_address_with_secret.ts

const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const bitcoin = require('bitcoinjs-lib')
const fs = require('fs')
const { promisify } = require('util');
const exec = promisify(require('child_process').exec)
const varuint = require("varuint-bitcoin")

const ECPair = ECPairFactory(ecc);

const swapParams = JSON.parse(fs.readFileSync("data.json", "utf8"))

const txHash = process.argv[2]
const vout = Number(process.argv[3]) || 0

const input = {
  hash: txHash,
  index: vout,
  sequence: 0,
}

constructRedeemTx()
async function constructRedeemTx () {
  const getTransactionResponse = await exec('bitcoin-core.cli -regtest gettransaction ' + txHash)
  const rawTx = JSON.parse(getTransactionResponse.stdout).hex
  const htlcTx = bitcoin.Transaction.fromHex(rawTx)
  const value = htlcTx.outs[vout].value

  // This is equivaluent to OP_0 OP_20 WITNESS_SCRIPT_HASH
  const witnessScript = Buffer.from(swapParams.witnessScript, 'hex')
  const witnessScriptHash = bitcoin.crypto.sha256(witnessScript)
  const witnessUtxoScript = Buffer.concat([Buffer.from([0x00, 0x20]), witnessScriptHash])

  // Segwit transactions require you to use Psbt to sign (afaik)
  const psbt = new bitcoin.Psbt({ network: bitcoin.networks[swapParams.network] })
  psbt.addInput({
    hash: txHash,
    index: vout, 
    witnessScript: Buffer.from(swapParams.witnessScript, 'hex'),
    witnessUtxo: {
      script: witnessUtxoScript,
      value
    }
  })
  const txFee = 2000;
  psbt.addOutput({
    address: swapParams.recipientAddress,
    value: (value - txFee),
  })

  const recipientKeypair = ECPair.fromWIF(swapParams.recipientPrivateWIF)
  psbt.signInput(0, recipientKeypair)

  const sig = psbt.data.inputs[0].partialSig[0].signature
  
  const witnessStack = [
    sig,
    recipientKeypair.publicKey,
    Buffer.from(swapParams.preimage, 'hex'),
    Buffer.from([0x01]), // Segwit OP_TRUE is 0x01
    witnessScript
  ]

  // serialize witness
  let finalScriptWitness = Buffer.from([0x05]) // 1-byte: Number of items
  for (let i=0; i < 5; i++) {
    finalScriptWitness = Buffer.concat([ finalScriptWitness, new Uint8Array([witnessStack[i].length]), witnessStack[i] ])
  }
  
  psbt.updateInput(0, { finalScriptWitness })

  const tx = psbt.extractTransaction();
  console.log(tx.toHex())
}
