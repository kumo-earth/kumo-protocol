// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
    
interface ILockupContractFactory {
    
    // --- Events ---

    event KUMOTokenAddressSet(address _kumoTokenAddress);
    event LockupContractDeployedThroughFactory(address _lockupContractAddress, address _beneficiary, uint _unlockTime, address _deployer);

    // --- Functions ---

    function setKUMOTokenAddress(address _kumoTokenAddress) external;

    function deployLockupContract(address _beneficiary, uint _unlockTime) external;

    function isRegisteredLockup(address _addr) external view returns (bool);
}
