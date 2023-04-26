const deploymentHelper = require("../utils/deploymentHelpers.js");
const testHelpers = require("../utils/testHelpers.js");
const NonPayable = artifacts.require("NonPayable.sol");

const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;
const mv = testHelpers.MoneyValues;
const timeValues = testHelpers.TimeValues;

const KUSDToken = artifacts.require("KUSDToken");

contract("CollSurplusPool", async accounts => {
  const [owner, A, B, C, D, E] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

  let borrowerOperations;
  let priceFeed;
  let collSurplusPool;
  let erc20Asset1;
  let contracts;
  let assetAddress1;

  const getOpenTroveKUSDAmount = async totalDebt => th.getOpenTroveKUSDAmount(contracts, totalDebt);
  const openTrove = async params => th.openTrove(contracts, params);

  beforeEach(async () => {
    contracts = await deploymentHelper.deployKumoCore();

    contracts.kusdToken = await KUSDToken.new(
      contracts.troveManager.address,
      contracts.stabilityPoolFactory.address,
      contracts.borrowerOperations.address
    );
    const KUMOContracts = await deploymentHelper.deployKUMOContracts(
      bountyAddress,
      lpRewardsAddress,
      multisig
    );

    priceFeed = contracts.priceFeedTestnet;
    collSurplusPool = contracts.collSurplusPool;
    borrowerOperations = contracts.borrowerOperations;

    await deploymentHelper.connectKUMOContracts(KUMOContracts);
    await deploymentHelper.connectCoreContracts(contracts, KUMOContracts);
    await deploymentHelper.connectKUMOContractsToCore(KUMOContracts, contracts);

    erc20Asset1 = await deploymentHelper.deployERC20Asset("Carbon Token X", "CTX");
    assetAddress1 = erc20Asset1.address;

    await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1);

    // Mint token to each acccount
    await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 23);
  });

  it("CollSurplusPool::getAssetBalance(): Returns the ETH balance of the CollSurplusPool after redemption", async () => {
    const ETH_1 = await collSurplusPool.getAssetBalance(assetAddress1);
    assert.equal(ETH_1, "0");

    const price = toBN(dec(100, 18));
    await priceFeed.setPrice(assetAddress1, price);

    const { collateral: B_coll, netDebt: B_netDebt } = await openTrove({
      asset: assetAddress1,
      ICR: toBN(dec(200, 16)),
      extraParams: { from: B }
    });
    await openTrove({
      asset: assetAddress1,
      tokenAmount: dec(3000, "ether"),
      extraKUSDAmount: B_netDebt,
      extraParams: { from: A }
    });

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider);

    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus
    await th.redeemCollateralAndGetTxObject(assetAddress1, A, contracts, B_netDebt);

    const ETH_2 = await collSurplusPool.getAssetBalance(assetAddress1);
    th.assertIsApproximatelyEqual(ETH_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)));
  });

  it("CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations", async () => {
    await th.assertRevert(
      collSurplusPool.claimColl(assetAddress1, A, { from: A }),
      "CollSurplusPool: Caller is not Borrower Operations"
    );
  });

  it("CollSurplusPool: claimColl(): Reverts if nothing to claim", async () => {
    await th.assertRevert(
      borrowerOperations.claimCollateral(assetAddress1, { from: A }),
      "CollSurplusPool: No collateral available to claim"
    );
  });

  it.skip("CollSurplusPool: claimColl(): Reverts if owner cannot receive ETH surplus", async () => {
    const nonPayable = await NonPayable.new();

    const price = toBN(dec(100, 18));
    await priceFeed.setPrice(price);

    // open trove from NonPayable proxy contract
    const B_coll = toBN(dec(60, 18));
    const B_kusdAmount = toBN(dec(3000, 18));
    const B_netDebt = await th.getAmountWithBorrowingFee(contracts, B_kusdAmount);
    const openTroveData = th.getTransactionData(
      "openTrove(address,uint256,uint256,uint256,address,address)",
      [assetAddress1, 0, "0xde0b6b3a7640000", web3.utils.toHex(B_kusdAmount), B, B]
    );
    await nonPayable.forward(borrowerOperations.address, openTroveData, { value: B_coll });
    await openTrove({
      extraKUSDAmount: B_netDebt,
      extraParams: { from: A, value: dec(3000, "ether") }
    });

    // skip bootstrapping phase
    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider);

    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus for B
    await th.redeemCollateralAndGetTxObject(assetAddress1, A, contracts, B_netDebt);

    const ETH_2 = await collSurplusPool.getAssetBalance(assetAddress1);
    th.assertIsApproximatelyEqual(ETH_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)));

    const claimCollateralData = th.getTransactionData("claimCollateral()", [assetAddress1]);
    await th.assertRevert(
      nonPayable.forward(borrowerOperations.address, claimCollateralData),
      "CollSurplusPool: sending Asset failed"
    );
  });

  it("CollSurplusPool: reverts trying to send ETH to it", async () => {
    await th.assertRevert(
      web3.eth.sendTransaction({ from: A, to: collSurplusPool.address, value: 1 }),
      "CollSurplusPool: Caller is not Active Pool"
    );
  });

  it("CollSurplusPool: accountSurplus: reverts if caller is not Trove Manager", async () => {
    await th.assertRevert(
      collSurplusPool.accountSurplus(assetAddress1, A, 1),
      "CollSurplusPool: Caller is not TroveManager"
    );
  });
});

contract("Reset chain state", async accounts => {});
