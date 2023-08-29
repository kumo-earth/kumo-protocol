// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../Dependencies/BaseMath.sol";
import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "hardhat/console.sol";
import "../Interfaces/IKUMOToken.sol";
import "../Interfaces/IKUMOStaking.sol";
import "../Dependencies/KumoMath.sol";
import "../Interfaces/IKUSDToken.sol";
import "../Interfaces/IDeposit.sol";
import "../Dependencies/SafetyTransfer.sol";

contract KUMOStaking is IKUMOStaking, Ownable, CheckContract, BaseMath {
    // using SafeMath for uint256;
    // using SafeERC20Upgradeable for IERC20Upgradeable;

    // // bool public isInitialized;
    // // --- Data ---
    // string public constant NAME = "KUMOStaking";

    // mapping(address => uint256) public stakes;
    // uint256 public totalKUMOStaked;

    // mapping(address => uint256) public F_ASSETS; // Running sum of ETH fees per-KUMO-staked
    // uint256 public F_KUSD; // Running sum of KUMO fees per-KUMO-staked

    // // User snapshots of F_ASSETS and F_KUSD, taken at the point at which their latest deposit was made
    // mapping(address => Snapshot) public snapshots;

    // mapping(address => uint256) internal assetsBalance;

    // struct Snapshot {
    //     mapping(address => uint256) F_ASSET_Snapshot;
    //     uint256 F_KUSD_Snapshot;
    // }

    // address[] ASSET_TYPE;
    // mapping(address => bool) isAssetTracked;
    // mapping(address => uint256) public sentToTreasuryTracker;

    // IKUMOToken public kumoToken;
    // IKUSDToken public kusdToken;

    // address public troveManagerAddress;
    // address public borrowerOperationsAddress;
    // address public activePoolAddress;
    // address public treasury;

    // // --- Events ---

    // // event KUMOTokenAddressSet(address _kumoTokenAddress);
    // // event KUSDTokenAddressSet(address _kusdTokenAddress);
    // // event TroveManagerAddressSet(address _troveManager);
    // // event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    // // event ActivePoolAddressSet(address _activePoolAddress);

    // // event StakeChanged(address indexed staker, uint256 newStake);
    // // event StakingGainsWithdrawn(address indexed staker, uint256 KUSDGain, uint256 ETHGain);
    // // event F_ASSETSUpdated(uint256 _F_ASSETS);
    // // event F_KUSDUpdated(uint256 _F_KUSD);
    // // event TotalKUMOStakedUpdated(uint256 _totalKUMOStaked);
    // // event AssetSent(address _account, uint256 _amount);
    // // event StakerSnapshotsUpdated(address _staker, uint256 _F_ASSETS, uint256 _F_KUSD);

    // // --- Functions ---

    // function setAddresses(
    //     address _kumoTokenAddress,
    //     address _kusdTokenAddress,
    //     address _troveManagerAddress,
    //     address _borrowerOperationsAddress,
    //     address _activePoolAddress
    // )
    //     external
    //     override
    //     // address _treasury
    //     onlyOwner
    // {
    //     // require(!isInitialized, "Already Initialized");
    //     // require(_treasury != address(0), "Invalid Treausry Address");
    //     checkContract(_kumoTokenAddress);
    //     checkContract(_kusdTokenAddress);
    //     checkContract(_troveManagerAddress);
    //     checkContract(_borrowerOperationsAddress);
    //     checkContract(_activePoolAddress);
    //     // isInitialized = true;

    //     // __Ownable_init();
    //     // _pause();

    //     kumoToken = IKUMOToken(_kumoTokenAddress);
    //     kusdToken = IKUSDToken(_kusdTokenAddress);
    //     troveManagerAddress = _troveManagerAddress;
    //     borrowerOperationsAddress = _borrowerOperationsAddress;
    //     activePoolAddress = _activePoolAddress;

    //     emit KUMOTokenAddressSet(_kumoTokenAddress);
    //     emit KUMOTokenAddressSet(_kusdTokenAddress);
    //     emit TroveManagerAddressSet(_troveManagerAddress);
    //     emit BorrowerOperationsAddressSet(_borrowerOperationsAddress);
    //     emit ActivePoolAddressSet(_activePoolAddress);

    //     _renounceOwnership();
    // }

    // // If caller has a pre-existing stake, send any accumulated ETH and KUSD gains to them.
    // function stake(uint256 _KUMOamount) external override {
    //     _requireNonZeroAmount(_KUMOamount);
    //     uint256 currentStake = stakes[msg.sender];

    //     uint256 assetLength = ASSET_TYPE.length;
    //     uint256 AssetGain;
    //     address asset;

    //     for (uint256 i = 0; i < assetLength; i++) {
    //         asset = ASSET_TYPE[i];

    //         if (currentStake != 0) {
    //             AssetGain = _getPendingAssetGain(asset, msg.sender);

    //             if (i == 0) {
    //                 uint256 KUSDGain = _getPendingKUSDGain(msg.sender);
    //                 kusdToken.transfer(msg.sender, KUSDGain);

    //                 emit StakingGainsKUSDWithdrawn(msg.sender, KUSDGain);
    //             }

    //             _sendAssetGainToUser(asset, AssetGain);
    //             emit StakingGainsAssetWithdrawn(msg.sender, asset, AssetGain);
    //         }

    //         _updateUserSnapshots(asset, msg.sender);
    //     }

    //     uint256 newStake = currentStake.add(_KUMOamount);

    //     // Increase user’s stake and total KUMO staked
    //     stakes[msg.sender] = newStake;
    //     totalKUMOStaked = totalKUMOStaked.add(_KUMOamount);
    //     emit TotalKUMOStakedUpdated(totalKUMOStaked);

    //     // Transfer KUMO from caller to this contract
    //     kumoToken.sendToKUMOStaking(msg.sender, _KUMOamount);

    //     emit StakeChanged(msg.sender, newStake);
    // }

    // // Unstake the KUMO and send the it back to the caller, along with their accumulated KUSD & ETH gains.
    // // If requested amount > stake, send their entire stake.
    // function unstake(uint256 _KUMOamount) external override {
    //     uint256 currentStake = stakes[msg.sender];
    //     _requireUserHasStake(currentStake);

    //     uint256 assetLength = ASSET_TYPE.length;
    //     uint256 AssetGain;
    //     address asset;

    //     for (uint256 i = 0; i < assetLength; i++) {
    //         asset = ASSET_TYPE[i];

    //         // Grab any accumulated ETH and KUSD gains from the current stake
    //         AssetGain = _getPendingAssetGain(asset, msg.sender);

    //         if (i == 0) {
    //             uint256 KUSDGain = _getPendingKUSDGain(msg.sender);
    //             kusdToken.transfer(msg.sender, KUSDGain);
    //             emit StakingGainsKUSDWithdrawn(msg.sender, KUSDGain);
    //         }

    //         _updateUserSnapshots(asset, msg.sender);
    //         emit StakingGainsAssetWithdrawn(msg.sender, asset, AssetGain);

    //         _sendAssetGainToUser(asset, AssetGain);
    //     }
    //     if (_KUMOamount > 0) {
    //         uint256 KUMOToWithdraw = KumoMath._min(_KUMOamount, currentStake);

    //         uint256 newStake = currentStake.sub(KUMOToWithdraw);

    //         // Decrease user's stake and total KUMO staked
    //         stakes[msg.sender] = newStake;
    //         totalKUMOStaked = totalKUMOStaked.sub(KUMOToWithdraw);
    //         emit TotalKUMOStakedUpdated(totalKUMOStaked);

    //         // Transfer unstaked KUMO to user
    //         kumoToken.transfer(msg.sender, KUMOToWithdraw);

    //         emit StakeChanged(msg.sender, newStake);
    //     }
    // }

    // // function pause() public onlyOwner {
    // // 	_pause();
    // // }

    // // function unpause() public onlyOwner {
    // // 	_unpause();
    // // }

    // // function changeTreasuryAddress(address _treasury) public onlyOwner {
    // // 	treasury = _treasury;
    // //     emit TreasuryAddressChanged(_treasury);
    // // }

    // // --- Reward-per-unit-staked increase functions. Called by Kumo core contracts ---

    // function increaseF_Asset(address _asset, uint256 _AssetFee) external override {
    //     _requireCallerIsTroveManager();

    //     if (!isAssetTracked[_asset]) {
    //         isAssetTracked[_asset] = true;
    //         ASSET_TYPE.push(_asset);
    //     }

    //     uint256 AssetFeePerKUMOStaked;

    //     if (totalKUMOStaked > 0) {
    //         AssetFeePerKUMOStaked = _AssetFee.mul(DECIMAL_PRECISION).div(totalKUMOStaked);
    //     }

    //     F_ASSETS[_asset] = F_ASSETS[_asset].add(AssetFeePerKUMOStaked);
    //     emit F_AssetUpdated(_asset, F_ASSETS[_asset]);
    // }

    // function increaseF_KUSD(uint256 _KUSDFee) external override {
    //     _requireCallerIsBorrowerOperations();
    //     uint256 KUSDFeePerKUMOStaked;

    //     if (totalKUMOStaked > 0) {
    //         KUSDFeePerKUMOStaked = _KUSDFee.mul(DECIMAL_PRECISION).div(totalKUMOStaked);
    //     }

    //     F_KUSD = F_KUSD.add(KUSDFeePerKUMOStaked);
    //     emit F_KUSDUpdated(F_KUSD);
    // }

    // // --- Pending reward functions ---

    // function getPendingAssetGain(address _asset, address _user)
    //     external
    //     view
    //     override
    //     returns (uint256)
    // {
    //     return _getPendingAssetGain(_asset, _user);
    // }

    // function _getPendingAssetGain(address _asset, address _user) internal view returns (uint256) {
    //     uint256 F_ASSET_Snapshot = snapshots[_user].F_ASSET_Snapshot[_asset];
    //     uint256 AssetGain = stakes[_user].mul(F_ASSETS[_asset].sub(F_ASSET_Snapshot)).div(
    //         DECIMAL_PRECISION
    //     );
    //     return AssetGain;
    // }

    // function getPendingKUSDGain(address _user) external view override returns (uint256) {
    //     return _getPendingKUSDGain(_user);
    // }

    // function _getPendingKUSDGain(address _user) internal view returns (uint256) {
    //     uint256 F_KUSD_Snapshot = snapshots[_user].F_KUSD_Snapshot;
    //     uint256 KUSDGain = stakes[_user].mul(F_KUSD.sub(F_KUSD_Snapshot)).div(DECIMAL_PRECISION);
    //     return KUSDGain;
    // }

    // // --- Internal helper functions ---

    // function _updateUserSnapshots(address _asset, address _user) internal {
    //     snapshots[_user].F_ASSET_Snapshot[_asset] = F_ASSETS[_asset];
    //     snapshots[_user].F_KUSD_Snapshot = F_KUSD;
    //     emit StakerSnapshotsUpdated(_user, F_ASSETS[_asset], F_KUSD);
    // }

    // function _sendAssetGainToUser(address _asset, uint256 _assetGain) internal {
    //     _sendAsset(msg.sender, _asset, _assetGain);
    // }

    // function _sendAsset(
    //     address _sendTo,
    //     address _asset,
    //     uint256 _amount
    // ) internal {
    //     _amount = SafetyTransfer.decimalsCorrection(_asset, _amount);
    //     IERC20Upgradeable(_asset).safeTransfer(_sendTo, _amount);

    //     emit AssetSent(_asset, _sendTo, _amount);
    // }

    // // --- 'require' functions ---

    // function _requireCallerIsTroveManager() internal view {
    //     require(msg.sender == troveManagerAddress, "KUMOStaking: caller is not TroveM");
    // }

    // function _requireCallerIsBorrowerOperations() internal view {
    //     require(msg.sender == borrowerOperationsAddress, "KUMOStaking: caller is not BorrowerOps");
    // }

    // function _requireUserHasStake(uint256 currentStake) internal pure {
    //     require(currentStake > 0, "KUMOStaking: User must have a non-zero stake");
    // }

    // function _requireNonZeroAmount(uint256 _amount) internal pure {
    //     require(_amount > 0, "KUMOStaking: Amount must be non-zero");
    // }

    // modifier callerIsActivePool() {
    //     require(msg.sender == activePoolAddress, "DefaultPool: Caller is not the ActivePool");
    //     _;
    // }

    // // --- 'require' functions ---

    // // modifier callerIsTroveManager() {
    // // 	require(msg.sender == troveManagerAddress, "KUSDStaking: caller is not TroveM");
    // // 	_;
    // // }

    // // modifier callerIsBorrowerOperations() {
    // // 	require(msg.sender == borrowerOperationsAddress, "KUSDStaking: caller is not BorrowerOps");
    // // 	_;
    // // }

    // // function _requireUserHasStake(uint256 currentStake) internal pure {
    // // 	require(currentStake > 0, "KUSDStaking: User must have a non-zero stake");
    // // }

    // function getAssetBalance(address _asset) external view override returns (uint256) {
    //     return assetsBalance[_asset];
    // }

    // function receivedERC20(address _asset, uint256 _amount) external callerIsActivePool {
    //     assetsBalance[_asset] = assetsBalance[_asset].add(_amount);
    //     emit KUMOStakingAssetBalanceUpdated(_asset, assetsBalance[_asset]);
    // }
}
