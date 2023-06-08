// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Libraries/LibDiamond.sol";
import "../Interfaces/ICollSurplusPool.sol";
import "../Interfaces/IKUSDToken.sol";
import "../Interfaces/ISortedTroves.sol";
import "../Interfaces/IKUMOToken.sol";
import "../Interfaces/IKUMOStaking.sol";
import "../Interfaces/IKumoParameters.sol";
import "../Interfaces/IStabilityPoolFactory.sol";
import "../Interfaces/IActivePool.sol";
import "../Interfaces/IDefaultPool.sol";
import "hardhat/console.sol";

enum Status {
    nonExistent,
    active,
    closedByOwner,
    closedByLiquidation,
    closedByRedemption
}

enum TroveManagerOperation {
    applyPendingRewards,
    liquidateInNormalMode,
    liquidateInRecoveryMode,
    redeemCollateral
}

// Store the necessary data for a trove
struct Trove {
    address asset;
    uint256 debt;
    uint256 coll;
    uint256 stake;
    Status status;
    uint128 arrayIndex;
}

/*
 * --- Variable container structs for liquidations ---
 *
 * These structs are used to hold, return and assign variables inside the liquidation functions,
 * in order to avoid the error: "CompilerError: Stack too deep".
 **/

struct RewardSnapshot {
    uint256 asset;
    uint256 KUSDDebt;
}

struct AppStorage {
    // --- Connected contract declarations ---
    address borrowerOperationsAddress;
    address gasPoolAddress;
    IStabilityPoolFactory stabilityPoolFactory;
    ICollSurplusPool collSurplusPool;
    IKUSDToken kusdToken;
    IKUMOToken kumoToken;
    IKUMOStaking kumoStaking;
    // A doubly linked list of Troves, sorted by their sorted by their collateral ratios
    ISortedTroves sortedTroves;
    IKumoParameters kumoParams;
    IDefaultPool defaultPool;
    IActivePool activePool;
    // --- Data structures ---

    uint256 baseRate;
    // The timestamp of the latest fee operation (redemption or new KUSD issuance)
    uint256 lastFeeOperationTime;
    mapping(address => mapping(address => Trove)) Troves;
    mapping(address => uint256) totalStakes;
    // Snapshot of the value of totalStakes, taken immediately after the latest liquidation
    mapping(address => uint256) totalStakesSnapshot;
    // Snapshot of the total collateral across the ActivePool and DefaultPool, immediately after the latest liquidation.
    mapping(address => uint256) totalCollateralSnapshot;
    /*
     * L_amount and L_KUSDDebt track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
     *
     * An ETH gain of ( stake * [L_amount - L_amount(0)] )
     * A KUSDDebt increase  of ( stake * [L_KUSDDebt - L_KUSDDebt(0)] )
     *
     * Where L_amount(0) and L_KUSDDebt(0) are snapshots of L_amount and L_KUSDDebt for the active Trove taken at the instant the stake was made
     */
    mapping(address => uint256) L_ASSETS;
    mapping(address => uint256) L_KUSDDebts;
    // Map addresses with active troves to their RewardSnapshot
    mapping(address => mapping(address => RewardSnapshot)) rewardSnapshots;
    // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
    mapping(address => address[]) TroveOwners;
    // Error trackers for the trove redistribution calculation
    mapping(address => uint256) lastAssetError_Redistribution;
    mapping(address => uint256) lastKUSDDebtError_Redistribution;
    bool isInitialized;
    mapping(address => bool) redemptionWhitelist;
    bool isRedemptionWhitelisted;
}

library LibAppStorage {
    function diamondStorage() internal pure returns (AppStorage storage ds) {
        assembly {
            ds.slot := 0
        }
    }

    function abs(int256 x) internal pure returns (uint256) {
        return uint256(x >= 0 ? x : -x);
    }
}

contract Modifiers {
    AppStorage internal s;

    modifier onlyOwner() {
        LibDiamond.enforceIsContractOwner();
        _;
    }

    function _requireCallerIsBorrowerOperations() internal view {
        require(
            msg.sender == s.borrowerOperationsAddress,
            "TroveManager: Caller is not the BorrowerOperations contract"
        );
    }
}
