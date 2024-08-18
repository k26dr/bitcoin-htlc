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
  console.log(htlcTx.outs[vout].script.toString('hex'))
  const value = htlcTx.outs[vout].value

  // This is equivaluent to OP_0 OP_20 WITNESS_SCRIPT_HASH
  const witnessUtxoScript = Buffer.from('0020' + swapParams.witnessScript, 'hex')


  const psbt = new bitcoin.Transaction({ network: bitcoin.networks[swapParams.network] })
  psbt.addInput({
    hash: txHash,
    index: vout, 
    witnessUtxo: {
      script: witnessUtxoScript,
      value
    },
    witnessScript: Buffer.from(swapParams.witnessScript, 'hex')
  })
  const txFee = 2000;
  psbt.addOutput({
    address: swapParams.recipientAddress,
    value: (value - txFee),
  })

  const signer = ECPair.fromWIF(swapParams.recipientPrivateWIF)
  psbt.signInput(0, signer)


}
