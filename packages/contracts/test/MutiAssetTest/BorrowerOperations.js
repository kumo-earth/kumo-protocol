const deploymentHelper = require("../../utils/deploymentHelpers.js");
const testHelpers = require("../../utils/testHelpers.js");

const BorrowerOperationsTester = artifacts.require("./BorrowerOperationsTester.sol");

const th = testHelpers.TestHelper;

const dec = th.dec;
const toBN = th.toBN;
const timeValues = testHelpers.TimeValues;
const TroveData = testHelpers.TroveData;

const assertRevert = th.assertRevert;

const GAS_PRICE = 10000000;

/* NOTE: Some of the borrowing tests do not test for specific KUSD fee values. They only test that the
 * fees are non-zero when they should occur, and that they decay over time.
 *
 * Specific KUSD fee values will depend on the final fee schedule used, and the final choice for
 *  the parameter MINUTE_DECAY_FACTOR in the TroveManager, which is still TBD based on economic
 * modelling.
 *
 */

contract.only("BorrowerOperations - Multiple Assets", async accounts => {
  const [owner, alice, bob, carol, dennis, whale, A, B, C, D, E, defaulter_1] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);
  const ZERO_ADDRESS = th.ZERO_ADDRESS;

  // const frontEnds = [frontEnd_1, frontEnd_2, frontEnd_3]

  let priceFeed;
  let kusdToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let collSurplusPool;
  let stabilityPool1;
  let borrowerOperations;
  let kumoStaking;
  let kumoToken;
  let erc20Asset1;
  let assetAddress1;
  let erc20Asset2;
  let assetAddress2;

  let contracts;

  const getNetBorrowingAmount = async (debtWithFee, asset) =>
    th.getNetBorrowingAmount(contracts, debtWithFee, asset);
  const openTrove = async params => th.openTrove(contracts, params);

  let kumoParams;

  before(async () => {});

  const testCorpus = ({ withProxy = false }) => {
    beforeEach(async () => {
      contracts = await deploymentHelper.deployKumoCore();
      contracts.borrowerOperations = await BorrowerOperationsTester.new();
      contracts = await deploymentHelper.deployKUSDTokenTester(contracts);
      const KUMOContracts = await deploymentHelper.deployKUMOTesterContractsHardhat(
        bountyAddress,
        lpRewardsAddress,
        multisig
      );

      erc20Asset1 = await deploymentHelper.deployERC20Asset("Carbon Token X", "CTX");
      assetAddress1 = erc20Asset1.address;
      erc20Asset2 = await deploymentHelper.deployERC20Asset("Carbon Token Y", "CTY");
      assetAddress2 = erc20Asset2.address;

      kumoParams = contracts.kumoParameters;
      await kumoParams.setAsDefault(assetAddress1);
      await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1);
      await kumoParams.setAsDefault(assetAddress2);
      await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress2);

      await deploymentHelper.connectKUMOContracts(KUMOContracts);
      await deploymentHelper.connectCoreContracts(contracts, KUMOContracts);
      await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts);

      if (withProxy) {
        const users = [alice, bob, carol, dennis, whale, A, B, C, D, E];
        await deploymentHelper.deployProxyScripts(contracts, KUMOContracts, owner, users);
      }

      priceFeed = contracts.priceFeedTestnet;
      kusdToken = contracts.kusdToken;
      sortedTroves = contracts.sortedTroves;
      troveManager = contracts.troveManager;
      activePool = contracts.activePool;
      collSurplusPool = contracts.collSurplusPool;
      stabilityPool1 = await deploymentHelper.getStabilityPoolByAsset(contracts, assetAddress1);
      borrowerOperations = contracts.borrowerOperations;
      kumoStaking = KUMOContracts.kumoStaking;
      kumoToken = KUMOContracts.kumoToken;

      // Mint token to each acccount
      await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 20);
      await deploymentHelper.mintMockAssets(erc20Asset2, accounts, 20);

      // Set KUSD mint cap to 1 trillion
      await kumoParams.setKUSDMintCap(assetAddress1, dec(1, 30));
      await kumoParams.setKUSDMintCap(assetAddress2, dec(1, 30));

      // for (account of accounts.slice(0, 10)) {
      //   await th.openTrove(contracts, { asset: assetAddress1, extraKUSDAmount: toBN(dec(20000, 18)), ICR: toBN(dec(2, 18)), extraParams: { from: account } })
      // }
    });

    it("openTrove(): changing TCR for one asset shouldn't change it for another", async () => {
      // create some TCR values for the first and second assets
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(10, 18)), extraParams: { from: bob } });
      await openTrove({ asset: assetAddress2, ICR: toBN(dec(10, 18)), extraParams: { from: bob } });

      const Price_Before_Asset1 = await priceFeed.getPrice(assetAddress1);
      const Price_Before_Asset2 = await priceFeed.getPrice(assetAddress2);

      const TCR_Before_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_Before_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      // alice creates a Trove for the first asset, changing TCR
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCR_After_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_After_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      assert.isTrue(TCR_Before_Asset2 == TCR_After_Asset2.toString());
      assert.isTrue(TCR_Before_Asset1 < TCR_After_Asset1.toString());
    });

    it("addColl(), change in collateral changing TCR for one asset shouldn't change it for another", async () => {
      // alice creates a Trove and adds first collateral
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ asset: assetAddress2, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      const Price_Before_Asset1 = await priceFeed.getPrice(assetAddress1);
      const Price_Before_Asset2 = await priceFeed.getPrice(assetAddress2);

      const TCR_Before_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_Before_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      // alice adds second collateral for the first asset, changing TCR
      await borrowerOperations.addColl(assetAddress1, dec(1, "ether"), alice, alice, {
        from: alice,
        value: dec(1, "ether")
      });

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCR_After_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_After_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      assert.isTrue(TCR_Before_Asset2 == TCR_After_Asset2.toString());
      assert.isTrue(TCR_Before_Asset1 < TCR_After_Asset1.toString());
    });

    it("addColl(): Increases the activePool ETH and raw ether balance changing TCR for one asset shouldn't change it for another", async () => {
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      await openTrove({
        asset: assetAddress2,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      const Price_Before_Asset1 = await priceFeed.getPrice(assetAddress1);
      const Price_Before_Asset2 = await priceFeed.getPrice(assetAddress2);

      const TCR_Before_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_Before_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      // alice add collateral for the first asset, changing TCR
      await borrowerOperations.addColl(assetAddress1, dec(1, "ether"), alice, alice, {
        from: alice,
        value: dec(1, "ether")
      });

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCR_After_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_After_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      assert.isTrue(TCR_Before_Asset2 == TCR_After_Asset2.toString());
      assert.isTrue(TCR_Before_Asset1 < TCR_After_Asset1.toString());
    });

    it("addColl(): can add collateral in Recovery Mode changing TCR for one asset shouldn't change it for another", async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ asset: assetAddress2, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      await priceFeed.setPrice(assetAddress1, "105000000000000000000");

      const Price_Before_Asset1 = await priceFeed.getPrice(assetAddress1);
      const Price_Before_Asset2 = await priceFeed.getPrice(assetAddress2);

      const TCR_Before_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_Before_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      const collTopUp = toBN(dec(1, "ether"));

      // changing TCR
      await borrowerOperations.addColl(assetAddress1, collTopUp, alice, alice, {
        from: alice,
        value: collTopUp
      });

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCR_After_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_After_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      assert.isTrue(TCR_Before_Asset2 == TCR_After_Asset2.toString());
      assert.isTrue(TCR_Before_Asset1 < TCR_After_Asset1.toString());
    });

    it("withdrawColl(): reduces the Trove's collateral changing TCR for one asset shouldn't change it for another", async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ asset: assetAddress2, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      const Price_Before_Asset1 = await priceFeed.getPrice(assetAddress1);
      const Price_Before_Asset2 = await priceFeed.getPrice(assetAddress2);

      const TCR_Before_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_Before_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      // Alice withdraws 1 ether for the first asset, changing TCR
      await borrowerOperations.withdrawColl(assetAddress1, dec(1, "ether"), alice, alice, {
        from: alice
      });

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCR_After_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_After_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      assert.isTrue(TCR_Before_Asset2 == TCR_After_Asset2.toString());
      assert.isTrue(TCR_Before_Asset1 > TCR_After_Asset1.toString());
    });

    it("withdrawColl(): reduces ActivePool ETH and raw ether changing TCR for one asset shouldn't change it for another", async () => {
      await openTrove({ asset: assetAddress1, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });
      await openTrove({ asset: assetAddress2, ICR: toBN(dec(2, 18)), extraParams: { from: alice } });

      const Price_Before_Asset1 = await priceFeed.getPrice(assetAddress1);
      const Price_Before_Asset2 = await priceFeed.getPrice(assetAddress2);

      const TCR_Before_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_Before_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      await borrowerOperations.withdrawColl(assetAddress1, dec(1, "ether"), alice, alice, {
        from: alice
      });

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCR_After_Asset1 = await troveManager.getTCR(assetAddress1, Price_Before_Asset1);
      const TCR_After_Asset2 = await troveManager.getTCR(assetAddress2, Price_Before_Asset2);

      assert.isTrue(TCR_Before_Asset2 == TCR_After_Asset2.toString());
      assert.isTrue(TCR_Before_Asset1 > TCR_After_Asset1.toString());
    });

    it("adjustTrove(): updates borrower's debt and coll changing TCR for one asset shouldn't change it for another", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });

      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });

      const priceBeforeAsset1 = await priceFeed.getPrice(assetAddress1);
      const priceBeforeAsset2 = await priceFeed.getPrice(assetAddress2);

      const TCRBeforeAsset1 = await troveManager.getTCR(assetAddress1, priceBeforeAsset1);
      const TCRBeforeAsset2 = await troveManager.getTCR(assetAddress2, priceBeforeAsset2);

      // Alice adjusts trove. Coll and debt increase(+1 ETH, +50KUSD), changing TCR
      await borrowerOperations.adjustTrove(
        assetAddress1,
        dec(1, "ether"),
        th._100pct,
        0,
        await getNetBorrowingAmount(dec(50, 18), assetAddress1),
        true,
        alice,
        alice,
        { from: alice }
      );

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCRAfterAsset1 = await troveManager.getTCR(assetAddress1, priceBeforeAsset1);
      const TCRAfterAsset2 = await troveManager.getTCR(assetAddress2, priceBeforeAsset2);

      assert.isTrue(TCRBeforeAsset2 == TCRAfterAsset2.toString());
      assert.isTrue(TCRBeforeAsset1 < TCRAfterAsset1.toString());
    });

    it("closeTrove(): sets trove's status to closed changing ActivePool balance for one asset shouldn't change it for another", async () => {
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: dennis }
      });

      await openTrove({
        asset: assetAddress2,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: whale }
      });

      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(10000, 18)),
        ICR: toBN(dec(2, 18)),
        extraParams: { from: alice }
      });

      const activePoolBeforeBalance1 = await activePool.getAssetBalance(assetAddress1);
      const activePoolBeforeBalance2 = await activePool.getAssetBalance(assetAddress2);

      // to compensate borrowing fees
      await kusdToken.transfer(alice, await kusdToken.balanceOf(dennis), { from: dennis });

      // Close the trove
      await borrowerOperations.closeTrove(assetAddress1, { from: alice });

      // ActivePool balance for Asset1 will change, for Asset2 It stays same
      const activePoolAfterBalance1 = await activePool.getAssetBalance(assetAddress1);
      const activePoolAfterBalance2 = await activePool.getAssetBalance(assetAddress2);

      assert.isTrue(activePoolBeforeBalance2 == activePoolAfterBalance2.toString());
      assert.isTrue(activePoolBeforeBalance1 > activePoolAfterBalance1.toString());
    });

    const redeemCollateral3Full1Partial = async assetAddress => {
      // time fast-forwards 1 year, and multisig stakes 1 KUMO
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);
      await kumoToken.approve(kumoStaking.address, dec(1, 18), { from: multisig });
      await kumoStaking.stake(dec(1, 18), { from: multisig });

      const { netDebt: W_netDebt } = await openTrove({
        asset: assetAddress,
        ICR: toBN(dec(20, 18)),
        extraKUSDAmount: dec(10000, 18),
        extraParams: { from: whale }
      });

      const { netDebt: A_netDebt, collateral: A_coll } = await openTrove({
        asset: assetAddress,
        ICR: toBN(dec(200, 16)),
        extraKUSDAmount: dec(100, 18),
        extraParams: { from: A }
      });
      const { netDebt: B_netDebt, collateral: B_coll } = await openTrove({
        asset: assetAddress,
        ICR: toBN(dec(190, 16)),
        extraKUSDAmount: dec(100, 18),
        extraParams: { from: B }
      });
      const { netDebt: C_netDebt, collateral: C_coll } = await openTrove({
        asset: assetAddress,
        ICR: toBN(dec(180, 16)),
        extraKUSDAmount: dec(100, 18),
        extraParams: { from: C }
      });
      const { netDebt: D_netDebt } = await openTrove({
        asset: assetAddress,
        ICR: toBN(dec(280, 16)),
        extraKUSDAmount: dec(100, 18),
        extraParams: { from: D }
      });
      const redemptionAmount = A_netDebt.add(B_netDebt)
        .add(C_netDebt)
        .add(toBN(dec(10, 18)));

      const A_balanceBefore = toBN(await erc20Asset1.balanceOf(A));
      const B_balanceBefore = toBN(await erc20Asset1.balanceOf(B));
      const C_balanceBefore = toBN(await erc20Asset1.balanceOf(C));
      const D_balanceBefore = toBN(await erc20Asset1.balanceOf(D));

      const A_collBefore = await troveManager.getTroveColl(assetAddress, A);
      const B_collBefore = await troveManager.getTroveColl(assetAddress, B);
      const C_collBefore = await troveManager.getTroveColl(assetAddress, C);
      const D_collBefore = await troveManager.getTroveColl(assetAddress, D);

      // Confirm baseRate before redemption is 0
      const baseRate = await troveManager.baseRate(assetAddress);
      assert.equal(baseRate, "0");

      // whale redeems KUSD.  Expect this to fully redeem A, B, C, and partially redeem D.
      await th.redeemCollateral(assetAddress, whale, contracts, redemptionAmount, GAS_PRICE);

      // Check A, B, C have been closed
      assert.isFalse(await sortedTroves.contains(assetAddress, A));
      assert.isFalse(await sortedTroves.contains(assetAddress, B));
      assert.isFalse(await sortedTroves.contains(assetAddress, C));

      // Check D stays active
      assert.isTrue(await sortedTroves.contains(assetAddress, D));

      /*
      At ETH:USD price of 200, with full redemptions from A, B, C:
  
      ETHDrawn from A = 100/200 = 0.5 ETH --> Surplus = (1-0.5) = 0.5
      ETHDrawn from B = 120/200 = 0.6 ETH --> Surplus = (1-0.6) = 0.4
      ETHDrawn from C = 130/200 = 0.65 ETH --> Surplus = (2-0.65) = 1.35
      */

      const A_balanceAfter = toBN(await erc20Asset1.balanceOf(A));
      const B_balanceAfter = toBN(await erc20Asset1.balanceOf(B));
      const C_balanceAfter = toBN(await erc20Asset1.balanceOf(C));
      const D_balanceAfter = toBN(await erc20Asset1.balanceOf(D));

      // Check A, B, C’s trove collateral balance is zero (fully redeemed-from troves)
      const A_collAfter = await troveManager.getTroveColl(assetAddress, A);
      const B_collAfter = await troveManager.getTroveColl(assetAddress, B);
      const C_collAfter = await troveManager.getTroveColl(assetAddress, C);
      assert.isTrue(A_collAfter.eq(toBN(0)));
      assert.isTrue(B_collAfter.eq(toBN(0)));
      assert.isTrue(C_collAfter.eq(toBN(0)));

      // check D's trove collateral balances have decreased (the partially redeemed-from trove)
      const D_collAfter = await troveManager.getTroveColl(assetAddress, D);
      assert.isTrue(D_collAfter.lt(D_collBefore));

      // Check A, B, C (fully redeemed-from troves), and D's (the partially redeemed-from trove) balance has not changed
      assert.isTrue(A_balanceAfter.eq(A_balanceBefore));
      assert.isTrue(B_balanceAfter.eq(B_balanceBefore));
      assert.isTrue(C_balanceAfter.eq(C_balanceBefore));
      assert.isTrue(D_balanceAfter.eq(D_balanceBefore));

      // D is not closed, so cannot open trove
      // await assertRevert(borrowerOperations.openTrove(th._100pct, 0, assetAddress, assetAddress, { from: D, value: dec(10, 18) }), 'BorrowerOps: Trove is active')
      await assertRevert(
        borrowerOperations.openTrove(
          assetAddress,
          toBN(dec(10, 18)),
          th._100pct,
          0,
          ZERO_ADDRESS,
          ZERO_ADDRESS,
          { from: D }
        )
      );

      return {
        A_netDebt,
        A_coll,
        B_netDebt,
        B_coll,
        C_netDebt,
        C_coll
      };
    };

    it("redeemCollateral(): a redemption that closes a trove changing CollSurplusPool balance for one asset shouldn't change it for another", async () => {
      await redeemCollateral3Full1Partial(assetAddress1);
      await redeemCollateral3Full1Partial(assetAddress2);

      // CollSurplusPool endpoint cannot be called directly
      await assertRevert(
        collSurplusPool.claimColl(assetAddress1, A),
        "CollSurplusPool: Caller is not Borrower Operations"
      );

      const collSurplusPoolBeforeBalance1 = await collSurplusPool.getAssetBalance(assetAddress1);
      const collSurplusPoolBeforeBalance2 = await collSurplusPool.getAssetBalance(assetAddress2);

      await borrowerOperations.claimCollateral(assetAddress1, { from: A, gasPrice: GAS_PRICE });
      await borrowerOperations.claimCollateral(assetAddress1, { from: B, gasPrice: GAS_PRICE });
      await borrowerOperations.claimCollateral(assetAddress1, { from: C, gasPrice: GAS_PRICE });

      // collSurplusPool asset balance changhes for first asset, doesn't change for second asset
      const collSurplusPoolAfterBalance1 = await collSurplusPool.getAssetBalance(assetAddress1);
      const collSurplusPoolAfterBalance2 = await collSurplusPool.getAssetBalance(assetAddress2);

      assert.isTrue(collSurplusPoolBeforeBalance2 == collSurplusPoolAfterBalance2.toString());
      assert.isTrue(collSurplusPoolBeforeBalance1 > collSurplusPoolAfterBalance1.toString());
    });

    it("withdrawAssetGainToTrove(): Applies kusdLoss to user's deposit changing TCR for one asset shouldn't change it for another", async () => {
      // --- SETUP ---
      // Whale deposits 185000 KUSD in StabilityPool
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(1000000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: whale }
      });

      await stabilityPool1.provideToSP(dec(185000, 18), ZERO_ADDRESS, { from: whale });

      // Defaulter opens trove
      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(2, 18)),
        extraParams: { from: defaulter_1 }
      });

      // Alice makes deposit #1: 15000 KUSD
      await openTrove({
        asset: assetAddress1,
        extraKUSDAmount: toBN(dec(15000, 18)),
        ICR: toBN(dec(10, 18)),
        extraParams: { from: alice }
      });

      await stabilityPool1.provideToSP(dec(15000, 18), ZERO_ADDRESS, { from: alice });

      // check Alice's Trove recorded Asset Before:
      const aliceTrove_Before = await troveManager.Troves(alice, assetAddress1);
      const aliceTrove_Asset_Before = toBN(aliceTrove_Before[TroveData.coll]);
      assert.isTrue(aliceTrove_Asset_Before.gt(toBN("0")));

      // price drops: defaulter's Trove falls below MCR, alice and whale Trove remain active
      await priceFeed.setPrice(assetAddress1, dec(105, 18));

      const priceBeforeAsset1 = await priceFeed.getPrice(assetAddress1);
      const priceBeforeAsset2 = await priceFeed.getPrice(assetAddress2);

      const TCRBeforeAsset1 = await troveManager.getTCR(assetAddress1, priceBeforeAsset1);
      const TCRBeforeAsset2 = await troveManager.getTCR(assetAddress2, priceBeforeAsset2);

      // Defaulter's Trove is closed, changing TCR for asset 1
      await troveManager.liquidate(assetAddress1, defaulter_1, {
        from: owner
      });

      // TCR for the first asset changes, TCR for the second asset stays the same
      const TCRAfterAsset1 = await troveManager.getTCR(assetAddress1, priceBeforeAsset1);
      const TCRAfterAsset2 = await troveManager.getTCR(assetAddress2, priceBeforeAsset2);

      assert.isTrue(TCRBeforeAsset2 == TCRAfterAsset2.toString());
      assert.isTrue(TCRBeforeAsset1 < TCRAfterAsset1.toString());
    });
  };

  describe("Without proxy", async () => {
    testCorpus({ withProxy: false });
  });
  // describe('With proxy', async () => {
  //   testCorpus({ withProxy: true })
  // })
});

contract("Reset chain state", async accounts => {});
