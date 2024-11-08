# Bitcoin HTLC swaps

## Release Notes

* `refundHTLC` has not been fully tested. Please open an issue if you have problems.
* Current support is only for Bitcoin. Litecoin and ZCash will be added in the next few weeks.
* There is a CLI client included. `node cli.js help` will get you documentation for that, and examples are included at the end of this README

## Use Cases

- Submarine swaps on Lightning
- Atomic swaps across Bitcoin forks like Litecoin or Bitcoin Cash. 
- With a little extra coding, you can use this to perform atomic swaps on non-bitcoin chains like Ethereum or Solana as well. 

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

Save the HTLC JSON somewhere secure. If you lose the HTLC, you'll be unable to retrieve your funds. 

If you're doing this process non-programatically, I would recommend you use the CLI. It will automatically store a backup for you that you can access later. 

Any bitcoin you send to the `htlcAddress` will now be locked to that hash until expiry. 

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

## Determining HTLC vout

To refund or redeem an HTLC you need to know the index (vout) of the HTLC output within your creation transaction. 

### Programatically using Bitcoin Core RPC

If you have access to a Bitcon Core full node, you can get transaction vouts programatically using the built-in RPC server

```js
const bitcoinCore = require('bitcoin-core')
const bitcoin = require('bitcoinjs-lib')

const client = new bitcoinCore({
  network: 'mainnet',
  username: 'hello',
  password: 'bitcoin'
});

async function getTxOuts (txid) {
  const rpcTx = await client.command('gettransaction', txid)
  return bitcoin.Transaction.fromHex(rpcTx.hex).outs
}

const TXID = "d8e375b891307145d7eec99e7077329b90f5496c983d0d7a43996d7bd2d4f437"
getTxOuts(TXID).then(console.log)
```

Output

```
[
  {
    value: 10000,
    script: <Buffer 00 14 d2 bd 7b 44 8e e1 95 98 c7 96 51 4b 60 e0 b3 b2 12 88 0a d6>
  },
  {
    value: 3156826,
    script: <Buffer 00 14 12 c6 bc a0 cb fe 19 b0 2d d5 a7 ea c8 5a 0c 02 08 1e 44 dc>
  }
]
```

Then you can select the index of the UTXO you want to unlock. 

### Programatically Using a Block Explorer

