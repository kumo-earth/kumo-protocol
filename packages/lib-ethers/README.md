# @liquity/lib-ethers

[Ethers](https://www.npmjs.com/package/ethers)-based library for reading Kumo protocol state and sending transactions.

## Quickstart

Install in your project:

```
npm install --save @liquity/lib-base @liquity/lib-ethers ethers@^5.0.0
```

Connecting to an Ethereum node and sending a transaction:

```javascript
const { Wallet, providers } = require("ethers");
const { EthersLiquity } = require("kumodao/lib-ethers");


async function example() {
  const provider = new providers.JsonRpcProvider("http://localhost:8545");
  const wallet = new Wallet(process.env.PRIVATE_KEY).connect(provider);
  const liquity = await EthersKumo.connect(wallet);

  const { newTrove } = await liquity.openTrove({
    depositCollateral: 5, // ETH
    borrowKUSD: 2000
  });

  console.log(`Successfully opened a Kumo Trove (${newTrove})!`);
}
```

## More examples

See [packages/examples](https://github.com/kumodao/borrowprot/tree/master/packages/examples) in the repo.

Kumo's [Dev UI](https://github.com/kumodao/borrowprot/tree/master/packages/dev-frontend) itself contains many examples of `@kumodao/lib-ethers` use.

## API Reference

For now, it can be found in the public Kumo [repo](https://github.com/kumodao/borrowprot/blob/master/docs/sdk/lib-ethers.md).
