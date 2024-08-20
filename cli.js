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
  .option('-n', '--network <network>', 'regtest|testnet|bitcoin', 'bitcoin')
  .action(options => {
    const htlc = createHTLC({
      recipientAddress: options.recipientAddress,
      refundAddress: options.refundAddress,
    })
    console.log(htlc)
  });

program.parse();