For this example, I am using [mempool.space](https://mempool.space) and an arbitrary txid. You can use any block explorer that supports pulling raw hex data.

```js
const bitcoin = require('bitcoinjs-lib')
const axios = require('axios')

async function getTxOuts (txid) {
  const rawTx = await axios.get('https://mempool.space/api/tx/' + txid + '/hex')
  const tx = bitcoin.Transaction.fromHex(rawTx.data)
  return tx.outs
}

const TXID = "f318d73cae78fb9c312aac8c0bfce9d55fa9ab8e1e0ac75cb572deac74e20601"
getTxOuts(TXID).then(console.log)
```

```
[
  {
    value: 11000,
    script: <Buffer 00 14 46 ae 1e 9a 4a 3b 6d cc 70 e1 de 61 14 7e 27 31 34 e7 49 0d>
  },
  {
    value: 6482,
    script: <Buffer 51 20 9c 87 b9 0f 3a b2 6a ff b5 50 5a 68 49 df 81 7b c1 e9 6f ad f5 4e b4 ac fc d7 92 91 70 ad 3a f6>
  }
]
```

You can now pick the index of the output you want to unlock. 

### Manually using bitcoin-cli

If you are running a Bitcoin Core full node, you can get the raw transaction hex and inspect it. 

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
```

```
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

We're looking for the 1 BTC output, so you can see the vout index is 1. 

## Redeeming an HTLC

We will redeem the bitcoin sent to the HTLC in TXID `2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62` in [Creating an HTLC](#creating-an-htlc). 

See [Determining HTLC vout](#determining-htlc-vout) for instructions on getting the vout of your HTLC. 

Run your redeem tx using the txid, value, and vout of your HTLC.

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
  feeRate: 10, // sat/vB
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
```

Congratulations. The receiver should have received the Bitcoin. 

## Refunding an HTLC

We will refund the bitcoin sent to the HTLC in TXID `2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62` in [Creating an HTLC](#creating-an-htlc). 

See [Determining HTLC vout](#determining-htlc-vout) for instructions on getting the vout of your HTLC. 

The first step is to expire your HTLC. There's really no other way to do that then to wait until the expiration has been hit. You can create another HTLC without a shorter custom expiration if you don't want to wait a day. Once you have an HTLC that is expired, you can proceed with the refund. 

Run your refund tx using the txid, value, and vout of your HTLC.

```js
// Example values
const TXID = "2d35ca1a04dafc84abedb25577fcf45c9b1cf278e569940b1621b5060dd36d62"
const value = 1e8 // 1 bitcoin in sats
const vout = 1

const refundTxRaw = refundHTLC({
  refundWIF: refundKeypair.toWIF(),
  witnessScript: htlc.witnessScript,
  txHash: TXID,
  value,
  feeRate: 10, // sat/vB
  vout
})
console.log(refundTxRaw)
```

Output

```
02000000000101626dd30d06b521160b9469e578f21c9b5cf4fc7755b2edab84fcda041aca352d0100000000ffffffff0130d9f50500000000160014fd017c2bbed1821caa3b089d24343274047d4ef20448304502210085be9c286ef56bb98ddfba7638c48e359aea3ebb91227dd06c4a43a99ee1b7cb02203ce37f32cec277c5d83d72b42c65ea0ba571239808ed02ce2e1cd82b27c409230121039ab7c891dc72e793e82c2391f59fd6ad9f81a6cf038f4425cd3ebf4e509f7a3b005d63a82061736afa42077c2b014e42b76c2c1e6b10ad66f1cc5d9d97a0c0ba8a6622c7f48876a9146cf511286ed4bd6d699d12ee81cef4bc1dd90bc467049630c566b17576a914fd017c2bbed1821caa3b089d24343274047d4ef26888ac00000000
```

Broadcast the transaction to the network

```bash
> bitcoin-core.cli sendrawtransaction 02000000000101626dd30d06b521160b9469e578f21c9b5cf4fc7755b2edab84fcda041aca352d0100000000ffffffff0130d9f50500000000160014fd017c2bbed1821caa3b089d24343274047d4ef20448304502210085be9c286ef56bb98ddfba7638c48e359aea3ebb91227dd06c4a43a99ee1b7cb02203ce37f32cec277c5d83d72b42c65ea0ba571239808ed02ce2e1cd82b27c409230121039ab7c891dc72e793e82c2391f59fd6ad9f81a6cf038f4425cd3ebf4e509f7a3b005d63a82061736afa42077c2b014e42b76c2c1e6b10ad66f1cc5d9d97a0c0ba8a6622c7f48876a9146cf511286ed4bd6d699d12ee81cef4bc1dd90bc467049630c566b17576a914fd017c2bbed1821caa3b089d24343274047d4ef26888ac00000000
```

Congratulations. The refund address should have been refunded the Bitcoin. 

# CLI

The `cli.js` files contains a command-line client to interact with the BIP-199 library. 

Run the client without any arguments to get a help page. 

```bash
> node cli.js

Usage: bitcoin-htlc [options] [command]

BIP-199 and atomic swap helpers for Node.js

Options:
  -V, --version                                            output the version number
  -h, --help                                               display help for command

Commands:
  createkeypair [options]                                  Create a keypair
  createhtlc [options] <recipientAddress> <refundAddress>  Create an HTLC
  redeemhtlc [options] <txhash> <vout>                     Redeem an HTLC
  refundhtlc [options] <txhash> <vout>                     Refund an HTLC
  help [command]                                           display help for command
```

Each command has a help page as well: 

```bash
> node cli.js help createhtlc

Usage: bitcoin-htlc createhtlc [options] <recipientAddress> <refundAddress>

Create an HTLC

Arguments:
  recipientAddress        bech32 address of recipient
  refundAddress           bech32 address for refund if HTLC expires

Options:
  --network <network>     regtest|testnet|bitcoin (default: "bitcoin")
  --hash <hash>           custom hash to lock HTLC. hash and preimage are generated if not provided.
  --expiration <expires>  UNIX timestamp to expire the HTLC. defaults to 1 day ahead of current time.
  -h, --help              display help for command
```

## Examples

```bash
> node cli.js createkeypair --network regtest
Private Key (WIF): L34qRfch5BZFA4DS7BuNSZR632QZUtLA4YzaqYMbZF7WoRR7KdRX
Address (bech32): bcrt1q2ykrmuu5ue6j30900z7urlxr2feu4r0cfv0hr4
```


```bash
> node cli.js createhtlc bcrt1q4dphx2tr62z0apa4a76g9gezraqgzkvgtaev3l bcrt1qkg3u49vxfergs9ygz2q6tjhnuvv5uulc0t7ad7 --network regtest
{
  recipientAddress: 'bcrt1q4dphx2tr62z0apa4a76g9gezraqgzkvgtaev3l',
  refundAddress: 'bcrt1qkg3u49vxfergs9ygz2q6tjhnuvv5uulc0t7ad7',
  preimage: '29a96993b68c87ef3f55c67e2773b90139c521025b0b18919484bcd3ae94eb01',
  contractHash: '4413078df9063acbfdaed6ada9a44e6051965ed8a547d9ea040b1ebe41bf8ade',
  expiration: 1724428870,
  network: 'regtest',
  addressType: 'p2wsh',
  witnessScript: '63a8204413078df9063acbfdaed6ada9a44e6051965ed8a547d9ea040b1ebe41bf8ade8876a914ab43732963d284fe87b5efb482a3221f40815988670446b2c866b17576a914b223ca95864e468814881281a5caf3e3194e73f86888ac',
  htlcAddress: 'bcrt1qkugjjsckkwq44774xrw882fdmfeumngxhhnpg3uquarurwrwjl6swdycru'
}
> bitcoin-cli -regtest sendtoaddress bcrt1qkugjjsckkwq44774xrw882fdmfeumngxhhnpg3uquarurwrwjl6swdycru 1
9b3d8d2f72a8ee6d2b69f1db1b431f3a3d1af80648f4d9a257b3423e9adb4a8f
```

Save the preimage somewhere safe. you will need it to redeem the HTLC.

`redeemhtlc` and `refundhtlc` return raw signed transactions that need to be broadcast to the network

```bash
> node cli.js redeemhtlc 1e8ca887798d302d0e673e454ec151d89442d85812cbaddd2da4fdfb3a16fae0 1 --network regtest --preimage ccf49d8f0c8995e597dd87b360ea6208d7db20ec3ea60f305b16ab9dcb10899c --recipientWIF L2ip9uxsG5oqJZbpN4GFvmPFns2MBNMJG1yriZccWBNVB46nWYrz --witnessScript 63a820a81ecf3772bac085103b62e67d1d138499b1becd0f308afc6e426500b40c3d268876a914ab43732963d284fe87b5efb482a3221f40815988670492a7c866b17576a914b223ca95864e468814881281a5caf3e3194e73f86888ac --feeRate 10 --valueBTC 0.2
02000000000101e0fa163afbfda42dddadcb1258d84294d851c14e453e670e2d308d7987a88c1e0100000000ffffffff018020310100000000160014ab43732963d284fe87b5efb482a3221f40815988054730440220213797ec18aee4857e1067212314fe2857d90d2da6dbcf2166db5739fc4d907602204dbe6fbb33a078939f8cb33039bc2cd97f9f7b2d88a6b794ba0e4b582a5d4ee00121035f15f7a38030e59c33e066cba47eb66153882fbc6a7dc477ba82973862573b5520ccf49d8f0c8995e597dd87b360ea6208d7db20ec3ea60f305b16ab9dcb10899c01015d63a820a81ecf3772bac085103b62e67d1d138499b1becd0f308afc6e426500b40c3d268876a914ab43732963d284fe87b5efb482a3221f40815988670492a7c866b17576a914b223ca95864e468814881281a5caf3e3194e73f86888ac00000000
> bitcoin-cli sendrawtransaction 02000000000101e0fa163afbfda42dddadcb1258d84294d851c14e453e670e2d308d7987a88c1e0100000000ffffffff018020310100000000160014ab43732963d284fe87b5efb482a3221f40815988054730440220213797ec18aee4857e1067212314fe2857d90d2da6dbcf2166db5739fc4d907602204dbe6fbb33a078939f8cb33039bc2cd97f9f7b2d88a6b794ba0e4b582a5d4ee00121035f15f7a38030e59c33e066cba47eb66153882fbc6a7dc477ba82973862573b5520ccf49d8f0c8995e597dd87b360ea6208d7db20ec3ea60f305b16ab9dcb10899c01015d63a820a81ecf3772bac085103b62e67d1d138499b1becd0f308afc6e426500b40c3d268876a914ab43732963d284fe87b5efb482a3221f40815988670492a7c866b17576a914b223ca95864e468814881281a5caf3e3194e73f86888ac00000000
f3af089519fa5a77354797f8dcb6cbc099f44eca3bc7a67b4962277d10ec29e4
```

```bash
> node cli.js refundhtlc 1e8ca887798d302d0e673e454ec151d89442d85812cbaddd2da4fdfb3a16fae0 1 --network regtest --refundWIF L2ip9uxsG5oqJZbpN4GFvmPFns2MBNMJG1yriZccWBNVB46nWYrz --witnessScript 63a820a81ecf3772bac085103b62e67d1d138499b1becd0f308afc6e426500b40c3d268876a914ab43732963d284fe87b5efb482a3221f40815988670492a7c866b17576a914b223ca95864e468814881281a5caf3e3194e73f86888ac --feeRate 10 --valueBTC 0.2
02000000000101e0fa163afbfda42dddadcb1258d84294d851c14e453e670e2d308d7987a88c1e0100000000ffffffff018020310100000000160014ab43732963d284fe87b5efb482a3221f40815988044730440220213797ec18aee4857e1067212314fe2857d90d2da6dbcf2166db5739fc4d907602204dbe6fbb33a078939f8cb33039bc2cd97f9f7b2d88a6b794ba0e4b582a5d4ee00121035f15f7a38030e59c33e066cba47eb66153882fbc6a7dc477ba82973862573b55005d63a820a81ecf3772bac085103b62e67d1d138499b1becd0f308afc6e426500b40c3d268876a914ab43732963d284fe87b5efb482a3221f40815988670492a7c866b17576a914b223ca95864e468814881281a5caf3e3194e73f86888ac00000000
> bitcoin-cli sendrawtransaction 02000000000101e0fa163afbfda42dddadcb1258d84294d851c14e453e670e2d308d7987a88c1e0100000000ffffffff018020310100000000160014ab43732963d284fe87b5efb482a3221f40815988044730440220213797ec18aee4857e1067212314fe2857d90d2da6dbcf2166db5739fc4d907602204dbe6fbb33a078939f8cb33039bc2cd97f9f7b2d88a6b794ba0e4b582a5d4ee00121035f15f7a38030e59c33e066cba47eb66153882fbc6a7dc477ba82973862573b55005d63a820a81ecf3772bac085103b62e67d1d138499b1becd0f308afc6e426500b40c3d268876a914ab43732963d284fe87b5efb482a3221f40815988670492a7c866b17576a914b223ca95864e468814881281a5caf3e3194e73f86888ac00000000
f3af089519fa5a77354797f8dcb6cbc099f44eca3bc7a67b4962277d10ec29e4
```

