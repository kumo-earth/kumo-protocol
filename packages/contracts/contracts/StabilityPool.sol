// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/IStabilityPool.sol";
import "./Interfaces/IBorrowerOperations.sol";
import "./Interfaces/ITroveManagerDiamond.sol";
import "./Interfaces/IKUSDToken.sol";
import "./Interfaces/ISortedTroves.sol";
import "./Interfaces/ICommunityIssuance.sol";
import "./Dependencies/KumoBase.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/KumoSafeMath128.sol";
import "./Dependencies/CheckContract.sol";
import "./Dependencies/SafetyTransfer.sol";

/*
 * The Stability Pool holds KUSD tokens deposited by Stability Pool depositors.
 *
 * When a trove is liquidated, then depending on system conditions, some of its KUSD debt gets offset with
 * KUSD in the Stability Pool:  that is, the offset debt evaporates, and an equal amount of KUSD tokens in the Stability Pool is burned.
 *
 * Thus, a liquidation causes each depositor to receive a KUSD loss, in proportion to their deposit as a share of total deposits.
 * They also receive an ETH gain, as the ETH collateral of the liquidated trove is distributed among Stability depositors,
 * in the same proportion.
 *
 * When a liquidation occurs, it depletes every deposit by the same fraction: for example, a liquidation that depletes 40%
 * of the total KUSD in the Stability Pool, depletes 40% of each deposit.
 *
 * A deposit that has experienced a series of liquidations is termed a "compounded deposit": each liquidation depletes the deposit,
 * multiplying it by some factor in range ]0,1[
 *
 *
 * --- IMPLEMENTATION ---
 *
 * We use a highly scalable method of tracking deposits and ETH gains that has O(1) complexity.
 *
 * When a liquidation occurs, rather than updating each depositor's deposit and ETH gain, we simply update two state variables:
 * a product P, and a sum S.
 *
 * A mathematical manipulation allows us to factor out the initial deposit, and accurately track all depositors' compounded deposits
 * and accumulated ETH gains over time, as liquidations occur, using just these two variables P and S. When depositors join the
 * Stability Pool, they get a snapshot of the latest P and S: P_t and S_t, respectively.
 *
 * The formula for a depositor's accumulated ETH gain is derived here:
 * https://github.com/liquity/dev/blob/main/packages/contracts/mathProofs/Scalable%20Compounding%20Stability%20Pool%20Deposits.pdf
 *
 * For a given deposit d_t, the ratio P/P_t tells us the factor by which a deposit has decreased since it joined the Stability Pool,
 * and the term d_t * (S - S_t)/P_t gives us the deposit's total accumulated ETH gain.
 *
 * Each liquidation updates the product P and sum S. After a series of liquidations, a compounded deposit and corresponding ETH gain
 * can be calculated using the initial deposit, the depositor’s snapshots of P and S, and the latest values of P and S.
 *
 * Any time a depositor updates their deposit (withdrawal, top-up) their accumulated ETH gain is paid out, their new deposit is recorded
 * (based on their latest compounded deposit and modified by the withdrawal/top-up), and they receive new snapshots of the latest P and S.
 * Essentially, they make a fresh deposit that overwrites the old one.
 *
 *
 * --- SCALE FACTOR ---
 *
 * Since P is a running product in range ]0,1] that is always-decreasing, it should never reach 0 when multiplied by a number in range ]0,1[.
 * Unfortunately, Solidity floor division always reaches 0, sooner or later.
 *
 * A series of liquidations that nearly empty the Pool (and thus each multiply P by a very small number in range ]0,1[ ) may push P
 * to its 18 digit decimal limit, and round it to 0, when in fact the Pool hasn't been emptied: this would break deposit tracking.
 *
 * So, to track P accurately, we use a scale factor: if a liquidation would cause P to decrease to <1e-9 (and be rounded to 0 by Solidity),
 * we first multiply P by 1e9, and increment a currentScale factor by 1.
 *
 * The added benefit of using 1e9 for the scale factor (rather than 1e18) is that it ensures negligible precision loss close to the
 * scale boundary: when P is at its minimum value of 1e9, the relative precision loss in P due to floor division is only on the
 * order of 1e-9.
 *
 * --- EPOCHS ---
 *
 * Whenever a liquidation fully empties the Stability Pool, all deposits should become 0. However, setting P to 0 would make P be 0
 * forever, and break all future reward calculations.
 *
 * So, every time the Stability Pool is emptied by a liquidation, we reset P = 1 and currentScale = 0, and increment the currentEpoch by 1.
 *
 * --- TRACKING DEPOSIT OVER SCALE CHANGES AND EPOCHS ---
 *
 * When a deposit is made, it gets snapshots of the currentEpoch and the currentScale.
 *
 * When calculating a compounded deposit, we compare the current epoch to the deposit's epoch snapshot. If the current epoch is newer,
 * then the deposit was present during a pool-emptying liquidation, and necessarily has been depleted to 0.
 *
 * Otherwise, we then compare the current scale to the deposit's scale snapshot. If they're equal, the compounded deposit is given by d_t * P/P_t.
 * If it spans one scale change, it is given by d_t * P/(P_t * 1e9). If it spans more than one scale change, we define the compounded deposit
 * as 0, since it is now less than 1e-9'th of its initial value (e.g. a deposit of 1 billion KUSD has depleted to < 1 KUSD).
 *
 *
 *  --- TRACKING DEPOSITOR'S ETH GAIN OVER SCALE CHANGES AND EPOCHS ---
 *
 * In the current epoch, the latest value of S is stored upon each scale change, and the mapping (scale -> S) is stored for each epoch.
 *
 * This allows us to calculate a deposit's accumulated ETH gain, during the epoch in which the deposit was non-zero and earned ETH.
 *
 * We calculate the depositor's accumulated ETH gain for the scale at which they made the deposit, using the ETH gain formula:
 * e_1 = d_t * (S - S_t) / P_t
 *
 * and also for scale after, taking care to divide the latter by a factor of 1e9:
 * e_2 = d_t * S / (P_t * 1e9)
 *
 * The gain in the second scale will be full, as the starting point was in the previous scale, thus no need to subtract anything.
 * The deposit therefore was present for reward events from the beginning of that second scale.
 *
 *        S_i-S_t + S_{i+1}
 *      .<--------.------------>
 *      .         .
 *      . S_i     .   S_{i+1}
 *   <--.-------->.<----------->
 *   S_t.         .
 *   <->.         .
 *      t         .
 *  |---+---------|-------------|-----...
 *         i            i+1
 *
 * The sum of (e_1 + e_2) captures the depositor's total accumulated ETH gain, handling the case where their
 * deposit spanned one scale change. We only care about gains across one scale change, since the compounded
 * deposit is defined as being 0 once it has spanned more than one scale change.
 *
 *
 * --- UPDATING P WHEN A LIQUIDATION OCCURS ---
 *
 * Please see the implementation spec in the proof document, which closely follows on from the compounded deposit / ETH gain derivations:
 * https://github.com/liquity/liquity/blob/master/papers/Scalable_Reward_Distribution_with_Compounding_Stakes.pdf
 *
 */
