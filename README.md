# Bitcoin HTLC swaps

## Documentation

See `module.exports` and the docstrings in [htlc.js](htlc.js) for available methods and detailed documentation. The examples below will probably be more useful for development.   

## Creating an HTLC

```js
const { createHTLC } = require('bip-199')

const htlc = createHTLC({
  recipientAddress: 'bcrt1qfjwqqxmf6ajmwy48pzs7ml33udt0smhdc8seya',
  refundAddress: 'bcrt1q2yuazzncplkcexkzcayj886eugkttwxefvwvm3'
})
console.log(htlc)
```

Output:

```
{
  recipientAddress: 'bcrt1qfjwqqxmf6ajmwy48pzs7ml33udt0smhdc8seya',
  refundAddress: 'bcrt1q2yuazzncplkcexkzcayj886eugkttwxefvwvm3',
  preimage: 'c68f23c9a800799447612d1b4bc09a8a05f643c01dd7de8acbde679a808f73ed',
  contractHash: 'f0d661c0c20862a0641b953c84660c649e91fbc97abe3ffd71fd344469b61dcd',
  expiration: 1724125162,
  network: 'regtest',
  addressType: 'p2wsh',
  witnessScript: '63a820f0d661c0c20862a0641b953c84660c649e91fbc97abe3ffd71fd344469b61dcd8876a9144c9c001b69d765b712a708a1edfe31e356f86eed6704ea0fc466b17576a9145139d10a780fed8c9ac2c749239f59e22cb5b8d96888ac',
  htlcAddress: 'bcrt1qd730p4644wqtvfa5h3dpdyhfu4anm6mqlsqc7al8tv0k3smazs4qcpczrq'
}
```

Any bitcoin you send to the `htlcAddress` will now be locked

```bash
> bitcoin-core.cli -regtest sendtoaddress bcrt1qd730p4644wqtvfa5h3dpdyhfu4anm6mqlsqc7al8tv0k3smazs4qcpczrq 1
2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62
```

## Using an existing hash sent from a counterparty

If your counterpary in an atomic swap is holding the preimage, he will have to send you the hash. 

You can use this hash to create an HTLC, and you will be able to redeem it once he reveals the preimage on his end. 

We use a custom expiration as well and conduct the transaction on Bitcoin mainnet to demonstrate it. 

```js
const { createHTLC } = require('bip-199')

const htlc2 = createHTLC({
  recipientAddress: 'bc1qqcjmr6de85qv2gq54y9x59ctqxc3pjeyskqtdr',
  refundAddress: 'bc1qwr3ksdcgy7dq0mgl7gs7a0ay3kdp5r5yudk6ma',
  hash: "368278313373e68a55c8361623fc06e1fa6c8251c90348fccac939879257144d",
  network: 'bitcoin',
  expiration: (Date.now() / 1000 | 0) + 3600, // 1 hour
})
console.log(htlc2)
```

Output:

```
{
  recipientAddress: 'bcrt1qfjwqqxmf6ajmwy48pzs7ml33udt0smhdc8seya',
  refundAddress: 'bcrt1q2yuazzncplkcexkzcayj886eugkttwxefvwvm3',
  preimage: '',
  contractHash: '368278313373e68a55c8361623fc06e1fa6c8251c90348fccac939879257144d',
  expiration: 1724042530,
  network: 'bitcoin',
  addressType: 'p2wsh',
  witnessScript: '63a820368278313373e68a55c8361623fc06e1fa6c8251c90348fccac939879257144d8876a9144c9c001b69d765b712a708a1edfe31e356f86eed670422cdc266b17576a9145139d10a780fed8c9ac2c749239f59e22cb5b8d96888ac',
  htlcAddress: 'bc1qfy23h4gwx7q0uzwklwf89fyjq4jhwga6vhuaxetej64c87wgemgsymz2aj'
}
```

## Redeeming an HTLC

We will redeem the bitcoin sent to the HTLC in TXID `2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62` above. 

