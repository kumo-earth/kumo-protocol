const Decimal = require("decimal.js");
const deploymentHelper = require("../utils/deploymentHelpers.js");
const { BNConverter } = require("../utils/BNConverter.js");
const testHelpers = require("../utils/testHelpers.js");
const { send } = require("@openzeppelin/test-helpers");

const KUMOStakingTester = artifacts.require("KUMOStakingTester");
const TroveManagerTester = artifacts.require("TroveManagerTester");
const NonPayable = artifacts.require("./NonPayable.sol");

const th = testHelpers.TestHelper;
const timeValues = testHelpers.TimeValues;
const dec = th.dec;
const assertRevert = th.assertRevert;

const toBN = th.toBN;
const ZERO = th.toBN("0");

const GAS_PRICE = 10000000;

/* NOTE: These tests do not test for specific ETH and KUSD gain values. They only test that the
 * gains are non-zero, occur when they should, and are in correct proportion to the user's stake.
 *
 * Specific ETH/KUSD gain values will depend on the final fee schedule used, and the final choices for
 * parameters BETA and MINUTE_DECAY_FACTOR in the TroveManager, which are still TBD based on economic
 * modelling.
 *
 */

contract("KUMOStaking revenue share tests", async accounts => {
  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  const [owner, A, B, C, D, E, F, G, whale] = accounts;

  let priceFeed;
  let kusdToken;
  let sortedTroves;
  let troveManager;
  let activePool;
  let stabilityPool;
  let defaultPool;
  let borrowerOperations;
  let kumoStaking;
  let kumoToken;
  let erc20Asset1;

  let contracts;

  const openTrove = async params => th.openTrove(contracts, params);

  beforeEach(async () => {
    contracts = await deploymentHelper.deployKumoCore();
    contracts = await deploymentHelper.deployKUSDTokenTester(contracts);
    const KUMOContracts = await deploymentHelper.deployKUMOTesterContractsHardhat(
      bountyAddress,
      lpRewardsAddress,
      multisig
    );

    await deploymentHelper.connectKUMOContracts(KUMOContracts);
    await deploymentHelper.connectCoreContracts(contracts, KUMOContracts);
    await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts);

    erc20Asset1 = await deploymentHelper.deployERC20Asset("Carbon Token X", "CTX");
    assetAddress1 = erc20Asset1.address;

    await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1);

    nonPayable = await NonPayable.new();
    priceFeed = contracts.priceFeedTestnet;
    kusdToken = contracts.kusdToken;
    sortedTroves = contracts.sortedTroves;
    troveManager = contracts.troveManager;
    activePool = contracts.activePool;
    stabilityPool = await deploymentHelper.getStabilityPoolByAsset(contracts, assetAddress1);
    defaultPool = contracts.defaultPool;
    borrowerOperations = contracts.borrowerOperations;
    hintHelpers = contracts.hintHelpers;
    kumoToken = KUMOContracts.kumoToken;
    kumoStaking = KUMOContracts.kumoStaking;
    await kumoToken.unprotectedMint(multisig, dec(5, 24));

    // Mint token to each acccount
    await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 20);
  });

  it("stake(): reverts if amount is zero", async () => {
    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // console.log(`A kumo bal: ${await kumoToken.balanceOf(A)}`)

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await assertRevert(kumoStaking.stake(0, { from: A }), "KUMOStaking: Amount must be non-zero");
  });

  it("ETH fee per KUMO staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // console.log(`A kumo bal: ${await kumoToken.balanceOf(A)}`)

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await kumoStaking.stake(dec(100, 18), { from: A });

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await kumoStaking.F_ASSETS(assetAddress1);
    assert.equal(F_ETH_Before, "0");

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3]);
    assert.isTrue(emittedETHFee.gt(toBN("0")));

    // Check ETH fee per unit staked has increased by correct amount
    const F_ETH_After = await kumoStaking.F_ASSETS(assetAddress1);

    // Expect fee per unit staked = fee/100, since there is 100 KUSD totalStaked
    const expected_F_ETH_After = emittedETHFee.div(toBN("100"));

    assert.isTrue(expected_F_ETH_After.eq(F_ETH_After));
  });

  it("ETH fee per KUMO staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // Check ETH fee per unit staked is zero
    const F_ETH_Before = await kumoStaking.F_ASSETS(assetAddress1);
    assert.equal(F_ETH_Before, "0");

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // check ETH fee emitted in event is non-zero
    const emittedETHFee = toBN((await th.getEmittedRedemptionValues(redemptionTx))[3]);
    assert.isTrue(emittedETHFee.gt(toBN("0")));

    // Check ETH fee per unit staked has not increased
    const F_ETH_After = await kumoStaking.F_ASSETS(assetAddress1);
    assert.equal(F_ETH_After, "0");
  });

  it("KUSD fee per KUMO staked increases when a redemption fee is triggered and totalStakes > 0", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await kumoStaking.stake(dec(100, 18), { from: A });

    // Check KUSD fee per unit staked is zero
    const F_KUSD_Before = await kumoStaking.F_ASSETS(assetAddress1);
    assert.equal(F_KUSD_Before, "0");

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate(assetAddress1);
    assert.isTrue(baseRate.gt(toBN("0")));

    // D draws debt
    const tx = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(27, 18), D, D, {
      from: D
    });

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(tx));
    assert.isTrue(emittedKUSDFee.gt(toBN("0")));

    // Check KUSD fee per unit staked has increased by correct amount
    const F_KUSD_After = await kumoStaking.F_KUSD();

    // Expect fee per unit staked = fee/100, since there is 100 KUSD totalStaked
    const expected_F_KUSD_After = emittedKUSDFee.div(toBN("100"));

    assert.isTrue(expected_F_KUSD_After.eq(F_KUSD_After));
  });

  it("KUSD fee per KUMO staked doesn't change when a redemption fee is triggered and totalStakes == 0", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // Check KUSD fee per unit staked is zero
    const F_KUSD_Before = await kumoStaking.F_ASSETS(assetAddress1);
    assert.equal(F_KUSD_Before, "0");

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // Check base rate is now non-zero
    const baseRate = await troveManager.baseRate(assetAddress1);
    assert.isTrue(baseRate.gt(toBN("0")));

    // D draws debt
    const tx = await borrowerOperations.withdrawKUSD(assetAddress1, th._100pct, dec(27, 18), D, D, {
      from: D
    });

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(tx));
    assert.isTrue(emittedKUSDFee.gt(toBN("0")));

    // Check KUSD fee per unit staked did not increase, is still zero
    const F_KUSD_After = await kumoStaking.F_KUSD();
    assert.equal(F_KUSD_After, "0");
  });

  it("KUMO Staking: A single staker earns all ETH and KUMO fees that occur", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await kumoStaking.stake(dec(100, 18), { from: A });

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3]);
    assert.isTrue(emittedETHFee_1.gt(toBN("0")));

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C);
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      C,
      contracts,
      dec(100, 18)
    );

    const C_BalAfterRedemption = await kusdToken.balanceOf(C);
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption));

    // check ETH fee 2 emitted in event is non-zero
    const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3]);
    assert.isTrue(emittedETHFee_2.gt(toBN("0")));

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(104, 18),
      D,
      D,
      { from: D }
    );

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1));
    assert.isTrue(emittedKUSDFee_1.gt(toBN("0")));

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(17, 18),
      B,
      B,
      { from: B }
    );

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2));
    assert.isTrue(emittedKUSDFee_2.gt(toBN("0")));

    const expectedTotalAsset1Gain = emittedETHFee_1.add(emittedETHFee_2);
    const expectedTotalKUSDGain = emittedKUSDFee_1.add(emittedKUSDFee_2);

    const A_Asset1Balance_Before = toBN(await erc20Asset1.balanceOf(A));
    const A_KUSDBalance_Before = toBN(await kusdToken.balanceOf(A));

    // A un-stakes
    await kumoStaking.unstake(dec(100, 18), { from: A, gasPrice: 0 });

    const A_Asset1Balance_After = toBN(await erc20Asset1.balanceOf(A));
    const A_KUSDBalance_After = toBN(await kusdToken.balanceOf(A));

    const A_Asset1Gain = A_Asset1Balance_After.sub(A_Asset1Balance_Before);
    const A_KUSDGain = A_KUSDBalance_After.sub(A_KUSDBalance_Before);

    assert.isAtMost(th.getDifference(expectedTotalAsset1Gain, A_Asset1Gain), 1000);
    assert.isAtMost(th.getDifference(expectedTotalKUSDGain, A_KUSDGain), 1000);
  });

  it("stake(): Top-up sends out all accumulated ETH and KUSD gains to the staker", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await kumoStaking.stake(dec(50, 18), { from: A });

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3]);
    assert.isTrue(emittedETHFee_1.gt(toBN("0")));

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C);
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      C,
      contracts,
      dec(100, 18)
    );

    const C_BalAfterRedemption = await kusdToken.balanceOf(C);
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption));

    // check ETH fee 2 emitted in event is non-zero
    const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3]);
    assert.isTrue(emittedETHFee_2.gt(toBN("0")));

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(104, 18),
      D,
      D,
      { from: D }
    );

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1));
    assert.isTrue(emittedKUSDFee_1.gt(toBN("0")));

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(17, 18),
      B,
      B,
      { from: B }
    );

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2));
    assert.isTrue(emittedKUSDFee_2.gt(toBN("0")));

    const expectedTotalAsset1Gain = emittedETHFee_1.add(emittedETHFee_2);
    const expectedTotalKUSDGain = emittedKUSDFee_1.add(emittedKUSDFee_2);

    const A_Asset1Balance_Before = toBN(await erc20Asset1.balanceOf(A));
    const A_KUSDBalance_Before = toBN(await kusdToken.balanceOf(A));

    // A tops up
    await kumoStaking.stake(dec(50, 18), { from: A, gasPrice: 0 });

    const A_Asset1Balance_After = toBN(await erc20Asset1.balanceOf(A));
    const A_KUSDBalance_After = toBN(await kusdToken.balanceOf(A));

    const A_Asset1Gain = A_Asset1Balance_After.sub(A_Asset1Balance_Before);
    const A_KUSDGain = A_KUSDBalance_After.sub(A_KUSDBalance_Before);

    assert.isAtMost(th.getDifference(expectedTotalAsset1Gain, A_Asset1Gain), 1000);
    assert.isAtMost(th.getDifference(expectedTotalKUSDGain, A_KUSDGain), 1000);
  });

  it("getPendingAsset1Gain(): Returns the staker's correct pending ETH gain", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await kumoStaking.stake(dec(50, 18), { from: A });

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3]);
    assert.isTrue(emittedETHFee_1.gt(toBN("0")));

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C);
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      C,
      contracts,
      dec(100, 18)
    );

    const C_BalAfterRedemption = await kusdToken.balanceOf(C);
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption));

    // check ETH fee 2 emitted in event is non-zero
    const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3]);
    assert.isTrue(emittedETHFee_2.gt(toBN("0")));

    const expectedTotalAsset1Gain = emittedETHFee_1.add(emittedETHFee_2);

    const A_Asset1Gain = await kumoStaking.getPendingAssetGain(assetAddress1, A);

    assert.isAtMost(th.getDifference(expectedTotalAsset1Gain, A_Asset1Gain), 1000);
  });

  it("getPendingKUSDGain(): Returns the staker's correct pending KUSD gain", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });

    // A makes stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await kumoStaking.stake(dec(50, 18), { from: A });

    const B_BalBeforeREdemption = await kusdToken.balanceOf(B);
    // B redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(100, 18)
    );

    const B_BalAfterRedemption = await kusdToken.balanceOf(B);
    assert.isTrue(B_BalAfterRedemption.lt(B_BalBeforeREdemption));

    // check ETH fee 1 emitted in event is non-zero
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3]);
    assert.isTrue(emittedETHFee_1.gt(toBN("0")));

    const C_BalBeforeREdemption = await kusdToken.balanceOf(C);
    // C redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      C,
      contracts,
      dec(100, 18)
    );

    const C_BalAfterRedemption = await kusdToken.balanceOf(C);
    assert.isTrue(C_BalAfterRedemption.lt(C_BalBeforeREdemption));

    // check ETH fee 2 emitted in event is non-zero
    const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3]);
    assert.isTrue(emittedETHFee_2.gt(toBN("0")));

    // D draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(104, 18),
      D,
      D,
      { from: D }
    );

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1));
    assert.isTrue(emittedKUSDFee_1.gt(toBN("0")));

    // B draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(17, 18),
      B,
      B,
      { from: B }
    );

    // Check KUSD fee value in event is non-zero
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2));
    assert.isTrue(emittedKUSDFee_2.gt(toBN("0")));

    const expectedTotalKUSDGain = emittedKUSDFee_1.add(emittedKUSDFee_2);
    const A_KUSDGain = await kumoStaking.getPendingKUSDGain(A);

    assert.isAtMost(th.getDifference(expectedTotalKUSDGain, A_KUSDGain), 1000);
  });

  // // - multi depositors, several rewards
  it("KUMO Staking: Multiple stakers earn the correct share of all Asset and KUMO fees, based on their stake size", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(10000, 18)),
      ICR: toBN(dec(10, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: E }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: F }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: G }
    });

    // FF time one year so owner can transfer KUMO
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A, B, C
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });
    await kumoToken.transfer(B, dec(200, 18), { from: multisig });
    await kumoToken.transfer(C, dec(300, 18), { from: multisig });

    // A, B, C make stake
    await kumoToken.approve(kumoStaking.address, dec(100, 18), { from: A });
    await kumoToken.approve(kumoStaking.address, dec(200, 18), { from: B });
    await kumoToken.approve(kumoStaking.address, dec(300, 18), { from: C });
    await kumoStaking.stake(dec(100, 18), { from: A });
    await kumoStaking.stake(dec(200, 18), { from: B });
    await kumoStaking.stake(dec(300, 18), { from: C });

    // Confirm staking contract holds 600 KUMO
    // console.log(`kumo staking KUMO bal: ${await kumoToken.balanceOf(kumoStaking.address)}`)
    assert.equal(await kumoToken.balanceOf(kumoStaking.address), dec(600, 18));
    assert.equal(await kumoStaking.totalKUMOStaked(), dec(600, 18));

    // F redeems
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      F,
      contracts,
      dec(45, 18)
    );
    const emittedETHFee_1 = toBN((await th.getEmittedRedemptionValues(redemptionTx_1))[3]);
    assert.isTrue(emittedETHFee_1.gt(toBN("0")));

    // G redeems
    const redemptionTx_2 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      G,
      contracts,
      dec(197, 18)
    );
    const emittedETHFee_2 = toBN((await th.getEmittedRedemptionValues(redemptionTx_2))[3]);
    assert.isTrue(emittedETHFee_2.gt(toBN("0")));

    // F draws debt
    const borrowingTx_1 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(104, 18),
      F,
      F,
      { from: F }
    );
    const emittedKUSDFee_1 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_1));
    assert.isTrue(emittedKUSDFee_1.gt(toBN("0")));

    // G draws debt
    const borrowingTx_2 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(17, 18),
      G,
      G,
      { from: G }
    );
    const emittedKUSDFee_2 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_2));
    assert.isTrue(emittedKUSDFee_2.gt(toBN("0")));

    // D obtains KUMO from owner and makes a stake
    await kumoToken.transfer(D, dec(50, 18), { from: multisig });
    await kumoToken.approve(kumoStaking.address, dec(50, 18), { from: D });
    await kumoStaking.stake(dec(50, 18), { from: D });

    // Confirm staking contract holds 650 KUMO
    assert.equal(await kumoToken.balanceOf(kumoStaking.address), dec(650, 18));
    assert.equal(await kumoStaking.totalKUMOStaked(), dec(650, 18));

    // G redeems
    const redemptionTx_3 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      C,
      contracts,
      dec(197, 18)
    );
    const emittedETHFee_3 = toBN((await th.getEmittedRedemptionValues(redemptionTx_3))[3]);
    assert.isTrue(emittedETHFee_3.gt(toBN("0")));

    // G draws debt
    const borrowingTx_3 = await borrowerOperations.withdrawKUSD(
      assetAddress1,
      th._100pct,
      dec(17, 18),
      G,
      G,
      { from: G }
    );
    const emittedKUSDFee_3 = toBN(th.getKUSDFeeFromKUSDBorrowingEvent(borrowingTx_3));
    assert.isTrue(emittedKUSDFee_3.gt(toBN("0")));

    /*  
    Expected rewards:

    A_ETH: (100* ETHFee_1)/600 + (100* ETHFee_2)/600 + (100*ETH_Fee_3)/650
    B_ETH: (200* ETHFee_1)/600 + (200* ETHFee_2)/600 + (200*ETH_Fee_3)/650
    C_ETH: (300* ETHFee_1)/600 + (300* ETHFee_2)/600 + (300*ETH_Fee_3)/650
    D_ETH:                                             (100*ETH_Fee_3)/650

    A_KUSD: (100*KUSDFee_1 )/600 + (100* KUSDFee_2)/600 + (100*KUSDFee_3)/650
    B_KUSD: (200* KUSDFee_1)/600 + (200* KUSDFee_2)/600 + (200*KUSDFee_3)/650
    C_KUSD: (300* KUSDFee_1)/600 + (300* KUSDFee_2)/600 + (300*KUSDFee_3)/650
    D_KUSD:                                               (100*KUSDFee_3)/650
    */

    // Expected ETH gains
    const expectedAsset1Gain_A = toBN("100")
      .mul(emittedETHFee_1)
      .div(toBN("600"))
      .add(toBN("100").mul(emittedETHFee_2).div(toBN("600")))
      .add(toBN("100").mul(emittedETHFee_3).div(toBN("650")));

    const expectedAsset1Gain_B = toBN("200")
      .mul(emittedETHFee_1)
      .div(toBN("600"))
      .add(toBN("200").mul(emittedETHFee_2).div(toBN("600")))
      .add(toBN("200").mul(emittedETHFee_3).div(toBN("650")));

    const expectedAsset1Gain_C = toBN("300")
      .mul(emittedETHFee_1)
      .div(toBN("600"))
      .add(toBN("300").mul(emittedETHFee_2).div(toBN("600")))
      .add(toBN("300").mul(emittedETHFee_3).div(toBN("650")));

    const expectedAsset1Gain_D = toBN("50").mul(emittedETHFee_3).div(toBN("650"));

    // Expected KUSD gains:
    const expectedKUSDGain_A = toBN("100")
      .mul(emittedKUSDFee_1)
      .div(toBN("600"))
      .add(toBN("100").mul(emittedKUSDFee_2).div(toBN("600")))
      .add(toBN("100").mul(emittedKUSDFee_3).div(toBN("650")));

    const expectedKUSDGain_B = toBN("200")
      .mul(emittedKUSDFee_1)
      .div(toBN("600"))
      .add(toBN("200").mul(emittedKUSDFee_2).div(toBN("600")))
      .add(toBN("200").mul(emittedKUSDFee_3).div(toBN("650")));

    const expectedKUSDGain_C = toBN("300")
      .mul(emittedKUSDFee_1)
      .div(toBN("600"))
      .add(toBN("300").mul(emittedKUSDFee_2).div(toBN("600")))
      .add(toBN("300").mul(emittedKUSDFee_3).div(toBN("650")));

    const expectedKUSDGain_D = toBN("50").mul(emittedKUSDFee_3).div(toBN("650"));

    const A_Asset1Balance_Before = toBN(await erc20Asset1.balanceOf(A));
    const A_KUSDBalance_Before = toBN(await kusdToken.balanceOf(A));
    const B_Asset1Balance_Before = toBN(await erc20Asset1.balanceOf(B));
    const B_KUSDBalance_Before = toBN(await kusdToken.balanceOf(B));
    const C_Asset1Balance_Before = toBN(await erc20Asset1.balanceOf(C));
    const C_KUSDBalance_Before = toBN(await kusdToken.balanceOf(C));
    const D_Asset1Balance_Before = toBN(await erc20Asset1.balanceOf(D));
    const D_KUSDBalance_Before = toBN(await kusdToken.balanceOf(D));

    // A-D un-stake
    await kumoStaking.unstake(dec(100, 18), { from: A, gasPrice: 0 });
    await kumoStaking.unstake(dec(200, 18), { from: B, gasPrice: 0 });
    await kumoStaking.unstake(dec(400, 18), { from: C, gasPrice: 0 });
    await kumoStaking.unstake(dec(50, 18), { from: D, gasPrice: 0 });

    // Confirm all depositors could withdraw

    //Confirm pool Size is now 0
    assert.equal(await kumoToken.balanceOf(kumoStaking.address), "0");
    assert.equal(await kumoStaking.totalKUMOStaked(), "0");

    // Get A-D ETH and KUSD balances
    const A_Asset1Balance_After = toBN(await erc20Asset1.balanceOf(A));
    const A_KUSDBalance_After = toBN(await kusdToken.balanceOf(A));
    const B_Asset1Balance_After = toBN(await erc20Asset1.balanceOf(B));
    const B_KUSDBalance_After = toBN(await kusdToken.balanceOf(B));
    const C_Asset1Balance_After = toBN(await erc20Asset1.balanceOf(C));
    const C_KUSDBalance_After = toBN(await kusdToken.balanceOf(C));
    const D_Asset1Balance_After = toBN(await erc20Asset1.balanceOf(D));
    const D_KUSDBalance_After = toBN(await kusdToken.balanceOf(D));

    // Get ETH and KUSD gains
    const A_Asset1Gain = A_Asset1Balance_After.sub(A_Asset1Balance_Before);
    const A_KUSDGain = A_KUSDBalance_After.sub(A_KUSDBalance_Before);
    const B_Asset1Gain = B_Asset1Balance_After.sub(B_Asset1Balance_Before);
    const B_KUSDGain = B_KUSDBalance_After.sub(B_KUSDBalance_Before);
    const C_Asset1Gain = C_Asset1Balance_After.sub(C_Asset1Balance_Before);
    const C_KUSDGain = C_KUSDBalance_After.sub(C_KUSDBalance_Before);
    const D_Asset1Gain = D_Asset1Balance_After.sub(D_Asset1Balance_Before);
    const D_KUSDGain = D_KUSDBalance_After.sub(D_KUSDBalance_Before);

    // Check gains match expected amounts
    assert.isAtMost(th.getDifference(expectedAsset1Gain_A, A_Asset1Gain), 1000);
    assert.isAtMost(th.getDifference(expectedKUSDGain_A, A_KUSDGain), 1000);
    assert.isAtMost(th.getDifference(expectedAsset1Gain_B, B_Asset1Gain), 1000);
    assert.isAtMost(th.getDifference(expectedKUSDGain_B, B_KUSDGain), 1000);
    assert.isAtMost(th.getDifference(expectedAsset1Gain_C, C_Asset1Gain), 1000);
    assert.isAtMost(th.getDifference(expectedKUSDGain_C, C_KUSDGain), 1000);
    assert.isAtMost(th.getDifference(expectedAsset1Gain_D, D_Asset1Gain), 1000);
    assert.isAtMost(th.getDifference(expectedKUSDGain_D, D_KUSDGain), 1000);
  });

  // Transaction doesn't revert anymore because there won't be ETH sent. Other ERC20 assets will always be accepted
  it.skip("unstake(): reverts if caller has ETH gains and can't receive ETH", async () => {
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: whale }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(20000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: A }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(30000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(40000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: C }
    });
    await openTrove({
      asset: assetAddress1,
      extraKUSDAmount: toBN(dec(50000, 18)),
      ICR: toBN(dec(2, 18)),
      extraParams: { from: D }
    });

    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_YEAR, web3.currentProvider);

    // multisig transfers KUMO to staker A and the non-payable proxy
    await kumoToken.transfer(A, dec(100, 18), { from: multisig });
    await kumoToken.transfer(nonPayable.address, dec(100, 18), { from: multisig });

    //  A makes stake
    const A_stakeTx = await kumoStaking.stake(dec(100, 18), { from: A });
    assert.isTrue(A_stakeTx.receipt.status);
    console.log("stake");
    //  A tells proxy to make a stake
    const proxyApproveTxData = await th.getTransactionData("approve(address,uint256)", [
      kumoStaking.address,
      "0x56bc75e2d63100000"
    ]); // proxy stakes 100 VSTA
    await nonPayable.forward(kumoToken.address, proxyApproveTxData, { from: A });

    const proxystakeTxData = await th.getTransactionData("stake(uint256)", ["0x56bc75e2d63100000"]); // proxy stakes 100 KUMO
    await nonPayable.forward(kumoStaking.address, proxystakeTxData, { from: A });
    console.log("stake 2");

    // B makes a redemption, creating ETH gain for proxy
    const redemptionTx_1 = await th.redeemCollateralAndGetTxObject(
      assetAddress1,
      B,
      contracts,
      dec(45, 18)
    );

    const proxy_Asset1Gain = await kumoStaking.getPendingAssetGain(
      assetAddress1,
      nonPayable.address
    );
    assert.isTrue(proxy_Asset1Gain.gt(toBN("0")));
    console.log("GetpendingAssetGain");
    // Expect this tx to revert: stake() tries to send nonPayable proxy's accumulated ETH gain (albeit 0),
    //  A tells proxy to unstake
    const proxyUnStakeTxData = await th.getTransactionData("unstake(uint256)", [
      "0x56bc75e2d63100000"
    ]); // proxy stakes 100 KUMO
    const proxyUnstakeTxPromise = nonPayable.forward(kumoStaking.address, proxyUnStakeTxData, {
      from: A
    });

    // but nonPayable proxy can not accept ETH - therefore stake() reverts.
    await assertRevert(proxyUnstakeTxPromise);
  });

  it("receive(): reverts when it receives erc20 token from an address that is not the Active Pool", async () => {
    const asset1SendTxPromise1 = kumoStaking.receivedERC20(kumoStaking.address, dec(1, "ether"), {
      from: A
    });
    const asset1SendTxPromise2 = kumoStaking.receivedERC20(kumoStaking.address, dec(1, "ether"), {
      from: owner
    });

    await assertRevert(asset1SendTxPromise1);
    await assertRevert(asset1SendTxPromise2);
  });

  it("unstake(): reverts if user has no stake", async () => {
    const unstakeTxPromise1 = kumoStaking.unstake(1, { from: A });
    const unstakeTxPromise2 = kumoStaking.unstake(1, { from: owner });

    await assertRevert(unstakeTxPromise1);
    await assertRevert(unstakeTxPromise2);
  });

  it("Test requireCallerIsTroveManager", async () => {
    const kumoStakingTester = await KUMOStakingTester.new();
    await assertRevert(
      kumoStakingTester.requireCallerIsTroveManager(),
      "KUMOStaking: caller is not TroveM"
    );
  });
});
