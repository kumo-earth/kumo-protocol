// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract ERC20Test is ERC20, ERC20Permit {
    constructor() ERC20("ERC Test", "TST") ERC20Permit("TST") {}

    uint8 private DECIMALS = 18;

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
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