Get the raw transaction hex and inspect it to get the vout index of the HTLC. I have done it here using bitcoin-cli, but you can do it on a block explorer as well. 

```bash
> bitcoin-core.cli -regtest gettransaction 2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62
{
  "amount": -1.00000000,
  "fee": -0.00000165,
  "confirmations": 0,
  "trusted": true,
  "txid": "2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62",
  "wtxid": "ce8e06e525c9f1276e7218b70eeee0f094c6b519c71f3ce9a3f71203b5253b1a",
  "walletconflicts": [
  ],
  "time": 1724109556,
  "timereceived": 1724109556,
  "bip125-replaceable": "yes",
  "details": [
    {
      "address": "bcrt1qqkc7qgklc4sud3pnwypj6cfdyfpyth2j4l7pygwhk5dj0wwy3jyqtceq0e",
      "category": "send",
      "amount": -1.00000000,
      "vout": 1,
      "fee": -0.00000165,
      "abandoned": false
    }
  ],
  "hex": "020000000001012bf80655c8814052821b9074bd32c0c3c3db57386d44726ee8c4ef48617c98460000000000fdffffff02db9a8b4400000000225120646101eab9a0dfe659fe8513564c1083c0120b0ed82c6079d0771f3fa2f184da00e1f5050000000022002005b1e022dfc561c6c43371032d612d224245dd52affc1221d7b51b27b9c48c880247304402201d69c58e9b3a87446c87a894cc229dd7ee4717ade2019bd4a7f1a88cb5d2efe602201fe656f527c20fca4b96a3605ea6a208c4262763c6e34309cf8236ad9a313451012102315063935d93222af241cbb82ac86f2d7abe660a68354bb06eadd0799b56ddde00000000",
  "lastprocessedblock": {
    "hash": "31762bb1a0105488e8bb1a805c99aba64c1462c8f1de50d3a2a6d2b0b337fa1e",
    "height": 506
  }
}
> bitcoin-core.cli -regtest decoderawtransaction 020000000001012bf80655c8814052821b9074bd32c0c3c3db57386d44726ee8c4ef48617c98460000000000fdffffff02db9a8b4400000000225120646101eab9a0dfe659fe8513564c1083c0120b0ed82c6079d0771f3fa2f184da00e1f5050000000022002005b1e022dfc561c6c43371032d612d224245dd52affc1221d7b51b27b9c48c880247304402201d69c58e9b3a87446c87a894cc229dd7ee4717ade2019bd4a7f1a88cb5d2efe602201fe656f527c20fca4b96a3605ea6a208c4262763c6e34309cf8236ad9a313451012102315063935d93222af241cbb82ac86f2d7abe660a68354bb06eadd0799b56ddde00000000
{
  "txid": "2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62",
  "hash": "ce8e06e525c9f1276e7218b70eeee0f094c6b519c71f3ce9a3f71203b5253b1a",
  "version": 2,
  "size": 246,
  "vsize": 165,
  "weight": 657,
  "locktime": 0,
  "vin": [
    {
      "txid": "46987c6148efc4e86e72446d3857dbc3c3c032bd74901b82524081c85506f82b",
      "vout": 0,
      "scriptSig": {
        "asm": "",
        "hex": ""
      },
      "txinwitness": [
        "304402201d69c58e9b3a87446c87a894cc229dd7ee4717ade2019bd4a7f1a88cb5d2efe602201fe656f527c20fca4b96a3605ea6a208c4262763c6e34309cf8236ad9a31345101",
        "02315063935d93222af241cbb82ac86f2d7abe660a68354bb06eadd0799b56ddde"
      ],
      "sequence": 4294967293
    }
  ],
  "vout": [
    {
      "value": 11.49999835,
      "n": 0,
      "scriptPubKey": {
        "asm": "1 646101eab9a0dfe659fe8513564c1083c0120b0ed82c6079d0771f3fa2f184da",
        "desc": "rawtr(646101eab9a0dfe659fe8513564c1083c0120b0ed82c6079d0771f3fa2f184da)#qy2l8r53",
        "hex": "5120646101eab9a0dfe659fe8513564c1083c0120b0ed82c6079d0771f3fa2f184da",
        "address": "bcrt1pv3ssr64e5r07vk07s5f4vnqss0qpyzcwmqkxq7wswu0nlgh3sndqluzggh",
        "type": "witness_v1_taproot"
      }
    },
    {
      "value": 1.00000000,
      "n": 1,
      "scriptPubKey": {
        "asm": "0 05b1e022dfc561c6c43371032d612d224245dd52affc1221d7b51b27b9c48c88",
        "desc": "addr(bcrt1qqkc7qgklc4sud3pnwypj6cfdyfpyth2j4l7pygwhk5dj0wwy3jyqtceq0e)#gwjyyzfy",
        "hex": "002005b1e022dfc561c6c43371032d612d224245dd52affc1221d7b51b27b9c48c88",
        "address": "bcrt1qqkc7qgklc4sud3pnwypj6cfdyfpyth2j4l7pygwhk5dj0wwy3jyqtceq0e",
        "type": "witness_v0_scripthash"
      }
    }
  ]
}
```

