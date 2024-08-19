# Bitcoin HTLC swaps

## Creating an HTLC

```js
const { createHTLC } = require('bip-199')

// Create HTLC
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

```js
const { createHTLC } = require('bip-199')

// Create HTLC with custom expiration and hash on mainnet
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

See [examples.js](examples.js) for more examples. Documentation will be provided soon. Until then you can look at the docstrings in [htlc.js](htlc.js)


## Use Cases

- Submarine swaps on Lightning
- Atomic swaps across Bitcoin forks like Litecoin or Bitcoin Cash. 
- With a little extra coding, you can use this to perform atomic swaps on non-bitcoin chains like Ethereum or Solana as well. 
