import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import { connectToDeployment, setUpInitialUserBalance } from "../testUtils"
import { mockAssetContracts } from "../testUtils/types"
import { STARTING_BALANCE } from "../testUtils/constants"

import {
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";

chai.use(chaiAsPromised);
chai.use(chaiSpies);

describe("EthersSendableKumo", async () => {
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


    describe("SendableEthersKumoMultiAsset", () => {
        for (const mockAssetContract of mockAssetContracts) {
            it(`should parse failed transactions without throwing ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                // By passing a gasLimit, we avoid automatic use of estimateGas which would throw
                const tx = await kumo.send.openTrove(
                    { depositCollateral: 0.01, borrowKUSD: 0.01 },
                    mockAssetAddress,
                    undefined,
                    { gasLimit: 1e6 }
                );
                const { status } = await tx.waitForReceipt();

                expect(status).to.equal("failed");
            });
        }
    });
});
