// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Interfaces/IKUSDToken.sol";

contract KUSDTokenCaller {
    IKUSDToken KUSD;

    function setKUSD(IKUSDToken _KUSD) external {
        KUSD = _KUSD;
    }

    function kusdMint(address _account, uint _amount) external {
        KUSD.mint(_account, _amount);
    }

    function kusdBurn(address _account, uint _amount) external {
        KUSD.burn(_account, _amount);
    }

    function kusdSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        KUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function kusdReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        KUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
