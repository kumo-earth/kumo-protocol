// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

// const memory name = "ERC 20 Test ";

contract ERC20Test is ERC20Permit {
    constructor() ERC20("ERC Test","TST") ERC20Permit("TST"){}

	uint8 private DECIMALS = 18;

	function mint(address _addr, uint256 _amount) public {
		_mint(_addr, _amount);
	}

	function transferFrom(
		address sender,
		address recipient,
		uint256 amount
	) public override returns (bool) {
		_transfer(sender, recipient, amount);
		return true;
	}

	function decimals() public view override returns (uint8) {
		return DECIMALS;
	}

	function setDecimals(uint8 _decimals) public {
		DECIMALS = _decimals;
	}

}

