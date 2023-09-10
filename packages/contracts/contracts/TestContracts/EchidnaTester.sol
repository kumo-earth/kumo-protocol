// SPDX-License-Identifier: MIT

pragma solidity 0.8.15;

import "../TroveManagerDiamond.sol";
import "../BorrowerOperations.sol";
import "../ActivePool.sol";
import "../DefaultPool.sol";
import "../StabilityPool.sol";
import "../GasPool.sol";
import "../CollSurplusPool.sol";
import "../KUSDToken.sol";
import "./PriceFeedTestnet.sol";
import "../SortedTroves.sol";
import "./EchidnaProxy.sol";
import "../KumoParameters.sol";
import "../Interfaces/IStabilityPool.sol";
import "../Interfaces/IDiamondCut.sol";
import "../Interfaces/ITroveManagerDiamond.sol";

//import "hardhat/console.sol";

// Run with:
// rm -f fuzzTests/corpus/* # (optional)
// ~/.local/bin/echidna-test contracts/TestContracts/EchidnaTester.sol --contract EchidnaTester --config fuzzTests/echidna_config.yaml

contract EchidnaTester {
    using SafeMath for uint256;

    uint256 private constant NUMBER_OF_ACTORS = 100;
    uint256 private constant INITIAL_BALANCE = 1e24;
    uint256 private MCR;
    uint256 private CCR;
    uint256 private KUSD_GAS_COMPENSATION;

    TroveManagerDiamond public troveManager;
    BorrowerOperations public borrowerOperations;
    ActivePool public activePool;
    DefaultPool public defaultPool;
    StabilityPool public stabilityPool;
    StabilityPoolFactory public stabilityPoolFactory;
    GasPool public gasPool;
    CollSurplusPool public collSurplusPool;
    KUSDToken public kusdToken;
    PriceFeedTestnet priceFeedTestnet;
    SortedTroves sortedTroves;
    KumoParameters kumoParams;

    EchidnaProxy[NUMBER_OF_ACTORS] public echidnaProxies;

    uint256 private numberOfTroves;

    constructor(address _asset) payable {
        troveManager = new TroveManagerDiamond();
        borrowerOperations = new BorrowerOperations();
        activePool = new ActivePool();
        defaultPool = new DefaultPool();
        stabilityPool = new StabilityPool();
        stabilityPoolFactory = new StabilityPoolFactory();
        gasPool = new GasPool();
        kusdToken = new KUSDToken(
            address(troveManager),
            address(stabilityPoolFactory),
            address(borrowerOperations)
        );

        collSurplusPool = new CollSurplusPool();
        priceFeedTestnet = new PriceFeedTestnet();
        sortedTroves = new SortedTroves();

        (bool success, ) = address(troveManager).call(
            abi.encodeWithSignature("setAddresses(address)", address(kumoParams))
        );
        require(success);

        borrowerOperations.setAddresses(
            address(troveManager),
            address(stabilityPoolFactory),
            address(gasPool),
            address(collSurplusPool),
            address(sortedTroves),
            address(kusdToken),
            address(0),
            address(kumoParams)
        );

        activePool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(stabilityPoolFactory),
            address(defaultPool),
            address(collSurplusPool),
            address(0)
        );
        defaultPool.setAddresses(address(troveManager), address(activePool));

        stabilityPool.setAddresses(
            address(kumoParams),
            address(borrowerOperations),
            address(troveManager),
            address(kusdToken),
            address(sortedTroves),
            address(0),
            address(kumoParams)
        );

        collSurplusPool.setAddresses(
            address(borrowerOperations),
            address(troveManager),
            address(activePool)
        );

        sortedTroves.setParams(address(troveManager), address(borrowerOperations));

        for (uint256 i = 0; i < NUMBER_OF_ACTORS; i++) {
            echidnaProxies[i] = new EchidnaProxy(
                address(troveManager),
                borrowerOperations,
                stabilityPoolFactory,
                kusdToken
            );
            (bool success, ) = address(echidnaProxies[i]).call{value: INITIAL_BALANCE}("");
            require(success);
        }

        MCR = kumoParams.MCR(_asset);
        CCR = kumoParams.CCR(_asset);
        KUSD_GAS_COMPENSATION = kumoParams.KUSD_GAS_COMPENSATION(_asset);
        require(MCR > 0);
        require(CCR > 0);

        // TODO:
        priceFeedTestnet.setPrice(_asset, 1e22);
    }

    // TroveManager

    function liquidateExt(address _asset, uint256 _i, address _user) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].liquidatePrx(_asset, _user);
    }

    function liquidateTrovesExt(address _asset, uint256 _i, uint256 _n) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].liquidateTrovesPrx(_asset, _n);
    }

    function batchLiquidateTrovesExt(
        address _asset,
        uint256 _i,
        address[] calldata _troveArray
    ) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].batchLiquidateTrovesPrx(_asset, _troveArray);
    }

    function redeemCollateralExt(
        address _asset,
        uint256 _i,
        uint256 _KUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint256 _partialRedemptionHintNICR
    ) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].redeemCollateralPrx(
            _asset,
            _KUSDAmount,
            _firstRedemptionHint,
            _upperPartialRedemptionHint,
            _lowerPartialRedemptionHint,
            _partialRedemptionHintNICR,
            0,
            0
        );
    }

    // Borrower Operations

    function getAdjustedASSET(
        address _asset,
        uint256 actorBalance,
        uint256 _ASSET,
        uint256 ratio
    ) internal view returns (uint256) {
        uint256 price = priceFeedTestnet.getPrice(_asset);
        require(price > 0);
        uint256 minASSET = ratio.mul(kumoParams.KUSD_GAS_COMPENSATION(_asset)).div(price);
        require(actorBalance > minASSET);
        uint256 ASSET = minASSET + (_ASSET % (actorBalance - minASSET));
        return ASSET;
    }

    function getAdjustedKUSD(
        address _asset,
        uint256 ASSET,
        uint256 _KUSDAmount,
        uint256 ratio
    ) internal view returns (uint256) {
        uint256 price = priceFeedTestnet.getPrice(_asset);
        uint256 KUSDAmount = _KUSDAmount;
        uint256 compositeDebt = KUSDAmount.add(kumoParams.KUSD_GAS_COMPENSATION(_asset));
        uint256 ICR = KumoMath._computeCR(ASSET, compositeDebt, price);
        if (ICR < ratio) {
            compositeDebt = ASSET.mul(price).div(ratio);
            KUSDAmount = compositeDebt.sub(kumoParams.KUSD_GAS_COMPENSATION(_asset));
        }
        return KUSDAmount;
    }

    function openTroveExt(
        address _asset,
        uint256 _i,
        uint256 _ASSET,
        uint256 _KUSDAmount
    ) public payable {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint256 actorBalance = address(echidnaProxy).balance;

        // we pass in CCR instead of MCR in case it’s the first one
        uint256 ASSET = getAdjustedASSET(_asset, actorBalance, _ASSET, CCR);
        uint256 KUSDAmount = getAdjustedKUSD(_asset, ASSET, _KUSDAmount, CCR);

        //console.log('ASSET', ASSET);
        //console.log('KUSDAmount', KUSDAmount);

        echidnaProxy.openTrovePrx(_asset, ASSET, KUSDAmount, address(0), address(0), 0);

        // numberOfTroves = troveManager.getTroveOwnersCount(_asset);
        (, bytes memory _data) = address(troveManager).call(
            abi.encodeWithSignature("getTroveOwnersCount(address)", _asset)
        );
        numberOfTroves = abi.decode(_data, (uint256));
        assert(numberOfTroves > 0);
        // canary
        //assert(numberOfTroves == 0);
    }

    function openTroveRawExt(
        address _asset,
        uint256 _i,
        uint256 _ASSET,
        uint256 _KUSDAmount,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFee
    ) public payable {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].openTrovePrx(
            _asset,
            _ASSET,
            _KUSDAmount,
            _upperHint,
            _lowerHint,
            _maxFee
        );
    }

    function addCollExt(address _asset, uint256 _i, uint256 _ASSET) external payable {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint256 actorBalance = address(echidnaProxy).balance;

        uint256 ASSET = getAdjustedASSET(_asset, actorBalance, _ASSET, MCR);

        echidnaProxy.addCollPrx(_asset, ASSET, address(0), address(0));
    }

    function addCollRawExt(
        address _asset,
        uint256 _i,
        uint256 _ASSET,
        address _upperHint,
        address _lowerHint
    ) external payable {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].addCollPrx(_asset, _ASSET, _upperHint, _lowerHint);
    }

    function withdrawCollExt(
        address _asset,
        uint256 _i,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawCollPrx(_asset, _amount, _upperHint, _lowerHint);
    }

    function withdrawKUSDExt(
        address _asset,
        uint256 _i,
        uint256 _amount,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFee
    ) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawKUSDPrx(_asset, _amount, _upperHint, _lowerHint, _maxFee);
    }

    function repayKUSDExt(
        address _asset,
        uint256 _i,
        uint256 _amount,
        address _upperHint,
        address _lowerHint
    ) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].repayKUSDPrx(_asset, _amount, _upperHint, _lowerHint);
    }

    function closeTroveExt(address _asset, uint256 _i) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].closeTrovePrx(_asset);
    }

    function adjustTroveExt(
        address _asset,
        uint256 _i,
        uint256 _ASSET,
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease
    ) external payable {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        EchidnaProxy echidnaProxy = echidnaProxies[actor];
        uint256 actorBalance = address(echidnaProxy).balance;

        uint256 ASSET = getAdjustedASSET(_asset, actorBalance, _ASSET, MCR);
        uint256 debtChange = _debtChange;
        if (_isDebtIncrease) {
            // TODO: add current amount already withdrawn:
            debtChange = getAdjustedKUSD(_asset, ASSET, uint256(_debtChange), MCR);
        }
        // TODO: collWithdrawal, debtChange
        echidnaProxy.adjustTrovePrx(
            _asset,
            ASSET,
            _collWithdrawal,
            debtChange,
            _isDebtIncrease,
            address(0),
            address(0),
            0
        );
    }

    function adjustTroveRawExt(
        address _asset,
        uint256 _i,
        uint256 _ASSET,
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint,
        uint256 _maxFee
    ) external payable {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].adjustTrovePrx(
            _asset,
            _ASSET,
            _collWithdrawal,
            _debtChange,
            _isDebtIncrease,
            _upperHint,
            _lowerHint,
            _maxFee
        );
    }

    // Pool Manager

    function provideToSPExt(
        uint256 _i,
        address _asset,
        uint256 _amount,
        address _frontEndTag
    ) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].provideToSPPrx(_asset, _amount, _frontEndTag);
    }

    function withdrawFromSPExt(uint256 _i, address _asset, uint256 _amount) external {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        echidnaProxies[actor].withdrawFromSPPrx(_asset, _amount);
    }

    // KUSD Token

    function transferExt(uint256 _i, address recipient, uint256 amount) external returns (bool) {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        return echidnaProxies[actor].transferPrx(recipient, amount);
    }

    function approveExt(uint256 _i, address spender, uint256 amount) external returns (bool) {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        return echidnaProxies[actor].approvePrx(spender, amount);
    }

    function transferFromExt(
        uint256 _i,
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        return echidnaProxies[actor].transferFromPrx(sender, recipient, amount);
    }

    function increaseAllowanceExt(
        uint256 _i,
        address spender,
        uint256 addedValue
    ) external returns (bool) {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        return echidnaProxies[actor].increaseAllowancePrx(spender, addedValue);
    }

    function decreaseAllowanceExt(
        uint256 _i,
        address spender,
        uint256 subtractedValue
    ) external returns (bool) {
        uint256 actor = _i % NUMBER_OF_ACTORS;
        return echidnaProxies[actor].decreaseAllowancePrx(spender, subtractedValue);
    }

    // PriceFeed

    function setPriceExt(uint256 _price) external {
        bool result = priceFeedTestnet.setPrice(address(0), _price);
        assert(result);
    }

    // --------------------------
    // Invariants and properties
    // --------------------------

    function echidna_canary_number_of_troves() public view returns (bool) {
        if (numberOfTroves > 20) {
            return false;
        }

        return true;
    }

    function echidna_canary_active_pool_balance() public view returns (bool) {
        if (address(activePool).balance > 0) {
            return false;
        }
        return true;
    }

    function echidna_troves_order(address _asset) external view returns (bool) {
        address currentTrove = sortedTroves.getFirst(_asset);
        address nextTrove = sortedTroves.getNext(_asset, currentTrove);

        while (currentTrove != address(0) && nextTrove != address(0)) {
            if (tmGetNominalICR(_asset, nextTrove) > tmGetNominalICR(_asset, currentTrove)) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            currentTrove = nextTrove;
            nextTrove = sortedTroves.getNext(_asset, currentTrove);
        }

        return true;
    }

    /**
     * Status
     * Minimum debt (gas compensation)
     * Stake > 0
     */
    function echidna_trove_properties(address _asset) public view returns (bool) {
        address currentTrove = sortedTroves.getFirst(_asset);
        while (currentTrove != address(0)) {
            // Status
            // if (TroveManager.Status(troveManager.getTroveStatus(_asset, currentTrove)) != TroveManager.Status.active) {
            //     return false;
            // }
            // Uncomment to check that the condition is meaningful
            //else return false;

            // Minimum debt (gas compensation)
            if (tmGetTroveDebt(_asset, currentTrove) < kumoParams.KUSD_GAS_COMPENSATION(_asset)) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            // Stake > 0
            if (tmGetTroveStake(_asset, currentTrove) == 0) {
                return false;
            }
            // Uncomment to check that the condition is meaningful
            //else return false;

            currentTrove = sortedTroves.getNext(_asset, currentTrove);
        }
        return true;
    }

    function echidna_ASSET_balances(address _asset) public view returns (bool) {
        if (address(troveManager).balance > 0) {
            return false;
        }

        if (address(borrowerOperations).balance > 0) {
            return false;
        }

        if (address(activePool).balance != activePool.getAssetBalance(_asset)) {
            return false;
        }

        if (address(defaultPool).balance != defaultPool.getAssetBalance(_asset)) {
            return false;
        }

        if (
            address(stabilityPool).balance !=
            stabilityPoolFactory.getStabilityPoolByAsset(_asset).getAssetBalance()
        ) {
            return false;
        }

        if (address(kusdToken).balance > 0) {
            return false;
        }

        if (address(priceFeedTestnet).balance > 0) {
            return false;
        }

        if (address(sortedTroves).balance > 0) {
            return false;
        }

        return true;
    }

    // TODO: What should we do with this? Should it be allowed? Should it be a canary?
    function echidna_price() public view returns (bool) {
        uint256 price = priceFeedTestnet.getPrice(address(0));

        if (price == 0) {
            return false;
        }
        // Uncomment to check that the condition is meaningful
        //else return false;

        return true;
    }

    // Total KUSD matches
    function echidna_KUSD_global_balances(address _asset) public view returns (bool) {
        uint256 totalSupply = kusdToken.totalSupply();
        uint256 gasPoolBalance = kusdToken.balanceOf(address(gasPool));

        uint256 activePoolBalance = activePool.getKUSDDebt(_asset);
        uint256 defaultPoolBalance = defaultPool.getKUSDDebt(_asset);
        if (totalSupply != activePoolBalance + defaultPoolBalance) {
            return false;
        }

        IStabilityPool stabilityPoolCached = stabilityPoolFactory.getStabilityPoolByAsset(_asset);
        uint256 stabilityPoolBalance = stabilityPoolCached.getTotalKUSDDeposits();
        address currentTrove = sortedTroves.getFirst(_asset);
        uint256 trovesBalance;
        while (currentTrove != address(0)) {
            trovesBalance += kusdToken.balanceOf(address(currentTrove));
            currentTrove = sortedTroves.getNext(_asset, currentTrove);
        }
        // we cannot state equality because tranfers are made to external addresses too
        if (totalSupply <= stabilityPoolBalance + trovesBalance + gasPoolBalance) {
            return false;
        }

        return true;
    }

    /*
    function echidna_test() public view returns(bool) {
        return true;
    }
    */

    function tmGetNominalICR(
        address _asset,
        address _borrower
    ) internal view returns (uint256 _result) {
        (, bytes memory _data) = address(troveManager).staticcall(
            abi.encodeWithSignature("getNominalICR(address,address)", _asset, _borrower)
        );

        _result = abi.decode(_data, (uint256));
    }

    function tmGetTroveDebt(
        address _asset,
        address _borrower
    ) internal view returns (uint256 _result) {
        (, bytes memory _data) = address(troveManager).staticcall(
            abi.encodeWithSignature("getTroveDebt(address,address)", _asset, _borrower)
        );

        _result = abi.decode(_data, (uint256));
    }

    function tmGetTroveStake(
        address _asset,
        address _borrower
    ) internal view returns (uint256 _result) {
        (, bytes memory _data) = address(troveManager).staticcall(
            abi.encodeWithSignature("getTroveStake(address,address)", _asset, _borrower)
        );

        _result = abi.decode(_data, (uint256));
    }
}
