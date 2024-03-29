<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@kumodao/lib-ethers](./lib-ethers.md) &gt; [SendableEthersKumo](./lib-ethers.sendableetherskumo.md) &gt; [openTrove](./lib-ethers.sendableetherskumo.opentrove.md)

## SendableEthersKumo.openTrove() method

Open a new Trove by depositing collateral and borrowing KUSD.

<b>Signature:</b>

```typescript
openTrove(params: TroveCreationParams<Decimalish>, asset: string, maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams, overrides?: EthersTransactionOverrides): Promise<SentEthersKumoTransaction<TroveCreationDetails>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  params | [TroveCreationParams](./lib-base.trovecreationparams.md)<!-- -->&lt;[Decimalish](./lib-base.decimalish.md)<!-- -->&gt; | How much to deposit and borrow. |
|  asset | string |  |
|  maxBorrowingRateOrOptionalParams | [Decimalish](./lib-base.decimalish.md) \| [BorrowingOperationOptionalParams](./lib-ethers.borrowingoperationoptionalparams.md) |  |
|  overrides | [EthersTransactionOverrides](./lib-ethers.etherstransactionoverrides.md) |  |

<b>Returns:</b>

Promise&lt;[SentEthersKumoTransaction](./lib-ethers.sentetherskumotransaction.md)<!-- -->&lt;[TroveCreationDetails](./lib-base.trovecreationdetails.md)<!-- -->&gt;&gt;

## Remarks

If `maxBorrowingRate` is omitted, the current borrowing rate plus 0.5% is used as maximum acceptable rate.

