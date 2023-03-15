import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, deployKumo } from "hardhat";

import {
    Decimal,
    Trove,
    Fees,
    KUSD_MINIMUM_DEBT,
} from "@kumodao/lib-base";

import { HintHelpers } from "../types";
import { connectToDeployment, setUpInitialUserBalance } from "../testUtils"
import { mockAssetContracts } from "../testUtils/types"
import { STARTING_BALANCE } from "../testUtils/constants"

import {
    PopulatableEthersKumo,
    _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { _KumoDeploymentJSON } from "../src/contracts";
import { EthersKumo } from "../src/EthersKumo";
import { ReadableEthersKumo } from "../src/ReadableEthersKumo";


chai.use(chaiAsPromised);
chai.use(chaiSpies);

describe("EthersKumoFindHintsCollateralratio", async () => {
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

    mockAssetContracts.forEach(async mockAssetContract => {
        describe(`findHintForCollateralRatioMultiAsset ${mockAssetContract.name}`, () => {
            it(`should pick the closest approx hint ${mockAssetContract.name}`, async () => {
                const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
                type Resolved<T> = T extends Promise<infer U> ? U : never;
                type ApproxHint = Resolved<ReturnType<HintHelpers["getApproxHint"]>>;

                const fakeHints: ApproxHint[] = [
                    { diff: BigNumber.from(3), hintAddress: "alice", latestRandomSeed: BigNumber.from(1111) },
                    { diff: BigNumber.from(4), hintAddress: "bob", latestRandomSeed: BigNumber.from(2222) },
                    { diff: BigNumber.from(1), hintAddress: "carol", latestRandomSeed: BigNumber.from(3333) },
                    { diff: BigNumber.from(2), hintAddress: "dennis", latestRandomSeed: BigNumber.from(4444) }
                ];

                const borrowerOperations = {
                    estimateGas: {
                        openTrove: () => Promise.resolve(BigNumber.from(1))
                    },
                    populateTransaction: {
                        openTrove: () => Promise.resolve({})
                    }
                };

                const hintHelpers = chai.spy.interface({
                    getApproxHint: () => Promise.resolve(fakeHints.shift())
                });

                const sortedTroves = chai.spy.interface({
                    findInsertPosition: () => Promise.resolve(["fake insert position"])
                });

                const fakeKumo = new PopulatableEthersKumo({
                    getNumberOfTroves: () => Promise.resolve(1000000),
                    getTotal: () => Promise.resolve(new Trove(Decimal.from(10), Decimal.ONE)),
                    getPrice: () => Promise.resolve(Decimal.ONE),
                    _getBlockTimestamp: () => Promise.resolve(0),
                    _getFeesFactory: () =>
                        Promise.resolve(() => new Fees(0, 0.99, 1, new Date(), new Date(), false)),

                    connection: {
                        signerOrProvider: user,
                        _contracts: {
                            borrowerOperations,
                            hintHelpers,
                            sortedTroves
                        }
                    }
                } as unknown as ReadableEthersKumo);

                const nominalCollateralRatio = Decimal.from(0.05);

                const params = Trove.recreate(new Trove(Decimal.from(1), KUSD_MINIMUM_DEBT));
                const trove = Trove.create(params);
                expect(`${trove._nominalCollateralRatio}`).to.equal(`${nominalCollateralRatio}`);

                await fakeKumo.openTrove(params, mockAssetAddress, undefined, { gasLimit });

                expect(hintHelpers.getApproxHint).to.have.been.called.exactly(4);
                expect(hintHelpers.getApproxHint).to.have.been.called.with(nominalCollateralRatio.hex);

                // returned latestRandomSeed should be passed back on the next call
                expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(1111));
                expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(2222));
                expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(3333));

                expect(sortedTroves.findInsertPosition).to.have.been.called.once;
                expect(sortedTroves.findInsertPosition).to.have.been.called.with(
                    nominalCollateralRatio.hex,
                    "carol"
                );
            });

        })
    })
});
