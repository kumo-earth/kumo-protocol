<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@kumodao/lib-base](./lib-base.md) &gt; [TransactableKumo](./lib-base.transactablekumo.md) &gt; [closeTrove](./lib-base.transactablekumo.closetrove.md)

## TransactableKumo.closeTrove() method

Close existing Trove by repaying all debt and withdrawing all collateral.

<b>Signature:</b>

```typescript
closeTrove(asset: string): Promise<TroveClosureDetails>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  asset | string |  |

<b>Returns:</b>

Promise&lt;[TroveClosureDetails](./lib-base.troveclosuredetails.md)<!-- -->&gt;

## Exceptions

Throws [TransactionFailedError](./lib-base.transactionfailederror.md) in case of transaction failure.

