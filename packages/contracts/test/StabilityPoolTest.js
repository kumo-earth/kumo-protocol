const deploymentHelper = require("../utils/deploymentHelpers.js");
const testHelpers = require("../utils/testHelpers.js");
const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;
const mv = testHelpers.MoneyValues;
const timeValues = testHelpers.TimeValues;
const TroveData = testHelpers.TroveData;

const KUSDToken = artifacts.require("KUSDToken");
const NonPayable = artifacts.require("NonPayable.sol");
const StabilityPool = artifacts.require("./StabilityPool.sol");

const ZERO = toBN("0");
const maxBytes32 = th.maxBytes32;

const GAS_PRICE = 10000000;

contract("StabilityPool", async accounts => {
  const [
    owner,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    whale,
    alice,
    bob,
    carol,
    dennis,
    erin,
    flyn,
    A,
    B,
    C,
    D,
    E,
    F
  ] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let contracts;
  let priceFeed;
  let kusdToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let stabilityPoolFactory;
  let defaultPool;
  let borrowerOperations;
  let kumoToken;
  let KUMOContracts;
  let erc20Asset1;
  let erc20Asset2;
  let stabilityPoolAsset1;
  let stabilityPoolAsset2;

  let gasPriceInWei;

  const getOpenTroveKUSDAmount = async (totalDebt, asset) =>
    th.getOpenTroveKUSDAmount(contracts, totalDebt, asset);
  const openTrove = async params => th.openTrove(contracts, params);
  const assertRevert = th.assertRevert;

  describe("Stability Pool Mechanisms", async () => {
    before(async () => {
      gasPriceInWei = await web3.eth.getGasPrice();
    });

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
      sortedTroves = contracts.sortedTroves;
      troveManager = contracts.troveManager;
      activePool = contracts.activePool;
      stabilityPoolFactory = contracts.stabilityPoolFactory;
      defaultPool = contracts.defaultPool;
      borrowerOperations = contracts.borrowerOperations;
      hintHelpers = contracts.hintHelpers;
      kumoParams = contracts.kumoParameters;

      kumoToken = KUMOContracts.kumoToken;
      communityIssuance = KUMOContracts.communityIssuance;
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
    });

    // --- provideToSP() ---
    // increases recorded KUSD at Stability Pool
    it("provideToSP(): increases the Stability Pool KUSD balance", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      // --- TEST ---

      // provideToSP()
      await stabilityPoolAsset1.provideToSP(200, { from: alice });

      // check KUSD balances after
      const stabilityPool_KUSD_After = await stabilityPoolAsset1.getTotalKUSDDeposits();
      assert.equal(stabilityPool_KUSD_After, 200);
    });

    it("provideToSP(): updates the user's deposit record in StabilityPool", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      // --- TEST ---
      // check user's deposit record before
      const alice_depositRecord_Before = await stabilityPoolAsset1.deposits(alice);
      assert.equal(alice_depositRecord_Before, 0);

      // provideToSP()
      await stabilityPoolAsset1.provideToSP(200, { from: alice });

      // check user's deposit record after
      const alice_depositRecord_After = await stabilityPoolAsset1.deposits(alice);
      assert.equal(alice_depositRecord_After, 200);
    });

    it("provideToSP(): reduces the user's KUSD balance by the correct amount", async () => {
      // --- SETUP --- Give Alice a least 200
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(200),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      // --- TEST ---
      // get user's deposit record before
      const alice_KUSDBalance_Before = await kusdToken.balanceOf(alice);

      // provideToSP()
      await stabilityPoolAsset1.provideToSP(200, { from: alice });

      // check user's KUSD balance change
      const alice_KUSDBalance_After = await kusdToken.balanceOf(alice);
      assert.equal(alice_KUSDBalance_Before.sub(alice_KUSDBalance_After), "200");
    });

    it("provideToSP(): increases totalKUSDDeposits by correct amount", async () => {
      // --- SETUP ---

      // Whale opens Trove with 50 Asset, adds 2000 KUSD to StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(2000, 18), { from: whale });

      const totalKUSDDeposits = await stabilityPoolAsset1.getTotalKUSDDeposits();
      assert.equal(totalKUSDDeposits, dec(2000, 18));
    });

    it("provideToSP(): Correctly updates user snapshots of accumulated rewards per unit staked", async () => {
      // --- SETUP ---

      // Whale opens Trove and deposits to SP
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });
      const whaleKUSD = await kusdToken.balanceOf(whale);
      await stabilityPoolAsset1.provideToSP(whaleKUSD, { from: whale });

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

      // price drops: defaulter's Troves fall below MCR, whale doesn't
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      const SPKUSD_Before = await stabilityPoolAsset1.getTotalKUSDDeposits();

      // Troves are closed
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner });
      await troveManager.liquidate(assetAddress1, defaulter_2, { from: owner });
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_2));

      // Confirm SP has decreased
      const SPKUSD_After = await stabilityPoolAsset1.getTotalKUSDDeposits();
      assert.isTrue(SPKUSD_After.lt(SPKUSD_Before));

      // --- TEST ---
      const P_Before = await stabilityPoolAsset1.P();
      const S_Before = await stabilityPoolAsset1.epochToScaleToSum(0, 0);
      const G_Before = await stabilityPoolAsset1.epochToScaleToG(0, 0);
      assert.isTrue(P_Before.gt(toBN("0")));
      assert.isTrue(S_Before.gt(toBN("0")));

      // Check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPoolAsset1.depositSnapshots(alice);
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString();
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString();
      const alice_snapshot_G_Before = alice_snapshot_Before[2].toString();
      assert.equal(alice_snapshot_S_Before, "0");
      assert.equal(alice_snapshot_P_Before, "0");
      assert.equal(alice_snapshot_G_Before, "0");

      // Make deposit
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: alice });

      // Check 'After' snapshots
      const alice_snapshot_After = await stabilityPoolAsset1.depositSnapshots(alice);
      const alice_snapshot_S_After = alice_snapshot_After[0].toString();
      const alice_snapshot_P_After = alice_snapshot_After[1].toString();
      const alice_snapshot_G_After = alice_snapshot_After[2].toString();

      assert.equal(alice_snapshot_S_After, S_Before);
      assert.equal(alice_snapshot_P_After, P_Before);
      assert.equal(alice_snapshot_G_After, G_Before);
    });

    it("provideToSP(): multiple deposits: updates user's deposit and snapshots", async () => {
      // --- SETUP ---
      // Whale opens Trove and deposits to SP
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });
      const whaleKUSD = await kusdToken.balanceOf(whale);
      await stabilityPoolAsset1.provideToSP(whaleKUSD, { from: whale });

      // 3 Troves opened. Two users withdraw 160 KUSD each
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1, value: dec(50, "ether") }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2, value: dec(50, "ether") }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: 0,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_3, value: dec(50, "ether") }
      });

      // --- TEST ---

      // Alice makes deposit #1: 150 KUSD
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(250, 18)),
        ICR: toBN(dec(3, 18)),
        extraParams: { from: alice }
      });
      await stabilityPoolAsset1.provideToSP(dec(150, 18), { from: alice });

      const alice_Snapshot_0 = await stabilityPoolAsset1.depositSnapshots(alice);
      const alice_Snapshot_S_0 = alice_Snapshot_0[0];
      const alice_Snapshot_P_0 = alice_Snapshot_0[1];
      assert.equal(alice_Snapshot_S_0, 0);
      assert.equal(alice_Snapshot_P_0, "1000000000000000000");

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // 2 users with Trove with 180 KUSD drawn are closed
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner }); // 180 KUSD closed
      await troveManager.liquidate(assetAddress1, defaulter_2, { from: owner }); // 180 KUSD closed

      const alice_compoundedDeposit_1 = await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice);

      // Alice makes deposit #2
      const alice_topUp_1 = toBN(dec(100, 18));
      await stabilityPoolAsset1.provideToSP(alice_topUp_1, { from: alice });

      const alice_newDeposit_1 = (await stabilityPoolAsset1.deposits(alice)).toString();
      assert.equal(alice_compoundedDeposit_1.add(alice_topUp_1), alice_newDeposit_1);

      // get system reward terms
      const P_1 = await stabilityPoolAsset1.P();
      const S_1 = await stabilityPoolAsset1.epochToScaleToSum(0, 0);
      assert.isTrue(P_1.lt(toBN(dec(1, 18))));
      assert.isTrue(S_1.gt(toBN("0")));

      // check Alice's new snapshot is correct
      const alice_Snapshot_1 = await stabilityPoolAsset1.depositSnapshots(alice);
      const alice_Snapshot_S_1 = alice_Snapshot_1[0];
      const alice_Snapshot_P_1 = alice_Snapshot_1[1];
      assert.isTrue(alice_Snapshot_S_1.eq(S_1));
      assert.isTrue(alice_Snapshot_P_1.eq(P_1));

      // Bob withdraws KUSD and deposits to StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await stabilityPoolAsset1.provideToSP(dec(427, 18), { from: alice });

      // Defaulter 3 Trove is closed
      await troveManager.liquidate(assetAddress1, defaulter_3, { from: owner });

      const alice_compoundedDeposit_2 = await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice);

      const P_2 = await stabilityPoolAsset1.P();
      const S_2 = await stabilityPoolAsset1.epochToScaleToSum(0, 0);
      assert.isTrue(P_2.lt(P_1));
      assert.isTrue(S_2.gt(S_1));

      // Alice makes deposit #3:  100KUSD
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: alice });

      // check Alice's new snapshot is correct
      const alice_Snapshot_2 = await stabilityPoolAsset1.depositSnapshots(alice);
      const alice_Snapshot_S_2 = alice_Snapshot_2[0];
      const alice_Snapshot_P_2 = alice_Snapshot_2[1];
      assert.isTrue(alice_Snapshot_S_2.eq(S_2));
      assert.isTrue(alice_Snapshot_P_2.eq(P_2));
    });

    it("provideToSP(): reverts if user tries to provide more than their KUSD balance", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice, value: dec(50, "ether") }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob, value: dec(50, "ether") }
      });
      const aliceKUSDbal = await kusdToken.balanceOf(alice);
      const bobKUSDbal = await kusdToken.balanceOf(bob);

      // Alice, attempts to deposit 1 wei more than her balance

      const aliceTxPromise = stabilityPoolAsset1.provideToSP(aliceKUSDbal.add(toBN(1)), {
        from: alice
      });
      await assertRevert(aliceTxPromise, "revert");

      // Bob, attempts to deposit 235534 more than his balance

      const bobTxPromise = stabilityPoolAsset1.provideToSP(bobKUSDbal.add(toBN(dec(235534, 18))), {
        from: bob
      });
      await assertRevert(bobTxPromise, "revert");
    });

    it("provideToSP(): reverts if user tries to provide 2^256-1 KUSD, which exceeds their balance", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice, value: dec(50, "ether") }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob, value: dec(50, "ether") }
      });

      const maxBytes32 = web3.utils.toBN(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      // Alice attempts to deposit 2^256-1 KUSD
      try {
        aliceTx = await stabilityPoolAsset1.provideToSP(maxBytes32, { from: alice });
        assert.isFalse(tx.receipt.status);
      } catch (error) {
        assert.include(error.message, "revert");
      }
    });

    it.skip("provideToSP(): reverts if cannot receive Asset Gain", async () => {
      // --- SETUP ---
      // Whale deposits 1850 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });
      await stabilityPoolAsset1.provideToSP(dec(1850, 18), { from: whale });

      // Defaulter Troves opened
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

      // --- TEST ---

      const nonPayable = await NonPayable.new();
      await kusdToken.transfer(nonPayable.address, dec(250, 18), { from: whale });

      // NonPayable makes deposit #1: 150 KUSD
      const txData1 = th.getTransactionData("provideToSP(uint256)", [
        web3.utils.toHex(dec(150, 18))
      ]);
      const tx1 = await nonPayable.forward(stabilityPoolAsset1.address, txData1);

      const gain_0 = await stabilityPoolAsset1.getDepositorAssetGain(nonPayable.address);
      assert.isTrue(gain_0.eq(toBN(0)), "NonPayable should not have accumulated gains");

      // price drops: defaulters' Troves fall below MCR, nonPayable and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // 2 defaulters are closed
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner });
      await troveManager.liquidate(assetAddress1, defaulter_2, { from: owner });

      const gain_1 = await stabilityPoolAsset1.getDepositorAssetGain(nonPayable.address);
      assert.isTrue(gain_1.gt(toBN(0)), "NonPayable should have some accumulated gains");

      // NonPayable tries to make deposit #2: 100KUSD (which also attempts to withdraw Asset gain)
      const txData2 = th.getTransactionData("provideToSP(uint256)", [
        web3.utils.toHex(dec(100, 18))
      ]);
      await th.assertRevert(nonPayable.forward(stabilityPoolAsset1.address, txData2));
    });

    it("provideToSP(): doesn't impact other users' deposits or Asset gains", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol }
      });

      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(2000, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(3000, 18), { from: carol });

      // D opens a trove
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis }
      });

      // Would-be defaulters open troves
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

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // Defaulters are liquidated
      await troveManager.liquidate(assetAddress1, defaulter_1);
      await troveManager.liquidate(assetAddress1, defaulter_2);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_2));

      const alice_KUSDDeposit_Before = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice)
      ).toString();
      const bob_KUSDDeposit_Before = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)
      ).toString();
      const carol_KUSDDeposit_Before = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(carol)
      ).toString();

      const alice_AssetGain_Before = (
        await stabilityPoolAsset1.getDepositorAssetGain(alice)
      ).toString();
      const bob_AssetGain_Before = (await stabilityPoolAsset1.getDepositorAssetGain(bob)).toString();
      const carol_AssetGain_Before = (
        await stabilityPoolAsset1.getDepositorAssetGain(carol)
      ).toString();

      //check non-zero KUSD and AssetGain in the Stability Pool
      const KUSDinSP = await stabilityPoolAsset1.getTotalKUSDDeposits();
      const AssetinSP = await stabilityPoolAsset1.getAssetBalance();
      assert.isTrue(KUSDinSP.gt(mv._zeroBN));
      assert.isTrue(AssetinSP.gt(mv._zeroBN));

      // D makes an SP deposit
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: dennis });
      assert.equal(
        (await stabilityPoolAsset1.getCompoundedKUSDDeposit(dennis)).toString(),
        dec(1000, 18)
      );

      const alice_KUSDDeposit_After = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice)
      ).toString();
      const bob_KUSDDeposit_After = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)
      ).toString();
      const carol_KUSDDeposit_After = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(carol)
      ).toString();

      const alice_AssetGain_After = (
        await stabilityPoolAsset1.getDepositorAssetGain(alice)
      ).toString();
      const bob_AssetGain_After = (await stabilityPoolAsset1.getDepositorAssetGain(bob)).toString();
      const carol_AssetGain_After = (
        await stabilityPoolAsset1.getDepositorAssetGain(carol)
      ).toString();

      // Check compounded deposits and Asset gains for A, B and C have not changed
      assert.equal(alice_KUSDDeposit_Before, alice_KUSDDeposit_After);
      assert.equal(bob_KUSDDeposit_Before, bob_KUSDDeposit_After);
      assert.equal(carol_KUSDDeposit_Before, carol_KUSDDeposit_After);

      assert.equal(alice_AssetGain_Before, alice_AssetGain_After);
      assert.equal(bob_AssetGain_Before, bob_AssetGain_After);
      assert.equal(carol_AssetGain_Before, carol_AssetGain_After);
    });

    it("provideToSP(): doesn't impact system debt, collateral or TCR", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol }
      });

      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(2000, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(3000, 18), { from: carol });

      // D opens a trove
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis }
      });

      // Would-be defaulters open troves
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

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // Defaulters are liquidated
      await troveManager.liquidate(assetAddress1, defaulter_1);
      await troveManager.liquidate(assetAddress1, defaulter_2);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_2));

      const activeDebt_Before = (await activePool.getKUSDDebt(assetAddress1)).toString();
      const defaultedDebt_Before = (await defaultPool.getKUSDDebt(assetAddress1)).toString();
      const activeColl_Before = (await activePool.getAssetBalance(assetAddress1)).toString();
      const defaultedColl_Before = (await defaultPool.getAssetBalance(assetAddress1)).toString();
      const TCR_Before = (await th.getTCR(contracts, assetAddress1)).toString();

      // D makes an SP deposit
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: dennis });
      assert.equal(
        (await stabilityPoolAsset1.getCompoundedKUSDDeposit(dennis)).toString(),
        dec(1000, 18)
      );

      const activeDebt_After = (await activePool.getKUSDDebt(assetAddress1)).toString();
      const defaultedDebt_After = (await defaultPool.getKUSDDebt(assetAddress1)).toString();
      const activeColl_After = (await activePool.getAssetBalance(assetAddress1)).toString();
      const defaultedColl_After = (await defaultPool.getAssetBalance(assetAddress1)).toString();
      const TCR_After = (await th.getTCR(contracts, assetAddress1)).toString();

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After);
      assert.equal(defaultedDebt_Before, defaultedDebt_After);
      assert.equal(activeColl_Before, activeColl_After);
      assert.equal(defaultedColl_Before, defaultedColl_After);
      assert.equal(TCR_Before, TCR_After);
    });

    it("provideToSP(): doesn't impact any troves, including the caller's trove", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol }
      });

      // A and B provide to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(2000, 18), { from: bob });

      // D opens a trove
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis }
      });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      const price = await priceFeed.getPrice(assetAddress1);

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.debt
      ].toString();
      const alice_Debt_Before = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.debt
      ].toString();
      const bob_Debt_Before = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.debt
      ].toString();
      const carol_Debt_Before = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.debt
      ].toString();
      const dennis_Debt_Before = (await troveManager.Troves(assetAddress1, dennis))[
        TroveData.debt
      ].toString();

      const whale_Coll_Before = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.coll
      ].toString();
      const alice_Coll_Before = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.coll
      ].toString();
      const bob_Coll_Before = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.coll
      ].toString();
      const carol_Coll_Before = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.coll
      ].toString();
      const dennis_Coll_Before = (await troveManager.Troves(assetAddress1, dennis))[
        TroveData.coll
      ].toString();

      const whale_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, whale, price)
      ).toString();
      const alice_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, alice, price)
      ).toString();
      const bob_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, bob, price)
      ).toString();
      const carol_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, carol, price)
      ).toString();
      const dennis_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, dennis, price)
      ).toString();

      // D makes an SP deposit
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: dennis });
      assert.equal(
        (await stabilityPoolAsset1.getCompoundedKUSDDeposit(dennis)).toString(),
        dec(1000, 18)
      );

      const whale_Debt_After = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.debt
      ].toString();
      const alice_Debt_After = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.debt
      ].toString();
      const bob_Debt_After = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.debt
      ].toString();
      const carol_Debt_After = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.debt
      ].toString();
      const dennis_Debt_After = (await troveManager.Troves(assetAddress1, dennis))[
        TroveData.debt
      ].toString();

      const whale_Coll_After = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.coll
      ].toString();
      const alice_Coll_After = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.coll
      ].toString();
      const bob_Coll_After = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.coll
      ].toString();
      const carol_Coll_After = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.coll
      ].toString();
      const dennis_Coll_After = (await troveManager.Troves(assetAddress1, dennis))[
        TroveData.coll
      ].toString();

      const whale_ICR_After = (
        await troveManager.getCurrentICR(assetAddress1, whale, price)
      ).toString();
      const alice_ICR_After = (
        await troveManager.getCurrentICR(assetAddress1, alice, price)
      ).toString();
      const bob_ICR_After = (await troveManager.getCurrentICR(assetAddress1, bob, price)).toString();
      const carol_ICR_After = (
        await troveManager.getCurrentICR(assetAddress1, carol, price)
      ).toString();
      const dennis_ICR_After = (
        await troveManager.getCurrentICR(assetAddress1, dennis, price)
      ).toString();

      assert.equal(whale_Debt_Before, whale_Debt_After);
      assert.equal(alice_Debt_Before, alice_Debt_After);
      assert.equal(bob_Debt_Before, bob_Debt_After);
      assert.equal(carol_Debt_Before, carol_Debt_After);
      assert.equal(dennis_Debt_Before, dennis_Debt_After);

      assert.equal(whale_Coll_Before, whale_Coll_After);
      assert.equal(alice_Coll_Before, alice_Coll_After);
      assert.equal(bob_Coll_Before, bob_Coll_After);
      assert.equal(carol_Coll_Before, carol_Coll_After);
      assert.equal(dennis_Coll_Before, dennis_Coll_After);

      assert.equal(whale_ICR_Before, whale_ICR_After);
      assert.equal(alice_ICR_Before, alice_ICR_After);
      assert.equal(bob_ICR_Before, bob_ICR_After);
      assert.equal(carol_ICR_Before, carol_ICR_After);
      assert.equal(dennis_ICR_Before, dennis_ICR_After);
    });

    it("provideToSP(): doesn't protect the depositor's trove from liquidation", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol }
      });

      // A, B provide 100 KUSD to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: bob });

      // Confirm Bob has an active trove in the system
      assert.isTrue(await sortedTroves.contains(assetAddress1, bob));
      assert.equal((await troveManager.getTroveStatus(assetAddress1, bob)).toString(), "1"); // Confirm Bob's trove status is active

      // Confirm Bob has a Stability deposit
      assert.equal(
        (await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)).toString(),
        dec(1000, 18)
      );

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      const price = await priceFeed.getPrice(assetAddress1);

      // Liquidate bob
      await troveManager.liquidate(assetAddress1, bob);

      // Check Bob's trove has been removed from the system
      assert.isFalse(await sortedTroves.contains(assetAddress1, bob));
      assert.equal((await troveManager.getTroveStatus(assetAddress1, bob)).toString(), "3"); // check Bob's trove status was closed by liquidation
    });

    it("provideToSP(): providing 0 KUSD reverts", async () => {
      // --- SETUP ---
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: carol }
      });

      // A, B, C provides 100, 50, 30 KUSD to SP
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(50, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30, 18), { from: carol });

      const bob_Deposit_Before = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)
      ).toString();
      const KUSDinSP_Before = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();

      assert.equal(KUSDinSP_Before, dec(180, 18));

      // Bob provides 0 KUSD to the Stability Pool
      const txPromise_B = stabilityPoolAsset1.provideToSP(0, { from: bob });
      await th.assertRevert(txPromise_B);
    });

    // --- KUMO functionality ---
    it("provideToSP(), new deposit: when SP > 0, triggers KUMO reward event - increases the sum G", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A provides to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: A });

      let currentEpoch = await stabilityPoolAsset1.currentEpoch();
      let currentScale = await stabilityPoolAsset1.currentScale();
      const G_Before = await stabilityPoolAsset1.epochToScaleToG(currentEpoch, currentScale);

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // B provides to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: B });

      currentEpoch = await stabilityPoolAsset1.currentEpoch();
      currentScale = await stabilityPoolAsset1.currentScale();
      const G_After = await stabilityPoolAsset1.epochToScaleToG(currentEpoch, currentScale);

      // Expect G has increased from the KUMO reward event triggered
      assert.isTrue(G_After.gt(G_Before));
    });

    it("provideToSP(), new deposit: when SP is empty, doesn't update G", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A provides to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: A });

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // A withdraws
      await stabilityPoolAsset1.withdrawFromSP(dec(1000, 18), { from: A });

      // Check SP is empty
      assert.equal(await stabilityPoolAsset1.getTotalKUSDDeposits(), "0");

      // Check G is non-zero
      let currentEpoch = await stabilityPoolAsset1.currentEpoch();
      let currentScale = await stabilityPoolAsset1.currentScale();
      const G_Before = await stabilityPoolAsset1.epochToScaleToG(currentEpoch, currentScale);

      assert.isTrue(G_Before.gt(toBN("0")));

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // B provides to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: B });

      currentEpoch = await stabilityPoolAsset1.currentEpoch();
      currentScale = await stabilityPoolAsset1.currentScale();
      const G_After = await stabilityPoolAsset1.epochToScaleToG(currentEpoch, currentScale);

      // Expect G has not changed
      assert.isTrue(G_After.eq(G_Before));
    });

    it("provideToSP(), new deposit: depositor does not receive any KUMO rewards", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale, value: dec(50, "ether") }
      });

      // A, B, open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });

      // Get A, B, C KUMO balances before and confirm they're zero
      const A_KUMOBalance_Before = await kumoToken.balanceOf(A);
      const B_KUMOBalance_Before = await kumoToken.balanceOf(B);

      assert.equal(A_KUMOBalance_Before, "0");
      assert.equal(B_KUMOBalance_Before, "0");

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // A, B provide to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(2000, 18), { from: B });

      // Get A, B, C KUMO balances after, and confirm they're still zero
      const A_KUMOBalance_After = await kumoToken.balanceOf(A);
      const B_KUMOBalance_After = await kumoToken.balanceOf(B);

      assert.equal(A_KUMOBalance_After, "0");
      assert.equal(B_KUMOBalance_After, "0");
    });

    it("provideToSP(), new deposit after past full withdrawal: depositor does not receive any KUMO rewards", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C, open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(4000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: D }
      });

      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // --- SETUP ---

      const initialDeposit_A = await kusdToken.balanceOf(A);
      const initialDeposit_B = await kusdToken.balanceOf(B);
      // A, B provide to SP
      await stabilityPoolAsset1.provideToSP(initialDeposit_A, { from: A });
      await stabilityPoolAsset1.provideToSP(initialDeposit_B, { from: B });

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // C deposits. A, and B earn KUMO
      await stabilityPoolAsset1.provideToSP(dec(5, 18), { from: C });

      // Price drops, defaulter is liquidated, A, B and C earn Asset
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));

      await troveManager.liquidate(assetAddress1, defaulter_1);

      // price bounces back to 200
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // A and B fully withdraw from the pool
      await stabilityPoolAsset1.withdrawFromSP(initialDeposit_A, { from: A });
      await stabilityPoolAsset1.withdrawFromSP(initialDeposit_B, { from: B });

      // --- TEST ---

      // Get A, B, C KUMO balances before and confirm they're non-zero
      const A_KUMOBalance_Before = await kumoToken.balanceOf(A);
      const B_KUMOBalance_Before = await kumoToken.balanceOf(B);
      assert.isTrue(A_KUMOBalance_Before.gt(toBN("0")));
      assert.isTrue(B_KUMOBalance_Before.gt(toBN("0")));

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // A, B provide to SP
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(200, 18), { from: B });

      // Get A, B, C KUMO balances after, and confirm they have not changed
      const A_KUMOBalance_After = await kumoToken.balanceOf(A);
      const B_KUMOBalance_After = await kumoToken.balanceOf(B);

      assert.isTrue(A_KUMOBalance_After.eq(A_KUMOBalance_Before));
      assert.isTrue(B_KUMOBalance_After.eq(B_KUMOBalance_Before));
    });

    it("provideToSP(), new deposit: depositor does not receive Asset gains", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // Whale transfers KUSD to A, B
      await kusdToken.transfer(A, dec(100, 18), { from: whale });
      await kusdToken.transfer(B, dec(200, 18), { from: whale });

      // C, D open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: D }
      });

      // --- TEST ---

      // get current Asset balances
      const A_AssetBalance_Before = await erc20Asset1.balanceOf(A);
      const B_AssetBalance_Before = await erc20Asset1.balanceOf(B);
      const C_AssetBalance_Before = await erc20Asset1.balanceOf(C);
      const D_AssetBalance_Before = await erc20Asset1.balanceOf(D);

      // A, B, C, D provide to SP
      const A_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(100, 18), {
          from: A,
          gasPrice: GAS_PRICE
        })
      );
      const B_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(200, 18), {
          from: B,
          gasPrice: GAS_PRICE
        })
      );
      const C_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(300, 18), {
          from: C,
          gasPrice: GAS_PRICE
        })
      );
      const D_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(400, 18), {
          from: D,
          gasPrice: GAS_PRICE
        })
      );

      // Asset balances before minus gas used
      const A_expectedBalance = A_AssetBalance_Before - A_GAS_Used;
      const B_expectedBalance = B_AssetBalance_Before - B_GAS_Used;
      const C_expectedBalance = C_AssetBalance_Before - C_GAS_Used;
      const D_expectedBalance = D_AssetBalance_Before - D_GAS_Used;

      // Get  Asset balances after
      const A_AssetBalance_After = await erc20Asset1.balanceOf(A);
      const B_AssetBalance_After = await erc20Asset1.balanceOf(B);
      const C_AssetBalance_After = await erc20Asset1.balanceOf(C);
      const D_AssetBalance_After = await erc20Asset1.balanceOf(D);

      // Check Asset balances have not changed
      assert.equal(A_AssetBalance_After, A_expectedBalance);
      assert.equal(B_AssetBalance_After, B_expectedBalance);
      assert.equal(C_AssetBalance_After, C_expectedBalance);
      assert.equal(D_AssetBalance_After, D_expectedBalance);
    });

    it("provideToSP(), new deposit after past full withdrawal: depositor does not receive Asset gains", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // Whale transfers KUSD to A, B
      await kusdToken.transfer(A, dec(1000, 18), { from: whale });
      await kusdToken.transfer(B, dec(1000, 18), { from: whale });

      // C, D open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(4000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(5000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: D }
      });

      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // --- SETUP ---
      // A, B, C, D provide to SP
      await stabilityPoolAsset1.provideToSP(dec(105, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(105, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(105, 18), { from: C });
      await stabilityPoolAsset1.provideToSP(dec(105, 18), { from: D });

      // time passes
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // B deposits. A,B,C,D earn KUMO
      await stabilityPoolAsset1.provideToSP(dec(5, 18), { from: B });

      // Price drops, defaulter is liquidated, A, B, C, D earn Asset
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));

      await troveManager.liquidate(assetAddress1, defaulter_1);

      // Price bounces back
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // A B,C, D fully withdraw from the pool
      await stabilityPoolAsset1.withdrawFromSP(dec(105, 18), { from: A });
      await stabilityPoolAsset1.withdrawFromSP(dec(105, 18), { from: B });
      await stabilityPoolAsset1.withdrawFromSP(dec(105, 18), { from: C });
      await stabilityPoolAsset1.withdrawFromSP(dec(105, 18), { from: D });

      // --- TEST ---

      // get current Asset balances
      const A_AssetBalance_Before = await erc20Asset1.balanceOf(A);
      const B_AssetBalance_Before = await erc20Asset1.balanceOf(B);
      const C_AssetBalance_Before = await erc20Asset1.balanceOf(C);
      const D_AssetBalance_Before = await erc20Asset1.balanceOf(D);

      // A, B, C, D provide to SP
      const A_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(100, 18), {
          from: A,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE
        })
      );
      const B_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(200, 18), {
          from: B,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE
        })
      );
      const C_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(300, 18), {
          from: C,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE
        })
      );
      const D_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(400, 18), {
          from: D,
          gasPrice: GAS_PRICE,
          gasPrice: GAS_PRICE
        })
      );

      // Asset balances before minus gas used
      const A_expectedBalance = A_AssetBalance_Before - A_GAS_Used;
      const B_expectedBalance = B_AssetBalance_Before - B_GAS_Used;
      const C_expectedBalance = C_AssetBalance_Before - C_GAS_Used;
      const D_expectedBalance = D_AssetBalance_Before - D_GAS_Used;

      // Get  Asset balances after
      const A_AssetBalance_After = await erc20Asset1.balanceOf(A);
      const B_AssetBalance_After = await erc20Asset1.balanceOf(B);
      const C_AssetBalance_After = await erc20Asset1.balanceOf(C);
      const D_AssetBalance_After = await erc20Asset1.balanceOf(D);

      // Check Asset balances have not changed
      assert.equal(A_AssetBalance_After, A_expectedBalance);
      assert.equal(B_AssetBalance_After, B_expectedBalance);
      assert.equal(C_AssetBalance_After, C_expectedBalance);
      assert.equal(D_AssetBalance_After, D_expectedBalance);
    });

    it("provideToSP(), topup: triggers KUMO reward event - increases the sum G", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A, B, C provide to SP
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(50, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(50, 18), { from: C });

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      const G_Before = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // B tops up
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: B });

      const G_After = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      // Expect G has increased from the KUMO reward event triggered by B's topup
      assert.isTrue(G_After.gt(G_Before));
    });

    it("provideToSP(), topup: depositor receives KUMO rewards", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(200, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(300, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A, B, C, provide to SP
      await stabilityPoolAsset1.provideToSP(dec(10, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(20, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(30, 18), { from: C });

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // Get A, B, C KUMO balance before
      const A_KUMOBalance_Before = await kumoToken.balanceOf(A);
      const B_KUMOBalance_Before = await kumoToken.balanceOf(B);
      const C_KUMOBalance_Before = await kumoToken.balanceOf(C);

      // A, B, C top up
      await stabilityPoolAsset1.provideToSP(dec(10, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(20, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(30, 18), { from: C });

      // Get KUMO balance after
      const A_KUMOBalance_After = await kumoToken.balanceOf(A);
      const B_KUMOBalance_After = await kumoToken.balanceOf(B);
      const C_KUMOBalance_After = await kumoToken.balanceOf(C);

      // Check KUMO Balance of A, B, C has increased
      assert.isTrue(A_KUMOBalance_After.gt(A_KUMOBalance_Before));
      assert.isTrue(B_KUMOBalance_After.gt(B_KUMOBalance_Before));
      assert.isTrue(C_KUMOBalance_After.gt(C_KUMOBalance_Before));
    });

    it("provideToSP(): reverts when amount is zero", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(2000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });

      // Whale transfers KUSD to C, D
      await kusdToken.transfer(C, dec(100, 18), { from: whale });
      await kusdToken.transfer(D, dec(100, 18), { from: whale });

      txPromise_A = stabilityPoolAsset1.provideToSP(0, { from: A });
      txPromise_B = stabilityPoolAsset1.provideToSP(0, { from: B });
      txPromise_C = stabilityPoolAsset1.provideToSP(0, { from: C });
      txPromise_D = stabilityPoolAsset1.provideToSP(0, { from: D });

      await th.assertRevert(txPromise_A, "StabilityPool: Amount must be non-zero");
      await th.assertRevert(txPromise_B, "StabilityPool: Amount must be non-zero");
      await th.assertRevert(txPromise_C, "StabilityPool: Amount must be non-zero");
      await th.assertRevert(txPromise_D, "StabilityPool: Amount must be non-zero");
    });

    // --- withdrawFromSP ---

    it("withdrawFromSP(): reverts when user has no active deposit", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });

      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: alice });

      const alice_initialDeposit = (await stabilityPoolAsset1.deposits(alice)).toString();
      const bob_initialDeposit = (await stabilityPoolAsset1.deposits(bob)).toString();

      assert.equal(alice_initialDeposit, dec(100, 18));
      assert.equal(bob_initialDeposit, "0");

      const txAlice = await stabilityPoolAsset1.withdrawFromSP(dec(100, 18), { from: alice });
      assert.isTrue(txAlice.receipt.status);

      try {
        const txBob = await stabilityPoolAsset1.withdrawFromSP(dec(100, 18), { from: bob });
        assert.isFalse(txBob.receipt.status);
      } catch (err) {
        assert.include(err.message, "revert");
        // TODO: infamous issue #99
        //assert.include(err.message, "User must have a non-zero deposit")
      }
    });

    it("withdrawFromSP(): reverts when amount > 0 and system has an undercollateralized trove", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: alice });

      const alice_initialDeposit = (await stabilityPoolAsset1.deposits(alice)).toString();
      assert.equal(alice_initialDeposit, dec(100, 18));

      // defaulter opens trove
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // Asset drops, defaulter is in liquidation range (but not liquidated yet)
      await priceFeed.setPrice(assetAddress1, dec(100, 18));

      await th.assertRevert(stabilityPoolAsset1.withdrawFromSP(dec(100, 18), { from: alice }));
    });

    it("withdrawFromSP(): partial retrieval - retrieves correct KUSD amount and the entire Asset gain, and updates deposit", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

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
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // 2 users with Trove with 170 KUSD drawn are closed
      const liquidationTX_1 = await troveManager.liquidate(assetAddress1, defaulter_1, {
        from: owner
      }); // 170 KUSD closed
      const liquidationTX_2 = await troveManager.liquidate(assetAddress1, defaulter_2, {
        from: owner
      }); // 170 KUSD closed

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1);
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2);

      // Alice kusdLoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedkusdLoss_A = liquidatedDebt_1
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)))
        .add(liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))));

      const expectedCompoundedKUSDDeposit_A = toBN(dec(15000, 18)).sub(expectedkusdLoss_A);
      const compoundedKUSDDeposit_A = await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice);

      assert.isAtMost(
        th.getDifference(expectedCompoundedKUSDDeposit_A, compoundedKUSDDeposit_A),
        100000
      );

      // Alice retrieves part of her entitled KUSD: 9000 KUSD
      await stabilityPoolAsset1.withdrawFromSP(dec(9000, 18), { from: alice });

      const expectedNewDeposit_A = compoundedKUSDDeposit_A.sub(toBN(dec(9000, 18)));

      // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
      const newDeposit = (await stabilityPoolAsset1.deposits(alice)).toString();
      assert.isAtMost(th.getDifference(newDeposit, expectedNewDeposit_A), 100000);

      // Expect Alice has withdrawn all Asset gain
      const alice_pendingAssetGain = await stabilityPoolAsset1.getDepositorAssetGain(alice);
      assert.equal(alice_pendingAssetGain, 0);
    });

    it("withdrawFromSP(): partial retrieval - leaves the correct amount of KUSD in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

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
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      const SP_KUSD_Before = await stabilityPoolAsset1.getTotalKUSDDeposits();
      assert.equal(SP_KUSD_Before, dec(200000, 18));

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // 2 users liquidated
      const liquidationTX_1 = await troveManager.liquidate(assetAddress1, defaulter_1, {
        from: owner
      });
      const liquidationTX_2 = await troveManager.liquidate(assetAddress1, defaulter_2, {
        from: owner
      });

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1);
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2);

      // Alice retrieves part of her entitled KUSD: 9000 KUSD
      await stabilityPoolAsset1.withdrawFromSP(dec(9000, 18), { from: alice });

      /* Check SP has reduced from 2 liquidations and Alice's withdrawal
      Expect KUSD in SP = (200000 - liquidatedDebt_1 - liquidatedDebt_2 - 9000) */
      const expectedSPKUSD = toBN(dec(200000, 18))
        .sub(toBN(liquidatedDebt_1))
        .sub(toBN(liquidatedDebt_2))
        .sub(toBN(dec(9000, 18)));

      const SP_KUSD_After = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();

      th.assertIsApproximatelyEqual(SP_KUSD_After, expectedSPKUSD);
    });

    it("withdrawFromSP(): full retrieval - leaves the correct amount of KUSD in the Stability Pool", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

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

      // Alice makes deposit #1
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      const SP_KUSD_Before = await stabilityPoolAsset1.getTotalKUSDDeposits();
      assert.equal(SP_KUSD_Before, dec(200000, 18));

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // 2 defaulters liquidated
      const liquidationTX_1 = await troveManager.liquidate(assetAddress1, defaulter_1, {
        from: owner
      });
      const liquidationTX_2 = await troveManager.liquidate(assetAddress1, defaulter_2, {
        from: owner
      });

      const [liquidatedDebt_1] = await th.getEmittedLiquidationValues(liquidationTX_1);
      const [liquidatedDebt_2] = await th.getEmittedLiquidationValues(liquidationTX_2);

      // Alice kusdLoss is ((15000/200000) * liquidatedDebt), for each liquidation
      const expectedkusdLoss_A = liquidatedDebt_1
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)))
        .add(liquidatedDebt_2.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18))));

      const expectedCompoundedKUSDDeposit_A = toBN(dec(15000, 18)).sub(expectedkusdLoss_A);
      const compoundedKUSDDeposit_A = await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice);

      assert.isAtMost(
        th.getDifference(expectedCompoundedKUSDDeposit_A, compoundedKUSDDeposit_A),
        100000
      );

      const KUSDinSPBefore = await stabilityPoolAsset1.getTotalKUSDDeposits();

      // Alice retrieves all of her entitled KUSD:
      await stabilityPoolAsset1.withdrawFromSP(dec(15000, 18), { from: alice });

      const expectedKUSDinSPAfter = KUSDinSPBefore.sub(compoundedKUSDDeposit_A);

      const KUSDinSPAfter = await stabilityPoolAsset1.getTotalKUSDDeposits();
      assert.isAtMost(th.getDifference(expectedKUSDinSPAfter, KUSDinSPAfter), 100000);
    });

    it("withdrawFromSP(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero Asset", async () => {
      // --- SETUP ---
      // Whale deposits 1850 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(18500, 18), { from: whale });

      // 2 defaulters open
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
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // defaulters liquidated
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner });
      await troveManager.liquidate(assetAddress1, defaulter_2, { from: owner });

      // Alice retrieves all of her entitled KUSD:
      await stabilityPoolAsset1.withdrawFromSP(dec(15000, 18), { from: alice });
      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(alice), 0);

      // Alice makes second deposit
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(alice), 0);

      const AssetinSP_Before = (await stabilityPoolAsset1.getAssetBalance()).toString();

      // Alice attempts second withdrawal
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: alice });
      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(alice), 0);

      // Check Asset in pool does not change
      const AssetinSP_1 = (await stabilityPoolAsset1.getAssetBalance()).toString();
      assert.equal(AssetinSP_Before, AssetinSP_1);

      // Third deposit
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(alice), 0);

      // Alice attempts third withdrawal (this time, frm SP to Trove)
      const txPromise_A = stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, {
        from: alice
      });
      await th.assertRevert(txPromise_A);
    });

    it("withdrawFromSP(): it correctly updates the user's KUSD and Asset snapshots of entitled reward per unit staked", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

      // 2 defaulters open
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
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      // check 'Before' snapshots
      const alice_snapshot_Before = await stabilityPoolAsset1.depositSnapshots(alice);
      const alice_snapshot_S_Before = alice_snapshot_Before[0].toString();
      const alice_snapshot_P_Before = alice_snapshot_Before[1].toString();
      assert.equal(alice_snapshot_S_Before, 0);
      assert.equal(alice_snapshot_P_Before, "1000000000000000000");

      // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // 2 defaulters liquidated
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner });
      await troveManager.liquidate(assetAddress1, defaulter_2, { from: owner });

      // Alice retrieves part of her entitled KUSD: 9000 KUSD
      await stabilityPoolAsset1.withdrawFromSP(dec(9000, 18), { from: alice });

      const P = (await stabilityPoolAsset1.P()).toString();
      const S = (await stabilityPoolAsset1.epochToScaleToSum(0, 0)).toString();
      // check 'After' snapshots
      const alice_snapshot_After = await stabilityPoolAsset1.depositSnapshots(alice);
      const alice_snapshot_S_After = alice_snapshot_After[0].toString();
      const alice_snapshot_P_After = alice_snapshot_After[1].toString();
      assert.equal(alice_snapshot_S_After, S);
      assert.equal(alice_snapshot_P_After, P);
    });

    it("withdrawFromSP(): decreases StabilityPool Asset", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

      // 1 defaulter opens
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
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      // price drops: defaulter's Trove falls below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, "100000000000000000000");

      // defaulter's Trove is closed.
      const liquidationTx_1 = await troveManager.liquidate(assetAddress1, defaulter_1, {
        from: owner
      }); // 180 KUSD closed
      const [, liquidatedColl] = th.getEmittedLiquidationValues(liquidationTx_1);

      //Get ActivePool and StabilityPool Ether before retrieval:
      const active_Asset_Before = await activePool.getAssetBalance(assetAddress1);
      const stability_Asset_Before = await stabilityPoolAsset1.getAssetBalance();

      // Expect alice to be entitled to 15000/200000 of the liquidated coll
      const aliceExpectedAssetGain = liquidatedColl
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)));
      const aliceAssetGain = await stabilityPoolAsset1.getDepositorAssetGain(alice);
      assert.isTrue(aliceExpectedAssetGain.eq(aliceAssetGain));

      // Alice retrieves all of her deposit
      await stabilityPoolAsset1.withdrawFromSP(dec(15000, 18), { from: alice });

      const active_Asset_After = await activePool.getAssetBalance(assetAddress1);
      const stability_Asset_After = await stabilityPoolAsset1.getAssetBalance();

      const active_Asset_Difference = active_Asset_Before.sub(active_Asset_After);
      const stability_Asset_Difference = stability_Asset_Before.sub(stability_Asset_After);

      assert.equal(active_Asset_Difference, "0");

      // Expect StabilityPool to have decreased by Alice's AssetGain
      assert.isAtMost(th.getDifference(stability_Asset_Difference, aliceAssetGain), 10000);
    });

    it("withdrawFromSP(): All depositors are able to withdraw from the SP to their account", async () => {
      // Whale opens trove
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // 1 defaulter open
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn];
      for (account of depositors) {
        await openTrove({
          asset: assetAddress1,
          extraKUSDAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: { from: account }
        });
        await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: account });
      }

      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      await troveManager.liquidate(assetAddress1, defaulter_1);

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // All depositors attempt to withdraw
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: alice });
      assert.equal((await stabilityPoolAsset1.deposits(alice)).toString(), "0");
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: bob });
      assert.equal((await stabilityPoolAsset1.deposits(alice)).toString(), "0");
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: carol });
      assert.equal((await stabilityPoolAsset1.deposits(alice)).toString(), "0");
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: dennis });
      assert.equal((await stabilityPoolAsset1.deposits(alice)).toString(), "0");
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: erin });
      assert.equal((await stabilityPoolAsset1.deposits(alice)).toString(), "0");
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: flyn });
      assert.equal((await stabilityPoolAsset1.deposits(alice)).toString(), "0");

      const totalDeposits = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();

      assert.isAtMost(th.getDifference(totalDeposits, "0"), 100000);
    });

    it("withdrawFromSP(): increases depositor's KUSD token balance by the expected amount", async () => {
      // Whale opens trove
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // 1 defaulter opens trove
      await borrowerOperations.openTrove(
        assetAddress1,
        dec(100, "ether"),
        th._100pct,
        await getOpenTroveKUSDAmount(dec(10000, 18), assetAddress1),
        defaulter_1,
        defaulter_1,
        { from: defaulter_1 }
      );

      const defaulterDebt = (await troveManager.getEntireDebtAndColl(assetAddress1, defaulter_1))[0];

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn];
      for (account of depositors) {
        await openTrove({
          asset: assetAddress1,
          extraKUSDAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: { from: account }
        });
        await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: account });
      }

      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      await troveManager.liquidate(assetAddress1, defaulter_1);

      const aliceBalBefore = await kusdToken.balanceOf(alice);
      const bobBalBefore = await kusdToken.balanceOf(bob);

      /* From an offset of 10000 KUSD, each depositor receives
      kusdLoss = 1666.6666666666666666 KUSD

      and thus with a deposit of 10000 KUSD, each should withdraw 8333.3333333333333333 KUSD (in practice, slightly less due to rounding error)
      */

      // Price bounces back to $200 per Asset
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Bob issues a further 5000 KUSD from his trove
      await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(5000, 18), bob, bob, {
        from: bob
      });

      // Expect Alice's KUSD balance increase be very close to 8333.3333333333333333 KUSD
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: alice });
      const aliceBalance = await kusdToken.balanceOf(alice);

      assert.isAtMost(
        th.getDifference(aliceBalance.sub(aliceBalBefore), "8333333333333333333333"),
        100000
      );

      // expect Bob's KUSD balance increase to be very close to  13333.33333333333333333 KUSD
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: bob });
      const bobBalance = await kusdToken.balanceOf(bob);
      assert.isAtMost(
        th.getDifference(bobBalance.sub(bobBalBefore), "13333333333333333333333"),
        100000
      );
    });

    it("withdrawFromSP(): doesn't impact other users Stability deposits or Asset gains", async () => {
      await openTrove({
        asset: assetAddress1,
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

      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(20000, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30000, 18), { from: carol });

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
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_2));

      const alice_KUSDDeposit_Before = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice)
      ).toString();
      const bob_KUSDDeposit_Before = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)
      ).toString();

      const alice_AssetGain_Before = (
        await stabilityPoolAsset1.getDepositorAssetGain(alice)
      ).toString();
      const bob_AssetGain_Before = (await stabilityPoolAsset1.getDepositorAssetGain(bob)).toString();

      //check non-zero KUSD and AssetGain in the Stability Pool
      const KUSDinSP = await stabilityPoolAsset1.getTotalKUSDDeposits();
      const AssetinSP = await stabilityPoolAsset1.getAssetBalance();
      assert.isTrue(KUSDinSP.gt(mv._zeroBN));
      assert.isTrue(AssetinSP.gt(mv._zeroBN));

      // Price rises
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Carol withdraws her Stability deposit
      assert.equal((await stabilityPoolAsset1.deposits(carol)).toString(), dec(30000, 18));
      await stabilityPoolAsset1.withdrawFromSP(dec(30000, 18), { from: carol });
      assert.equal((await stabilityPoolAsset1.deposits(carol)).toString(), "0");

      const alice_KUSDDeposit_After = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice)
      ).toString();
      const bob_KUSDDeposit_After = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)
      ).toString();

      const alice_AssetGain_After = (
        await stabilityPoolAsset1.getDepositorAssetGain(alice)
      ).toString();
      const bob_AssetGain_After = (await stabilityPoolAsset1.getDepositorAssetGain(bob)).toString();

      // Check compounded deposits and Asset gains for A and B have not changed
      assert.equal(alice_KUSDDeposit_Before, alice_KUSDDeposit_After);
      assert.equal(bob_KUSDDeposit_Before, bob_KUSDDeposit_After);

      assert.equal(alice_AssetGain_Before, alice_AssetGain_After);
      assert.equal(bob_AssetGain_Before, bob_AssetGain_After);
    });

    it("withdrawFromSP(): doesn't impact system debt, collateral or TCR ", async () => {
      await openTrove({
        asset: assetAddress1,
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

      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(20000, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30000, 18), { from: carol });

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
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_2));

      // Price rises
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      const activeDebt_Before = (await activePool.getKUSDDebt(assetAddress1)).toString();
      const defaultedDebt_Before = (await defaultPool.getKUSDDebt(assetAddress1)).toString();
      const activeColl_Before = (await activePool.getAssetBalance(assetAddress1)).toString();
      const defaultedColl_Before = (await defaultPool.getAssetBalance(assetAddress1)).toString();
      const TCR_Before = (await th.getTCR(contracts, assetAddress1)).toString();

      // Carol withdraws her Stability deposit
      assert.equal((await stabilityPoolAsset1.deposits(carol)).toString(), dec(30000, 18));
      await stabilityPoolAsset1.withdrawFromSP(dec(30000, 18), { from: carol });
      assert.equal((await stabilityPoolAsset1.deposits(carol)).toString(), "0");

      const activeDebt_After = (await activePool.getKUSDDebt(assetAddress1)).toString();
      const defaultedDebt_After = (await defaultPool.getKUSDDebt(assetAddress1)).toString();
      const activeColl_After = (await activePool.getAssetBalance(assetAddress1)).toString();
      const defaultedColl_After = (await defaultPool.getAssetBalance(assetAddress1)).toString();
      const TCR_After = (await th.getTCR(contracts, assetAddress1)).toString();

      // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
      assert.equal(activeDebt_Before, activeDebt_After);
      assert.equal(defaultedDebt_Before, defaultedDebt_After);
      assert.equal(activeColl_Before, activeColl_After);
      assert.equal(defaultedColl_Before, defaultedColl_After);
      assert.equal(TCR_Before, TCR_After);
    });

    it("withdrawFromSP(): doesn't impact any troves, including the caller's trove", async () => {
      await openTrove({
        asset: assetAddress1,
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

      // A, B and C provide to SP
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(20000, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30000, 18), { from: carol });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      const price = await priceFeed.getPrice(assetAddress1);

      // Get debt, collateral and ICR of all existing troves
      const whale_Debt_Before = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.debt
      ].toString();
      const alice_Debt_Before = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.debt
      ].toString();
      const bob_Debt_Before = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.debt
      ].toString();
      const carol_Debt_Before = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.debt
      ].toString();

      const whale_Coll_Before = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.coll
      ].toString();
      const alice_Coll_Before = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.coll
      ].toString();
      const bob_Coll_Before = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.coll
      ].toString();
      const carol_Coll_Before = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.coll
      ].toString();

      const whale_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, whale, price)
      ).toString();
      const alice_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, alice, price)
      ).toString();
      const bob_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, bob, price)
      ).toString();
      const carol_ICR_Before = (
        await troveManager.getCurrentICR(assetAddress1, carol, price)
      ).toString();

      // price rises
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Carol withdraws her Stability deposit
      assert.equal((await stabilityPoolAsset1.deposits(carol)).toString(), dec(30000, 18));
      await stabilityPoolAsset1.withdrawFromSP(dec(30000, 18), { from: carol });
      assert.equal((await stabilityPoolAsset1.deposits(carol)).toString(), "0");

      const whale_Debt_After = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.debt
      ].toString();
      const alice_Debt_After = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.debt
      ].toString();
      const bob_Debt_After = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.debt
      ].toString();
      const carol_Debt_After = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.debt
      ].toString();

      const whale_Coll_After = (await troveManager.Troves(assetAddress1, whale))[
        TroveData.coll
      ].toString();
      const alice_Coll_After = (await troveManager.Troves(assetAddress1, alice))[
        TroveData.coll
      ].toString();
      const bob_Coll_After = (await troveManager.Troves(assetAddress1, bob))[
        TroveData.coll
      ].toString();
      const carol_Coll_After = (await troveManager.Troves(assetAddress1, carol))[
        TroveData.coll
      ].toString();

      const whale_ICR_After = (
        await troveManager.getCurrentICR(assetAddress1, whale, price)
      ).toString();
      const alice_ICR_After = (
        await troveManager.getCurrentICR(assetAddress1, alice, price)
      ).toString();
      const bob_ICR_After = (await troveManager.getCurrentICR(assetAddress1, bob, price)).toString();
      const carol_ICR_After = (
        await troveManager.getCurrentICR(assetAddress1, carol, price)
      ).toString();

      // Check all troves are unaffected by Carol's Stability deposit withdrawal
      assert.equal(whale_Debt_Before, whale_Debt_After);
      assert.equal(alice_Debt_Before, alice_Debt_After);
      assert.equal(bob_Debt_Before, bob_Debt_After);
      assert.equal(carol_Debt_Before, carol_Debt_After);

      assert.equal(whale_Coll_Before, whale_Coll_After);
      assert.equal(alice_Coll_Before, alice_Coll_After);
      assert.equal(bob_Coll_Before, bob_Coll_After);
      assert.equal(carol_Coll_Before, carol_Coll_After);

      assert.equal(whale_ICR_Before, whale_ICR_After);
      assert.equal(alice_ICR_Before, alice_ICR_After);
      assert.equal(bob_ICR_Before, bob_ICR_After);
      assert.equal(carol_ICR_Before, carol_ICR_After);
    });

    it("withdrawFromSP(): succeeds when amount is 0 and system has an undercollateralized trove", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });

      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: A });

      const A_initialDeposit = (await stabilityPoolAsset1.deposits(A)).toString();
      assert.equal(A_initialDeposit, dec(100, 18));

      // defaulters opens trove
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

      // Asset drops, defaulters are in liquidation range
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      const price = await priceFeed.getPrice(assetAddress1);
      assert.isTrue(await th.ICRbetween100and110(assetAddress1, defaulter_1, troveManager, price));

      await th.fastForwardTime(timeValues.MINUTES_IN_ONE_WEEK, web3.currentProvider);

      // Liquidate d1
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      // Check d2 is undercollateralized
      assert.isTrue(await th.ICRbetween100and110(assetAddress1, defaulter_2, troveManager, price));
      assert.isTrue(await sortedTroves.contains(assetAddress1, defaulter_2));

      const A_AssetBalBefore = toBN(await erc20Asset1.balanceOf(A));
      const A_KUMOBalBefore = await kumoToken.balanceOf(A);

      // Check Alice has gains to withdraw
      const A_pendingAssetGain = await stabilityPoolAsset1.getDepositorAssetGain(A);
      const A_pendingKUMOGain = await stabilityPoolAsset1.getDepositorKUMOGain(A);
      assert.isTrue(A_pendingAssetGain.gt(toBN("0")));
      assert.isTrue(A_pendingKUMOGain.gt(toBN("0")));

      // Check withdrawal of 0 succeeds
      const tx = await stabilityPoolAsset1.withdrawFromSP(0, { from: A, gasPrice: GAS_PRICE });
      assert.isTrue(tx.receipt.status);

      const A_expectedBalance = A_AssetBalBefore.sub(toBN(th.gasUsed(tx) * GAS_PRICE));

      const A_AssetBalAfter = toBN(await erc20Asset1.balanceOf(A));

      const A_KUMOBalAfter = await kumoToken.balanceOf(A);
      const A_KUMOBalDiff = A_KUMOBalAfter.sub(A_KUMOBalBefore);

      // Check A's Asset and KUMO balances have increased correctly
      assert.isTrue(A_AssetBalAfter.sub(A_AssetBalBefore).eq(A_pendingAssetGain));
      assert.isAtMost(th.getDifference(A_KUMOBalDiff, A_pendingKUMOGain), 1000);
    });

    it("withdrawFromSP(): withdrawing 0 KUSD doesn't alter the caller's deposit or the total KUSD in the Stability Pool", async () => {
      // --- SETUP ---
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
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

      // A, B, C provides 100, 50, 30 KUSD to SP
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(50, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30, 18), { from: carol });

      const bob_Deposit_Before = (
        await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)
      ).toString();
      const KUSDinSP_Before = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();

      assert.equal(KUSDinSP_Before, dec(180, 18));

      // Bob withdraws 0 KUSD from the Stability Pool
      await stabilityPoolAsset1.withdrawFromSP(0, { from: bob });

      // check Bob's deposit and total KUSD in Stability Pool has not changed
      const bob_Deposit_After = (await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)).toString();
      const KUSDinSP_After = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();

      assert.equal(bob_Deposit_Before, bob_Deposit_After);
      assert.equal(KUSDinSP_Before, KUSDinSP_After);
    });

    it("withdrawFromSP(): withdrawing 0 Asset gain does not alter the caller's Asset balance, their trove collateral, or the Asset  in the Stability Pool", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
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

      // Would-be defaulter open trove
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));

      // Defaulter 1 liquidated, full offset
      await troveManager.liquidate(assetAddress1, defaulter_1);

      // Dennis opens trove and deposits to Stability Pool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis }
      });
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: dennis });

      // Check Dennis has 0 AssetGain
      const dennis_AssetGain = (await stabilityPoolAsset1.getDepositorAssetGain(dennis)).toString();
      assert.equal(dennis_AssetGain, "0");

      const dennis_AssetBalance_Before = erc20Asset1.balanceOf(dennis).toString();
      const dennis_Collateral_Before = (await troveManager.Troves(assetAddress1, dennis))[
        TroveData.coll
      ].toString();
      const AssetinSP_Before = (await stabilityPoolAsset1.getAssetBalance()).toString();

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Dennis withdraws his full deposit and AssetGain to his account
      await stabilityPoolAsset1.withdrawFromSP(dec(100, 18), { from: dennis, gasPrice: GAS_PRICE });

      // Check withdrawal does not alter Dennis' Asset balance or his trove's collateral
      const dennis_AssetBalance_After = erc20Asset1.balanceOf(dennis).toString();
      const dennis_Collateral_After = (await troveManager.Troves(assetAddress1, dennis))[
        TroveData.coll
      ].toString();
      const AssetinSP_After = (await stabilityPoolAsset1.getAssetBalance()).toString();

      assert.equal(dennis_AssetBalance_Before, dennis_AssetBalance_After);
      assert.equal(dennis_Collateral_Before, dennis_Collateral_After);

      // Check withdrawal has not altered the Asset in the Stability Pool
      assert.equal(AssetinSP_Before, AssetinSP_After);
    });

    it("withdrawFromSP(): Request to withdraw > caller's deposit only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
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
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // A, B, C provide KUSD to SP
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(20000, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30000, 18), { from: carol });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // Liquidate defaulter 1
      await troveManager.liquidate(assetAddress1, defaulter_1);

      const alice_KUSD_Balance_Before = await kusdToken.balanceOf(alice);
      const bob_KUSD_Balance_Before = await kusdToken.balanceOf(bob);

      const alice_Deposit_Before = await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice);
      const bob_Deposit_Before = await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob);

      const KUSDinSP_Before = await stabilityPoolAsset1.getTotalKUSDDeposits();

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Bob attempts to withdraws 1 wei more than his compounded deposit from the Stability Pool
      await stabilityPoolAsset1.withdrawFromSP(bob_Deposit_Before.add(toBN(1)), { from: bob });

      // Check Bob's KUSD balance has risen by only the value of his compounded deposit
      const bob_expectedKUSDBalance = bob_KUSD_Balance_Before.add(bob_Deposit_Before).toString();
      const bob_KUSD_Balance_After = (await kusdToken.balanceOf(bob)).toString();
      assert.equal(bob_KUSD_Balance_After, bob_expectedKUSDBalance);

      // Alice attempts to withdraws 2309842309.000000000000000000 KUSD from the Stability Pool
      await stabilityPoolAsset1.withdrawFromSP("2309842309000000000000000000", { from: alice });

      // Check Alice's KUSD balance has risen by only the value of her compounded deposit
      const alice_expectedKUSDBalance = alice_KUSD_Balance_Before
        .add(alice_Deposit_Before)
        .toString();
      const alice_KUSD_Balance_After = (await kusdToken.balanceOf(alice)).toString();
      assert.equal(alice_KUSD_Balance_After, alice_expectedKUSDBalance);

      // Check KUSD in Stability Pool has been reduced by only Alice's compounded deposit and Bob's compounded deposit
      const expectedKUSDinSP = KUSDinSP_Before.sub(alice_Deposit_Before)
        .sub(bob_Deposit_Before)
        .toString();
      const KUSDinSP_After = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();
      assert.equal(KUSDinSP_After, expectedKUSDinSP);
    });

    it("withdrawFromSP(): Request to withdraw 2^256-1 KUSD only withdraws the caller's compounded deposit", async () => {
      // --- SETUP ---
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
      // A, B, C open troves
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
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // A, B, C provides 100, 50, 30 KUSD to SP
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(50, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(30, 18), { from: carol });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(100, 18));

      // Liquidate defaulter 1
      await troveManager.liquidate(assetAddress1, defaulter_1);

      const bob_KUSD_Balance_Before = await kusdToken.balanceOf(bob);

      const bob_Deposit_Before = await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob);

      const KUSDinSP_Before = await stabilityPoolAsset1.getTotalKUSDDeposits();

      const maxBytes32 = web3.utils.toBN(
        "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
      );

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Bob attempts to withdraws maxBytes32 KUSD from the Stability Pool
      await stabilityPoolAsset1.withdrawFromSP(maxBytes32, { from: bob });

      // Check Bob's KUSD balance has risen by only the value of his compounded deposit
      const bob_expectedKUSDBalance = bob_KUSD_Balance_Before.add(bob_Deposit_Before).toString();
      const bob_KUSD_Balance_After = (await kusdToken.balanceOf(bob)).toString();
      assert.equal(bob_KUSD_Balance_After, bob_expectedKUSDBalance);

      // Check KUSD in Stability Pool has been reduced by only  Bob's compounded deposit
      const expectedKUSDinSP = KUSDinSP_Before.sub(bob_Deposit_Before).toString();
      const KUSDinSP_After = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();
      assert.equal(KUSDinSP_After, expectedKUSDinSP);
    });

    it("withdrawFromSP(): caller can withdraw full deposit and Asset gain during Recovery Mode", async () => {
      // --- SETUP ---

      // Price doubles
      await priceFeed.setPrice(assetAddress1, dec(400, 18));
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale }
      });
      // Price halves
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // A, B, C open troves and make Stability Pool deposits
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(4, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(4, 18)),
        extraParams: { from: bob }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(4, 18)),
        extraParams: { from: carol }
      });

      await borrowerOperations.openTrove(
        assetAddress1,
        dec(100, "ether"),
        th._100pct,
        await getOpenTroveKUSDAmount(dec(10000, 18), assetAddress1),
        defaulter_1,
        defaulter_1,
        { from: defaulter_1 }
      );

      // A, B, C provides 10000, 5000, 3000 KUSD to SP
      const A_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(10000, 18), {
          from: alice,
          gasPrice: GAS_PRICE
        })
      );
      const B_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(5000, 18), {
          from: bob,
          gasPrice: GAS_PRICE
        })
      );
      const C_GAS_Used = th.gasUsed(
        await stabilityPoolAsset1.provideToSP(dec(3000, 18), {
          from: carol,
          gasPrice: GAS_PRICE
        })
      );

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      const price = await priceFeed.getPrice(assetAddress1);

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));

      // Liquidate defaulter 1
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      const alice_KUSD_Balance_Before = await kusdToken.balanceOf(alice);
      const bob_KUSD_Balance_Before = await kusdToken.balanceOf(bob);
      const carol_KUSD_Balance_Before = await kusdToken.balanceOf(carol);

      const alice_Asset_Balance_Before = web3.utils.toBN(await erc20Asset1.balanceOf(alice));

      const bob_Asset_Balance_Before = web3.utils.toBN(await erc20Asset1.balanceOf(bob));
      const carol_Asset_Balance_Before = web3.utils.toBN(await erc20Asset1.balanceOf(carol));

      const alice_Deposit_Before = await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice);
      const bob_Deposit_Before = await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob);
      const carol_Deposit_Before = await stabilityPoolAsset1.getCompoundedKUSDDeposit(carol);

      const alice_AssetGain_Before = await stabilityPoolAsset1.getDepositorAssetGain(alice);
      const bob_AssetGain_Before = await stabilityPoolAsset1.getDepositorAssetGain(bob);
      const carol_AssetGain_Before = await stabilityPoolAsset1.getDepositorAssetGain(carol);

      const KUSDinSP_Before = await stabilityPoolAsset1.getTotalKUSDDeposits();

      // Price rises
      await priceFeed.setPrice(assetAddress1, dec(220, 18));

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));

      // A, B, C withdraw their full deposits from the Stability Pool
      const A_GAS_Deposit = th.gasUsed(
        await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), {
          from: alice,
          gasPrice: GAS_PRICE
        })
      );
      const B_GAS_Deposit = th.gasUsed(
        await stabilityPoolAsset1.withdrawFromSP(dec(5000, 18), { from: bob, gasPrice: GAS_PRICE })
      );
      const C_GAS_Deposit = th.gasUsed(
        await stabilityPoolAsset1.withdrawFromSP(dec(3000, 18), { from: carol, gasPrice: GAS_PRICE })
      );

      // Check KUSD balances of A, B, C have risen by the value of their compounded deposits, respectively
      const alice_expectedKUSDBalance = alice_KUSD_Balance_Before
        .add(alice_Deposit_Before)
        .toString();

      const bob_expectedKUSDBalance = bob_KUSD_Balance_Before.add(bob_Deposit_Before).toString();
      const carol_expectedKUSDBalance = carol_KUSD_Balance_Before
        .add(carol_Deposit_Before)
        .toString();

      const alice_KUSD_Balance_After = (await kusdToken.balanceOf(alice)).toString();

      const bob_KUSD_Balance_After = (await kusdToken.balanceOf(bob)).toString();
      const carol_KUSD_Balance_After = (await kusdToken.balanceOf(carol)).toString();

      assert.equal(alice_KUSD_Balance_After, alice_expectedKUSDBalance);
      assert.equal(bob_KUSD_Balance_After, bob_expectedKUSDBalance);
      assert.equal(carol_KUSD_Balance_After, carol_expectedKUSDBalance);

      // Check Asset balances of A, B, C have increased by the value of their Asset gain from liquidations, respectively
      const alice_expectedAssetBalance = alice_Asset_Balance_Before
        .add(alice_AssetGain_Before)
        .toString();
      const bob_expectedAssetBalance = bob_Asset_Balance_Before.add(bob_AssetGain_Before).toString();
      const carol_expectedAssetBalance = carol_Asset_Balance_Before
        .add(carol_AssetGain_Before)
        .toString();

      const alice_AssetBalance_After = (await erc20Asset1.balanceOf(alice)).toString();
      const bob_AssetBalance_After = (await erc20Asset1.balanceOf(bob)).toString();
      const carol_AssetBalance_After = (await erc20Asset1.balanceOf(carol)).toString();

      // Asset balances before minus gas used
      const alice_AssetBalance_After_Gas = alice_AssetBalance_After - A_GAS_Used;
      const bob_AssetBalance_After_Gas = bob_AssetBalance_After - B_GAS_Used;
      const carol_AssetBalance_After_Gas = carol_AssetBalance_After - C_GAS_Used;

      assert.equal(alice_expectedAssetBalance, alice_AssetBalance_After_Gas);
      assert.equal(bob_expectedAssetBalance, bob_AssetBalance_After_Gas);
      assert.equal(carol_expectedAssetBalance, carol_AssetBalance_After_Gas);

      // Check KUSD in Stability Pool has been reduced by A, B and C's compounded deposit
      const expectedKUSDinSP = KUSDinSP_Before.sub(alice_Deposit_Before)
        .sub(bob_Deposit_Before)
        .sub(carol_Deposit_Before)
        .toString();
      const KUSDinSP_After = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();
      assert.equal(KUSDinSP_After, expectedKUSDinSP);

      // Check Asset in SP has reduced to zero
      const AssetinSP_After = (await stabilityPoolAsset1.getAssetBalance()).toString();
      assert.isAtMost(th.getDifference(AssetinSP_After, "0"), 100000);
    });

    it("getDepositorAssetGain(): depositor does not earn further Asset gains from liquidations while their compounded deposit == 0: ", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
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

      // defaulters open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_2 }
      });
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_3 }
      });

      // A, B, provide 10000, 5000 KUSD to SP
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(5000, 18), { from: bob });

      //price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // Liquidate defaulter 1. Empties the Pool
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      const KUSDinSP = (await stabilityPoolAsset1.getTotalKUSDDeposits()).toString();
      assert.equal(KUSDinSP, "0");

      // Check Stability deposits have been fully cancelled with debt, and are now all zero
      const alice_Deposit = (await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice)).toString();
      const bob_Deposit = (await stabilityPoolAsset1.getCompoundedKUSDDeposit(bob)).toString();

      assert.equal(alice_Deposit, "0");
      assert.equal(bob_Deposit, "0");

      // Get Asset gain for A and B
      const alice_AssetGain_1 = (await stabilityPoolAsset1.getDepositorAssetGain(alice)).toString();
      const bob_AssetGain_1 = (await stabilityPoolAsset1.getDepositorAssetGain(bob)).toString();

      // Whale deposits 10000 KUSD to Stability Pool
      await stabilityPoolAsset1.provideToSP(dec(1, 24), { from: whale });

      // Liquidation 2
      await troveManager.liquidate(assetAddress1, defaulter_2);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_2));

      // Check Alice and Bob have not received Asset gain from liquidation 2 while their deposit was 0
      const alice_AssetGain_2 = (await stabilityPoolAsset1.getDepositorAssetGain(alice)).toString();
      const bob_AssetGain_2 = (await stabilityPoolAsset1.getDepositorAssetGain(bob)).toString();

      assert.equal(alice_AssetGain_1, alice_AssetGain_2);
      assert.equal(bob_AssetGain_1, bob_AssetGain_2);

      // Liquidation 3
      await troveManager.liquidate(assetAddress1, defaulter_3);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_3));

      // Check Alice and Bob have not received Asset gain from liquidation 3 while their deposit was 0
      const alice_AssetGain_3 = (await stabilityPoolAsset1.getDepositorAssetGain(alice)).toString();
      const bob_AssetGain_3 = (await stabilityPoolAsset1.getDepositorAssetGain(bob)).toString();

      assert.equal(alice_AssetGain_1, alice_AssetGain_3);
      assert.equal(bob_AssetGain_1, bob_AssetGain_3);
    });

    //--- KUMO functionality ---
    it("withdrawFromSP(): triggers KUMO reward event - increases the sum G", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1, 24)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A and B provide to SP
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: B });

      const G_Before = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // A withdraws from SP
      await stabilityPoolAsset1.withdrawFromSP(dec(5000, 18), { from: A });

      const G_1 = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      // Expect G has increased from the KUMO reward event triggered
      assert.isTrue(G_1.gt(G_Before));

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // A withdraws from SP
      await stabilityPoolAsset1.withdrawFromSP(dec(5000, 18), { from: B });

      const G_2 = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      // Expect G has increased from the KUMO reward event triggered
      assert.isTrue(G_2.gt(G_1));
    });

    it("withdrawFromSP(), partial withdrawal: depositor receives KUMO rewards", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A, B, C, provide to SP
      await stabilityPoolAsset1.provideToSP(dec(10, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(20, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(30, 18), { from: C });

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // Get A, B, C KUMO balance before
      const A_KUMOBalance_Before = await kumoToken.balanceOf(A);
      const B_KUMOBalance_Before = await kumoToken.balanceOf(B);
      const C_KUMOBalance_Before = await kumoToken.balanceOf(C);

      // A, B, C withdraw
      await stabilityPoolAsset1.withdrawFromSP(dec(1, 18), { from: A });
      await stabilityPoolAsset1.withdrawFromSP(dec(2, 18), { from: B });
      await stabilityPoolAsset1.withdrawFromSP(dec(3, 18), { from: C });

      // Get KUMO balance after
      const A_KUMOBalance_After = await kumoToken.balanceOf(A);
      const B_KUMOBalance_After = await kumoToken.balanceOf(B);
      const C_KUMOBalance_After = await kumoToken.balanceOf(C);

      // Check KUMO Balance of A, B, C has increased
      assert.isTrue(A_KUMOBalance_After.gt(A_KUMOBalance_Before));
      assert.isTrue(B_KUMOBalance_After.gt(B_KUMOBalance_Before));
      assert.isTrue(C_KUMOBalance_After.gt(C_KUMOBalance_Before));
    });

    it("withdrawFromSP(), full withdrawal: zero's depositor's snapshots", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      //  SETUP: Execute a series of operations to make G, S > 0 and P < 1

      // E opens trove and makes a deposit
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: E }
      });
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: E });

      // Fast-forward time and make a second deposit, to trigger KUMO reward and make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: E });

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));

      await troveManager.liquidate(assetAddress1, defaulter_1);

      const currentEpoch = await stabilityPoolAsset1.currentEpoch();
      const currentScale = await stabilityPoolAsset1.currentScale();

      const S_Before = await stabilityPoolAsset1.epochToScaleToSum(currentEpoch, currentScale);
      const P_Before = await stabilityPoolAsset1.P();
      const G_Before = await stabilityPoolAsset1.epochToScaleToG(currentEpoch, currentScale);

      // Confirm 0 < P < 1
      assert.isTrue(P_Before.gt(toBN("0")) && P_Before.lt(toBN(dec(1, 18))));
      // Confirm S, G are both > 0
      assert.isTrue(S_Before.gt(toBN("0")));
      assert.isTrue(G_Before.gt(toBN("0")));

      // --- TEST ---

      // Whale transfers to A, B
      await kusdToken.transfer(A, dec(10000, 18), { from: whale });
      await kusdToken.transfer(B, dec(20000, 18), { from: whale });

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // C, D open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: C }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(40000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: D }
      });

      // A, B, C, D make their initial deposits
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(20000, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(30000, 18), { from: C });
      await stabilityPoolAsset1.provideToSP(dec(40000, 18), { from: D });

      // Check deposits snapshots are non-zero

      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPoolAsset1.depositSnapshots(depositor);

        const ZERO = toBN("0");
        // Check S,P, G snapshots are non-zero
        assert.isTrue(snapshot[0].eq(S_Before)); // S
        assert.isTrue(snapshot[1].eq(P_Before)); // P
        assert.isTrue(snapshot[2].gt(ZERO)); // GL increases a bit between each depositor op, so just check it is non-zero
        assert.equal(snapshot[3], "0"); // scale
        assert.equal(snapshot[4], "0"); // epoch
      }

      // All depositors make full withdrawal
      await stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: A });
      await stabilityPoolAsset1.withdrawFromSP(dec(20000, 18), { from: B });
      await stabilityPoolAsset1.withdrawFromSP(dec(30000, 18), { from: C });
      await stabilityPoolAsset1.withdrawFromSP(dec(40000, 18), { from: D });

      // Check all depositors' snapshots have been zero'd
      for (depositor of [A, B, C, D]) {
        const snapshot = await stabilityPoolAsset1.depositSnapshots(depositor);

        // Check S, P, G snapshots are now zero
        assert.equal(snapshot[0], "0"); // S
        assert.equal(snapshot[1], "0"); // P
        assert.equal(snapshot[2], "0"); // G
        assert.equal(snapshot[3], "0"); // scale
        assert.equal(snapshot[4], "0"); // epoch
      }
    });

    it("withdrawFromSP(), reverts when initial deposit value is 0", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A opens trove and join the Stability Pool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10100, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: A });

      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      //  SETUP: Execute a series of operations to trigger KUMO and Asset rewards for depositor A

      // Fast-forward time and make a second deposit, to trigger KUMO reward and make G > 0
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);
      await stabilityPoolAsset1.provideToSP(dec(100, 18), { from: A });

      // perform a liquidation to make 0 < P < 1, and S > 0
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));

      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // A successfully withraws deposit and all gains
      await stabilityPoolAsset1.withdrawFromSP(dec(10100, 18), { from: A });

      // Confirm A's recorded deposit is 0
      const A_deposit = await stabilityPoolAsset1.deposits(A); // get initialValue property on deposit struct
      assert.equal(A_deposit, "0");

      // --- TEST ---
      const expectedRevertMessage = "StabilityPool: User must have a non-zero deposit";

      // Further withdrawal attempt from A
      const withdrawalPromise_A = stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: A });
      await th.assertRevert(withdrawalPromise_A, expectedRevertMessage);

      // Withdrawal attempt of a non-existent deposit, from C
      const withdrawalPromise_C = stabilityPoolAsset1.withdrawFromSP(dec(10000, 18), { from: C });
      await th.assertRevert(withdrawalPromise_C, expectedRevertMessage);
    });

    // --- withdrawAssetGainToTrove ---

    it("withdrawAssetGainToTrove(): reverts when user has no active deposit", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: bob }
      });

      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });

      const alice_initialDeposit = (await stabilityPoolAsset1.deposits(alice)).toString();
      const bob_initialDeposit = (await stabilityPoolAsset1.deposits(bob)).toString();

      assert.equal(alice_initialDeposit, dec(10000, 18));
      assert.equal(bob_initialDeposit, "0");

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      const txAlice = await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, {
        from: alice
      });
      assert.isTrue(txAlice.receipt.status);

      const txPromise_B = stabilityPoolAsset1.withdrawAssetGainToTrove(bob, bob, { from: bob });
      await th.assertRevert(txPromise_B);
    });

    it("withdrawAssetGainToTrove(): Applies kusdLoss to user's deposit, and redirects Asset reward to user's Trove", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

      // Defaulter opens trove
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
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      // check Alice's Trove recorded Asset Before:
      const aliceTrove_Before = await troveManager.Troves(assetAddress1, alice);
      const aliceTrove_Asset_Before = toBN(aliceTrove_Before[TroveData.coll]);
      assert.isTrue(aliceTrove_Asset_Before.gt(toBN("0")));

      // price drops: defaulter's Trove falls below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // Defaulter's Trove is closed
      const liquidationTx_1 = await troveManager.liquidate(assetAddress1, defaulter_1, {
        from: owner
      });
      const [liquidatedDebt, liquidatedColl, ,] = th.getEmittedLiquidationValues(liquidationTx_1);

      const AssetGain_A = await stabilityPoolAsset1.getDepositorAssetGain(alice);
      const compoundedDeposit_A = await stabilityPoolAsset1.getCompoundedKUSDDeposit(alice);

      // Alice should receive rewards proportional to her deposit as share of total deposits
      const expectedAssetGain_A = liquidatedColl
        .mul(toBN(dec(15000, 18)))
        .div(toBN(dec(200000, 18)));
      const expectedkusdLoss_A = liquidatedDebt.mul(toBN(dec(15000, 18))).div(toBN(dec(200000, 18)));
      const expectedCompoundedDeposit_A = toBN(dec(15000, 18)).sub(expectedkusdLoss_A);

      assert.isAtMost(th.getDifference(expectedCompoundedDeposit_A, compoundedDeposit_A), 100000);

      // Alice sends her Asset gains to her Trove
      await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice });

      // check Alice's kusdLoss has been applied to her deposit expectedCompoundedDeposit_A
      alice_deposit_afterDefault = await stabilityPoolAsset1.deposits(alice);
      assert.isAtMost(
        th.getDifference(alice_deposit_afterDefault, expectedCompoundedDeposit_A),
        100000
      );

      // check alice's Trove recorded Asset has increased by the expected reward amount
      const aliceTrove_After = await troveManager.Troves(assetAddress1, alice);
      const aliceTrove_Asset_After = toBN(aliceTrove_After[TroveData.coll]);

      const Trove_Asset_Increase = aliceTrove_Asset_After.sub(aliceTrove_Asset_Before).toString();

      assert.equal(Trove_Asset_Increase, AssetGain_A);
    });

    it("withdrawAssetGainToTrove(): reverts if it would leave trove with ICR < MCR", async () => {
      // --- SETUP ---
      // Whale deposits 1850 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

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
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      // check alice's Trove recorded Asset Before:
      const aliceTrove_Before = await troveManager.Troves(assetAddress1, alice);
      const aliceTrove_Asset_Before = toBN(aliceTrove_Before[TroveData.coll]);
      assert.isTrue(aliceTrove_Asset_Before.gt(toBN("0")));

      // price drops: defaulter's Trove falls below MCR
      await priceFeed.setPrice(assetAddress1, dec(10, 18));

      // defaulter's Trove is closed.
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner });

      // Alice attempts to  her Asset gains to her Trove
      await assertRevert(
        stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice }),
        "BorrowerOps: An operation that would result in ICR < MCR is not permitted"
      );
    });

    it("withdrawAssetGainToTrove(): Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero Asset", async () => {
      // --- SETUP ---
      // Whale deposits 1850 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

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
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

      // check alice's Trove recorded Asset Before:
      const aliceTrove_Before = await troveManager.Troves(assetAddress1, alice);
      const aliceTrove_Asset_Before = toBN(aliceTrove_Before[TroveData.coll]);
      assert.isTrue(aliceTrove_Asset_Before.gt(toBN("0")));

      // price drops: defaulter's Trove falls below MCR
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      // defaulter's Trove is closed.
      await troveManager.liquidate(assetAddress1, defaulter_1, { from: owner });

      // price bounces back
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Alice sends her Asset gains to her Trove
      await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice });

      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(alice), 0);

      const AssetinSP_Before = (await stabilityPoolAsset1.getAssetBalance()).toString();

      // Alice attempts second withdrawal from SP to Trove - reverts, due to 0 Asset gain
      const txPromise_A = stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, {
        from: alice
      });
      await th.assertRevert(txPromise_A);

      // Check Asset in pool does not change
      const AssetinSP_1 = (await stabilityPoolAsset1.getAssetBalance()).toString();
      assert.equal(AssetinSP_Before, AssetinSP_1);

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // Alice attempts third withdrawal (this time, from SP to her own account)
      await stabilityPoolAsset1.withdrawFromSP(dec(15000, 18), { from: alice });

      // Check Asset in pool does not change
      const AssetinSP_2 = (await stabilityPoolAsset1.getAssetBalance()).toString();
      assert.equal(AssetinSP_Before, AssetinSP_2);
    });

    it("withdrawAssetGainToTrove(): decreases StabilityPool Asset and increases activePool Asset", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(dec(185000, 18), { from: whale });

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
      await stabilityPoolAsset1.provideToSP(dec(15000, 18), { from: alice });

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
      const active_Asset_Before = await activePool.getAssetBalance(assetAddress1);
      const stability_Asset_Before = await stabilityPoolAsset1.getAssetBalance();

      // Alice retrieves redirects Asset gain to her Trove
      await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice });

      const active_Asset_After = await activePool.getAssetBalance(assetAddress1);
      const stability_Asset_After = await stabilityPoolAsset1.getAssetBalance();

      const active_Asset_Difference = active_Asset_After.sub(active_Asset_Before); // AP Asset should increase
      const stability_Asset_Difference = stability_Asset_Before.sub(stability_Asset_After); // SP Asset should decrease

      // check Pool Asset values change by Alice's AssetGain, i.e 0.075 Asset
      assert.isAtMost(th.getDifference(active_Asset_Difference, aliceAssetGain), 10000);
      assert.isAtMost(th.getDifference(stability_Asset_Difference, aliceAssetGain), 10000);
    });

    it("withdrawAssetGainToTrove(): All depositors are able to withdraw their Asset gain from the SP to their Trove", async () => {
      // Whale opens trove
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // Defaulter opens trove
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn];
      for (account of depositors) {
        await openTrove({
          asset: assetAddress1,
          extraKUSDAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: { from: account }
        });
        await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: account });
      }

      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      await troveManager.liquidate(assetAddress1, defaulter_1);

      // price bounces back
      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // All depositors attempt to withdraw
      const tx1 = await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice });
      assert.isTrue(tx1.receipt.status);
      const tx2 = await stabilityPoolAsset1.withdrawAssetGainToTrove(bob, bob, { from: bob });
      assert.isTrue(tx1.receipt.status);
      const tx3 = await stabilityPoolAsset1.withdrawAssetGainToTrove(carol, carol, { from: carol });
      assert.isTrue(tx1.receipt.status);
      const tx4 = await stabilityPoolAsset1.withdrawAssetGainToTrove(dennis, dennis, {
        from: dennis
      });
      assert.isTrue(tx1.receipt.status);
      const tx5 = await stabilityPoolAsset1.withdrawAssetGainToTrove(erin, erin, { from: erin });
      assert.isTrue(tx1.receipt.status);
      const tx6 = await stabilityPoolAsset1.withdrawAssetGainToTrove(flyn, flyn, { from: flyn });
      assert.isTrue(tx1.receipt.status);
    });

    it("withdrawAssetGainToTrove(): All depositors withdraw, each withdraw their correct Asset gain", async () => {
      // Whale opens trove
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // defaulter opened
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // 6 Accounts open troves and provide to SP
      const depositors = [alice, bob, carol, dennis, erin, flyn];
      for (account of depositors) {
        await openTrove({
          asset: assetAddress1,
          extraKUSDAmount: toBN(dec(10000, 18)),
          ICR: toBN(dec(2, 18)),
          extraParams: { from: account }
        });
        await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: account });
      }
      const collBefore = toBN((await troveManager.Troves(assetAddress1, alice))[TroveData.coll]); // all troves have same coll before

      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      const liquidationTx = await troveManager.liquidate(assetAddress1, defaulter_1);
      const [, liquidatedColl, ,] = th.getEmittedLiquidationValues(liquidationTx);

      /* All depositors attempt to withdraw their Asset gain to their Trove. Each depositor 
      receives (liquidatedColl/ 6).

      Thus, expected new collateral for each depositor with 1 Ether in their trove originally, is 
      (1 + liquidatedColl/6)
      */

      const expectedCollGain = liquidatedColl.div(toBN("6"));

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice });
      const aliceCollAfter = toBN((await troveManager.Troves(assetAddress1, alice))[TroveData.coll]);
      assert.isAtMost(th.getDifference(aliceCollAfter.sub(collBefore), expectedCollGain), 10000);

      await stabilityPoolAsset1.withdrawAssetGainToTrove(bob, bob, { from: bob });
      const bobCollAfter = toBN((await troveManager.Troves(assetAddress1, bob))[TroveData.coll]);
      assert.isAtMost(th.getDifference(bobCollAfter.sub(collBefore), expectedCollGain), 10000);

      await stabilityPoolAsset1.withdrawAssetGainToTrove(carol, carol, { from: carol });
      const carolCollAfter = toBN((await troveManager.Troves(assetAddress1, carol))[TroveData.coll]);
      assert.isAtMost(th.getDifference(carolCollAfter.sub(collBefore), expectedCollGain), 10000);

      await stabilityPoolAsset1.withdrawAssetGainToTrove(dennis, dennis, { from: dennis });
      const dennisCollAfter = toBN(
        (await troveManager.Troves(assetAddress1, dennis))[TroveData.coll]
      );
      assert.isAtMost(th.getDifference(dennisCollAfter.sub(collBefore), expectedCollGain), 10000);

      await stabilityPoolAsset1.withdrawAssetGainToTrove(erin, erin, { from: erin });
      const erinCollAfter = toBN((await troveManager.Troves(assetAddress1, erin))[TroveData.coll]);
      assert.isAtMost(th.getDifference(erinCollAfter.sub(collBefore), expectedCollGain), 10000);

      await stabilityPoolAsset1.withdrawAssetGainToTrove(flyn, flyn, { from: flyn });
      const flynCollAfter = toBN((await troveManager.Troves(assetAddress1, flyn))[TroveData.coll]);
      assert.isAtMost(th.getDifference(flynCollAfter.sub(collBefore), expectedCollGain), 10000);
    });

    it("withdrawAssetGainToTrove(): caller can withdraw full deposit and Asset gain to their trove during Recovery Mode", async () => {
      // --- SETUP ---

      // Defaulter opens
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // A, B, C open troves
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

      // A, B, C provides 10000, 5000, 3000 KUSD to SP
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: alice });
      await stabilityPoolAsset1.provideToSP(dec(5000, 18), { from: bob });
      await stabilityPoolAsset1.provideToSP(dec(3000, 18), { from: carol });

      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));

      // Price drops to 105,
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      const price = await priceFeed.getPrice(assetAddress1);

      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));

      // Check defaulter 1 has ICR: 100% < ICR < 110%.
      assert.isTrue(await th.ICRbetween100and110(assetAddress1, defaulter_1, troveManager, price));

      const alice_Collateral_Before = toBN(
        (await troveManager.Troves(assetAddress1, alice))[TroveData.coll]
      );
      const bob_Collateral_Before = toBN(
        (await troveManager.Troves(assetAddress1, bob))[TroveData.coll]
      );
      const carol_Collateral_Before = toBN(
        (await troveManager.Troves(assetAddress1, carol))[TroveData.coll]
      );

      // Liquidate defaulter 1
      assert.isTrue(await sortedTroves.contains(assetAddress1, defaulter_1));
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      const alice_AssetGain_Before = await stabilityPoolAsset1.getDepositorAssetGain(alice);
      const bob_AssetGain_Before = await stabilityPoolAsset1.getDepositorAssetGain(bob);
      const carol_AssetGain_Before = await stabilityPoolAsset1.getDepositorAssetGain(carol);

      // A, B, C withdraw their full Asset gain from the Stability Pool to their trove
      await stabilityPoolAsset1.withdrawAssetGainToTrove(alice, alice, { from: alice });
      await stabilityPoolAsset1.withdrawAssetGainToTrove(bob, bob, { from: bob });
      await stabilityPoolAsset1.withdrawAssetGainToTrove(carol, carol, { from: carol });

      // Check collateral of troves A, B, C has increased by the value of their Asset gain from liquidations, respectively
      const alice_expectedCollateral = alice_Collateral_Before
        .add(alice_AssetGain_Before)
        .toString();
      const bob_expectedColalteral = bob_Collateral_Before.add(bob_AssetGain_Before).toString();
      const carol_expectedCollateral = carol_Collateral_Before
        .add(carol_AssetGain_Before)
        .toString();

      const alice_Collateral_After = toBN(
        (await troveManager.Troves(assetAddress1, alice))[TroveData.coll]
      );
      const bob_Collateral_After = toBN(
        (await troveManager.Troves(assetAddress1, bob))[TroveData.coll]
      );
      const carol_Collateral_After = toBN(
        (await troveManager.Troves(assetAddress1, carol))[TroveData.coll]
      );

      assert.equal(alice_expectedCollateral, alice_Collateral_After);
      assert.equal(bob_expectedColalteral, bob_Collateral_After);
      assert.equal(carol_expectedCollateral, carol_Collateral_After);

      // Check Asset in SP has reduced to zero
      const AssetinSP_After = (await stabilityPoolAsset1.getAssetBalance()).toString();
      assert.isAtMost(th.getDifference(AssetinSP_After, "0"), 100000);
    });

    it("withdrawAssetGainToTrove(): reverts if user has no trove", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
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

      // Defaulter opens
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // A transfers KUSD to D
      await kusdToken.transfer(dennis, dec(10000, 18), { from: alice });

      // D deposits to Stability Pool
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: dennis });

      //Price drops
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      //Liquidate defaulter 1
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // D attempts to withdraw his Asset gain to Trove
      await th.assertRevert(
        stabilityPoolAsset1.withdrawAssetGainToTrove(dennis, dennis, { from: dennis }),
        "caller must have an active trove to withdraw AssetGain to"
      );
    });

    it("withdrawAssetGainToTrove(): triggers KUMO reward event - increases the sum G", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A and B provide to SP
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(10000, 18), { from: B });

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      const G_Before = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // A withdraws from SP
      await stabilityPoolAsset1.withdrawFromSP(dec(50, 18), { from: A });

      const G_1 = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      // Expect G has increased from the KUMO reward event triggered
      assert.isTrue(G_1.gt(G_Before));

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // Check B has non-zero Asset gain
      assert.isTrue((await stabilityPoolAsset1.getDepositorAssetGain(B)).gt(ZERO));

      // B withdraws to trove
      await stabilityPoolAsset1.withdrawAssetGainToTrove(B, B, { from: B });

      const G_2 = await stabilityPoolAsset1.epochToScaleToG(0, 0);

      // Expect G has increased from the KUMO reward event triggered
      assert.isTrue(G_2.gt(G_1));
    });

    it("withdrawAssetGainToTrove(), eligible deposit: depositor receives KUMO rewards", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // A, B, C open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: A }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(20000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: B }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(30000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });

      // A, B, C, provide to SP
      await stabilityPoolAsset1.provideToSP(dec(1000, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(2000, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(3000, 18), { from: C });

      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);

      // Defaulter opens a trove, price drops, defaulter gets liquidated
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });
      await priceFeed.setPrice(assetAddress1, dec(105, 18));
      assert.isFalse(await th.checkRecoveryMode(contracts, assetAddress1));
      await troveManager.liquidate(assetAddress1, defaulter_1);
      assert.isFalse(await sortedTroves.contains(assetAddress1, defaulter_1));

      // Get A, B, C KUMO balance before
      const A_KUMOBalance_Before = await kumoToken.balanceOf(A);
      const B_KUMOBalance_Before = await kumoToken.balanceOf(B);
      const C_KUMOBalance_Before = await kumoToken.balanceOf(C);

      // Check A, B, C have non-zero Asset gain
      assert.isTrue((await stabilityPoolAsset1.getDepositorAssetGain(A)).gt(ZERO));
      assert.isTrue((await stabilityPoolAsset1.getDepositorAssetGain(B)).gt(ZERO));
      assert.isTrue((await stabilityPoolAsset1.getDepositorAssetGain(C)).gt(ZERO));

      await priceFeed.setPrice(assetAddress1, dec(200, 18));

      // A, B, C withdraw to trove
      await stabilityPoolAsset1.withdrawAssetGainToTrove(A, A, { from: A });
      await stabilityPoolAsset1.withdrawAssetGainToTrove(B, B, { from: B });
      await stabilityPoolAsset1.withdrawAssetGainToTrove(C, C, { from: C });

      // Get KUMO balance after
      const A_KUMOBalance_After = await kumoToken.balanceOf(A);
      const B_KUMOBalance_After = await kumoToken.balanceOf(B);
      const C_KUMOBalance_After = await kumoToken.balanceOf(C);

      // Check KUMO Balance of A, B, C has increased
      assert.isTrue(A_KUMOBalance_After.gt(A_KUMOBalance_Before));
      assert.isTrue(B_KUMOBalance_After.gt(B_KUMOBalance_Before));
      assert.isTrue(C_KUMOBalance_After.gt(C_KUMOBalance_Before));
    });

    it("withdrawAssetGainToTrove(): reverts when depositor has no Asset gain", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(100000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      // Whale transfers KUSD to A, B
      await kusdToken.transfer(A, dec(10000, 18), { from: whale });
      await kusdToken.transfer(B, dec(20000, 18), { from: whale });

      // C, D open troves
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: C }
      });
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(4000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: D }
      });

      // A, B, C, D provide to SP
      await stabilityPoolAsset1.provideToSP(dec(10, 18), { from: A });
      await stabilityPoolAsset1.provideToSP(dec(20, 18), { from: B });
      await stabilityPoolAsset1.provideToSP(dec(30, 18), { from: C });
      await stabilityPoolAsset1.provideToSP(dec(40, 18), { from: D });

      // fastforward time, and E makes a deposit, creating KUMO rewards for all
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_HOUR, web3.currentProvider);
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(3000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: E }
      });
      await stabilityPoolAsset1.provideToSP(dec(3000, 18), { from: E });

      // Confirm A, B, C have zero Asset gain
      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(A), "0");
      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(B), "0");
      assert.equal(await stabilityPoolAsset1.getDepositorAssetGain(C), "0");

      // Check withdrawAssetGainToTrove reverts for A, B, C
      const txPromise_A = stabilityPoolAsset1.withdrawAssetGainToTrove(A, A, { from: A });
      const txPromise_B = stabilityPoolAsset1.withdrawAssetGainToTrove(B, B, { from: B });
      const txPromise_C = stabilityPoolAsset1.withdrawAssetGainToTrove(C, C, { from: C });
      const txPromise_D = stabilityPoolAsset1.withdrawAssetGainToTrove(D, D, { from: D });

      await th.assertRevert(txPromise_A);
      await th.assertRevert(txPromise_B);
      await th.assertRevert(txPromise_C);
      await th.assertRevert(txPromise_D);
    });
  });
});

contract("Reset chain state", async accounts => {});
