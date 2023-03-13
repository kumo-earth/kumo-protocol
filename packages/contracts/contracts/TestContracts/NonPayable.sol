// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

//import "hardhat/console.sol";

contract NonPayable {
    mapping(address => uint256) internal assetsBalance;

    function forward(address _dest, bytes calldata _data) external payable {
        (bool success, bytes memory returnData) = _dest.call{value: msg.value}(_data);
        //console.logBytes(returnData);
        require(success, string(returnData));
    }

    function getAssetBalance(address _asset) external view returns (uint256) {
        return assetsBalance[_asset];
    }

    function receivedERC20(address _asset, uint256 _amount) external {
        assetsBalance[_asset] = assetsBalance[_asset] + (_amount);
    }
}
