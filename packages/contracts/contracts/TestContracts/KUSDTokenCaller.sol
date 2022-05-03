// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../Interfaces/IKUSDToken.sol";

contract KUSDTokenCaller {
    IKUSDToken KUSD;

    function setKUSD(IKUSDToken _KUSD) external {
        KUSD = _KUSD;
    }

    function KUSDMint(address _account, uint _amount) external {
        KUSD.mint(_account, _amount);
    }

    function KUSDBurn(address _account, uint _amount) external {
        KUSD.burn(_account, _amount);
    }

    function KUSDSendToPool(address _sender,  address _poolAddress, uint256 _amount) external {
        KUSD.sendToPool(_sender, _poolAddress, _amount);
    }

    function KUSDReturnFromPool(address _poolAddress, address _receiver, uint256 _amount ) external {
        KUSD.returnFromPool(_poolAddress, _receiver, _amount);
    }
}
