const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants.js");
const deploymentHelper = require("../../utils/deploymentHelpers.js");
const testHelpers = require("../../utils/testHelpers.js");
const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;

const KUSDToken = artifacts.require("KUSDToken");

contract("StabilityPool - Multiple Assets", async accounts => {
  const [
    owner,
    defaulter_1,
    defaulter_2,
    whale,
    alice,
    bob,
    carol,
    frontEnd_1,
    frontEnd_2,
    frontEnd_3
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3];
  let contracts;
  let priceFeed;
  let kusdToken;
  let troveManager;
  let activePool;
  let defaultPool;
  let KUMOContracts;
  let erc20Asset1;
  let erc20Asset2;
  let stabilityPoolAsset1;
  let stabilityPoolAsset2;

  const openTrove = async params => th.openTrove(contracts, params);

  describe("Stability Pool Mechanisms - Multi Asset", async () => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployKumoCore();

      contracts.kusdToken = await KUSDToken.new(
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
      troveManager = contracts.troveManager;
      activePool = contracts.activePool;
      defaultPool = contracts.defaultPool;
      hintHelpers = contracts.hintHelpers;
      
      erc20Asset1 = await deploymentHelper.deployERC20Asset("Carbon Token X", "CTX");
      assetAddress1 = erc20Asset1.address;
      erc20Asset2 = await deploymentHelper.deployERC20Asset("Carbon Token Y", "CTY");
      assetAddress2 = erc20Asset2.address;

      await deploymentHelper.connectKUMOContracts(KUMOContracts);
      await deploymentHelper.connectCoreContracts(contracts, KUMOContracts);
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

      // Register 3 front ends
      await th.registerFrontEnds(frontEnds, stabilityPoolAsset1);
    });

    // --- provideToSP() ---
    // increases recorded KUSD at Stability Pool
    it("provideToSP(): increases the Stability Pool KUSD balance, should not change KUSD balance for second asset", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      const KUSD_Balance_Before_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString()
      const KUSD_Balance_Before_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits().toString())

      // --- TEST ---

      // provideToSP(), changing KUSD of Asset1, changes KUSD balance
      await stabilityPoolAsset1.provideToSP(200, ZERO_ADDRESS, { from: alice });



      const KUSD_Balance_After_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString()
      const KUSD_Balance_After_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits().toString())

      // KUSD for the first asset changes, KUSD for the second asset stays the same as ZERO
      assert.isTrue(KUSD_Balance_Before_Asset2 == KUSD_Balance_After_Asset2);
      assert.isTrue(KUSD_Balance_Before_Asset1 < KUSD_Balance_After_Asset1);

    });

    it("provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked, should not change StabilityPool balance and KUSD balance for second asset", async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });
      const whaleKUSD = await kusdToken.balanceOf(whale);
      await stabilityPoolAsset1.provideToSP(whaleKUSD, frontEnd_1, { from: whale });

      // 2 Troves opened, each withdraws minimum debt
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 }
      });

      // Alice makes Trove and withdraws 100 KUSD
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(5, 18)),
        extraParams: { from: alice, value: dec(50, "ether") }
      });

      // Alice makes Trove and withdraws 100 KUSD
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(5, 18)),
        extraParams: { from: alice, value: dec(50, "ether") }
      });

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      const Stability_Balance_Before_Asset1 = (await stabilityPoolAsset1.getAssetBalance()).toString()
      const Stability_Balance_Before_Asset2 = (await stabilityPoolAsset2.getAssetBalance()).toString()

      // Troves are closed
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner });
      await troveManager.liquidate(assetAddress1, defaulter_2, { from: owner });

      const KUSD_Balance_Before_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString()
      const KUSD_Balance_Before_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits()).toString()

      // Make deposit
      await stabilityPoolAsset1.provideToSP(dec(100, 18), frontEnd_1, { from: alice });

      const Stability_Balance_After_Asset1 = (await stabilityPoolAsset1.getAssetBalance()).toString()
      const Stability_Balance_After_Asset2 = (await stabilityPoolAsset2.getAssetBalance()).toString()

      const KUSD_Balance_After_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString()
      const KUSD_Balance_After_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits()).toString()


      assert.isTrue(Stability_Balance_Before_Asset2 == Stability_Balance_After_Asset2);
      assert.isTrue(Stability_Balance_Before_Asset1 < Stability_Balance_After_Asset1);

      assert.isTrue(KUSD_Balance_Before_Asset2 == KUSD_Balance_After_Asset2);
      assert.isTrue(KUSD_Balance_Before_Asset1 < KUSD_Balance_After_Asset1);

    });


    it("withdrawFromSP(): partial retrieval - retrieves correct KUSD amount and the entire Asset gain, and updates deposit, should not change SP and KUSD balance for second asset", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      await stabilityPoolAsset1.provideToSP(dec(185000, 18), frontEnd_1, { from: whale });


      // 2 Troves opened
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 }
      });

      // --- TEST ---

      // Alice makes deposit #1: 15000 KUSD
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });

      await stabilityPoolAsset1.provideToSP(dec(15000, 18), frontEnd_1, { from: alice });

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      const Stability_Balance_Before_Asset1 = (await stabilityPoolAsset1.getAssetBalance()).toString()
      const Stability_Balance_Before_Asset2 = (await stabilityPoolAsset2.getAssetBalance()).toString()

      const KUSD_Balance_Before_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString()
      const KUSD_Balance_Before_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits()).toString()

      // 2 users with Trove with 170 KUSD drawn are closed
      await troveManager.liquidate(assetAddress1, defaulter_1, {
        from: owner
      }); // 170 KUSD closed
      await troveManager.liquidate(assetAddress1, defaulter_2, {
        from: owner
      }); // 170 KUSD closed

      // Alice retrieves part of her entitled KUSD: 9000 KUSD
      await stabilityPoolAsset1.withdrawFromSP(dec(9000, 18), { from: alice });

      const Stability_Balance_After_Asset1 = (await stabilityPoolAsset1.getAssetBalance()).toString()
      const Stability_Balance_After_Asset2 = (await stabilityPoolAsset2.getAssetBalance()).toString()

      const KUSD_Balance_After_Asset1 = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString()
      const KUSD_Balance_After_Asset2 = (await stabilityPoolAsset2.getTotalKUSDDeposits()).toString()


      assert.isTrue(Stability_Balance_Before_Asset2 == Stability_Balance_After_Asset2);
      assert.isTrue(Stability_Balance_Before_Asset1 < Stability_Balance_After_Asset1);

      assert.isTrue(KUSD_Balance_Before_Asset2 == KUSD_Balance_After_Asset2);
      assert.isTrue(KUSD_Balance_Before_Asset1 > KUSD_Balance_After_Asset1);

    });

    it("withdrawFromSP(): doesn't impact system debt, collateral or TCR on second asset", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol }
      });

      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol }
      });

      await stabilityPoolAsset1.provideToSP(dec(10000, 18), frontEnd_1, { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(20000, 18), frontEnd_1, { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30000, 18), frontEnd_1, { from: carol });

      // Would-be defaulters open troves
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 }
      });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // Defaulters are liquidated
      await troveManager.liquidate(assetAddress1, defaulter_1);
      await troveManager.liquidate(assetAddress1, defaulter_2);

      // Price rises
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      const activeDebt_Before_Asset1 = (await activePool.getKUSDDebt(assetAddress1)).toString();
      const defaultedDebt_Before_Asset1 = (await defaultPool.getKUSDDebt(assetAddress1)).toString();
      const activeColl_Before_Asset1 = (await activePool.getAssetBalance(assetAddress1)).toString();
      const defaultedColl_Before_Asset1 = (await defaultPool.getAssetBalance(assetAddress1)).toString();
      const TCR_Before_Asset1 = (await th.getTCR(contracts, assetAddress1)).toString();

      const activeDebt_Before_Asset2 = (await activePool.getKUSDDebt(assetAddress2)).toString();
      const defaultedDebt_Before_Asset2 = (await defaultPool.getKUSDDebt(assetAddress2)).toString();
      const activeColl_Before_Asset2 = (await activePool.getAssetBalance(assetAddress2)).toString();
      const defaultedColl_Before_Asset2 = (await defaultPool.getAssetBalance(assetAddress2)).toString();
      const TCR_Before_Asset2 = (await th.getTCR(contracts, assetAddress2)).toString();

      // Carol withdraws her Stability deposit
      await stabilityPoolAsset1.withdrawFromSP(dec(30000, 18), { from: carol });

      const activeDebt_After_Asset1 = (await activePool.getKUSDDebt(assetAddress1)).toString();
      const defaultedDebt_After_Asset1 = (await defaultPool.getKUSDDebt(assetAddress1)).toString();
      const activeColl_After_Asset1 = (await activePool.getAssetBalance(assetAddress1)).toString();
      const defaultedColl_After_Asset1 = (await defaultPool.getAssetBalance(assetAddress1)).toString();
      const TCR_After_Asset1 = (await th.getTCR(contracts, assetAddress1)).toString();


      const activeDebt_After_Asset2 = (await activePool.getKUSDDebt(assetAddress2)).toString();
      const defaultedDebt_After_Asset2 = (await defaultPool.getKUSDDebt(assetAddress2)).toString();
      const activeColl_After_Asset2 = (await activePool.getAssetBalance(assetAddress2)).toString();
      const defaultedColl_After_Asset2 = (await defaultPool.getAssetBalance(assetAddress2)).toString();
      const TCR_After_Asset2 = (await th.getTCR(contracts, assetAddress2)).toString();

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before_Asset1, activeDebt_After_Asset1);
      assert.equal(defaultedDebt_Before_Asset1, defaultedDebt_After_Asset1);
      assert.equal(activeColl_Before_Asset1, activeColl_After_Asset1);
      assert.equal(defaultedColl_Before_Asset1, defaultedColl_After_Asset1);
      assert.equal(TCR_Before_Asset1, TCR_After_Asset1);

      assert.equal(activeDebt_Before_Asset2, activeDebt_After_Asset2);
      assert.equal(defaultedDebt_Before_Asset2, defaultedDebt_After_Asset2);
      assert.equal(activeColl_Before_Asset2, activeColl_After_Asset2);
      assert.equal(defaultedColl_Before_Asset2, defaultedColl_After_Asset2);
      assert.equal(TCR_Before_Asset2, TCR_After_Asset2);
    });

    // --- withdrawAssetGainToTrove ---

    it("withdrawAssetGainToTrove(): decreases StabilityPool Asset and increases activePool Asset, should not change SP and Active Pool balance of second asset", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), frontEnd_1, { from: whale });

      // defaulter opened
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // --- TEST ---

      // Alice makes deposit #1: 15000 KUSD
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), frontEnd_1, { from: alice });

      // price drops: defaulter's Trove falls below MCR
      await priceFeed.setPrice(assetAddress1, dec(100, 18));

      // defaulter's Trove is closed.
      const liquidationTx = await troveManager.liquidate(assetAddress1, defaulter_1);
      const [liquidatedDebt, liquidatedColl, gasComp] =
        th.getEmittedLiquidationValues(liquidationTx);

      // Expect alice to be entitled to 15000/200000 of the liquidated coll
      const aliceExpectedAssetGain = liquidatedColl
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)));
      const aliceAssetGain = await stabilityPoolAsset1.getDepositorAssetGain(alice);
      assert.isTrue(aliceExpectedAssetGain.eq(aliceAssetGain));

      // price bounces back
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      //check activePool and StabilityPool Ether before retrieval:
      const active_Asset1_Before = await activePool.getAssetBalance(assetAddress1);
      const stability_Asset1_Before = await stabilityPoolAsset1.getAssetBalance();

      const active_Asset2_Before = (await activePool.getAssetBalance(assetAddress2)).toString();
      const stability_Asset2_Before = (await stabilityPoolAsset2.getAssetBalance()).toString();

      // Alice retrieves redirects Asset gain to her Trove
      await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice });

      const active_Asset1_After = await activePool.getAssetBalance(assetAddress1);
      const stability_Asset1_After = await stabilityPoolAsset1.getAssetBalance();

      const active_Asset2_After = (await activePool.getAssetBalance(assetAddress2)).toString();
      const stability_Asset2_After = (await stabilityPoolAsset2.getAssetBalance()).toString();


      const active_Asset_Difference = active_Asset1_After.sub(active_Asset1_Before); // AP Asset should increase
      const stability_Asset_Difference = stability_Asset1_Before.sub(stability_Asset1_After); // SP Asset should decrease

      // check Pool Asset values change by Alice's AssetGain, i.e 0.075 Asset
      assert.isAtMost(th.getDifference(active_Asset_Difference, aliceAssetGain), 10000);
      assert.isAtMost(th.getDifference(stability_Asset_Difference, aliceAssetGain), 10000);

      assert.isTrue(active_Asset2_Before == active_Asset2_After);
      assert.isTrue(stability_Asset2_Before == stability_Asset2_After);

    });
  });
});

contract("Reset chain state", async accounts => { });
