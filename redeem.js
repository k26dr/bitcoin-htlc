const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const bitcoin = require('bitcoinjs-lib')
const fs = require('fs')
const { promisify } = require('util');
const exec = promisify(require('child_process').exec)

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
  const witnessScriptHash = bitcoin.crypto.sha256(Buffer.from(swapParams.witnessScript, 'hex'))
  const witnessUtxoScript = Buffer.concat([Buffer.from([0x00, 0x20]), witnessScriptHash])

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
  
  const OPS = bitcoin.script.OPS
  const swapInput = bitcoin.script.compile([
    sig,
    recipientKeypair.publicKey,
    Buffer.from(swapParams.preimage, 'hex'),
    OPS.OP_TRUE
  ])

  //const finalizeInput = (_inputIndex, input) => {
  //  const redeemPayment = payments.p2wsh({
  //      redeem: {
  //        input: bitcoin.script.compile([

  //        ]),
  //        output: input.witnessScript
  //      }
  //    });

  //    const finalScriptWitness = witnessStackToScriptWitness(
  //      redeemPayment.witness ?? []
  //    );

  //    return {
  //      finalScriptSig: Buffer.from(""),
  //      finalScriptWitness
  //    }
  //}

}
