<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@kumodao/lib-base](./lib-base.md) &gt; [PopulatableKumo](./lib-base.populatablekumo.md) &gt; [closeTrove](./lib-base.populatablekumo.closetrove.md)

## PopulatableKumo.closeTrove() method

Close existing Trove by repaying all debt and withdrawing all collateral.

<b>Signature:</b>

```typescript
closeTrove(asset: string): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, TroveClosureDetails>>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  asset | string |  |

<b>Returns:</b>

Promise&lt;[PopulatedKumoTransaction](./lib-base.populatedkumotransaction.md)<!-- -->&lt;P, [SentKumoTransaction](./lib-base.sentkumotransaction.md)<!-- -->&lt;S, [KumoReceipt](./lib-base.kumoreceipt.md)<!-- -->&lt;R, [TroveClosureDetails](./lib-base.troveclosuredetails.md)<!-- -->&gt;&gt;&gt;&gt;

