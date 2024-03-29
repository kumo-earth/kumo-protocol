<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@kumodao/lib-base](./lib-base.md) &gt; [ReadableKumo](./lib-base.readablekumo.md) &gt; [getAssetBalance](./lib-base.readablekumo.getassetbalance.md)

## ReadableKumo.getAssetBalance() method

Get the amount of BCT held by an address.

<b>Signature:</b>

```typescript
getAssetBalance(address: string, assetType: string, provider: Provider): Promise<Decimal>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  address | string | Address whose balance should be retrieved. |
|  assetType | string |  |
|  provider | Provider |  |

<b>Returns:</b>

Promise&lt;[Decimal](./lib-base.decimal.md)<!-- -->&gt;

