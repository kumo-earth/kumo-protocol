// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../Interfaces/IKUMOToken.sol";
import "../Interfaces/ICommunityIssuance.sol";
import "../Interfaces/IStabilityPoolFactory.sol";
import "../Dependencies/BaseMath.sol";
import "../Dependencies/KumoMath.sol";
import "../Dependencies/Ownable.sol";
import "../Dependencies/CheckContract.sol";
import "../Dependencies/SafeMath.sol";

contract CommunityIssuance is ICommunityIssuance, Ownable, CheckContract, BaseMath {
    using SafeMath for uint256;

    bool public isInitialized;
    // --- Data ---

    string public constant NAME = "CommunityIssuance";

    uint256 public constant SECONDS_IN_ONE_MINUTE = 60;

    /* The issuance factor F determines the curvature of the issuance curve.
     *
     * Minutes in one year: 60*24*365 = 525600
     *
     * For 50% of remaining tokens issued each year, with minutes as time units, we have:
     *
     * F ** 525600 = 0.5
     *
     * Re-arranging:
     *
     * 525600 * ln(F) = ln(0.5)
     * F = 0.5 ** (1/525600)
     * F = 0.999998681227695000
     */
    uint256 public constant ISSUANCE_FACTOR = 999998681227695000;

    /*
     * The community KUMO supply cap is the starting balance of the Community Issuance contract.
     * It should be minted to this contract by KUMOToken, when the token is deployed.
     *
     * Set to 32M (slightly less than 1/3) of total KUMO supply.
     */
    uint256 public constant KUMOSupplyCap = 32e24; // 32 million

    IKUMOToken public kumoToken;

    IStabilityPoolFactory public stabilityPoolFactory;

    uint256 public totalKUMOIssued;
    uint256 public immutable deploymentTime;

    // --- Events ---

    // event KUMOTokenAddressSet(address _kumoTokenAddress);
    // event StabilityPoolAddressSet(address _stabilityPoolAddress);
    // event TotalKUMOIssuedUpdated(uint256 _totalKUMOIssued);

    // --- Functions ---

    constructor() {
        deploymentTime = block.timestamp;
    }

    function setAddresses(
        address _kumoTokenAddress,
        address _stabilityPoolFactoryAddress
    ) external override onlyOwner {
        // require(!isInitialized, "Already initialized");
        checkContract(_kumoTokenAddress);
        checkContract(_stabilityPoolFactoryAddress);

        // isInitialized = true;
        // __Ownable_init();

        kumoToken = IKUMOToken(_kumoTokenAddress);
        stabilityPoolFactory = IStabilityPoolFactory(_stabilityPoolFactoryAddress);

        // When KUMOToken deployed, it should have transferred CommunityIssuance's KUMO entitlement
        // uint256 KUMOBalance = kumoToken.balanceOf(address(this));
        // assert(KUMOBalance >= KUMOSupplyCap);

        emit KUMOTokenAddressSet(_kumoTokenAddress);
        emit StabilityPoolFactoryAddressSet(_stabilityPoolFactoryAddress);

        _renounceOwnership();
    }

    function issueKUMO() external override returns (uint256) {
        _requireCallerIsStabilityPool();

        uint256 latestTotalKUMOIssued = KUMOSupplyCap.mul(_getCumulativeIssuanceFraction()).div(
            DECIMAL_PRECISION
        );
        uint256 issuance = latestTotalKUMOIssued.sub(totalKUMOIssued);

        totalKUMOIssued = latestTotalKUMOIssued;
        emit TotalKUMOIssuedUpdated(latestTotalKUMOIssued);

        return issuance;
    }

    /* Gets 1-f^t    where: f < 1

    f: issuance factor that determines the shape of the curve
    t:  time passed since last KUMO issuance event  */
    function _getCumulativeIssuanceFraction() internal view returns (uint256) {
        // Get the time passed since deployment
        uint256 timePassedInMinutes = block.timestamp.sub(deploymentTime).div(SECONDS_IN_ONE_MINUTE);

        // f^t
        uint256 power = KumoMath._decPow(ISSUANCE_FACTOR, timePassedInMinutes);

        //  (1 - f^t)
        uint256 cumulativeIssuanceFraction = (uint256(DECIMAL_PRECISION).sub(power));
        assert(cumulativeIssuanceFraction <= DECIMAL_PRECISION); // must be in range [0,1]

        return cumulativeIssuanceFraction;
    }

    function sendKUMO(address _account, uint256 _KUMOamount) external override {
        // _requireCallerIsStabilityPool();
        // kumoToken.transfer(_account, _KUMOamount);
    }

    // --- 'require' functions ---

    function _requireCallerIsStabilityPool() internal view {
        require(
            stabilityPoolFactory.isRegisteredStabilityPool(msg.sender),
            "CommunityIssuance: caller is not SP"
        );
    }
}
