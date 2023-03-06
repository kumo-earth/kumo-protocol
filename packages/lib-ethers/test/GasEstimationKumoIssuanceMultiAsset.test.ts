import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
    Decimal,
    Trove
} from "@kumodao/lib-base";


import {
    PopulatedEthersKumoTransaction,
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { EthersKumo } from "../src/EthersKumo";
import { mockAssetContracts } from "../testUtils/types";
import { assertDefined, connectToDeployment, connectUsers, increaseTime, setUpInitialUserBalance, waitForSuccess } from "../testUtils";
import { STARTING_BALANCE } from "../testUtils/constants";


const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);


describe("EthersKumoGasEstimationKumoIssuanceMultiAsset", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;

    let deployerKumo: EthersKumo;
    let kumo: EthersKumo;

    let mockAssetAddress: string;

    const gasLimit = BigNumber.from(2500000);

    before(async function () {
        if (network.name !== "hardhat") {
            this.skip();
        }
        [deployer, funder, user, ...otherUsers] = await ethers.getSigners();

        deployment = await deployKumo(deployer);

        kumo = await connectToDeployment(deployment, user);

        expect(kumo).to.be.an.instanceOf(EthersKumo);

        [deployerKumo, kumo] = await connectUsers(deployment, [deployer, user]);

    });


    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`Gas estimation (KUMO issuance) Multi Asset ${mockAssetContract.name}`, () => {
            const estimate = (tx: PopulatedEthersKumoTransaction) =>
                provider.estimateGas(tx.rawPopulatedTransaction);

            before(() => {
                mockAssetAddress = deployment.addresses[mockAssetContract.contract];
            })

            // Always setup same initial balance for user
            beforeEach(async () => {
                const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

                await setUpInitialUserBalance(user, funder, gasLimit)
                expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
            });

            it(`should include enough gas for issuing KUMO ${mockAssetContract.name}`, async function () {
                this.timeout("1m");

                await kumo.openTrove(
                    { depositCollateral: 40, borrowKUSD: 4000 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );
                await kumo.depositKUSDInStabilityPool(19, mockAssetContract.name);

                await increaseTime(60);

                // This will issue KUMO for the first time ever. That uses a whole lotta gas, and we don't
                // want to pack any extra gas to prepare for this case specifically, because it only happens
                // once.
                await kumo.withdrawGainsFromStabilityPool(mockAssetContract.name);

                const claim = await kumo.populate.withdrawGainsFromStabilityPool(mockAssetContract.name);
                const deposit = await kumo.populate.depositKUSDInStabilityPool(1, mockAssetContract.name);
                const withdraw = await kumo.populate.withdrawKUSDFromStabilityPool(1, mockAssetContract.name);

                for (let i = 0; i < 5; ++i) {
                    for (const tx of [claim, deposit, withdraw]) {
                        const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
                        const requiredGas = (await estimate(tx)).toNumber();

                        assertDefined(gasLimit);
                        expect(requiredGas).to.be.at.most(gasLimit);
                    }
                    await increaseTime(60);
                }

                await waitForSuccess(claim.send());

                const creation = Trove.recreate(new Trove(Decimal.from(11.1), Decimal.from(2000.1)));

                await deployerKumo.openTrove(creation, mockAssetAddress, undefined, { gasLimit });
                await deployerKumo.depositKUSDInStabilityPool(creation.borrowKUSD, mockAssetContract.name);
                await deployerKumo.setPrice(mockAssetAddress, 198);

                const liquidateTarget = await kumo.populate.liquidate(mockAssetAddress, await deployer.getAddress());
                const liquidateMultiple = await kumo.populate.liquidateUpTo(mockAssetAddress, 40);

                for (let i = 0; i < 5; ++i) {
                    for (const tx of [liquidateTarget, liquidateMultiple]) {
                        const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
                        const requiredGas = (await estimate(tx)).toNumber();

                        assertDefined(gasLimit);
                        expect(requiredGas).to.be.at.most(gasLimit);
                    }

                    await increaseTime(60);
                }
                await waitForSuccess(liquidateMultiple.send());
            });

        });
    })
});
