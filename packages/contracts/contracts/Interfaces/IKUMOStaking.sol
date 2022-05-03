// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IKUMOStaking {

    // --- Events --
    
    event KUMOTokenAddressSet(address _kumoTokenAddress);
    event KUSDTokenAddressSet(address _kusdTokenAddress);
    event TroveManagerAddressSet(address _troveManager);
    event BorrowerOperationsAddressSet(address _borrowerOperationsAddress);
    event ActivePoolAddressSet(address _activePoolAddress);

    event StakeChanged(address indexed staker, uint newStake);
    event StakingGainsWithdrawn(address indexed staker, uint KUSDGain, uint ETHGain);
    event F_ETHUpdated(uint _F_ETH);
    event F_KUSDUpdated(uint _F_KUSD);
    event TotalKUMOStakedUpdated(uint _totalKUMOStaked);
    event EtherSent(address _account, uint _amount);
    event StakerSnapshotsUpdated(address _staker, uint _F_ETH, uint _F_KUSD);

    // --- Functions ---

    function setAddresses
    (
        address _kumoTokenAddress,
        address _kusdTokenAddress,
        address _troveManagerAddress, 
        address _borrowerOperationsAddress,
        address _activePoolAddress
    )  external;

    function stake(uint _KUMOamount) external;

    function unstake(uint _KUMOamount) external;

    function increaseF_ETH(uint _ETHFee) external; 

    function increaseF_KUSD(uint _KUMOFee) external;  

    function getPendingETHGain(address _user) external view returns (uint);

    function getPendingKUSDGain(address _user) external view returns (uint);
}
