// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

import "./IERC20.sol";
import "./SafeMath.sol";

library SafetyTransfer {
	using SafeMath for uint256;

	//_amount is in ether (1e18) and we want to convert it to the token decimal
	function decimalsCorrection(address _token, uint256 _amount)
		internal
		view
		returns (uint256)
	{
		uint8 decimals = IERC20(_token).decimals();
		if (decimals < 18) {
			return _amount.div(10**(18 - decimals));
		}

		return _amount;
	}
}
