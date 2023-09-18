// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "../Interfaces/ITellorCaller.sol";
import "./ITellor.sol";
import "./SafeMath.sol";
/*
* This contract has a single external function that calls Tellor: getTellorCurrentValue(). 
*
* The function is called by the Kumo contract PriceFeed.sol. If any of its inner calls to Tellor revert, 
* this function will revert, and PriceFeed will catch the failure and handle it accordingly.
*
* The function comes from Tellor's own wrapper contract, 'UsingTellor.sol':
* https://github.com/tellor-io/usingtellor/blob/master/contracts/UsingTellor.sol
*
*/
contract TellorCaller is ITellorCaller {
    using SafeMath for uint256;

    ITellor public tellor;

    constructor (address _tellorMasterAddress)  {
        tellor = ITellor(_tellorMasterAddress);
    }

    /*
    * getTellorCurrentValue(): identical to getCurrentValue() in UsingTellor.sol
    *
    * @dev Allows the user to get the latest value for the queryId specified
    * @param _queryId is the id to look up the value for
    * @return ifRetrieve bool true if non-zero value successfully retrieved
    * @return value the value retrieved
    * @return _timestampRetrieved the retrieved value's timestamp
    */
    function getTellorCurrentValue(bytes32 _queryId)
        external
        view
        override
        returns (
            bool _ifRetrieve,
            uint256 _value,
            uint256 _timestampRetrieved
        )
    {
        uint256 _count = tellor.getNewValueCountbyQueryId(_queryId);

        if (_count == 0) {
            return (false, 0, 0);
        }

        uint256 _time =
            tellor.getTimestampbyQueryIdandIndex(_queryId, _count.sub(1));
        uint256 value = abi.decode(tellor.retrieveData(_queryId, _time),(uint256));
        if (value > 0) return (true, value, _time);
        return (false, value, _time);
    }
}
