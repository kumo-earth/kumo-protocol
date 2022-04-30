// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../KUMO/CommunityIssuance.sol";

contract CommunityIssuanceTester is CommunityIssuance {
    using SafeMath for uint256;
    
    function obtainKUMO(uint _amount) external {
        kumoToken.transfer(msg.sender, _amount);
    }

    function getCumulativeIssuanceFraction() external view returns (uint) {
       return _getCumulativeIssuanceFraction();
    }

    function unprotectedIssueKUMO() external returns (uint) {
        // No checks on caller address
       
        uint latestTotalKUMOIssued = KUMOSupplyCap.mul(_getCumulativeIssuanceFraction()).div(DECIMAL_PRECISION);
        uint issuance = latestTotalKUMOIssued.sub(totalKUMOIssued);
      
        totalKUMOIssued = latestTotalKUMOIssued;
        return issuance;
    }
}
