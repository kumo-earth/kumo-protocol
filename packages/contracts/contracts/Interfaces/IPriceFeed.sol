// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IPriceFeed {
    // --- Events ---
    event LastGoodPriceUpdated(address _asset, uint256 _lastGoodPrice);

    // added to emulate lastGoodPrice (public view function) to ease the process.
    function getPrice(address _asset) external view returns (uint256);

    // --- Function ---
    function fetchPrice(address _asset) external returns (uint256);
}
