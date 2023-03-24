// const assertion
export const mockAssetContracts = [{ name: "ctx", contract: "mockAsset1" }, { name: "cty", contract: "mockAsset2" }] as const

// interfaces
export interface MockAssets {
    assetName: string, assetAddress: string, assetContract: any
}