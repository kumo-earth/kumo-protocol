// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "../Interfaces/IPriceFeed.sol";

/*
 * PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state
 * variable. The contract does not connect to a live Chainlink price feed.
 */
contract PriceFeedTestnet is IPriceFeed {
    // uint256 private _price = 200 * 1e18;
    mapping(address => uint256) private assetPrices;
    uint256 private constant zeroValue = type(uint256).max - 143; // 143 is just to increase randomness

    // --- Functions ---

    // View price getter for simplicity in tests
    function getPrice(address _asset) external view returns (uint256) {
        if (assetPrices[_asset] == 0) {
            return 200 * 1e18;
        } else if (assetPrices[_asset] == zeroValue) {
            return 0;
        } else {
            return assetPrices[_asset];
        }
    }

    function fetchPrice(address _asset) external override returns (uint256) {
        // Fire an event just like the mainnet version would.
        // This lets the subgraph rely on events to get the latest price even when developing locally.
        emit LastGoodPriceUpdated(_asset, assetPrices[_asset]);
        if (assetPrices[_asset] == 0) {
            return 200 * 1e18;
        } else {
            return assetPrices[_asset];
        }
    }

    // Manual external price setter.
    function setPrice(address _asset, uint256 _price) external returns (bool) {
        if (_price == 0) {
            assetPrices[_asset] = zeroValue;
        } else {
            assetPrices[_asset] = _price;
        }
        return true;
    }
}
