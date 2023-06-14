const { getAddress } = require("ethers/lib/utils");
const deploymentHelper = require("../../utils/deploymentHelpers.js");
const testHelpers = require("../../utils/testHelpers.js");
const KUSDTokenTester = artifacts.require("./KUSDTokenTester.sol");

const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;
const assertRevert = th.assertRevert;
const mv = testHelpers.MoneyValues;
const timeValues = testHelpers.TimeValues;
const TroveData = testHelpers.TroveData;

const GAS_PRICE = 10000000;

/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 *
 */
contract("TroveManager - Multi Asset", async accounts => {
    const _18_zeros = "000000000000000000";
    const ZERO_ADDRESS = th.ZERO_ADDRESS;

    const [
        owner,
        alice,
        bob,
        carol,
        dennis,
        erin,
        flyn,
        graham,
        harriet,
        ida,
        defaulter_1,
        defaulter_2,
        defaulter_3,
        defaulter_4,
        whale,
        A,
        B,
        C,
        D,
        E
    ] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

    let priceFeed;
    let kusdToken;
    let sortedTroves;
    let troveManager;
    let activePool;
    let stabilityPoolFactory;
    let collSurplusPool;
    let defaultPool;
    let borrowerOperations;
    let hintHelpers;
    let kumoParams;
    let KUMOContracts;
    let erc20Asset1;
    let erc20Asset2;
    let stabilityPoolAsset1;
    let stabilityPoolAsset2;

    let contracts;

    const getOpenTroveTotalDebt = async kusdAmount => th.getOpenTroveTotalDebt(contracts, kusdAmount);
    const getOpenTroveKUSDAmount = async (totalDebt, asset) =>
        th.getOpenTroveKUSDAmount(contracts, totalDebt, asset);
    const getActualDebtFromComposite = async compositeDebt =>
        th.getActualDebtFromComposite(compositeDebt, contracts);
    const getNetBorrowingAmount = async (debtWithFee, asset) =>
        th.getNetBorrowingAmount(contracts, debtWithFee, asset);
    const openTrove = async params => th.openTrove(contracts, params);
    const withdrawKUSD = async params => th.withdrawKUSD(contracts, params);

    beforeEach(async () => {
        contracts = await deploymentHelper.deployKumoCore();
        contracts.kusdToken = await KUSDTokenTester.new(
            contracts.troveManager.address,
            contracts.stabilityPoolFactory.address,
            contracts.borrowerOperations.address
        );
        KUMOContracts = await deploymentHelper.deployKUMOTesterContractsHardhat(
            bountyAddress,
            lpRewardsAddress,
            multisig
        );

        priceFeed = contracts.priceFeedTestnet;
        kusdToken = contracts.kusdToken;
        sortedTroves = contracts.sortedTroves;
        troveManager = contracts.troveManager;
        activePool = contracts.activePool;
        defaultPool = contracts.defaultPool;
        collSurplusPool = contracts.collSurplusPool;
        borrowerOperations = contracts.borrowerOperations;
        hintHelpers = contracts.hintHelpers;
        kumoParams = contracts.kumoParameters;
        stabilityPoolFactory = contracts.stabilityPoolFactory;

        kumoStaking = KUMOContracts.kumoStaking;
        kumoToken = KUMOContracts.kumoToken;
        communityIssuance = KUMOContracts.communityIssuance;
        lockupContractFactory = KUMOContracts.lockupContractFactory;
        erc20Asset1 = await deploymentHelper.deployERC20Asset("Carbon Token X", "CTX");
        assetAddress1 = erc20Asset1.address;
        erc20Asset2 = await deploymentHelper.deployERC20Asset("Carbon Token Y", "CTY");
        assetAddress2 = erc20Asset2.address;

        await deploymentHelper.connectCoreContracts(contracts, KUMOContracts);
        await deploymentHelper.connectKUMOContracts(KUMOContracts);
        await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts);

        // Add assets to the system
        await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1);
        await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress2);

        // Mint token to each acccount
        await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 20);
        await deploymentHelper.mintMockAssets(erc20Asset2, accounts, 20);

        // Set StabilityPools
        stabilityPoolAsset1 = await deploymentHelper.getStabilityPoolByAsset(contracts, assetAddress1);
        stabilityPoolAsset2 = await deploymentHelper.getStabilityPoolByAsset(contracts, assetAddress2);
    });

    it("liquidate(): decreases ActivePool Asset and KUSDDebt by correct amounts, should not change AP balance of second asset", async () => {
        // --- SETUP ---
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(4, 18)),
            extraParams: { from: alice }
        });
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(21, 17)),
            extraParams: { from: bob }
        });

        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(4, 18)),
            extraParams: { from: alice }
        });
        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(21, 17)),
            extraParams: { from: bob }
        });
        // --- TEST ---

        // check ActivePool Assets and KUSD debt before
        const activePool_Balance_Before_Asset1 = (
            await activePool.getAssetBalance(assetAddress1)
        ).toString();
        const activePool_Balance_Before_Asset2 = (
            await activePool.getAssetBalance(assetAddress2)
        ).toString();
        const activePool_KUSDDebt_Before_Asset1 = (
            await activePool.getKUSDDebt(assetAddress1)
        ).toString();
        const activePool_KUSDDebt_Before_Asset2 = (
            await activePool.getKUSDDebt(assetAddress2)
        ).toString();

        // price drops to 1Asset1:100KUSD, reducing Bob's ICR below MCR
        await priceFeed.setPrice(assetAddress1, "100000000000000000000");

        /* close Bob's Trove. Should liquidate his ether and KUSD, 
        leaving Alice’s ether and KUSD debt in the ActivePool. */
        await troveManager.liquidate(assetAddress1, bob, { from: owner });

        // check ActivePool ETH and KUSD debt
        const activePool_Balance_After_Asset1 = (await activePool.getAssetBalance(assetAddress1)).toString();
        const activePool_Balance_After_Asset2 = (await activePool.getAssetBalance(assetAddress2)).toString();

        const activePool_KUSDDebt_After_Asset1 = (
            await activePool.getKUSDDebt(assetAddress1)
        ).toString();
        const activePool_KUSDDebt_After_Asset2 = (
            await activePool.getKUSDDebt(assetAddress2)
        ).toString();

        assert.isTrue(activePool_Balance_Before_Asset1 > activePool_Balance_After_Asset1);
        assert.isTrue(activePool_Balance_Before_Asset2 == activePool_Balance_After_Asset2);

        assert.isTrue(activePool_KUSDDebt_Before_Asset1 > activePool_KUSDDebt_After_Asset1);
        assert.isTrue(activePool_KUSDDebt_Before_Asset2 == activePool_KUSDDebt_After_Asset2);

    });


    it("liquidate(): Pool offsets increase the TCR, should not change TCR or second asset", async () => {
        // Whale provides KUSD to SP
        const spDeposit = toBN(dec(100, 24));
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(4, 18)),
            extraKUSDAmount: spDeposit,
            extraParams: { from: whale }
        });
        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(4, 18)),
            extraKUSDAmount: spDeposit,
            extraParams: { from: whale }
        });

        await stabilityPoolAsset1.provideToSP(spDeposit, ZERO_ADDRESS, { from: whale });

        await openTrove({ asset: assetAddress1, ICR: toBN(dec(10, 18)), extraParams: { from: alice } });
        await openTrove({ asset: assetAddress1, ICR: toBN(dec(70, 18)), extraParams: { from: bob } });
        await openTrove({ asset: assetAddress1, ICR: toBN(dec(2, 18)), extraParams: { from: carol } });
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(200, 18)),
            extraParams: { from: dennis }
        });

        await openTrove({ asset: assetAddress2, ICR: toBN(dec(10, 18)), extraParams: { from: alice } });
        await openTrove({ asset: assetAddress2, ICR: toBN(dec(70, 18)), extraParams: { from: bob } });
        await openTrove({ asset: assetAddress2, ICR: toBN(dec(2, 18)), extraParams: { from: carol } });
        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(200, 18)),
            extraParams: { from: dennis }
        });

        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(202, 16)),
            extraParams: { from: defaulter_1 }
        });
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(190, 16)),
            extraParams: { from: defaulter_2 }
        });
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(196, 16)),
            extraParams: { from: defaulter_3 }
        });
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(200, 16)),
            extraParams: { from: defaulter_4 }
        });

        assert.isTrue(await sortedTroves.contains(assetAddress1, defaulter_1));
        assert.isTrue(await sortedTroves.contains(assetAddress1, defaulter_2));
        assert.isTrue(await sortedTroves.contains(assetAddress1, defaulter_3));
        assert.isTrue(await sortedTroves.contains(assetAddress1, defaulter_4));

        await priceFeed.setPrice(assetAddress1, dec(100, 18));

        const TCR_Asset1_1 = await th.getTCR(contracts, assetAddress1);
        const TCR_Asset2_1 = await th.getTCR(contracts, assetAddress2);

        // Confirm system is not in Recovery Mode
        assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));

        // Check TCR improves with each liquidation that is offset with Pool
        await troveManager.liquidate(assetAddress1, defaulter_1);
        assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));
        const TCR_Asset1_2 = await th.getTCR(contracts, assetAddress1);
        const TCR_Asset2_2 = await th.getTCR(contracts, assetAddress2);
        assert.isTrue(TCR_Asset1_2.gte(TCR_Asset1_1));
        assert.isTrue(TCR_Asset2_2.eq(TCR_Asset2_1));

        await troveManager.liquidate(assetAddress1, defaulter_2);
        assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_2));
        const TCR_Asset1_3 = await th.getTCR(contracts, assetAddress1);
        const TCR_Asset2_3 = await th.getTCR(contracts, assetAddress2);
        assert.isTrue(TCR_Asset1_3.gte(TCR_Asset1_2));
        assert.isTrue(TCR_Asset2_3.eq(TCR_Asset2_2));

        await troveManager.liquidate(assetAddress1, defaulter_3);
        assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_3));
        const TCR_Asset1_4 = await th.getTCR(contracts, assetAddress1);
        const TCR_Asset2_4 = await th.getTCR(contracts, assetAddress2);
        assert.isTrue(TCR_Asset1_4.gte(TCR_Asset1_4));
        assert.isTrue(TCR_Asset2_4.eq(TCR_Asset2_3));

        await troveManager.liquidate(assetAddress1, defaulter_4);
        assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_4));
        const TCR_Asset1_5 = await th.getTCR(contracts, assetAddress1);
        const TCR_Asset2_5 = await th.getTCR(contracts, assetAddress2);
        assert.isTrue(TCR_Asset1_5.gte(TCR_Asset1_5));
        assert.isTrue(TCR_Asset2_5.eq(TCR_Asset2_4));
    });

    // --- liquidateTroves() ---

    it("liquidateTroves(): Liquidating troves with SP deposits correctly impacts their SP deposit and ETH gain, should not impact on SP and KUSD balance of second asset", async () => {
        // Whale provides 400 KUSD to the SP
        const whaleDeposit = toBN(dec(40000, 18));
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(100, 18)),
            extraKUSDAmount: whaleDeposit,
            extraParams: { from: whale }
        });

        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(100, 18)),
            extraKUSDAmount: whaleDeposit,
            extraParams: { from: whale }
        });

        await stabilityPoolAsset1.provideToSP(whaleDeposit, ZERO_ADDRESS, { from: whale });



        const A_deposit = toBN(dec(10000, 18));
        const B_deposit = toBN(dec(30000, 18));
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(2, 18)),
            extraKUSDAmount: A_deposit,
            extraParams: { from: alice }
        });
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(2, 18)),
            extraKUSDAmount: B_deposit,
            extraParams: { from: bob }
        });
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(2, 18)),
            extraParams: { from: carol }
        });

        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(2, 18)),
            extraKUSDAmount: A_deposit,
            extraParams: { from: alice }
        });
        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(2, 18)),
            extraKUSDAmount: B_deposit,
            extraParams: { from: bob }
        });
        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(2, 18)),
            extraParams: { from: carol }
        });

        // A, B provide 100, 300 to the SP
        await stabilityPoolAsset1.provideToSP(A_deposit, ZERO_ADDRESS, { from: alice });
        await stabilityPoolAsset1.provideToSP(B_deposit, ZERO_ADDRESS, { from: bob });

        const total_KUSDinSP_Before_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();
        const total_SPB_Before_Asset1 = (await stabilityPoolAsset1.getAssetBalance()).toString();
        const total_KUSDinSP_Before_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits()).toString();
        const total_SPB_Before_Asset2 = (await stabilityPoolAsset2.getAssetBalance()).toString();

        // Price drops
        await priceFeed.setPrice(assetAddress1, dec(100, 18));

        // Liquidate
        await troveManager.liquidateTroves(assetAddress1, 10);

        // Check total remaining deposits and ETH gain in Stability Pool
        const total_KUSDinSP_After_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();
        const total_SPB_After_Asset1 = (await stabilityPoolAsset1.getAssetBalance()).toString();
        const total_KUSDinSP_After_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits()).toString();
        const total_SPB_After_Asset2 = (await stabilityPoolAsset2.getAssetBalance()).toString();

        assert.isTrue(total_KUSDinSP_Before_Asset1 > total_KUSDinSP_After_Asset1);
        assert.isTrue(total_SPB_Before_Asset1 < total_SPB_After_Asset1);

        assert.isTrue(total_KUSDinSP_Before_Asset2 == total_KUSDinSP_After_Asset2);
        assert.isTrue(total_SPB_Before_Asset2 == total_SPB_After_Asset2);

    });

    it("redeemCollateral(): caller can redeem their entire KUSDToken balance, should not change KUSD balance of second asset", async () => {
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(20, 18)),
            extraParams: { from: whale }
        });

        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(20, 18)),
            extraParams: { from: whale }
        });

        // Alice opens trove and transfers 400 KUSD to Erin, the would-be redeemer
        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(300, 16)),
            extraKUSDAmount: dec(400, 18),
            extraParams: { from: alice }
        });
        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(300, 16)),
            extraKUSDAmount: dec(400, 18),
            extraParams: { from: alice }
        });
        await kusdToken.transfer(erin, dec(400, 18), { from: alice });

        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(300, 16)),
            extraKUSDAmount: dec(590, 18),
            extraParams: { from: bob }
        });

        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(300, 16)),
            extraKUSDAmount: dec(590, 18),
            extraParams: { from: bob }
        });

        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(300, 16)),
            extraKUSDAmount: dec(1990, 18),
            extraParams: { from: carol }
        });

        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(300, 16)),
            extraKUSDAmount: dec(1990, 18),
            extraParams: { from: carol }
        });

        await openTrove({
            asset: assetAddress1,
            ICR: toBN(dec(500, 16)),
            extraKUSDAmount: dec(1990, 18),
            extraParams: { from: dennis }
        });

        await openTrove({
            asset: assetAddress2,
            ICR: toBN(dec(500, 16)),
            extraKUSDAmount: dec(1990, 18),
            extraParams: { from: dennis }
        });



        // Get active debt and coll before redemption
        const activePool_debt_before_asset1 = (await activePool.getKUSDDebt(assetAddress1)).toString();
        const activePool_debt_before_asset2 = (await activePool.getKUSDDebt(assetAddress2)).toString();

        const price = await priceFeed.getPrice(assetAddress1);

        // skip bootstrapping phase
        await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider);

        // Erin attempts to redeem 400 KUSD
        const { firstRedemptionHint, partialRedemptionHintNICR } = await hintHelpers.getRedemptionHints(
            assetAddress1,
            dec(400, 18),
            price,
            0
        );

        const { 0: upperPartialRedemptionHint, 1: lowerPartialRedemptionHint } =
            await sortedTroves.findInsertPosition(assetAddress1, partialRedemptionHintNICR, erin, erin);

        await troveManager.redeemCollateral(
            assetAddress1,
            dec(400, 18),
            firstRedemptionHint,
            upperPartialRedemptionHint,
            lowerPartialRedemptionHint,
            partialRedemptionHintNICR,
            0,
            th._100pct,
            { from: erin }
        );

        // Check activePool debt reduced by  400 KUSD
        const activePool_debt_after_asset1 = (await activePool.getKUSDDebt(assetAddress1)).toString();
        const activePool_debt_after_asset2 = (await activePool.getKUSDDebt(assetAddress2)).toString();
        assert.isTrue(activePool_debt_before_asset1 > activePool_debt_after_asset1)
        assert.isTrue(activePool_debt_before_asset2 == activePool_debt_after_asset2)

    });
});

contract("Reset chain state", async accounts => { });
