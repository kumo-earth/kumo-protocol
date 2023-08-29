// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

interface IKUMOStaking {
    // // --- Events --
    // event KUMOTokenAddressSet(address _kumoTokenAddress);
    // event KUSDTokenAddressSet(address _kusdTokenAddress);
    // event TroveManagerAddressSet(address _troveManager);
    // event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    // event ActivePoolAddressSet(address _activePoolAddress);
    // event StakeChanged(address indexed staker, uint256 newStake);
    // event StakingGainsAssetWithdrawn(
    //     address indexed staker,
    //     address indexed asset,
    //     uint256 AssetGain
    // );
    // event StakingGainsKUSDWithdrawn(address indexed staker, uint256 KUSDGain);
    // event StakingGainsWithdrawn(address indexed staker, uint256 KUSDGain, uint256 ETHGain);
    // event F_AssetUpdated(address indexed _asset, uint256 _F_ASSET);
    // event F_KUSDUpdated(uint256 _F_KUSD);
    // event TotalKUMOStakedUpdated(uint256 _totalKUMOStaked);
    // event AssetSent(address indexed _asset, address _account, uint256 _amount);
    // event StakerSnapshotsUpdated(address _staker, uint256 _F_Asset, uint256 _F_KUSD);
    // event KUMOStakingAssetBalanceUpdated(address _asset, uint256 _balance);
    // // function kumoToken() external view returns (IERC20Upgradeable);
    // // --- Functions ---
    // function setAddresses(
    //     address _kumoTokenAddress,
    //     address _kusdTokenAddress,
    //     address _troveManagerAddress,
    //     address _borrowerOperationsAddress,
    //     address _activePoolAddress
    //     // address _treasuy
    // ) external;
    // function stake(uint256 _KUMOamount) external;
    // function unstake(uint256 _KUMOamount) external;
    // function increaseF_Asset(address _asset, uint256 _AssetFee) external;
    // function increaseF_KUSD(uint256 _KUMOFee) external;
    // function getPendingAssetGain(address _asset, address _user) external view returns (uint256);
    // function getPendingKUSDGain(address _user) external view returns (uint256);
    // function getAssetBalance(address _asset) external view returns (uint256);
}
