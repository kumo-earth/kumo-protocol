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

	function setKumoParameters(address _vaultParams) public onlyOwner {
		kumoParams = IKumoParameters(_vaultParams);
		emit VaultParametersBaseChanged(_vaultParams);
	}

    // Minimum amount of net KUSD debt a trove must have
    uint constant public MIN_NET_DEBT = 1800e18;
    // uint constant public MIN_NET_DEBT = 0; 

    // --- Gas compensation functions ---

    // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
    function _getCompositeDebt(uint _debt) internal view returns (uint) {
        return _debt.add(kumoParams.KUSD_GAS_COMPENSATION());
    }

    function _getNetDebt(uint _debt) internal view returns (uint) {
        return _debt.sub(kumoParams.KUSD_GAS_COMPENSATION());
    }

    // Return the amount of ETH to be drawn from a trove's collateral and sent as gas compensation.
    function _getCollGasCompensation(uint _entireColl) internal view returns (uint) {
        return _entireColl / kumoParams.PERCENT_DIVISOR();
    }

    function getEntireSystemColl() public view returns (uint entireSystemColl) {
        uint activeColl = kumoParams.activePool().getETH();
        uint liquidatedColl = kumoParams.defaultPool().getETH();
        return activeColl.add(liquidatedColl);
    }

    function getEntireSystemDebt() public view returns (uint entireSystemDebt) {
        uint activeDebt = kumoParams.activePool().getKUSDDebt();
        uint closedDebt = kumoParams.defaultPool().getKUSDDebt();

        return activeDebt.add(closedDebt);
    }

    function _getTCR(uint _price) internal view returns (uint TCR) {
        uint entireSystemColl = getEntireSystemColl();
        uint entireSystemDebt = getEntireSystemDebt();

        TCR = KumoMath._computeCR(entireSystemColl, entireSystemDebt, _price);

        return TCR;
    }

    function _checkRecoveryMode(uint _price) internal view returns (bool) {
        uint TCR = _getTCR(_price);
        return TCR < kumoParams.CCR();
    }

    function _requireUserAcceptsFee(uint _fee, uint _amount, uint _maxFeePercentage) internal view {
        uint feePercentage = _fee.mul(kumoParams.DECIMAL_PRECISION()).div(_amount);
        require(feePercentage <= _maxFeePercentage, "Fee exceeded provided maximum");
    }
}
