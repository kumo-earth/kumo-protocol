// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./Dependencies/Ownable.sol";
import "./Interfaces/IStabilityPool.sol";

contract StabilityPoolFactory is Ownable {
    mapping(address => address) stabilityPools;
    mapping(address => bool) registeredStabiliyPools;

    function createNewStabilityPool(address _asset, address _stabilityPoolAddress)
        external
        onlyOwner
    {
        stabilityPools[_asset] = _stabilityPoolAddress;
        registeredStabiliyPools[_stabilityPoolAddress] = true;
    }

    function removeStabilityPool(address _asset) external onlyOwner {
        registeredStabiliyPools[stabilityPools[_asset]] = false;
        delete stabilityPools[_asset];
    }

    function getStabilityPoolByAsset(address _asset) public view returns (IStabilityPool) {
        return IStabilityPool(stabilityPools[_asset]);
    }

    function isRegisteredStabilityPool(address _stabilityPoolAddress) external view returns (bool) {
        return registeredStabiliyPools[_stabilityPoolAddress];
    }

    function provideToSPbyAsset(
        address _asset,
        uint256 _amount,
        address _frontEndTag
    ) external {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        stabilityPoolCached.provideToSP(_amount, _frontEndTag);
    }

    function getTotalKUSDDepositsByAsset(address _asset) external view returns (uint256) {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        return stabilityPoolCached.getTotalKUSDDeposits();
    }

    // // Functio calls to SP

    function withdrawFromSPByAsset(address _asset, uint256 _amount) external {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        stabilityPoolCached.withdrawFromSP(_amount);
    }

    function withdrawAssetGainToTroveByAsset(
        address _asset,
        address _upperHint,
        address _lowerHint
    ) external {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        stabilityPoolCached.withdrawAssetGainToTrove(_upperHint, _lowerHint);
    }

    function registerFrontEndByAsset(address _asset, uint256 _kickbackRate) external {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        stabilityPoolCached.registerFrontEnd(_kickbackRate);
    }

    function getCompoundedKUSDDepositByAsset(address _asset, address _depositor)
        external
        view
        returns (uint256)
    {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        return stabilityPoolCached.getCompoundedKUSDDeposit(_depositor);
    }

    function getDepositorAssetGainByAsset(address _asset, address _depositor)
        external
        view
        returns (uint256)
    {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        return stabilityPoolCached.getDepositorAssetGain(_depositor);
    }

    function getDepositorKUMOGainByAsset(address _asset, address _depositor)
        external
        view
        returns (uint256)
    {
        IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
        return stabilityPoolCached.getDepositorKUMOGain(_depositor);
    }

    // function frontEnds(address _asset, address _frontendAddress)
    //     external
    //     view
    //     returns (uint256, bool)
    // {
    //     IStabilityPool stabilityPoolCached = getStabilityPoolByAsset(_asset);
    //     return stabilityPoolCached.frontEnds(_frontendAddress);
    // }

    // withdrawFromSP
    // withdrawAssetGainToTrove
    // registerFrontEnd
    // getCompoundedKUSDDeposit
    // getDepositorAssetGain
    // getDepositorKUMOGain
    // frontEnds

    // //    Events
    // userDepositChanged
    // AssetGainWithdrawn
    // KUMOPaidToDepositor

    // // replacements
    // stabilityPool.address StabilityPoolFactory.getStabilityPoolByAsset(asset)
}
