const deploymentHelper = require("../utils/deploymentHelpers.js");
const { TestHelper: th, MoneyValues: mv, TroveData } = require("../utils/testHelpers.js");
const { toBN, dec, ZERO_ADDRESS } = th;

const KUSDToken = artifacts.require("./KUSDToken.sol");

contract("TroveManager - in Recovery Mode - back to normal mode in 1 tx", async accounts => {
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);
  const [
    owner,
    alice,
    bob,
    carol,
    dennis,
    erin,
    freddy,
    greta,
    harry,
    ida,
    whale,
    defaulter_1,
    defaulter_2,
    defaulter_3,
    defaulter_4,
    A,
    B,
    C,
    D,
    E,
    F,
    G,
    H,
    I
  ] = accounts;

  let contracts;
  let troveManager;
  let priceFeed;
  let sortedTroves;
  let KUMOContracts;
  let erc20Asset1;
  let erc20Asset2;
  let stabilityPoolAsset1;
  let stabilityPoolAsset2;

  const openTrove = async params => th.openTrove(contracts, params);

  beforeEach(async () => {
    contracts = await deploymentHelper.deployKumoCore();
    contracts.kusdToken = await KUSDToken.new(
      contracts.troveManager.address,
      contracts.stabilityPoolFactory.address,
      contracts.borrowerOperations.address
    );
    KUMOContracts = await deploymentHelper.deployKUMOContracts(
      bountyAddress,
      lpRewardsAddress,
      multisig
    );

    troveManager = contracts.troveManager;
    priceFeed = contracts.priceFeedTestnet;
    sortedTroves = contracts.sortedTroves;
    erc20Asset1 = await deploymentHelper.deployERC20Asset("Carbon Token X", "CTX");
    assetAddress1 = erc20Asset1.address;
    erc20Asset2 = await deploymentHelper.deployERC20Asset("Carbon Token Y", "CTY");
    assetAddress2 = erc20Asset2.address;
    stabilityPoolFactory = contracts.stabilityPoolFactory;

    await deploymentHelper.connectKUMOContracts(KUMOContracts);
    await deploymentHelper.connectCoreContracts(contracts, KUMOContracts);
    await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts);

    // Add assets to the system
    await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1);
    await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress2);

    // Mint token to each acccount
    await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 25);
    await deploymentHelper.mintMockAssets(erc20Asset2, accounts, 25);

    // Set StabilityPools
    stabilityPoolAsset1 = await deploymentHelper.getStabilityPoolByAsset(contracts, assetAddress1);
    stabilityPoolAsset2 = await deploymentHelper.getStabilityPoolByAsset(contracts, assetAddress2);
  });

  context("Batch liquidations", () => {
    const setup = async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(296, 16)),
        extraParams: { from: alice }
      });
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(280, 16)),
        extraParams: { from: bob }
      });
      const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(150, 16)),
        extraParams: { from: carol }
      });

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt);

      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(340, 16)),
        extraKUSDAmount: totalLiquidatedDebt,
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(totalLiquidatedDebt, { from: whale });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(100, 18));
      const price = await priceFeed.getPrice(assetAddress1);
      const TCR = await th.getTCR(contracts, assetAddress1);

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(assetAddress1, alice, price);
      const ICR_B = await troveManager.getCurrentICR(assetAddress1, bob, price);
      const ICR_C = await troveManager.getCurrentICR(assetAddress1, carol, price);

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
      assert.isTrue(ICR_C.lt(mv._ICR100));

      return {
        A_coll,
        A_totalDebt,
        B_coll,
        B_totalDebt,
        C_coll,
        C_totalDebt,
        totalLiquidatedDebt,
        price
      };
    };

    it("First trove only doesn’t get out of Recovery Mode", async () => {
      await setup();
      const tx = await troveManager.batchLiquidateTroves(assetAddress1, [alice]);

      const TCR = await th.getTCR(contracts, assetAddress1);
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));
    });

    it("Two troves over MCR are liquidated", async () => {
      await setup();
      const tx = await troveManager.batchLiquidateTroves(assetAddress1, [alice, bob, carol]);

      const liquidationEvents = th.getAllEventsByName(tx, "TroveLiquidated");
      assert.equal(liquidationEvents.length, 3, "Not enough liquidations");

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(assetAddress1, alice));
      assert.isFalse(await sortedTroves.contains(assetAddress1, bob));
      assert.isFalse(await sortedTroves.contains(assetAddress1, carol));

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(assetAddress1, alice))[TroveData.status], "3");
      assert.equal((await troveManager.Troves(assetAddress1, bob))[TroveData.status], "3");
      assert.equal((await troveManager.Troves(assetAddress1, carol))[TroveData.status], "3");
    });

    it("Stability Pool profit matches", async () => {
      const { A_coll, A_totalDebt, C_coll, C_totalDebt, totalLiquidatedDebt, price } = await setup();

      const spEthBefore = await stabilityPoolAsset1.getAssetBalance();
      const spKusdBefore = await stabilityPoolAsset1.getTotalKUSDDeposits();

      const tx = await troveManager.batchLiquidateTroves(assetAddress1, [alice, carol]);

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(assetAddress1, alice));
      assert.isFalse(await sortedTroves.contains(assetAddress1, carol));

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(assetAddress1, alice))[TroveData.status], "3");
      assert.equal((await troveManager.Troves(assetAddress1, carol))[TroveData.status], "3");

      const spEthAfter = await stabilityPoolAsset1.getAssetBalance();
      const spKusdAfter = await stabilityPoolAsset1.getTotalKUSDDeposits();

      // liquidate collaterals with the gas compensation fee subtracted
      const expectedCollateralLiquidatedA = th.applyLiquidationFee(
        A_totalDebt.mul(mv._MCR).div(price)
      );
      const expectedCollateralLiquidatedC = th.applyLiquidationFee(C_coll);
      // Stability Pool gains
      const expectedGainInKUSD = expectedCollateralLiquidatedA
        .mul(price)
        .div(mv._1e18BN)
        .sub(A_totalDebt);
      const realGainInKUSD = spEthAfter
        .sub(spEthBefore)
        .mul(price)
        .div(mv._1e18BN)
        .sub(spKusdBefore.sub(spKusdAfter));

      assert.equal(
        spEthAfter.sub(spEthBefore).toString(),
        expectedCollateralLiquidatedA.toString(),
        "Stability Pool ETH doesn’t match"
      );
      assert.equal(
        spKusdBefore.sub(spKusdAfter).toString(),
        A_totalDebt.toString(),
        "Stability Pool KUSD doesn’t match"
      );
      assert.equal(
        realGainInKUSD.toString(),
        expectedGainInKUSD.toString(),
        "Stability Pool gains don’t match"
      );
    });

    it("A trove over TCR is not liquidated", async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(280, 16)),
        extraParams: { from: alice }
      });
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(276, 16)),
        extraParams: { from: bob }
      });
      const { collateral: C_coll, totalDebt: C_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(150, 16)),
        extraParams: { from: carol }
      });

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt).add(C_totalDebt);

      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(310, 16)),
        extraKUSDAmount: totalLiquidatedDebt,
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(totalLiquidatedDebt, { from: whale });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(100, 18));
      const price = await priceFeed.getPrice(assetAddress1);
      const TCR = await th.getTCR(contracts, assetAddress1);

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(assetAddress1, alice, price);
      const ICR_B = await troveManager.getCurrentICR(assetAddress1, bob, price);
      const ICR_C = await troveManager.getCurrentICR(assetAddress1, carol, price);

      assert.isTrue(ICR_A.gt(TCR));
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));
      assert.isTrue(ICR_C.lt(mv._ICR100));

      const tx = await troveManager.batchLiquidateTroves(assetAddress1, [bob, alice]);

      const liquidationEvents = th.getAllEventsByName(tx, "TroveLiquidated");
      assert.equal(liquidationEvents.length, 1, "Not enough liquidations");

      // Confirm only Bob’s trove removed
      assert.isTrue(await sortedTroves.contains(assetAddress1, alice));
      assert.isFalse(await sortedTroves.contains(assetAddress1, bob));
      assert.isTrue(await sortedTroves.contains(assetAddress1, carol));

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(assetAddress1, bob))[TroveData.status], "3");
      // Confirm troves have status 'open' (Status enum element idx 1)
      assert.equal((await troveManager.Troves(assetAddress1, alice))[TroveData.status], "1");
      assert.equal((await troveManager.Troves(assetAddress1, carol))[TroveData.status], "1");
    });
  });

  context("Sequential liquidations", () => {
    const setup = async () => {
      const { collateral: A_coll, totalDebt: A_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(299, 16)),
        extraParams: { from: alice }
      });
      const { collateral: B_coll, totalDebt: B_totalDebt } = await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(298, 16)),
        extraParams: { from: bob }
      });

      const totalLiquidatedDebt = A_totalDebt.add(B_totalDebt);

      await openTrove({
        asset: assetAddress1,
        ICR: toBN(dec(300, 16)),
        extraKUSDAmount: totalLiquidatedDebt,
        extraParams: { from: whale }
      });
      await stabilityPoolAsset1.provideToSP(totalLiquidatedDebt, { from: whale });

      // Price drops
      await priceFeed.setPrice(assetAddress1, dec(100, 18));
      const price = await priceFeed.getPrice(assetAddress1);
      const TCR = await th.getTCR(contracts, assetAddress1);

      // Check Recovery Mode is active
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));

      // Check troves A, B are in range 110% < ICR < TCR, C is below 100%
      const ICR_A = await troveManager.getCurrentICR(assetAddress1, alice, price);
      const ICR_B = await troveManager.getCurrentICR(assetAddress1, bob, price);

      assert.isTrue(ICR_A.gt(mv._MCR) && ICR_A.lt(TCR));
      assert.isTrue(ICR_B.gt(mv._MCR) && ICR_B.lt(TCR));

      return {
        A_coll,
        A_totalDebt,
        B_coll,
        B_totalDebt,
        totalLiquidatedDebt,
        price
      };
    };

    it("First trove only doesn’t get out of Recovery Mode", async () => {
      await setup();
      const tx = await troveManager.liquidateTroves(assetAddress1, 1);

      const TCR = await th.getTCR(contracts, assetAddress1);
      assert.isTrue(await th.checkRecoveryMode(contracts, assetAddress1));
    });

    it("Two troves over MCR are liquidated", async () => {
      await setup();
      const tx = await troveManager.liquidateTroves(assetAddress1, 10);

      const liquidationEvents = th.getAllEventsByName(tx, "TroveLiquidated");
      assert.equal(liquidationEvents.length, 2, "Not enough liquidations");

      // Confirm all troves removed
      assert.isFalse(await sortedTroves.contains(assetAddress1, alice));
      assert.isFalse(await sortedTroves.contains(assetAddress1, bob));

      // Confirm troves have status 'closed by liquidation' (Status enum element idx 3)
      assert.equal((await troveManager.Troves(assetAddress1, alice))[TroveData.status], "3");
      assert.equal((await troveManager.Troves(assetAddress1, bob))[TroveData.status], "3");
    });
  });
});
