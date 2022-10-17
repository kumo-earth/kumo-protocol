// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./BaseMath.sol";
import "./KumoMath.sol";
import "./Ownable.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IKumoBase.sol";
// import "hardhat/console.sol";


/* 
* Base contract for TroveManager, BorrowerOperations and StabilityPool. Contains global system constants and
* common functions. 
*/
contract KumoBase is BaseMath, Ownable, IKumoBase {
    using SafeMath for uint;
    IKumoParameters public override kumoParams;

	function setKumoParameters(address _kumoParamsAddress ) public onlyOwner {
		kumoParams = IKumoParameters(_kumoParamsAddress );
		emit VaultParametersBaseChanged(_kumoParamsAddress );
	}

    // Minimum amount of net KUSD debt a trove must have
    uint256 constant public MIN_NET_DEBT = 1800e18;
    // uint256 constant public MIN_NET_DEBT = 0; 

    // --- Gas compensation functions ---

    // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(address _asset, uint256 _debt) internal view returns (uint256) {
        return _debt.add(kumoParams.KUSD_GAS_COMPENSATION(_asset));
    }

    function _getNetDebt(address _asset, uint256 _debt) internal view returns (uint256) {
        return _debt.sub(kumoParams.KUSD_GAS_COMPENSATION(_asset));
    }

    // Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(address _asset, uint256 _entireColl) internal view returns (uint256) {
        return _entireColl / kumoParams.PERCENT_DIVISOR(_asset);
    }

    function getEntireSystemColl(address _asset) public view returns (uint256 entireSystemColl) {
        uint256 activeColl = kumoParams.activePool().getAssetBalance(_asset);
        uint256 liquidatedColl = kumoParams.defaultPool().getAssetBalance(_asset);
        return activeColl.add(liquidatedColl);
    }

    function getEntireSystemDebt(address _asset) public view returns (uint256 entireSystemDebt) {
        uint256 activeDebt = kumoParams.activePool().getKUSDDebt(_asset);
        uint256 closedDebt = kumoParams.defaultPool().getKUSDDebt(_asset);

        return activeDebt.add(closedDebt);
    }

    function _getTCR(address _asset, uint256 _price) internal view returns (uint256 TCR) {
        uint256 entireSystemColl = getEntireSystemColl(_asset);
        uint256 entireSystemDebt = getEntireSystemDebt(_asset);

        TCR = KumoMath._computeCR(entireSystemColl, entireSystemDebt, _price);

        return TCR;
    }

    function _checkRecoveryMode(address _asset, uint256 _price) internal view returns (bool) {
        uint256 TCR = _getTCR(_asset, _price);
        return TCR < kumoParams.CCR(_asset);
    }

    function _requireUserAcceptsFee(uint256 _fee, uint256 _amount, uint256 _maxFeePercentage) internal view {
        uint256 feePercentage = _fee.mul(kumoParams.DECIMAL_PRECISION()).div(_amount);
        require(feePercentage <= _maxFeePercentage, "Fee exceeded provided maximum");
    }
}
