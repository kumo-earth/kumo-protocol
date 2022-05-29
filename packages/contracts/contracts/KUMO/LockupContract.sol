// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

//import "../Dependencies/SafeMath.sol";
import "../Interfaces/IKUMOToken.sol";

/*
* The lockup contract architecture utilizes a single LockupContract, with an unlockTime. The unlockTime is passed as an argument 
* to the LockupContract's constructor. The contract's balance can be withdrawn by the beneficiary when block.timestamp > unlockTime. 
* At construction, the contract checks that unlockTime is at least one year later than the Kumo system's deployment time. 

* Within the first year from deployment, the deployer of the KUMOToken (Kumo AG's address) may transfer KUMO only to valid 
* LockupContracts, and no other addresses (this is enforced in KUMOToken.sol's transfer() function).
* 
* The above two restrictions ensure that until one year after system deployment, KUMO tokens originating from Kumo AG cannot 
* enter circulating supply and cannot be staked to earn system revenue.
*/
contract LockupContract {
    using SafeMathUpgradeable for uint;
	// bool public isInitialized;
    // --- Data ---
    string constant public NAME = "LockupContract";

    uint constant public SECONDS_IN_ONE_YEAR = 31536000; 

    address public immutable beneficiary;

    IKUMOToken public kumoToken;

    // Unlock time is the Unix point in time at which the beneficiary can withdraw.
    uint public unlockTime;

    // --- Events ---

    event LockupContractCreated(address _beneficiary, uint _unlockTime);
    event LockupContractEmptied(uint _KUMOwithdrawal);

    // --- Functions ---

    constructor
    (
        address _kumoTokenAddress, 
        address _beneficiary, 
        uint _unlockTime
    ) 
    {
        kumoToken = IKUMOToken(_kumoTokenAddress);

        /*
        * Set the unlock time to a chosen instant in the future, as long as it is at least 1 year after
        * the system was deployed 
        */
        _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(_unlockTime);
        unlockTime = _unlockTime;
        
        beneficiary =  _beneficiary;
        emit LockupContractCreated(_beneficiary, _unlockTime);
    }

    function withdrawKUMO() external {
        _requireCallerIsBeneficiary();
        _requireLockupDurationHasPassed();

        IKUMOToken kumoTokenCached = kumoToken;
        uint KUMOBalance = kumoTokenCached.balanceOf(address(this));
        kumoTokenCached.transfer(beneficiary, KUMOBalance);
        emit LockupContractEmptied(KUMOBalance);
    }

    // --- 'require' functions ---

    function _requireCallerIsBeneficiary() internal view {
        require(msg.sender == beneficiary, "LockupContract: caller is not the beneficiary");
    }

    function _requireLockupDurationHasPassed() internal view {
        require(block.timestamp >= unlockTime, "LockupContract: The lockup duration must have passed");
    }

    function _requireUnlockTimeIsAtLeastOneYearAfterSystemDeployment(uint _unlockTime) internal view {
        uint systemDeploymentTime = kumoToken.getDeploymentStartTime();
        require(_unlockTime >= systemDeploymentTime.add(SECONDS_IN_ONE_YEAR), "LockupContract: unlock time must be at least one year after system deployment");
    }
}
