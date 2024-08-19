# Bitcoin HTLC swaps

See [htlc.js](htlc.js) for code to generate a bech32 address for HTLC-based atomic swaps.

See [redeem.js](redeem.js) for code to use a valid preimage to unlock an HTLC to the specified receiver. 

A script for refunding the HTLC is under development. 

# Use Cases

- Submarine swaps on Lightning
- Atomic swaps across Bitcoin forks like Litecoin or Bitcoin Cash. 
- With a little extra coding, you can use this to perform atomic swaps on non-bitcoin chains like Ethereum or Solana as well. 
