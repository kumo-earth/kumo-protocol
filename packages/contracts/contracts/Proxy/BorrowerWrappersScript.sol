// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Dependencies/SafeMath.sol";
import "../Dependencies/KumoMath.sol";
import "../Dependencies/IERC20.sol";
import "../Interfaces/IBorrowerOperations.sol";
import "../Interfaces/ITroveManager.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IPriceFeed.sol";
import "../Interfaces/IKUMOStaking.sol";
import "./BorrowerOperationsScript.sol";
import "./ETHTransferScript.sol";
import "./KUMOStakingScript.sol";
import "../Dependencies/console.sol";


contract BorrowerWrappersScript is BorrowerOperationsScript, ETHTransferScript, KUMOStakingScript {
    using SafeMath for uint;

    string constant public NAME = "BorrowerWrappersScript";

    ITroveManager immutable troveManager;
    IStabilityPool immutable stabilityPool;
    IPriceFeed immutable priceFeed;
    IERC20 immutable kusdToken;
    IERC20 immutable kumoToken;
    IKUMOStaking immutable kumoStaking;

    constructor (
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _kumoStakingAddress
    )
        BorrowerOperationsScript(IBorrowerOperations(_borrowerOperationsAddress))
        KUMOStakingScript(_kumoStakingAddress)
    {
        checkContract(_troveManagerAddress);
        ITroveManager troveManagerCached = ITroveManager(_troveManagerAddress);
        troveManager = troveManagerCached;

        IStabilityPool stabilityPoolCached = troveManagerCached.stabilityPool();
        checkContract(address(stabilityPoolCached));
        stabilityPool = stabilityPoolCached;

        IPriceFeed priceFeedCached = troveManagerCached.priceFeed();
        checkContract(address(priceFeedCached));
        priceFeed = priceFeedCached;

        address kusdTokenCached = address(troveManagerCached.kusdToken());
        checkContract(kusdTokenCached);
        kusdToken = IERC20(kusdTokenCached);

        address kumoTokenCached = address(troveManagerCached.kumoToken());
        checkContract(kumoTokenCached);
        kumoToken = IERC20(kumoTokenCached);

        IKUMOStaking kumoStakingCached = troveManagerCached.kumoStaking();
        require(_kumoStakingAddress == address(kumoStakingCached), "BorrowerWrappersScript: Wrong KUMOStaking address");
        kumoStaking = kumoStakingCached;
    }

    function claimCollateralAndOpenTrove(uint _maxFee, uint _KUSDAmount, address _upperHint, address _lowerHint) external payable {
        uint balanceBefore = address(this).balance;

        // Claim collateral
        borrowerOperations.claimCollateral();

        uint balanceAfter = address(this).balance;

        // already checked in CollSurplusPool
        assert(balanceAfter > balanceBefore);

        uint totalCollateral = balanceAfter.sub(balanceBefore).add(msg.value);

        // Open trove with obtained collateral, plus collateral sent by user
        borrowerOperations.openTrove{ value: totalCollateral }(_maxFee, _KUSDAmount, _upperHint, _lowerHint);
    }

    function claimSPRewardsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint kumoBalanceBefore = kumoToken.balanceOf(address(this));

        // Claim rewards
        stabilityPool.withdrawFromSP(0);

        uint collBalanceAfter = address(this).balance;
        uint kumoBalanceAfter = kumoToken.balanceOf(address(this));
        uint claimedCollateral = collBalanceAfter.sub(collBalanceBefore);

        // Add claimed ETH to trove, get more KUSD and stake it into the Stability Pool
        if (claimedCollateral > 0) {
            _requireUserHasTrove(address(this));
            uint KUSDAmount = _getNetKUSDAmount(claimedCollateral);
            borrowerOperations.adjustTrove{ value: claimedCollateral }(_maxFee, 0, KUSDAmount, true, _upperHint, _lowerHint);
            // Provide withdrawn KUSD to Stability Pool
            if (KUSDAmount > 0) {
                stabilityPool.provideToSP(KUSDAmount, address(0));
            }
        }

        // Stake claimed KUMO
        uint claimedKUMO = kumoBalanceAfter.sub(kumoBalanceBefore);
        if (claimedKUMO > 0) {
            kumoStaking.stake(claimedKUMO);
        }
    }

    function claimStakingGainsAndRecycle(uint _maxFee, address _upperHint, address _lowerHint) external {
        uint collBalanceBefore = address(this).balance;
        uint kusdBalanceBefore = kusdToken.balanceOf(address(this));
        uint kumoBalanceBefore = kumoToken.balanceOf(address(this));

        // Claim gains
        kumoStaking.unstake(0);

        uint gainedCollateral = address(this).balance.sub(collBalanceBefore); // stack too deep issues :'(
        uint gainedKUSD = kusdToken.balanceOf(address(this)).sub(kusdBalanceBefore);

        uint netKUSDAmount;
        // Top up trove and get more KUSD, keeping ICR constant
        if (gainedCollateral > 0) {
            _requireUserHasTrove(address(this));
            netKUSDAmount = _getNetKUSDAmount(gainedCollateral);
            borrowerOperations.adjustTrove{ value: gainedCollateral }(_maxFee, 0, netKUSDAmount, true, _upperHint, _lowerHint);
        }

        uint totalKUSD = gainedKUSD.add(netKUSDAmount);
        if (totalKUSD > 0) {
            stabilityPool.provideToSP(totalKUSD, address(0));

            // Providing to Stability Pool also triggers KUMO claim, so stake it if any
            uint kumoBalanceAfter = kumoToken.balanceOf(address(this));
            uint claimedKUMO = kumoBalanceAfter.sub(kumoBalanceBefore);
            if (claimedKUMO > 0) {
                kumoStaking.stake(claimedKUMO);
            }
        }

    }

    function _getNetKUSDAmount(uint _collateral) internal returns (uint) {
        uint price = priceFeed.fetchPrice();
        uint ICR = troveManager.getCurrentICR(address(this), price);

        uint KUSDAmount = _collateral.mul(price).div(ICR);
        uint borrowingRate = troveManager.getBorrowingRateWithDecay();
        uint netDebt = KUSDAmount.mul(KumoMath.DECIMAL_PRECISION).div(KumoMath.DECIMAL_PRECISION.add(borrowingRate));

        return netDebt;
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(troveManager.getTroveStatus(_depositor) == 1, "BorrowerWrappersScript: caller must have an active trove");
    }
}
