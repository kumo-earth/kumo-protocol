const deploymentHelper = require("../utils/deploymentHelpers.js");
const testHelpers = require("../utils/testHelpers.js");
const KUSDTokenTester = artifacts.require("./KUSDTokenTester.sol");

const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;
const assertRevert = th.assertRevert;
const mv = testHelpers.MoneyValues;
const timeValues = testHelpers.TimeValues;
const TroveData = testHelpers.TroveData;

/* NOTE: Some tests involving ETH redemption fees do not test for specific fee values.
 * Some only test that the fees are non-zero when they should occur.
 *
 * Specific ETH gain values will depend on the final fee schedule used, and the final choices for
 * the parameter BETA in the TroveManager, which is still TBD based on economic modelling.
 *
 */
contract("TroveManager - stakeDecline", async accounts => {
  const ZERO_ADDRESS = th.ZERO_ADDRESS;
  const [owner, A, B, C, D, E, F] = accounts.slice(0, 7);

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let priceFeed;
  let kusdToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let collSurplusPool;
  let defaultPool;
  let borrowerOperations;
  let hintHelpers;
  let KUMOContracts;
  let erc20Asset1;
  let erc20Asset2;

  let contracts;

  const getOpenTroveKUSDAmount = async (asset, totalDebt) =>
    th.getOpenTroveKUSDAmount(contracts, totalDebt, asset);

  const getSnapshotsRatio = async asset => {
    const ratio = (await troveManager.totalStakesSnapshot(asset))
      .mul(toBN(dec(1, 18)))
      .div(await troveManager.totalCollateralSnapshot(asset));

    return ratio;
  };

  beforeEach(async () => {
    contracts = await deploymentHelper.deployKumoCore();
    contracts.kusdToken = await KUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.stabilityPoolFactory.address,
      contracts.borrowerOperations.address
    );
    KUMOContracts = await deploymentHelper.deployKUMOContracts(
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

    kumoStaking = KUMOContracts.kumoStaking;
    kumoToken = KUMOContracts.kumoToken;
    communityIssuance = KUMOContracts.communityIssuance;
    lockupContractFactory = KUMOContracts.lockupContractFactory;
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
    await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 25);
    await deploymentHelper.mintMockAssets(erc20Asset2, accounts, 25);

    // Set KUSD mint cap to 1 trillion
    await contracts.kumoParameters.setKUSDMintCap(assetAddress1, dec(1, 30));
    await contracts.kumoParameters.setKUSDMintCap(assetAddress2, dec(1, 30));
  });

  it("A given trove's stake decline is negligible with adjustments and tiny liquidations", async () => {
    // Set KUSD mint cap to a lot
    await contracts.kumoParameters.setKUSDMintCap(assetAddress1, dec(1, 50));

    await priceFeed.setPrice(assetAddress1, dec(100, 18));

    // Make 1 mega troves A at ~50% total collateral
    await borrowerOperations.openTrove(
      assetAddress1,
      dec(2, 29),
      th._100pct,
      await getOpenTroveKUSDAmount(assetAddress1, dec(1, 31)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { from: A }
    );

    // Make 5 large troves B, C, D, E, F at ~10% total collateral
    await borrowerOperations.openTrove(
      assetAddress1,
      dec(4, 28),
      th._100pct,
      await getOpenTroveKUSDAmount(assetAddress1, dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { from: B }
    );
    await borrowerOperations.openTrove(
      assetAddress1,
      dec(4, 28),
      th._100pct,
      await getOpenTroveKUSDAmount(assetAddress1, dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { from: C }
    );
    await borrowerOperations.openTrove(
      assetAddress1,
      dec(4, 28),
      th._100pct,
      await getOpenTroveKUSDAmount(assetAddress1, dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { from: D }
    );
    await borrowerOperations.openTrove(
      assetAddress1,
      dec(4, 28),
      th._100pct,
      await getOpenTroveKUSDAmount(assetAddress1, dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { from: E }
    );
    await borrowerOperations.openTrove(
      assetAddress1,
      dec(4, 28),
      th._100pct,
      await getOpenTroveKUSDAmount(assetAddress1, dec(2, 30)),
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { from: F }
    );

    // Make 10 tiny troves at relatively negligible collateral (~1e-9 of total)
    const tinyTroves = accounts.slice(10, 20);
    for (account of tinyTroves) {
      await borrowerOperations.openTrove(
        assetAddress1,
        dec(2, 20),
        th._100pct,
        await getOpenTroveKUSDAmount(assetAddress1, dec(1, 22)),
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        { from: account }
      );
    }

    // liquidate 1 trove at ~50% total system collateral
    await priceFeed.setPrice(assetAddress1, dec(50, 18));
    assert.isTrue(
      await troveManager.checkRecoveryMode(assetAddress1, await priceFeed.getPrice(assetAddress1))
    );
    await troveManager.liquidate(assetAddress1, A);

    console.log(
      `totalStakesSnapshot after L1: ${await troveManager.totalStakesSnapshot(assetAddress1)}`
    );
    console.log(
      `totalCollateralSnapshot after L1: ${await troveManager.totalCollateralSnapshot(
        assetAddress1
      )}`
    );
    console.log(`Snapshots ratio after L1: ${await getSnapshotsRatio(assetAddress1)}`);
    console.log(
      `B pending ETH reward after L1: ${await troveManager.getPendingReward(assetAddress1, B)}`
    );
    console.log(
      `B stake after L1: ${(await troveManager.Troves(assetAddress1, B))[TroveData.stake]}`
    );

    // adjust trove B 1 wei: apply rewards
    await borrowerOperations.adjustTrove(
      assetAddress1,
      0,
      th._100pct,
      0,
      1,
      false,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { from: B }
    ); // B repays 1 wei
    console.log(
      `B stake after A1: ${(await troveManager.Troves(assetAddress1, B))[TroveData.stake]}`
    );
    console.log(`Snapshots ratio after A1: ${await getSnapshotsRatio(assetAddress1)}`);

    // Loop over tiny troves, and alternately:
    // - Liquidate a tiny trove
    // - Adjust B's collateral by 1 wei
    for (let [idx, trove] of tinyTroves.entries()) {
      await troveManager.liquidate(assetAddress1, trove);
      console.log(
        `B stake after L${idx + 2}: ${
          (await troveManager.Troves(assetAddress1, B))[TroveData.stake]
        }`
      );
      console.log(`Snapshots ratio after L${idx + 2}: ${await getSnapshotsRatio(assetAddress1)}`);
      await borrowerOperations.adjustTrove(
        assetAddress1,
        0,
        th._100pct,
        0,
        1,
        false,
        ZERO_ADDRESS,
        ZERO_ADDRESS,
        { from: B }
      ); // A repays 1 wei
      console.log(
        `B stake after A${idx + 2}: ${
          (await troveManager.Troves(assetAddress1, B))[TroveData.stake]
        }`
      );
    }
  });

  // TODO: stake decline for adjustments with sizable liquidations, for comparison
});
