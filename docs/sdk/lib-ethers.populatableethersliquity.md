<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@liquity/lib-ethers](./lib-ethers.md) &gt; [PopulatableEthersLiquity](./lib-ethers.populatableethersliquity.md)

## PopulatableEthersLiquity class

Ethers-based implementation of [PopulatableLiquity](./lib-base.populatableliquity.md)<!-- -->.

<b>Signature:</b>

```typescript
export declare class PopulatableEthersLiquity extends _PopulatableEthersLiquityBase implements PopulatableLiquity<EthersTransactionReceipt, EthersTransactionResponse, EthersPopulatedTransaction> 
```
<b>Extends:</b> \_PopulatableEthersLiquityBase

<b>Implements:</b> [PopulatableLiquity](./lib-base.populatableliquity.md)<!-- -->&lt;[EthersTransactionReceipt](./lib-ethers.etherstransactionreceipt.md)<!-- -->, [EthersTransactionResponse](./lib-ethers.etherstransactionresponse.md)<!-- -->, [EthersPopulatedTransaction](./lib-ethers.etherspopulatedtransaction.md)<!-- -->&gt;

## Constructors

|  Constructor | Modifiers | Description |
|  --- | --- | --- |
|  [(constructor)(readable)](./lib-ethers.populatableethersliquity._constructor_.md) |  | Constructs a new instance of the <code>PopulatableEthersLiquity</code> class |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [adjustTrove(params, overrides)](./lib-ethers.populatableethersliquity.adjusttrove.md) |  | Adjust existing Trove by changing its collateral, debt, or both. |
|  [borrowLUSD(amount, overrides)](./lib-ethers.populatableethersliquity.borrowlusd.md) |  | Adjust existing Trove by borrowing more LUSD. |
|  [claimCollateralSurplus(overrides)](./lib-ethers.populatableethersliquity.claimcollateralsurplus.md) |  | Claim leftover collateral after a liquidation or redemption. |
|  [closeTrove(overrides)](./lib-ethers.populatableethersliquity.closetrove.md) |  | Close existing Trove by repaying all debt and withdrawing all collateral. |
|  [depositCollateral(amount, overrides)](./lib-ethers.populatableethersliquity.depositcollateral.md) |  | Adjust existing Trove by depositing more collateral. |
|  [depositLUSDInStabilityPool(amount, frontendTag, overrides)](./lib-ethers.populatableethersliquity.depositlusdinstabilitypool.md) |  | Make a new Stability Deposit, or top up existing one. |
|  [liquidate(address, overrides)](./lib-ethers.populatableethersliquity.liquidate.md) |  | Liquidate one or more undercollateralized Troves. |
|  [liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)](./lib-ethers.populatableethersliquity.liquidateupto.md) |  | Liquidate the least collateralized Troves up to a maximum number. |
|  [openTrove(params, overrides)](./lib-ethers.populatableethersliquity.opentrove.md) |  | Open a new Trove by depositing collateral and borrowing LUSD. |
|  [redeemLUSD(amount, overrides)](./lib-ethers.populatableethersliquity.redeemlusd.md) |  | Redeem LUSD to native currency (e.g. Ether) at face value. |
|  [registerFrontend(kickbackRate, overrides)](./lib-ethers.populatableethersliquity.registerfrontend.md) |  | Register current wallet address as a Liquity frontend. |
|  [repayLUSD(amount, overrides)](./lib-ethers.populatableethersliquity.repaylusd.md) |  | Adjust existing Trove by repaying some of its debt. |
|  [sendLQTY(toAddress, amount, overrides)](./lib-ethers.populatableethersliquity.sendlqty.md) |  | Send LQTY tokens to an address. |
|  [sendLUSD(toAddress, amount, overrides)](./lib-ethers.populatableethersliquity.sendlusd.md) |  | Send LUSD tokens to an address. |
|  [stakeLQTY(amount, overrides)](./lib-ethers.populatableethersliquity.stakelqty.md) |  | Stake LQTY to start earning fee revenue or increase existing stake. |
|  [transferCollateralGainToTrove(overrides)](./lib-ethers.populatableethersliquity.transfercollateralgaintotrove.md) |  | Transfer [collateral gain](./lib-base.stabilitydeposit.collateralgain.md) from Stability Deposit to Trove. |
|  [unstakeLQTY(amount, overrides)](./lib-ethers.populatableethersliquity.unstakelqty.md) |  | Withdraw LQTY from staking. |
|  [withdrawCollateral(amount, overrides)](./lib-ethers.populatableethersliquity.withdrawcollateral.md) |  | Adjust existing Trove by withdrawing some of its collateral. |
|  [withdrawGainsFromStabilityPool(overrides)](./lib-ethers.populatableethersliquity.withdrawgainsfromstabilitypool.md) |  | Withdraw [collateral gain](./lib-base.stabilitydeposit.collateralgain.md) and [LQTY reward](./lib-base.stabilitydeposit.lqtyreward.md) from Stability Deposit. |
|  [withdrawGainsFromStaking(overrides)](./lib-ethers.populatableethersliquity.withdrawgainsfromstaking.md) |  | Withdraw [collateral gain](./lib-base.lqtystake.collateralgain.md) and [LUSD gain](./lib-base.lqtystake.lusdgain.md) from LQTY stake. |
|  [withdrawLUSDFromStabilityPool(amount, overrides)](./lib-ethers.populatableethersliquity.withdrawlusdfromstabilitypool.md) |  | Withdraw LUSD from Stability Deposit. |