We're looking for the 1 BTC output, so you can see the vout index is 1. There's a 50% chance your vout index is actually 0, so make sure you check that. 

Now run your redeem tx using that txid, value, and vout.

```js
const TXID = "2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62"
const value = 1e8 // 1 bitcoin in sats
const vout = 1
const redeemTxRaw = redeemHTLC({
  preimage: htlc.preimage,
  recipientWIF: recipientKeypair.toWIF(),
  witnessScript: htlc.witnessScript,
  txHash: TXID,
  value,
  feeRate: 10,
  vout
})
console.log(redeemTxRaw)
```

Output:

```
02000000000101626dd30d06b521160b9469e578f21c9b5cf4fc7755b2edab84fcda041aca352d0100000000ffffffff0130d9f505000000001600144775723b2f720f03489abb90356e6408e22fd0ce05473044022004235b860b5af19f13f58af6c16fb21496dc74acbb00b91ca3e2303248d08ec3022046f38e94f17286740a56f41b60068c39e90674277d132cd0821c4d1c2f89e4430121028c38a7431c0d87d69c7d4d0bc0d2ba394e59f9493990d1998b40612416bc651b2074279120f6fe355c598f0411f115a0398aa07db066ea81136f5c85219bfa0bdb01015d63a8209aa0fe59b6373bd6758caa9cb4278934568f437615937ecc4c4f8c2a0030759e8876a9144775723b2f720f03489abb90356e6408e22fd0ce6704a825c566b17576a9144775723b2f720f03489abb90356e6408e22fd0ce6888ac00000000
```

Broadcast the transaction to the network

```bash
> bitcoin-core.cli sendrawtransaction 02000000000101626dd30d06b521160b9469e578f21c9b5cf4fc7755b2edab84fcda041aca352d0100000000ffffffff0130d9f505000000001600144775723b2f720f03489abb90356e6408e22fd0ce05473044022004235b860b5af19f13f58af6c16fb21496dc74acbb00b91ca3e2303248d08ec3022046f38e94f17286740a56f41b60068c39e90674277d132cd0821c4d1c2f89e4430121028c38a7431c0d87d69c7d4d0bc0d2ba394e59f9493990d1998b40612416bc651b2074279120f6fe355c598f0411f115a0398aa07db066ea81136f5c85219bfa0bdb01015d63a8209aa0fe59b6373bd6758caa9cb4278934568f437615937ecc4c4f8c2a0030759e8876a9144775723b2f720f03489abb90356e6408e22fd0ce6704a825c566b17576a9144775723b2f720f03489abb90356e6408e22fd0ce6888ac00000000

## Refunding an HTLC

WIP

## Use Cases

- Submarine swaps on Lightning
- Atomic swaps across Bitcoin forks like Litecoin or Bitcoin Cash. 
- With a little extra coding, you can use this to perform atomic swaps on non-bitcoin chains like Ethereum or Solana as well. 
