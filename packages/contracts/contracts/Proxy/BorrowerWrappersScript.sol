// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/KumoMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManagerDiamond.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IKUMOStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./KUMOStakingScript.sol";
import "hardhat/console.sol";

contract BorrowerWrappersScript {
    // is BorrowerOperationsScript, ETHTransferScript, KUMOStakingScript {
    // using SafeMath for uint256;
    // struct Local_var {
    //     address _asset;
    //     uint256 _maxFee;
    //     address _upperHint;
    //     address _lowerHint;
    //     uint256 netKUSDAmount;
    // }
    // string public constant NAME = "BorrowerWrappersScript";
    // ITroveManager immutable troveManager;
    // IStabilityPool immutable stabilityPool;
    // IPriceFeed immutable priceFeed;
    // IERC20 immutable kusdToken;
    // IERC20 immutable kumoToken;
    // IKUMOStaking immutable kumoStaking;
    // constructor(
    //     address _borrowerOperationsAddress,
    //     address _troveManagerAddress,
    //     address _kumoStakingAddress
    // )
    //     BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
    //     KUMOStakingScript(_kumoStakingAddress)
    // {
    //     checkContract(_troveManagerAddress);
    //     ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
    //     troveManager = troveManagerCached;
    //     IStabilityPool stabilityPoolCached = troveManagerCached.stabilityPool();
    //     checkContract(address(stabilityPoolCached));
    //     stabilityPool = stabilityPoolCached;
    //     IPriceFeed priceFeedCached = troveManagerCached.kumoParams().priceFeed();
    //     checkContract(address(priceFeedCached));
    //     priceFeed = priceFeedCached;
    //     address kusdTokenCached = address(troveManagerCached.kusdToken());
    //     checkContract(kusdTokenCached);
    //     kusdToken = IERC20(kusdTokenCached);
    //     address kumoTokenCached = address(troveManagerCached.kumoToken());
    //     checkContract(kumoTokenCached);
    //     kumoToken = IERC20(kumoTokenCached);
    //     IKUMOStaking kumoStakingCached = troveManagerCached.kumoStaking();
    //     require(
    //         _kumoStakingAddress == address(kumoStakingCached),
    //         "BorrowerWrappersScript: Wrong KUMOStaking address"
    //     );
    //     kumoStaking = kumoStakingCached;
    // }
    // function claimCollateralAndOpenTrove(
    //     address _asset,
    //     uint256 _maxFee,
    //     uint256 _KUSDAmount,
    //     address _upperHint,
    //     address _lowerHint
    // ) external payable {
    //     uint256 balanceBefore = address(this).balance;
    //     // Claim collateral
    //     borrowerOperations.claimCollateral(_asset);
    //     uint256 balanceAfter = address(this).balance;
    //     // already checked in CollSurplusPool
    //     assert(balanceAfter > balanceBefore);
    //     uint256 totalCollateral = balanceAfter.sub(balanceBefore).add(msg.value);
    //     // Open trove with obtained collateral, plus collateral sent by user
    //     borrowerOperations.openTrove{value: _asset == address(0) ? totalCollateral : 0}(
    //         _asset,
    //         totalCollateral,
    //         _maxFee,
    //         _KUSDAmount,
    //         _upperHint,
    //         _lowerHint
    //     );
    // }
    // function claimSPRewardsAndRecycle(
    //     address _asset,
    //     uint256 _maxFee,
    //     address _upperHint,
    //     address _lowerHint
    // ) external {
    //     Local_var memory vars = Local_var(_asset, _maxFee, _upperHint, _lowerHint, 0);
    //     uint256 collBalanceBefore = address(this).balance;
    //     uint256 kumoBalanceBefore = kumoToken.balanceOf(address(this));
    //     // Claim rewards
    //     stabilityPool.withdrawFromSP(0);
    //     uint256 collBalanceAfter = address(this).balance;
    //     uint256 kumoBalanceAfter = kumoToken.balanceOf(address(this));
    //     uint256 claimedCollateral = collBalanceAfter.sub(collBalanceBefore);
    //     // Add claimed ETH to trove, get more KUSD and stake it into the Stability Pool
    //     if (claimedCollateral > 0) {
    //         _requireUserHasTrove(vars._asset, address(this));
    //         vars.netKUSDAmount = _getNetKUSDAmount(vars._asset, claimedCollateral);
    //         borrowerOperations.adjustTrove{value: vars._asset == address(0) ? claimedCollateral : 0}(
    //             vars._asset,
    //             claimedCollateral,
    //             vars._maxFee,
    //             0,
    //             vars.netKUSDAmount,
    //             true,
    //             vars._upperHint,
    //             vars._lowerHint
    //         );
    //         // Provide withdrawn KUSD to Stability Pool
    //         if (vars.netKUSDAmount > 0) {
    //             stabilityPool.provideToSP(vars.netKUSDAmount, address(0));
    //         }
    //     }
    //     // Stake claimed KUMO
    //     uint256 claimedKUMO = kumoBalanceAfter.sub(kumoBalanceBefore);
    //     if (claimedKUMO > 0) {
    //         kumoStaking.stake(claimedKUMO);
    //     }
    // }
    // function claimStakingGainsAndRecycle(
    //     address _asset,
    //     uint256 _maxFee,
    //     address _upperHint,
    //     address _lowerHint
    // ) external {
    //     Local_var memory vars = Local_var(_asset, _maxFee, _upperHint, _lowerHint, 0);
    //     uint256 collBalanceBefore = address(this).balance;
    //     uint256 kusdBalanceBefore = kusdToken.balanceOf(address(this));
    //     uint256 kumoBalanceBefore = kumoToken.balanceOf(address(this));
    //     // Claim gains
    //     kumoStaking.unstake(0);
    //     uint256 gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
    //     uint256 gainedKUSD = kusdToken.balanceOf(address(this)).sub(kusdBalanceBefore);
    //     //  uint256 netKUSDAmount;
    //     // Top up trove and get more KUSD, keeping ICR constant
    //     if (gainedCollateral > 0) {
    //         _requireUserHasTrove(vars._asset, address(this));
    //         vars.netKUSDAmount = _getNetKUSDAmount(vars._asset, gainedCollateral);
    //         borrowerOperations.adjustTrove{value: vars._asset == address(0) ? gainedCollateral : 0}(
    //             vars._asset,
    //             gainedCollateral,
    //             vars._maxFee,
    //             0,
    //             vars.netKUSDAmount,
    //             true,
    //             vars._upperHint,
    //             vars._lowerHint
    //         );
    //     }
    //     uint256 totalKUSD = gainedKUSD.add(vars.netKUSDAmount);
    //     if (totalKUSD > 0) {
    //         stabilityPool.provideToSP(totalKUSD, address(0));
    //         // Providing to Stability Pool also triggers KUMO claim, so stake it if any
    //         uint256 kumoBalanceAfter = kumoToken.balanceOf(address(this));
    //         uint256 claimedKUMO = kumoBalanceAfter.sub(kumoBalanceBefore);
    //         if (claimedKUMO > 0) {
    //             kumoStaking.stake(claimedKUMO);
    //         }
    //     }
    // }
    // function _getNetKUSDAmount(address _asset, uint256 _collateral) internal returns (uint256) {
    //     uint256 price = priceFeed.fetchPrice();
    //     uint256 ICR = troveManager.getCurrentICR(_asset, address(this), price);
    //     uint256 KUSDAmount = _collateral.mul(price).div(ICR);
    //     uint256 borrowingRate = troveManager.getBorrowingRateWithDecay(_asset);
    //     uint256 netDebt = KUSDAmount.mul(KumoMath.DECIMAL_PRECISION).div(
    //         KumoMath.DECIMAL_PRECISION.add(borrowingRate)
    //     );
    //     return netDebt;
    // }
    // function _requireUserHasTrove(address _asset, address _depositor) internal view {
    //     require(
    //         troveManager.getTroveStatus(_asset, _depositor) == 1,
    //         "BorrowerWrappersScript: caller must have an active trove"
    //     );
    // }
}
