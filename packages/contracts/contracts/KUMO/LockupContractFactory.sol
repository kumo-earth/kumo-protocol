// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

import "../Dependencies/CheckContract.sol";
// import "../Dependencies/SafeMath.sol";
import "../Dependencies/Ownable.sol";
import "../Interfaces/ILockupContractFactory.sol";
import "./LockupContract.sol";
import "../Dependencies/console.sol";

/*
* The LockupContractFactory deploys LockupContracts - its main purpose is to keep a registry of valid deployed 
* LockupContracts. 
* 
* This registry is checked by KUMOToken when the Kumo deployer attempts to transfer KUMO tokens. During the first year 
* since system deployment, the Kumo deployer is only allowed to transfer KUMO to valid LockupContracts that have been 
* deployed by and recorded in the LockupContractFactory. This ensures the deployer's KUMO can't be traded or staked in the
* first year, and can only be sent to a verified LockupContract which unlocks at least one year after system deployment.
*
* LockupContracts can of course be deployed directly, but only those deployed through and recorded in the LockupContractFactory 
* will be considered "valid" by KUMOToken. This is a convenient way to verify that the target address is a genuine 
* LockupContract.
*/

contract LockupContractFactory is ILockupContractFactory, Ownable, CheckContract {
    using SafeMathUpgradeable for uint;

	// bool public isInitialized;
    // --- Data ---
    string constant public NAME = "LockupContractFactory";

    uint constant public SECONDS_IN_ONE_YEAR = 31536000;

    address public kumoTokenAddress;
    
    mapping (address => address) public lockupContractToDeployer;

    // --- Events ---

    // event KUMOTokenAddressSet(address _kumoTokenAddress);
    // event LockupContractDeployedThroughFactory(address _lockupContractAddress, address _beneficiary, uint _unlockTime, address _deployer);

    // --- Functions ---

    function setKUMOTokenAddress(address _kumoTokenAddress) external override onlyOwner {
        // require(!isInitialized, "Already initialized");
        checkContract(_kumoTokenAddress);
		// isInitialized = true;

		// __Ownable_init();

        kumoTokenAddress = _kumoTokenAddress;
        emit KUMOTokenAddressSet(_kumoTokenAddress);

        _renounceOwnership();
    }

    function deployLockupContract(address _beneficiary, uint _unlockTime) external override {
        address kumoTokenAddressCached = kumoTokenAddress;
        _requireKUMOAddressIsSet(kumoTokenAddressCached);
        LockupContract lockupContract = new LockupContract(
                                                        kumoTokenAddressCached,
                                                        _beneficiary, 
                                                        _unlockTime);

        lockupContractToDeployer[address(lockupContract)] = msg.sender;
        emit LockupContractDeployedThroughFactory(address(lockupContract), _beneficiary, _unlockTime, msg.sender);
    }

    function isRegisteredLockup(address _contractAddress) public view override returns (bool) {
        return lockupContractToDeployer[_contractAddress] != address(0);
    }

    // --- 'require'  functions ---
    function _requireKUMOAddressIsSet(address _kumoTokenAddress) internal pure {
        require(_kumoTokenAddress != address(0), "LCF: KUMO Address is not set");
    }
}
