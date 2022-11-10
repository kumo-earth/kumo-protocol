// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface ICommunityIssuance { 
    
    // --- Events ---
    
    event KUMOTokenAddressSet(address _kumoTokenAddress);
    event StabilityPoolAddressSet(address _stabilityPoolAddress);
    event TotalKUMOIssuedUpdated(uint256 _totalKUMOIssued);

    // --- Functions ---

    function setAddresses(address _kumoTokenAddress, address _stabilityPoolAddress) external;

    function issueKUMO() external returns (uint256);

    function sendKUMO(address _account, uint256 _KUMOamount) external;
}
