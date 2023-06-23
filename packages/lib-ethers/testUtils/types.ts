// const assertion
export const mockAssetContracts = [{ name: "nbc", contract: "mockAsset1" }, { name: "csc", contract: "mockAsset2" }] as const

// interfaces
export interface MockAssets {
    assetName: string, assetAddress: string, assetContract: any
}