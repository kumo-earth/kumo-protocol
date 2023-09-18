// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

interface IPriceFeed {

    // --- Events ---
    event LastGoodPriceUpdated(address _asset, uint256 _lastGoodPrice);
   
    // --- Function ---
    function fetchPrice(address _asset) external returns (uint256);
}
