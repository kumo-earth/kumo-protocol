// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface ITroveEvents {
    event SystemSnapshotsUpdated(
        address indexed _asset,
        uint256 _totalStakesSnapshot,
        uint256 _totalCollateralSnapshot
    );

    event Liquidation(
        address indexed _asset,
        uint256 _liquidatedDebt,
        uint256 _liquidatedColl,
        uint256 _collGasCompensation,
        uint256 _kusdGasCompensation
    );
}
