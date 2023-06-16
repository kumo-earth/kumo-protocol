import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
    Decimal,
    KUSD_MINIMUM_DEBT,
} from "@kumodao/lib-base";

import { assertStrictEqual, connectToDeployment, setUpInitialUserBalance } from "../testUtils"
import { mockAssetContracts } from "../testUtils/types"
import { STARTING_BALANCE } from "../testUtils/constants"

import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";

chai.use(chaiAsPromised);
chai.use(chaiSpies);

describe.only("EthersKumo", async () => {
    let deployer: Signer;
    let funder: Signer;
    let user: Signer;
    let otherUsers: Signer[];

    let deployment: _KumoDeploymentJSON;
    let kumo: EthersKumo;

    const gasLimit = BigNumber.from(2500000);

    before(async () => {
        [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
        deployment = await deployKumo(deployer);

        kumo = await connectToDeployment(deployment, user);

        expect(kumo).to.be.an.instanceOf(EthersKumo);

    });

    // Always setup same initial balance for user
    beforeEach(async () => {
        const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

        await setUpInitialUserBalance(user, funder, gasLimit)
        expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
    });

    describe("Frontend", () => {
        for (const mockAssetContract of mockAssetContracts) {
            it(`should have no frontend initially ${mockAssetContract.name}`, async () => {
                const frontend = await kumo.getFrontendStatus(mockAssetContract.name, await user.getAddress());

                assertStrictEqual(frontend.status, "unregistered" as const);
            });

            it(`should register a frontend ${mockAssetContract.name}`, async () => {
                await kumo.registerFrontend(mockAssetContract.name, 0.75);
            });

            it(`should have a frontend now ${mockAssetContract.name}`, async () => {
                const frontend = await kumo.getFrontendStatus(mockAssetContract.name, await user.getAddress());

                assertStrictEqual(frontend.status, "registered" as const);
                expect(`${frontend.kickbackRate}`).to.equal("0.75");
            });

            it(`other user's deposit should be tagged with the frontend's address ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                const frontendTag = await user.getAddress();

                await funder.sendTransaction({
                    to: otherUsers[0].getAddress(),
                    value: Decimal.from(20.1).hex
                });

                const otherKumo = await connectToDeployment(deployment, otherUsers[0], frontendTag);
                await otherKumo.openTrove(
                    { depositCollateral: 20, borrowKUSD: KUSD_MINIMUM_DEBT },
                    mockAssetAddress,
                    undefined,
                    { gasLimit }
                );

                await otherKumo.depositKUSDInStabilityPool(KUSD_MINIMUM_DEBT, mockAssetContract.name);

                const deposit = await otherKumo.getStabilityDeposit(mockAssetContract.name);
                expect(deposit.frontendTag).to.equal(frontendTag);
            });
        }
    });
});
