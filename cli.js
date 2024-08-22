const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const ECPair = ECPairFactory(ecc);
const { createHTLC, redeemHTLC, refundHTLC } = require('./htlc')
const bitcoin = require('bitcoinjs-lib')
const { Command } = require('commander');
const program = new Command();

program
  .name('bitcoin-htlc')
  .description('BIP-199 and atomic swap helpers for Node.js')
  .version('1.0.7');

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
    console.log(htlc)
  });

program.command('redeemhtlc')
  .description('Redeem an HTLC')
  .argument('<txhash>', 'Transacion hash with the HTLC output you want to unlock')
  .argument('<vout>', 'Index of the output you want to unlock in <txhash>')
  .requiredOption('--valueBTC <valueBTC>', "value of the HTLC you're looking to unlock in BTC")
  .requiredOption('--preimage <preimage>', 'preimage to unlock htlc')
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
    const htlc = redeemHTLC({
      txHash: txhash,
      vout: Number(vout),
      ...options,
      feeRate: Number(options.feeRate),
      value
    })
    console.log(htlc)
  });

program.parse();
