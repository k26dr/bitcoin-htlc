const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const ECPair = ECPairFactory(ecc);
const { createHTLC, redeemHTLC, refundHTLC } = require('./htlc')
const bitcoin = require('bitcoinjs-lib')
const { Command } = require('commander');
const program = new Command();
const fs = require('fs')

program
  .name('bitcoin-htlc')
  .description('BIP-199 and atomic swap helpers for Node.js')
  .version('1.0.7');

program.command('rescuehtlc')
  .description("Did you lose your HTLC data? If you're lucky we stored a backup. Give it a shot.")
  .argument('<htlcAddress>', 'the hash you want to retrieve the preimage for in HEX format')
  .action(htlcAddress => {
    const file = fs.readFileSync('.htlc.backup', 'utf8')
    const htlcs = []
    for (let line of file.split('\n')) {
      htlcs[line.split(' ')[0]] = line
    }
    if (!htlcs[htlcAddress]) {
      console.log("No HTLC found")
      return
    }
    const htlc = JSON.parse(htlcs[htlcAddress].split(' ')[1])
    console.log(htlc)
  });

program.command('refundscript')
  .description('Use this to generate the refund script if you lost your HTLC info')
  .argument('<hash>', 'HTLC contract hash')
  .argument('<recipientAddress>', 'bech32 address of recipient')
  .argument('<refundAddress>', 'bech32 address for refund if HTLC expires')
  .action((hash, recipientAddress, refundAddress) => {
    getWitnessScript(recipientAddress, refundAddress, hash, expiration)
  });

program.command('createkeypair')
  .description('Create a keypair')
  .option('--network <network>', 'regtest|testnet|bitcoin', 'bitcoin')
  .action(options => {
    const keypair = ECPair.makeRandom()
    const address = bitcoin.payments.p2wpkh({
        pubkey: keypair.publicKey,
        network: bitcoin.networks[options.network]
    }).address;
    console.log("Private Key (WIF):", keypair.toWIF())
    console.log("Address (bech32):", address)
  });

program.command('createhtlc')
  .description('Create an HTLC')
  .argument('<recipientAddress>', 'bech32 address of recipient')
  .argument('<refundAddress>', 'bech32 address for refund if HTLC expires')
  .option('--network <network>', 'regtest|testnet|bitcoin', 'bitcoin')
  .option('--hash <hash>', 'custom hash to lock HTLC. hash and preimage are generated if not provided.')
  .option('--expiration <expires>', 'UNIX timestamp to expire the HTLC. defaults to 1 day ahead of current time.')
  .action((recipientAddress, refundAddress, options) => {
    const htlc = createHTLC({
      recipientAddress,
      refundAddress,
      ...options
    })

    // Save a backup of all HTLCs
    const line = htlc.htlcAddress + ' ' + JSON.stringify(htlc) + '\n'
    fs.appendFileSync('.htlc.backup', line)

    console.log(htlc)
  });

program.command('redeemhtlc')
  .description('Get a raw transaction hex to redeem an HTLC')
  .argument('<txhash>', 'Transacion hash with the HTLC output you want to unlock')
  .argument('<vout>', 'Index of the output you want to unlock in <txhash>')
  .requiredOption('--valueBTC <valueBTC>', "value of the HTLC you're looking to unlock in BTC")
  .requiredOption('--preimage <preimage>', 'preimage to unlock htlc in HEX format')
  .requiredOption('--recipientWIF <recipientWIF>', 'private key of recipient address in WIF format')
  .requiredOption('--witnessScript <witnessScript>', 'Witness script for HTLC in hex format')
  .requiredOption('--feeRate <feeRate>', 'Fee rate in sat/vB')
  .option('--network <network>', 'regtest|testnet|bitcoin', 'bitcoin')
  .action((txhash, vout, options) => {
    const value = Number(options.valueBTC * 1e8)
    if (isNaN(value)) {
      console.log("bad input for <value>")
      return
    }
    const rawTx = redeemHTLC({
      txHash: txhash,
      vout: Number(vout),
      ...options,
      feeRate: Number(options.feeRate),
      value
    })
    console.log(rawTx)
  });

program.command('refundhtlc')
  .description('Get a raw transaction hex to refund an HTLC')
  .argument('<txhash>', 'Transacion hash with the HTLC output you want to unlock')
  .argument('<vout>', 'Index of the output you want to unlock in <txhash>')
  .requiredOption('--valueBTC <valueBTC>', "value of the HTLC you're looking to unlock in BTC")
  .requiredOption('--refundWIF <refundWIF>', 'private key of recipient address in WIF format')
  .requiredOption('--witnessScript <witnessScript>', 'Witness script for HTLC in hex format')
  .requiredOption('--feeRate <feeRate>', 'Fee rate in sat/vB')
  .option('--network <network>', 'regtest|testnet|bitcoin', 'bitcoin')
  .action((txhash, vout, options) => {
    const value = Number(options.valueBTC * 1e8)
    if (isNaN(value)) {
      console.log("bad input for <value>")
      return
    }
    const rawTx = refundHTLC({
      txHash: txhash,
      vout: Number(vout),
      ...options,
      feeRate: Number(options.feeRate),
      value
    })
    console.log(rawTx)
  });

program.parse();
