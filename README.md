# Bitcoin HTLC swaps

## Creating an HTLC

```js
const { ECPairFactory } = require('ecpair')
const ecc = require('tiny-secp256k1')
const ECPair = ECPairFactory(ecc);
const { createHTLC, redeemHTLC } = require('./htlc')

// Generate keypairs
const recipientKeypair = ECPair.makeRandom()
const refundKeypair = ECPair.makeRandom()

// Create HTLC
const htlc = createHTLC({
  recipientAddress: 'bcrt1qfjwqqxmf6ajmwy48pzs7ml33udt0smhdc8seya',
  refundAddress: 'bcrt1q2yuazzncplkcexkzcayj886eugkttwxefvwvm3'
})
console.log(htlc)
```

See [examples.js](examples.js) for more examples. Documentation will be provided soon. Until then you can look at the docstrings in [htlc.js](htlc.js)


## Use Cases

- Submarine swaps on Lightning
- Atomic swaps across Bitcoin forks like Litecoin or Bitcoin Cash. 
- With a little extra coding, you can use this to perform atomic swaps on non-bitcoin chains like Ethereum or Solana as well. 
