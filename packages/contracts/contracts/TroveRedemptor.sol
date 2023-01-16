// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./TroveManager.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/IKUSDToken.sol";
import "./Interfaces/ITroveRedemptor.sol";
import "./Interfaces/IKumoParameters.sol";
import "./Dependencies/KumoBase.sol";
import "./Dependencies/TroveManagerModel.sol";

contract TroveRedemptor is KumoBase, ITroveRedemptor {
    using SafeMath for uint256;

    TroveManager private troveManager;
    ISortedTroves private sortedTroves;
    IKUSDToken private kusdToken;

    modifier onlyTroveManager() {
        require(msg.sender == address(troveManager), "TroveRedemptor: Only TroveManager");
        _;
    }

    function setAddresses(
        address _troveManagerAddress,
        address _sortedTrovesAddress,
        address _kusdTokenAddress,
        address _kumoParamsAddress
    ) external {
        troveManager = TroveManager(_troveManagerAddress);
        kumoParams = IKumoParameters(_kumoParamsAddress);
        kusdToken = IKUMOToken(_kusdTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
    }

    function redeemCollateral(
        address _asset,
        address _caller,
        uint256 _KUSDamount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR,
        uint256 _maxIterations,
        uint256 _maxFeePercentage
    ) external override onlyTroveManager {
        RedemptionTotals memory totals;

        // requireValidMaxFeePercentage
        require(
            _maxFeePercentage >= kumoParams.REDEMPTION_FEE_FLOOR(_asset) &&
                _maxFeePercentage <= DECIMAL_PRECISION,
            "TroveRedemptor: Max fee percentage must be between 0.5% and 100%"
        );

        // requireAfterBootstrapPeriod
        uint256 systemDeploymentTime = kusdToken.getDeploymentStartTime();
        require(
            block.timestamp >= systemDeploymentTime.add(kumoParams.BOOTSTRAP_PERIOD()),
            "TroveRedemptor: Redemptions are not allowed during bootstrap phase"
        );

        totals.price = kumoParams.priceFeed().fetchPrice(_asset);

        // requireTCRoverMCR
        require(
            _getTCR(_asset, totals.price) >= kumoParams.MCR(_asset),
            "TroveRedemptor: Cannot redeem when TCR < MCR"
        );

        // _requireAmountGreaterThanZero
        require(_KUSDamount > 0, "TroveManager: Amount must be greater than zero");

        // _requireKUSDBalanceCoversRedemption(contractsCache.kusdToken, msg.sender, _KUSDamount);
        require(
            kusdToken.balanceOf(_caller) >= _KUSDamount,
            "TroveRedemptor: Requested redemption amount must be <= user's KUSD token balance"
        );

        totals.totalKUSDSupplyAtStart = getEntireSystemDebt(_asset);
        totals.remainingKUSD = _KUSDamount;
        address currentBorrower;

        if (troveManager.isValidFirstRedemptionHint(_asset, _firstRedemptionHint, totals.price)) {
            currentBorrower = _firstRedemptionHint;
        } else {
            currentBorrower = sortedTroves.getLast(_asset);
            // Find the first trove with ICR >= MCR
            while (
                currentBorrower != address(0) &&
                troveManager.getCurrentICR(_asset, currentBorrower, totals.price) <
                kumoParams.MCR(_asset)
            ) {
                currentBorrower = sortedTroves.getPrev(_asset, currentBorrower);
            }
        }

        // Loop through the Troves starting from the one with lowest collateral ratio until _amount of KUSD is exchanged for collateral
        if (_maxIterations == 0) {
            _maxIterations = type(uint256).max;
        }
        while (currentBorrower != address(0) && totals.remainingKUSD > 0 && _maxIterations > 0) {
            _maxIterations--;
            // Save the address of the Trove preceding the current one, before potentially modifying the list
            address nextUserToCheck = sortedTroves.getPrev(_asset, currentBorrower);

            troveManager.applyPendingRewards(_asset, currentBorrower);

            SingleRedemptionValues memory singleRedemption = _redeemCollateralFromTrove(
                _asset,
                currentBorrower,
                totals.remainingKUSD,
                totals.price,
                _upperPartialRedemptionHint,
                _lowerPartialRedemptionHint,
                _partialRedemptionHintNICR
            );

            if (singleRedemption.cancelledPartial) break; // Partial redemption was cancelled (out-of-date hint, or new net debt < minimum), therefore we could not redeem from the last Trove

            totals.totalKUSDToRedeem = totals.totalKUSDToRedeem.add(singleRedemption.KUSDLot);
            totals.totalAssetDrawn = totals.totalAssetDrawn.add(singleRedemption.AssetLot);

            totals.remainingKUSD = totals.remainingKUSD.sub(singleRedemption.KUSDLot);
            currentBorrower = nextUserToCheck;
        }
        require(totals.totalAssetDrawn > 0, "TroveRedemptor: Unable to redeem any amount");

        // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
        // Use the saved total KUSD supply value, from before it was reduced by the redemption.
        troveManager.updateBaseRateFromRedemption(
            _asset,
            totals.totalAssetDrawn,
            totals.price,
            totals.totalKUSDSupplyAtStart
        );

        // Calculate the ETH fee
        totals.AssetFee = troveManager.getRedemptionFee(_asset, totals.totalAssetDrawn);

        _requireUserAcceptsFee(totals.AssetFee, totals.totalAssetDrawn, _maxFeePercentage);

        troveManager.finalizeRedemption(
            _asset,
            msg.sender,
            _KUSDamount,
            totals.totalKUSDToRedeem,
            totals.AssetFee,
            totals.totalAssetDrawn
        );
    }
}
