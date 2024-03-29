<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@kumodao/lib-base](./lib-base.md) &gt; [ReadableKumo](./lib-base.readablekumo.md) &gt; [getTroves](./lib-base.readablekumo.gettroves_1.md)

## ReadableKumo.getTroves() method

Get a slice from the list of Troves.

<b>Signature:</b>

```typescript
getTroves(asset: string, params: TroveListingParams): Promise<UserTrove[]>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  asset | string |  |
|  params | [TroveListingParams](./lib-base.trovelistingparams.md) | Controls how the list is sorted, and where the slice begins and ends. |

<b>Returns:</b>

Promise&lt;[UserTrove](./lib-base.usertrove.md)<!-- -->\[\]&gt;

Pairs of owner addresses and their Troves.

