// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "./Interfaces/ITroveManager.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Dependencies/KumoBase.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafeMath.sol";

contract HintHelpers is KumoBase, CheckContract {
    using SafeMath for uint256;
    string constant public NAME = "HintHelpers";

    struct LocalRedemptionVars {
		address _asset;
	}

	bool public isInitialized;
    ISortedTroves public sortedTroves;
    ITroveManager public troveManager;

    // --- Events ---

    event SortedTrovesAddressChanged(address _sortedTrovesAddress);
    event TroveManagerAddressChanged(address _troveManagerAddress);

    // --- Dependency setters ---

    function setAddresses(
        address _sortedTrovesAddress,
        address _troveManagerAddress,
        address _vaultParametersAddress
    )
        external
        onlyOwner 
        {
		// require(!isInitialized, "Already initialized");
		checkContract(_sortedTrovesAddress);
		checkContract(_troveManagerAddress);
		checkContract(_vaultParametersAddress);
		// isInitialized = true;

		// __Ownable_init();

        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        troveManager = ITroveManager(_troveManagerAddress);

        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);

        setKumoParameters(_vaultParametersAddress);

        _renounceOwnership();
    }

    // --- Functions ---

    /* getRedemptionHints() - Helper function for finding the right hints to pass to redeemCollateral().
     *
     * It simulates a redemption of `_KUSDamount` to figure out where the redemption sequence will start and what state the final Trove
     * of the sequence will end up in.
     *
     * Returns three hints:
     *  - `firstRedemptionHint` is the address of the first Trove with ICR >= MCR (i.e. the first Trove that will be redeemed).
     *  - `partialRedemptionHintNICR` is the final nominal ICR of the last Trove of the sequence after being hit by partial redemption,
     *     or zero in case of no partial redemption.
     *  - `truncatedKUSDamount` is the maximum amount that can be redeemed out of the the provided `_KUSDamount`. This can be lower than
     *    `_KUSDamount` when redeeming the full amount would leave the last Trove of the redemption sequence with less net debt than the
     *    minimum allowed value (i.e. MIN_NET_DEBT).
     *
     * The number of Troves to consider for redemption can be capped by passing a non-zero value as `_maxIterations`, while passing zero
     * will leave it uncapped.
     */

    function getRedemptionHints(
        address _asset,
        uint256 _KUSDamount, 
        uint256 _price,
        uint256 _maxIterations
    )
        external
        view
        returns (
            address firstRedemptionHint,
            uint256 partialRedemptionHintNICR,
            uint256 truncatedKUSDamount
        )
    {
        ISortedTroves sortedTrovesCached = sortedTroves;
        LocalRedemptionVars memory vars = LocalRedemptionVars(
			_asset
		);

        uint256 remainingKUSD = _KUSDamount;
        address currentTroveuser = sortedTrovesCached.getLast(vars._asset);

        while (currentTroveuser != address(0) && troveManager.getCurrentICR(vars._asset, currentTroveuser, _price) < kumoParams.MCR(_asset)) {
            currentTroveuser = sortedTrovesCached.getPrev(vars._asset, currentTroveuser);
        }

        firstRedemptionHint = currentTroveuser;

        if (_maxIterations == 0) {
            _maxIterations = type(uint256).max;
        }

        while (currentTroveuser != address(0) && remainingKUSD > 0 && _maxIterations-- > 0) {
            uint256 netKUSDDebt = _getNetDebt(vars._asset, troveManager.getTroveDebt(vars._asset, currentTroveuser))
                .add(troveManager.getPendingKUSDDebtReward(vars._asset, currentTroveuser));

            if (netKUSDDebt > remainingKUSD) {
                if (netKUSDDebt > kumoParams.MIN_NET_DEBT(vars._asset)) {
                    uint256 maxRedeemableKUSD = KumoMath._min(remainingKUSD, netKUSDDebt.sub(kumoParams.MIN_NET_DEBT(vars._asset)));

                    uint256 ETH = troveManager.getTroveColl(vars._asset,  currentTroveuser)
                        .add(troveManager.getPendingReward(vars._asset, currentTroveuser));

                    uint256 newColl = ETH.sub(maxRedeemableKUSD.mul(DECIMAL_PRECISION).div(_price));
                    uint256 newDebt = netKUSDDebt.sub(maxRedeemableKUSD);

                    uint256 compositeDebt = _getCompositeDebt(vars._asset, newDebt);
                    partialRedemptionHintNICR = KumoMath._computeNominalCR(newColl, compositeDebt);

                    remainingKUSD = remainingKUSD.sub(maxRedeemableKUSD);
                }
                break;
            } else {
                remainingKUSD = remainingKUSD.sub(netKUSDDebt);
            }

            currentTroveuser = sortedTrovesCached.getPrev(_asset, currentTroveuser);
        }

        truncatedKUSDamount = _KUSDamount.sub(remainingKUSD);
    }

    /* getApproxHint() - return address of a Trove that is, on average, (length / numTrials) positions away in the 
    sortedTroves list from the correct insert position of the Trove to be inserted. 
    
    Note: The output address is worst-case O(n) positions away from the correct insert position, however, the function 
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput address will 
    be <= sqrt(length) positions away from the correct insert position.
    */
    function getApproxHint(address _asset, uint256 _CR, uint256 _numTrials, uint256 _inputRandomSeed)
        external
        view
        returns (address hintAddress, uint256 diff, uint256 latestRandomSeed)
    {
        uint256 arrayLength = troveManager.getTroveOwnersCount(_asset);

        if (arrayLength == 0) {
            return (address(0), 0, _inputRandomSeed);
        }

        hintAddress = sortedTroves.getLast(_asset);
        diff = KumoMath._getAbsoluteDifference(_CR, troveManager.getNominalICR(_asset, hintAddress));
        latestRandomSeed = _inputRandomSeed;

        uint256 i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint256(keccak256(abi.encodePacked(latestRandomSeed)));

            uint256 arrayIndex = latestRandomSeed % arrayLength;
            address currentAddress = troveManager.getTroveFromTroveOwnersArray(_asset, arrayIndex);
            uint256 currentNICR = troveManager.getNominalICR(_asset, currentAddress);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint256 currentDiff = KumoMath._getAbsoluteDifference(currentNICR, _CR);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
    }

    function computeNominalCR(uint256 _coll, uint256 _debt) external pure returns (uint256) {
        return KumoMath._computeNominalCR(_coll, _debt);
    }

    function computeCR(uint256 _coll, uint256 _debt, uint256 _price) external pure returns (uint256) {
        return KumoMath._computeCR(_coll, _debt, _price);
    }
}