contract StabilityPool is KumoBase, CheckContract, IStabilityPool {
    using KumoSafeMath128 for uint128;
    using SafeMath for uint256;
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // bool public isInitialized;

    string public constant NAME = "StabilityPool";
    bytes32 public constant STABILITY_POOL_NAME_BYTES =
        0xf704b47f65a99b2219b7213612db4be4a436cdf50624f4baca1373ef0de0aac7;

    IBorrowerOperations public borrowerOperations;

    ITroveManagerDiamond public troveManager;

    IKUSDToken public kusdToken;

    // Needed to check if there are pending liquidations
    ISortedTroves public sortedTroves;

    ICommunityIssuance public communityIssuance;

    address internal assetAddress;

    uint256 internal assetBalance; // deposited asset tracker

    // Tracker for KUSD held in the pool. Changes when users deposit/withdraw, and when Trove debt is offset.
    uint256 internal totalKUSDDeposits;

    // --- Data structures ---

    struct Snapshots {
        uint256 S;
        uint256 P;
        uint128 scale;
        uint128 epoch;
    }

    mapping(address => uint256) public deposits; // depositor address -> uint256 value
    mapping(address => Snapshots) public depositSnapshots; // depositor address -> snapshots struct

    /*  Product 'P': Running product by which to multiply an initial deposit, in order to find the current compounded deposit,
     * after a series of liquidations have occurred, each of which cancel some KUSD debt with the deposit.
     *
     * During its lifetime, a deposit's value evolves from d_t to d_t * P / P_t , where P_t
     * is the snapshot of P taken at the instant the deposit was made. 18-digit decimal.
     */
    uint256 public P = DECIMAL_PRECISION;

    uint256 public constant SCALE_FACTOR = 1e9;

    // Each time the scale of P shifts by SCALE_FACTOR, the scale is incremented by 1
    uint128 public currentScale;

    // With each offset that fully empties the Pool, the epoch is incremented by 1
    uint128 public currentEpoch;

    /* ETH Gain sum 'S': During its lifetime, each deposit d_t earns an ETH gain of ( d_t * [S - S_t] )/P_t, where S_t
     * is the depositor's snapshot of S taken at the time t when the deposit was made.
     *
     * The 'S' sums are stored in a nested mapping (epoch => scale => sum):
     *
     * - The inner mapping records the sum S at different scales
     * - The outer mapping records the (scale => sum) mappings, for different epochs.
     */
    mapping(uint128 => mapping(uint128 => uint256)) public epochToScaleToSum;

    // Error trackers for the error correction in the offset calculation
    uint256 public lastETHError_Offset;
    uint256 public lastKUSDLossError_Offset;

    // --- Moved staking capabilities ---

    // Tracker for KUSD from fees held in the pool. Changes when users borrow/redeem, and when users withdraw gains.
    uint256 internal totalKUSDGains;

    uint256 public F_ASSET; // Running sum of Asset fees per-KUSD-staked
    uint256 public F_KUSD; // Running sum of KUSD fees per-KUSD-staked

    // User snapshots of F_ASSET and F_KUSD, taken at the point at which their latest deposit was made
    mapping(address => StakingSnapshot) public stakingSnapshots;

    struct StakingSnapshot {
        uint256 F_ASSET_Snapshot;
        uint256 F_KUSD_Snapshot;
    }

    struct LocalVariables_AssetGainFromSnapshots {
        uint128 epochSnapshot;
        uint128 scaleSnapshot;
        uint256 S_Snapshot;
        uint256 P_Snapshot;
        uint256 firstPortion;
        uint256 secondPortion;
        uint256 SPAssetGain;
        uint256 F_ASSET_Snapshot;
        uint256 StakingAssetGain;
    }

    // --- Contract setters ---
    function getNameBytes() external pure override returns (bytes32) {
        return STABILITY_POOL_NAME_BYTES;
    }

    function getAssetType() external view override returns (address) {
        return assetAddress;
    }

    function setAddresses(
        address _assetAddress,
        address _borrowerOperationsAddress,
        address _troveManagerAddress,
        address _kusdTokenAddress,
        address _sortedTrovesAddress,
        address _communityIssuanceAddress,
        address _kumoParamsAddress
    ) external override onlyOwner {
        // require(!isInitialized, "Already initialized");
        checkContract(_borrowerOperationsAddress);
        checkContract(_troveManagerAddress);
        checkContract(_kusdTokenAddress);
        checkContract(_sortedTrovesAddress);
        checkContract(_communityIssuanceAddress);
        checkContract(_kumoParamsAddress);

        // isInitialized = true;
        // __Ownable_init();

        checkContract(_assetAddress);

        assetAddress = _assetAddress;

        borrowerOperations = IBorrowerOperations(_borrowerOperationsAddress);
        troveManager = ITroveManagerDiamond(_troveManagerAddress);
        kusdToken = IKUSDToken(_kusdTokenAddress);
        sortedTroves = ISortedTroves(_sortedTrovesAddress);
        communityIssuance = ICommunityIssuance(_communityIssuanceAddress);

        setKumoParameters(_kumoParamsAddress);

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit TroveManagerAddressChanged(_troveManagerAddress);
        emit KUSDTokenAddressChanged(_kusdTokenAddress);
        emit SortedTrovesAddressChanged(_sortedTrovesAddress);
        emit CommunityIssuanceAddressChanged(_communityIssuanceAddress);

        // _renounceOwnership(); --> Needs to be paused because of current test deployment with adding an asset to the system
    }

    // --- Getters for public variables. Required by IPool interface ---

    function getAssetBalance() external view override returns (uint256) {
        return assetBalance;
    }

    function getTotalKUSDDeposits() external view override returns (uint256) {
        return totalKUSDDeposits;
    }

    // --- External Depositor Functions ---

    /*  provideToSP():
     *
     * - Sends depositor's accumulated gains (Asset and KUSD, from the protocol revenue and stability pooling) to depositor.
     * - Increases deposit and takes new snapshot.
     */
    function provideToSP(uint256 _amount) external override {
        _requireNonZeroAmount(_amount);

        uint256 initialDeposit = deposits[msg.sender];

        uint256 depositorAssetGain = getDepositorAssetGain(msg.sender);
        uint256 depositorKUSDGain = getDepositorKUSDGain(msg.sender);

        uint256 compoundedKUSDDeposit = getCompoundedKUSDDeposit(msg.sender);
        uint256 KUSDLoss = initialDeposit.sub(compoundedKUSDDeposit); // Needed only for event log

        _sendKUSDtoStabilityPool(msg.sender, _amount);

        uint256 newDeposit = compoundedKUSDDeposit.add(_amount);
        _updateDepositAndSnapshots(msg.sender, newDeposit);

        emit UserDepositChanged(msg.sender, newDeposit);
        emit AssetGainWithdrawn(msg.sender, depositorAssetGain, KUSDLoss); // KUSD Loss required for event log
        emit KUSDGainWithdrawn(msg.sender, depositorKUSDGain);

        _sendAssetGainToDepositor(depositorAssetGain);
        _sendKUSDGainToDepositor(msg.sender, depositorKUSDGain);
    }

    /*  withdrawFromSP():
     *
     * - Sends all depositor's accumulated gains (Asset and KUSD, from the protocol revenue and stability pooling) to depositor
     * - Decreases deposit and takes new snapshot.
     *
     * If _amount > userDeposit, the user withdraws all of their compounded deposit.
     */
    function withdrawFromSP(uint256 _amount) external override {
        if (_amount != 0) {
            _requireNoUnderCollateralizedTroves();
        }
        uint256 initialDeposit = deposits[msg.sender];
        _requireUserHasDeposit(initialDeposit);

        uint256 depositorAssetGain = getDepositorAssetGain(msg.sender);
        uint256 depositorKUSDGain = getDepositorKUSDGain(msg.sender);

        uint256 compoundedKUSDDeposit = getCompoundedKUSDDeposit(msg.sender);
        uint256 KUSDtoWithdraw = KumoMath._min(_amount, compoundedKUSDDeposit);
        uint256 KUSDLoss = initialDeposit.sub(compoundedKUSDDeposit); // Needed only for event log

        _sendKUSDToDepositor(msg.sender, KUSDtoWithdraw);

        // Update deposit
        uint256 newDeposit = compoundedKUSDDeposit.sub(KUSDtoWithdraw);
        _updateDepositAndSnapshots(msg.sender, newDeposit);

        emit UserDepositChanged(msg.sender, newDeposit);
        emit AssetGainWithdrawn(msg.sender, depositorAssetGain, KUSDLoss); // KUSD Loss required for event log
        emit KUSDGainWithdrawn(msg.sender, depositorKUSDGain);

        _sendAssetGainToDepositor(depositorAssetGain);
        _sendKUSDGainToDepositor(msg.sender, depositorKUSDGain);
    }

    /* withdrawAssetGainToTrove:
     * - Transfers the depositor's entire Asset gain from the Stability Pool to the caller's trove
     * - Leaves their compounded deposit in the Stability Pool
     * - Updates snapshot for deposit */
    function withdrawAssetGainToTrove(address _upperHint, address _lowerHint) external {
        uint256 initialDeposit = deposits[msg.sender];
        _requireUserHasDeposit(initialDeposit);
        _requireUserHasTrove(msg.sender);
        _requireUserHasAssetGain(msg.sender);

        uint256 depositorAssetGain = getDepositorAssetGain(msg.sender);
        uint256 depositorKUSDGain = getDepositorKUSDGain(msg.sender);

        uint256 compoundedKUSDDeposit = getCompoundedKUSDDeposit(msg.sender);
        uint256 KUSDLoss = initialDeposit.sub(compoundedKUSDDeposit); // Needed only for event log

        _updateDepositAndSnapshots(msg.sender, compoundedKUSDDeposit);

        /* Emit events before transferring Asset gain to Trove.
         This lets the event log make more sense (i.e. so it appears that first the Asset gain is withdrawn
        and then it is deposited into the Trove, not the other way around). */
        emit AssetGainWithdrawn(msg.sender, depositorAssetGain, KUSDLoss);
        emit KUSDGainWithdrawn(msg.sender, depositorKUSDGain);
        emit UserDepositChanged(msg.sender, compoundedKUSDDeposit);

        assetBalance = assetBalance.sub(depositorAssetGain);
        emit StabilityPoolAssetBalanceUpdated(assetBalance);
        emit AssetSent(msg.sender, depositorAssetGain);

        borrowerOperations.moveAssetGainToTrove(
            assetAddress,
            depositorAssetGain,
            msg.sender,
            _upperHint,
            _lowerHint
        );

        _sendKUSDGainToDepositor(msg.sender, depositorKUSDGain);
    }

    // --- Liquidation functions ---

    /*
     * Cancels out the specified debt against the KUSD contained in the Stability Pool (as far as possible)
     * and transfers the Trove's ETH collateral from ActivePool to StabilityPool.
     * Only called by liquidation functions in the TroveManager.
     */
    function offset(uint256 _debtToOffset, uint256 _collToAdd) external override {
        _requireCallerIsTroveManager();
        uint256 totalKUSD = totalKUSDDeposits; // cached to save an SLOAD
        if (totalKUSD == 0 || _debtToOffset == 0) {
            return;
        }

        (uint256 ETHGainPerUnitStaked, uint256 KUSDLossPerUnitStaked) = _computeRewardsPerUnitStaked(
            _collToAdd,
            _debtToOffset,
            totalKUSD
        );

        _updateRewardSumAndProduct(ETHGainPerUnitStaked, KUSDLossPerUnitStaked); // updates S and P

        _moveOffsetCollAndDebt(_collToAdd, _debtToOffset);
    }

    // --- Offset helper functions ---

    function _computeRewardsPerUnitStaked(
        uint256 _collToAdd,
        uint256 _debtToOffset,
        uint256 _totalKUSDDeposits
    ) internal returns (uint256 ETHGainPerUnitStaked, uint256 KUSDLossPerUnitStaked) {
        /*
         * Compute the KUSD and ETH rewards. Uses a "feedback" error correction, to keep
         * the cumulative error in the P and S state variables low:
         *
         * 1) Form numerators which compensate for the floor division errors that occurred the last time this
         * function was called.
         * 2) Calculate "per-unit-staked" ratios.
         * 3) Multiply each ratio back by its denominator, to reveal the current floor division error.
         * 4) Store these errors for use in the next correction when this function is called.
         * 5) Note: static analysis tools complain about this "division before multiplication", however, it is intended.
         */
        uint256 ETHNumerator = _collToAdd.mul(DECIMAL_PRECISION).add(lastETHError_Offset);

        assert(_debtToOffset <= _totalKUSDDeposits);
        if (_debtToOffset == _totalKUSDDeposits) {
            KUSDLossPerUnitStaked = DECIMAL_PRECISION; // When the Pool depletes to 0, so does each deposit
            lastKUSDLossError_Offset = 0;
        } else {
            uint256 KUSDLossNumerator = _debtToOffset.mul(DECIMAL_PRECISION).sub(
                lastKUSDLossError_Offset
            );
            /*
             * Add 1 to make error in quotient positive. We want "slightly too much" KUSD loss,
             * which ensures the error in any given compoundedKUSDDeposit favors the Stability Pool.
             */
            KUSDLossPerUnitStaked = (KUSDLossNumerator.div(_totalKUSDDeposits)).add(1);
            lastKUSDLossError_Offset = (KUSDLossPerUnitStaked.mul(_totalKUSDDeposits)).sub(
                KUSDLossNumerator
            );
        }

        ETHGainPerUnitStaked = ETHNumerator.div(_totalKUSDDeposits);
        lastETHError_Offset = ETHNumerator.sub(ETHGainPerUnitStaked.mul(_totalKUSDDeposits));

        return (ETHGainPerUnitStaked, KUSDLossPerUnitStaked);
    }

    // Update the Stability Pool reward sum S and product P
    function _updateRewardSumAndProduct(
        uint256 _ETHGainPerUnitStaked,
        uint256 _KUSDLossPerUnitStaked
    ) internal {
        uint256 currentP = P;
        uint256 newP;

        assert(_KUSDLossPerUnitStaked <= DECIMAL_PRECISION);
        /*
         * The newProductFactor is the factor by which to change all deposits, due to the depletion of Stability Pool KUSD in the liquidation.
         * We make the product factor 0 if there was a pool-emptying. Otherwise, it is (1 - KUSDLossPerUnitStaked)
         */
        uint256 newProductFactor = uint256(DECIMAL_PRECISION).sub(_KUSDLossPerUnitStaked);

        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint256 currentS = epochToScaleToSum[currentEpochCached][currentScaleCached];

        /*
         * Calculate the new S first, before we update P.
         * The ETH gain for any given depositor from a liquidation depends on the value of their deposit
         * (and the value of totalDeposits) prior to the Stability being depleted by the debt in the liquidation.
         *
         * Since S corresponds to ETH gain, and P to deposit loss, we update S first.
         */
        uint256 marginalETHGain = _ETHGainPerUnitStaked.mul(currentP);
        uint256 newS = currentS.add(marginalETHGain);
        epochToScaleToSum[currentEpochCached][currentScaleCached] = newS;
        emit S_Updated(newS, currentEpochCached, currentScaleCached);

        // If the Stability Pool was emptied, increment the epoch, and reset the scale and product P
        if (newProductFactor == 0) {
            currentEpoch = currentEpochCached.add(1);
            emit EpochUpdated(currentEpoch);
            currentScale = 0;
            emit ScaleUpdated(currentScale);
            newP = DECIMAL_PRECISION;

            // If multiplying P by a non-zero product factor would reduce P below the scale boundary, increment the scale
        } else if (currentP.mul(newProductFactor).div(DECIMAL_PRECISION) < SCALE_FACTOR) {
            newP = currentP.mul(newProductFactor).mul(SCALE_FACTOR).div(DECIMAL_PRECISION);
            currentScale = currentScaleCached.add(1);
            emit ScaleUpdated(currentScale);
        } else {
            newP = currentP.mul(newProductFactor).div(DECIMAL_PRECISION);
        }

        assert(newP > 0);
        P = newP;

        emit P_Updated(newP);
    }

    function _moveOffsetCollAndDebt(uint256 _collToAdd, uint256 _debtToOffset) internal {
        IActivePool activePoolCached = kumoParams.activePool();

        // Cancel the liquidated KUSD debt with the KUSD in the stability pool
        activePoolCached.decreaseKUSDDebt(assetAddress, _debtToOffset);
        _decreaseKUSD(_debtToOffset);

        // Burn the debt that was successfully offset
        kusdToken.burn(address(this), _debtToOffset);

        activePoolCached.sendAsset(assetAddress, address(this), _collToAdd);
    }

    function _increaseKUSD(uint256 _amount) internal {
        uint256 newtotalKUSDDeposits = totalKUSDDeposits.add(_amount);
        totalKUSDDeposits = newtotalKUSDDeposits;

        emit StabilityPoolKUSDBalanceUpdated(newtotalKUSDDeposits);
    }

    function _decreaseKUSD(uint256 _amount) internal {
        uint256 newtotalKUSDDeposits = totalKUSDDeposits.sub(_amount);
        totalKUSDDeposits = newtotalKUSDDeposits;

        emit StabilityPoolKUSDBalanceUpdated(newtotalKUSDDeposits);
    }

    function _increaseKUSDGains(uint256 _amount) internal {
        uint256 newtotalKUSDGains = totalKUSDGains.add(_amount);
        totalKUSDGains = newtotalKUSDGains;

        emit StabilityPoolKUSDGainsBalanceUpdated(newtotalKUSDGains);
    }

    function _decreaseKUSDGains(uint256 _amount) internal {
        uint256 newtotalKUSDGains = totalKUSDGains.sub(_amount);
        totalKUSDGains = newtotalKUSDGains;

        emit StabilityPoolKUSDGainsBalanceUpdated(newtotalKUSDGains);
    }

    // --- Reward calculator functions for depositor ---
    function getDepositorAssetGain(address _depositor) public view override returns (uint256) {
        uint256 initialDeposit = deposits[_depositor];

        if (initialDeposit == 0) {
            return 0;
        }

        Snapshots memory snapshots = depositSnapshots[_depositor];

        return
            SafetyTransfer.decimalsCorrection(
                assetAddress,
                _getAssetGainFromSnapshots(initialDeposit, snapshots, _depositor)
            );
    }

    function _getAssetGainFromSnapshots(
        uint256 initialDeposit,
        Snapshots memory snapshots,
        address _depositor
    ) internal view returns (uint256) {
        // --- Stability Pool gains ---
        /*
         * Grab the sum 'S' from the epoch at which the stake was made. The ETH gain may span up to one scale change.
         * If it does, the second portion of the ETH gain is scaled by 1e9.
         * If the gain spans no scale change, the second portion will be 0.
         */

        LocalVariables_AssetGainFromSnapshots memory vars;

        vars.epochSnapshot = snapshots.epoch;
        vars.scaleSnapshot = snapshots.scale;
        vars.S_Snapshot = snapshots.S;
        vars.P_Snapshot = snapshots.P;

        vars.firstPortion = epochToScaleToSum[vars.epochSnapshot][vars.scaleSnapshot].sub(
            vars.S_Snapshot
        );
        vars.secondPortion = epochToScaleToSum[vars.epochSnapshot][vars.scaleSnapshot.add(1)].div(
            SCALE_FACTOR
        );

        vars.SPAssetGain = initialDeposit
            .mul(vars.firstPortion.add(vars.secondPortion))
            .div(vars.P_Snapshot)
            .div(DECIMAL_PRECISION);

        // --- Protocol revenue (prev. staking) gains ---
        vars.F_ASSET_Snapshot = stakingSnapshots[_depositor].F_ASSET_Snapshot;
        vars.StakingAssetGain = deposits[_depositor].mul(F_ASSET.sub(vars.F_ASSET_Snapshot)).div(
            DECIMAL_PRECISION
        );

        return vars.SPAssetGain + vars.StakingAssetGain;
    }

    function getDepositorKUSDGain(address _depositor) public view override returns (uint256) {
        return
            SafetyTransfer.decimalsCorrection(
                address(kusdToken),
                _getKUSDGainFromSnapshots(_depositor)
            );
    }

    function _getKUSDGainFromSnapshots(address _user) internal view returns (uint256) {
        uint256 F_KUSD_Snapshot = stakingSnapshots[_user].F_KUSD_Snapshot;
        uint256 KUSDGain = deposits[_user].mul(F_KUSD.sub(F_KUSD_Snapshot)).div(DECIMAL_PRECISION);

        return KUSDGain;
    }

    // Internal function, used to calculcate compounded deposits and compounded stakes.
    function _getCompoundedStakeFromSnapshots(
        uint256 initialStake,
        Snapshots memory snapshots
    ) internal view returns (uint256) {
        uint256 snapshot_P = snapshots.P;
        uint128 scaleSnapshot = snapshots.scale;
        uint128 epochSnapshot = snapshots.epoch;

        // If stake was made before a pool-emptying event, then it has been fully cancelled with debt -- so, return 0
        if (epochSnapshot < currentEpoch) {
            return 0;
        }

        uint256 compoundedStake;
        uint128 scaleDiff = currentScale.sub(scaleSnapshot);

        /* Compute the compounded stake. If a scale change in P was made during the stake's lifetime,
         * account for it. If more than one scale change was made, then the stake has decreased by a factor of
         * at least 1e-9 -- so return 0.
         */
        if (scaleDiff == 0) {
            compoundedStake = initialStake.mul(P).div(snapshot_P);
        } else if (scaleDiff == 1) {
            compoundedStake = initialStake.mul(P).div(snapshot_P).div(SCALE_FACTOR);
        } else {
            compoundedStake = 0;
        }

        /*
         * If compounded deposit is less than a billionth of the initial deposit, return 0.
         *
         * NOTE: originally, this line was in place to stop rounding errors making the deposit too large. However, the error
         * corrections should ensure the error in P "favors the Pool", i.e. any given compounded deposit should slightly less
         * than it's theoretical value.
         *
         * Thus it's unclear whether this line is still really needed.
         */
        if (compoundedStake < initialStake.div(1e9)) {
            return 0;
        }

        return compoundedStake;
    }

    /*
     * Return the user's compounded deposit. Given by the formula:  d = d0 * P/P(0)
     * where P(0) is the depositor's snapshot of the product P, taken when they last updated their deposit.
     */
    function getCompoundedKUSDDeposit(address _depositor) public view override returns (uint256) {
        uint256 initialDeposit = deposits[_depositor];
        if (initialDeposit == 0) {
            return 0;
        }

        Snapshots memory snapshots = depositSnapshots[_depositor];

        uint256 compoundedDeposit = _getCompoundedStakeFromSnapshots(initialDeposit, snapshots);
        return compoundedDeposit;
    }

    // --- Sender functions for KUSD deposit and KUSD gains ---

    // Transfer the KUSD tokens from the user to the Stability Pool's address, and update its recorded KUSD
    function _sendKUSDtoStabilityPool(address _address, uint256 _amount) internal {
        kusdToken.sendToPool(_address, address(this), _amount);

        _increaseKUSD(_amount);
    }

    // Send KUSD to user and decrease KUSD in Pool
    function _sendKUSDToDepositor(address _depositor, uint256 KUSDWithdrawal) internal {
        if (KUSDWithdrawal == 0) {
            return;
        }

        kusdToken.returnFromPool(address(this), _depositor, KUSDWithdrawal);
        _decreaseKUSD(KUSDWithdrawal);
    }

    // --- Stability Pool Deposit Functionality ---

    function _updateDepositAndSnapshots(address _depositor, uint256 _newValue) internal {
        // --- SP part ---
        deposits[_depositor] = _newValue;

        if (_newValue == 0) {
            delete depositSnapshots[_depositor];
            emit DepositSnapshotUpdated(_depositor, 0, 0);
            return;
        }
        uint128 currentScaleCached = currentScale;
        uint128 currentEpochCached = currentEpoch;
        uint256 currentP = P;

        // Get S for the current epoch and current scale
        uint256 currentS = epochToScaleToSum[currentEpochCached][currentScaleCached];

        // Record new snapshots of the latest running product P, and sum S, for the depositor
        depositSnapshots[_depositor].P = currentP;
        depositSnapshots[_depositor].S = currentS;
        depositSnapshots[_depositor].scale = currentScaleCached;
        depositSnapshots[_depositor].epoch = currentEpochCached;

        emit DepositSnapshotUpdated(_depositor, currentP, currentS);

        // --- Staking part ---
        stakingSnapshots[_depositor].F_ASSET_Snapshot = F_ASSET;
        stakingSnapshots[_depositor].F_KUSD_Snapshot = F_KUSD;
        emit StakerSnapshotsUpdated(_depositor, F_ASSET, F_KUSD);
    }

    // --- Sender functions for Asset gains and KUSD gains ---

    function _sendAssetGainToDepositor(uint256 _amount) internal {
        if (_amount == 0) {
            return;
        }

        assetBalance = assetBalance.sub(_amount);
        IERC20Upgradeable(assetAddress).safeTransfer(msg.sender, _amount);

        emit StabilityPoolAssetBalanceUpdated(assetBalance);
        emit AssetSent(msg.sender, _amount);
    }

    // Send KUSD gains to user and decrease KUSD gains in Pool
    function _sendKUSDGainToDepositor(address _depositor, uint256 KUSDWithdrawal) internal {
        if (KUSDWithdrawal == 0) {
            return;
        }

        kusdToken.returnFromPool(address(this), _depositor, KUSDWithdrawal);
        _decreaseKUSDGains(KUSDWithdrawal);
    }

    // --- 'require' functions ---

    function _requireCallerIsActivePool() internal view {
        require(
            msg.sender == address(kumoParams.activePool()),
            "StabilityPool: Caller is not ActivePool"
        );
    }

    function _requireCallerIsTroveManager() internal view {
        require(msg.sender == address(troveManager), "StabilityPool: Caller is not TroveManager");
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(
            msg.sender == address(borrowerOperations),
            "StabilityPool: Caller is not BorrowerOperations"
        );
    }

    function _requireNoUnderCollateralizedTroves() internal {
        uint256 price = kumoParams.priceFeed().fetchPrice(assetAddress);
        address lowestTrove = sortedTroves.getLast(assetAddress);
        uint256 ICR = troveManager.getCurrentICR(assetAddress, lowestTrove, price);
        require(
            ICR >= kumoParams.MCR(assetAddress),
            "StabilityPool: Cannot withdraw while there are troves with ICR < MCR"
        );
    }

    function _requireUserHasDeposit(uint256 _initialDeposit) internal pure {
        require(_initialDeposit > 0, "StabilityPool: User must have a non-zero deposit");
    }

    function _requireUserHasNoDeposit(address _address) internal view {
        uint256 initialDeposit = deposits[_address];
        require(initialDeposit == 0, "StabilityPool: User must have no deposit");
    }

    function _requireNonZeroAmount(uint256 _amount) internal pure {
        require(_amount > 0, "StabilityPool: Amount must be non-zero");
    }

    function _requireUserHasTrove(address _depositor) internal view {
        require(
            troveManager.getTroveStatus(assetAddress, _depositor) == 1,
            "StabilityPool: caller must have an active trove to withdraw Asset Gain to"
        );
    }

    function _requireUserHasAssetGain(address _depositor) internal view {
        uint256 AssetGain = getDepositorAssetGain(_depositor);
        require(AssetGain > 0, "StabilityPool: caller must have non-zero Asset Gain");
    }

    function receivedERC20(address _asset, uint256 _amount) external override {
        _requireCallerIsActivePool();

        require(_asset == assetAddress, "Receiving the wrong asset in StabilityPool");

        assetBalance = assetBalance.add(_amount);
        emit StabilityPoolAssetBalanceUpdated(assetBalance);
    }

    // --- Moved staking functions ---

    // --- Reward-per-unit-staked increase functions. Called by Kumo core contracts ---
    function increaseF_Asset(uint256 _AssetFee) external override {
        _requireCallerIsTroveManager();

        uint256 AssetFeePerKUSDDeposited;
        if (totalKUSDDeposits > 0) {
            AssetFeePerKUSDDeposited = _AssetFee.mul(DECIMAL_PRECISION).div(totalKUSDDeposits);
        }
        F_ASSET = F_ASSET.add(AssetFeePerKUSDDeposited);
        emit F_AssetUpdated(assetAddress, F_ASSET);

        assetBalance = assetBalance.add(_AssetFee);
    }

    function increaseF_KUSD(uint256 _KUSDFee) external override {
        _requireCallerIsBorrowerOperations();
        uint256 KUSDFeePerKUSDDeposited;
        if (totalKUSDDeposits > 0) {
            KUSDFeePerKUSDDeposited = _KUSDFee.mul(DECIMAL_PRECISION).div(totalKUSDDeposits);
        }
        F_KUSD = F_KUSD.add(KUSDFeePerKUSDDeposited);
        emit F_KUSDUpdated(F_KUSD);

        _increaseKUSDGains(_KUSDFee);
    }
}
