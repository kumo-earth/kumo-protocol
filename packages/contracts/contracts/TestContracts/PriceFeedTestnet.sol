// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Interfaces/IPriceFeed.sol";

/*
* PriceFeed placeholder for testnet and development. The price is simply set manually and saved in a state 
* variable. The contract does not connect to a live Chainlink price feed. 
*/
contract PriceFeedTestnet is IPriceFeed {
    
    // uint256 private _price = 200 * 1e18;
    mapping(address => uint256) private assetPrices;

    // --- Functions ---

    // View price getter for simplicity in tests
    function getPrice(address _asset) external view returns (uint256) {
        return assetPrices[_asset];
    }

    function fetchPrice(address _asset) external override returns (uint256) {
        // Fire an event just like the mainnet version would.
        // This lets the subgraph rely on events to get the latest price even when developing locally.
        emit LastGoodPriceUpdated(_asset, assetPrices[_asset]);
        return assetPrices[_asset];
    }

    // Manual external price setter.
    function setPrice(address _asset, uint256 _price) external returns (bool) {
        assetPrices[_asset] = _price;
        return true;
    }
}
