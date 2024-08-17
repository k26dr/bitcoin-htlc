const bitcoin = require('bitcoinjs-lib')
const crypto = require('crypto');

// Modify this is as needed 
// It sets the HTLC expiration to a specified number of seconds in the future
// Default: 1 day
const HTLC_EXPIRATION = 86400

//interface SwapParams {
//    value: BigNumber;
//    recipientAddress: AddressType;
//    refundAddress: AddressType;
//    secretHash: string;
//    expiration: number;
//}

function getPubKeyHash(address) {
   return bitcoin.address.fromBech32(address).data;
}

const hash = crypto.createHash('sha256');

const swapParams = {
  value: 20000,
  recipientAddress: "bc1qfahj9jxdmhmndu8veg6p4lspr5qn0vy07tenqr",
  refundAddress: "bc1qrvycjjfe9agte7uzz2g4cdrxpljf76f4wzkyd3",
  secretHash: crypto.createHash('sha256').update('funstuff').digest(),
  expiration: (Date.now() / 1000) + HTLC_EXPIRATION 
}

const recipientPubKeyHash = getPubKeyHash(swapParams.recipientAddress)
const refundPubKeyHash = getPubKeyHash(swapParams.refundAddress)
const OPS = bitcoin.script.OPS;

const script = bitcoin.script.compile([
    OPS.OP_IF,
    OPS.OP_SIZE,
    bitcoin.script.number.encode(32),
    OPS.OP_EQUALVERIFY,
    OPS.OP_SHA256,
    swapParams.secretHash,
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

const network = bitcoin.networks.regtest;
const p2sh = bitcoin.payments.p2sh({
    redeem: { output: script, network },
    network

});

console.log(p2sh.address)
