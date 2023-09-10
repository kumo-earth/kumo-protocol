// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "./IPriceFeed.sol";
import "./IKumoParameters.sol";


interface IKumoBase {
    
    event VaultParametersBaseChanged(address indexed newAddress);

	function kumoParams() external view returns (IKumoParameters);
}
