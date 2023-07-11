// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import {LibAppStorage, AppStorage} from "./LibAppStorage.sol";
import "../Dependencies/KumoMath.sol";

library LibKumoBase {
    // ----------------- MOVE
    // function setKumoParameters(address _kumoParamsAddress) public onlyOwner {
    //     kumoParams = IKumoParameters(_kumoParamsAddress);
    //     emit VaultParametersBaseChanged(_kumoParamsAddress);
    // }

    // Minimum amount of net KUSD debt a trove must have
    uint256 public constant MIN_NET_DEBT = 1800e18;

    // uint256 constant public MIN_NET_DEBT = 0;

    // --- Gas compensation functions ---

    // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(address _asset, uint256 _debt) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        return _debt + s.kumoParams.KUSD_GAS_COMPENSATION(_asset);
    }

    function _getNetDebt(address _asset, uint256 _debt) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        return _debt - s.kumoParams.KUSD_GAS_COMPENSATION(_asset);
    }

    // Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(
        address _asset,
        uint256 _entireColl
    ) internal view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        return _entireColl / s.kumoParams.PERCENT_DIVISOR(_asset);
    }

    function _getEntireSystemColl(address _asset) internal view returns (uint256 entireSystemColl) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 activeColl = s.activePool.getAssetBalance(_asset);
        uint256 liquidatedColl = s.defaultPool.getAssetBalance(_asset);
        return activeColl + liquidatedColl;
    }

    function _getEntireSystemDebt(address _asset) internal view returns (uint256 entireSystemDebt) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 activeDebt = s.activePool.getKUSDDebt(_asset);
        uint256 closedDebt = s.defaultPool.getKUSDDebt(_asset);

        return activeDebt + closedDebt;
    }

    function _getTCR(address _asset, uint256 _price) internal view returns (uint256 TCR) {
        uint256 entireSystemColl = _getEntireSystemColl(_asset);
        uint256 entireSystemDebt = _getEntireSystemDebt(_asset);

        TCR = KumoMath._computeCR(entireSystemColl * _price, entireSystemDebt);

        return TCR;
    }

    function _getSystemWideTCR() internal view returns (uint256 TCR) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 entireSystemCollSum = 0;
        uint256 entireSystemDebt = 0;

        for (uint8 i = 0; i < s.kumoParams.supportedAssetsCounter(); i++) {
            address _asset = s.kumoParams.supportedAssets(i);
            uint256 _assetColl = _getEntireSystemColl(_asset);
            uint256 _assetDebt = _getEntireSystemDebt(_asset);
            uint256 _price = s.kumoParams.priceFeed().getPrice(_asset);

            entireSystemCollSum += _assetColl * _price;
            entireSystemDebt += _assetDebt;
        }

        TCR = KumoMath._computeCR(entireSystemCollSum, entireSystemDebt);

        return TCR;
    }

    function _checkRecoveryMode(address _asset, uint256 _price) internal view returns (bool) {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 systemTCR = _getSystemWideTCR();
        uint256 TCR = _getTCR(_asset, _price);
        uint256 CCR = s.kumoParams.CCR(_asset);
        uint256 SCCR = s.kumoParams.SCCR();

        return (TCR < CCR || systemTCR < SCCR);
    }

    function _requireUserAcceptsFee(
        uint256 _fee,
        uint256 _amount,
        uint256 _maxFeePercentage
    ) internal view {
        AppStorage storage s = LibAppStorage.diamondStorage();

        uint256 feePercentage = (_fee * s.kumoParams.DECIMAL_PRECISION()) / _amount;
        require(feePercentage <= _maxFeePercentage, "Fee exceeded provided maximum");
    }
}
