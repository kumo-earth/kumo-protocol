// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../KUMO/KUMOToken.sol";

contract KUMOTokenTester is KUMOToken {
    constructor
    (
        address _communityIssuanceAddress, 
        address _kumoStakingAddress,
        address _lockupFactoryAddress,
        address _bountyAddress,
        address _lpRewardsAddress,
        address _multisigAddress
    ) 
        KUMOToken 
    (
        _communityIssuanceAddress,
        _kumoStakingAddress,
        _lockupFactoryAddress,
        _bountyAddress,
        _lpRewardsAddress,
        _multisigAddress
    )
    {} 

    function unprotectedMint(address account, uint256 amount) external {
        // No check for the caller here

        _mint(account, amount);
    }

    function unprotectedSendToKUMOStaking(address _sender, uint256 _amount) external {
        // No check for the caller here
        
        if (_isFirstYear()) {_requireSenderIsNotMultisig(_sender);}
        _transfer(_sender, kumoStakingAddress, _amount);
    }

    function callInternalApprove(address owner, address spender, uint256 amount) external returns (bool approve) {
        _approve(owner, spender, amount);
        return approve;
    }

    function callInternalTransfer(address sender, address recipient, uint256 amount) external returns (bool transfer) {
        _transfer(sender, recipient, amount);
        return transfer;
    }

    function getChainId() external view returns (uint256 chainID) {
        //return _chainID(); // it’s private
        assembly {
            chainID := chainid()
        }
    }
}