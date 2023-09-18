// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "../Dependencies/IERC20.sol";
import "../Dependencies/IERC2612.sol";

interface IKUMOToken is IERC20, IERC2612 {
    // --- Events ---

    event CommunityIssuanceAddressSet(address _communityIssuanceAddress);
    event KUMOStakingAddressSet(address _kumoStakingAddress);
    event LockupContractFactoryAddressSet(address _lockupContractFactoryAddress);

    // --- Functions ---

    function sendToKUMOStaking(address _sender, uint256 _amount) external;

    // function getDeploymentStartTime() external view returns (uint256);

    function getLpRewardsEntitlement() external view returns (uint256);
}
