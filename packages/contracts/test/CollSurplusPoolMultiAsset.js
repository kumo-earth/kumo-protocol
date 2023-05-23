const deploymentHelper = require("../utils/deploymentHelpers.js");
const testHelpers = require("../utils/testHelpers.js");
const NonPayable = artifacts.require("NonPayable.sol");

const th = testHelpers.TestHelper;
const dec = th.dec;
const toBN = th.toBN;
const mv = testHelpers.MoneyValues;
const timeValues = testHelpers.TimeValues;

const KUSDToken = artifacts.require("KUSDToken");

contract("CollSurplusPoolMultiAsset", async accounts => {
    const [owner, A, B, C, D, E] = accounts;

    const [bountyAddress, lpRewardsAddress, multisig] = accounts.slice(997, 1000);

    let borrowerOperations;
    let priceFeed;
    let collSurplusPool;
    let erc20Asset1;
    let contracts;
    let assetAddress1;
    let assetsData;

    const getOpenTroveKUSDAmount = async totalDebt => th.getOpenTroveKUSDAmount(contracts, totalDebt);
    const openTrove = async params => th.openTrove(contracts, params);

    before(async () => {
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
        erc20Asset2 = await deploymentHelper.deployERC20Asset("Carbon Token Y", "CTY");
        assetAddress1 = erc20Asset1.address;
        assetAddress2 = erc20Asset2.address;
        assetsData = [{ name: "ctx", contractAddress: assetAddress1 }, { name: "cty", contractAddress: assetAddress2 }]

        await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress1);
        await deploymentHelper.addNewAssetToSystem(contracts, KUMOContracts, assetAddress2);

        // Mint token to each acccount
        await deploymentHelper.mintMockAssets(erc20Asset1, accounts, 23);
        await deploymentHelper.mintMockAssets(erc20Asset2, accounts, 23);
    });


    it.only(`CollSurplusPool-MultiAsset`, async () => {
        describe(`CollSurplusPool-MultiAsset Outer Describe block to run For Loop`, () => {
            for (const asset of assetsData) {
                after(`Run after each test ${asset.name}`, async () => {
                    let totalBalance = toBN(dec(0, 18));
                    for await (const assetDt of assetsData) {
                        const assetAddress = assetDt.contractAddress;
                        const balance = await collSurplusPool.getAssetBalance(assetAddress);
                        totalBalance = totalBalance.add(balance)

                    }
                    assert.equal(`${totalBalance}`, "44000000000000000000");
                })

                it(`CollSurplusPool::getAssetBalance(): Returns the ETH balance of the CollSurplusPool after redemption ${asset.name}`, async () => {
                    const ETH_1 = await collSurplusPool.getAssetBalance(asset.contractAddress);
                    assert.equal(ETH_1, "0");

                    const price = toBN(dec(100, 18));
                    await priceFeed.setPrice(asset.contractAddress, price);

                    const { collateral: B_coll, netDebt: B_netDebt } = await openTrove({
                        asset: asset.contractAddress,
                        ICR: toBN(dec(200, 16)),
                        extraParams: { from: B }
                    });
                    await openTrove({
                        asset: asset.contractAddress,
                        tokenAmount: dec(3000, "ether"),
                        extraKUSDAmount: B_netDebt,
                        extraParams: { from: A }
                    });

                    // skip bootstrapping phase
                    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider);

                    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus
                    await th.redeemCollateralAndGetTxObject(asset.contractAddress, A, contracts, B_netDebt);

                    const ETH_2 = await collSurplusPool.getAssetBalance(asset.contractAddress);
                    th.assertIsApproximatelyEqual(ETH_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)));
                });

                it(`CollSurplusPool: claimColl(): Reverts if caller is not Borrower Operations ${asset.name}`, async () => {
                    await th.assertRevert(
                        collSurplusPool.claimColl(asset.contractAddress, A, { from: A }),
                        "CollSurplusPool: Caller is not Borrower Operations"
                    );
                });

                it(`CollSurplusPool: claimColl(): Reverts if nothing to claim ${asset.name}`, async () => {
                    await th.assertRevert(
                        borrowerOperations.claimCollateral(asset.contractAddress, { from: A }),
                        "CollSurplusPool: No collateral available to claim"
                    );
                });

                it.skip(`CollSurplusPool: claimColl(): Reverts if owner cannot receive ETH surplus ${asset.name}`, async () => {
                    const nonPayable = await NonPayable.new();

                    const price = toBN(dec(100, 18));
                    await priceFeed.setPrice(price);

                    // open trove from NonPayable proxy contract
                    const B_coll = toBN(dec(60, 18));
                    const B_kusdAmount = toBN(dec(3000, 18));
                    const B_netDebt = await th.getAmountWithBorrowingFee(contracts, B_kusdAmount);
                    const openTroveData = th.getTransactionData(
                        "openTrove(address,uint256,uint256,uint256,address,address)",
                        [asset.contractAddress, 0, "0xde0b6b3a7640000", web3.utils.toHex(B_kusdAmount), B, B]
                    );
                    await nonPayable.forward(borrowerOperations.address, openTroveData, { value: B_coll });
                    await openTrove({
                        extraKUSDAmount: B_netDebt,
                        extraParams: { from: A, value: dec(3000, "ether") }
                    });

                    // skip bootstrapping phase
                    await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider);

                    // At ETH:USD = 100, this redemption should leave 1 ether of coll surplus for B
                    await th.redeemCollateralAndGetTxObject(asset.contractAddress, A, contracts, B_netDebt);

                    const ETH_2 = await collSurplusPool.getAssetBalance(asset.contractAddress);
                    th.assertIsApproximatelyEqual(ETH_2, B_coll.sub(B_netDebt.mul(mv._1e18BN).div(price)));

                    const claimCollateralData = th.getTransactionData("claimCollateral()", [asset.contractAddress]);
                    await th.assertRevert(
                        nonPayable.forward(borrowerOperations.address, claimCollateralData),
                        "CollSurplusPool: sending Asset failed"
                    );
                });

                it(`CollSurplusPool: reverts trying to send ETH to it ${asset.name}`, async () => {
                    await th.assertRevert(
                        web3.eth.sendTransaction({ from: A, to: collSurplusPool.address, value: 1 }),
                        "CollSurplusPool: Caller is not Active Pool"
                    );
                });

                it(`CollSurplusPool: accountSurplus: reverts if caller is not Trove Manager ${asset.name}`, async () => {
                    await th.assertRevert(
                        collSurplusPool.accountSurplus(asset.contractAddress, A, 1),
                        "CollSurplusPool: Caller is not TroveManager"
                    );
                });

            }
        })
    })

});

contract("Reset chain state", async accounts => { });
