<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@kumodao/lib-base](./lib-base.md) &gt; [PopulatableKumo](./lib-base.populatablekumo.md) &gt; [transferTestTokens](./lib-base.populatablekumo.transfertesttokens.md)

## PopulatableKumo.transferTestTokens() method

Request Test tokens to an address.

<b>Signature:</b>

```typescript
transferTestTokens(tokenAddress: string, toAddress: string, amount: Decimalish): Promise<PopulatedKumoTransaction<P, SentKumoTransaction<S, KumoReceipt<R, void>>>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  tokenAddress | string | Address of test token contract. |
|  toAddress | string |  |
|  amount | [Decimalish](./lib-base.decimalish.md) |  |

<b>Returns:</b>

Promise&lt;[PopulatedKumoTransaction](./lib-base.populatedkumotransaction.md)<!-- -->&lt;P, [SentKumoTransaction](./lib-base.sentkumotransaction.md)<!-- -->&lt;S, [KumoReceipt](./lib-base.kumoreceipt.md)<!-- -->&lt;R, void&gt;&gt;&gt;&gt;
