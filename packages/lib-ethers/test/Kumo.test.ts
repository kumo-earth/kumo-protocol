import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { AddressZero } from "@ethersproject/constants";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployKumo } from "hardhat";

import {
  Decimal,
  Decimalish,
  Trove,
  StabilityDeposit,
  KumoReceipt,
  SuccessfulReceipt,
  SentKumoTransaction,
  TroveCreationParams,
  Fees,
  KUSD_LIQUIDATION_RESERVE,
  MAXIMUM_BORROWING_RATE,
  MINIMUM_BORROWING_RATE,
  KUSD_MINIMUM_DEBT,
  KUSD_MINIMUM_NET_DEBT
} from "@kumodao/lib-base";

import { HintHelpers } from "../types";

import {
  PopulatableEthersKumo,
  PopulatedEthersKumoTransaction,
  _redeemMaxIterations
} from "../src/PopulatableEthersKumo";

import { EthersTransactionReceipt } from "../src/types";
import { _KumoDeploymentJSON } from "../src/contracts";
import { _connectToDeployment } from "../src/EthersKumoConnection";
import { EthersKumo } from "../src/EthersKumo";
import { ReadableEthersKumo } from "../src/ReadableEthersKumo";


const ERC20ABI = require("../abi/ERC20Test.json")

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);

const STARTING_BALANCE = Decimal.from(1000);

// Extra ETH sent to users to be spent on gas
const GAS_BUDGET = Decimal.from(0.1); // ETH

const getGasCost = (tx: EthersTransactionReceipt) => tx.gasUsed.mul(tx.effectiveGasPrice);

const connectToDeployment = async (
  deployment: _KumoDeploymentJSON,
  signer: Signer,
  frontendTag?: string
) =>
  EthersKumo._from(
    _connectToDeployment(deployment, signer, {
      userAddress: await signer.getAddress(),
      frontendTag
    })
  );

const increaseTime = async (timeJumpSeconds: number) => {
  await provider.send("evm_increaseTime", [timeJumpSeconds]);
};

function assertStrictEqual<T, U extends T>(
  actual: T,
  expected: U,
  message?: string
): asserts actual is U {
  assert.strictEqual(actual, expected, message);
}

function assertDefined<T>(actual: T | undefined): asserts actual is T {
  assert(actual !== undefined);
}

const waitForSuccess = async <T extends KumoReceipt>(
  tx: Promise<SentKumoTransaction<unknown, T>>
) => {
  const receipt = await (await tx).waitForReceipt();
  assertStrictEqual(receipt.status, "succeeded" as const);

  return receipt as Extract<T, SuccessfulReceipt>;
};

const mockAssetContracts = [{ name: "ctx", contract: "mockAsset1" }, { name: "cty", contract: "mockAsset2" }] as const

interface MockAssets {
  assetName: string, assetAddress: string, assetContract: any
}

// TODO make the testcases isolated

describe("EthersKumo", async () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let deployment: _KumoDeploymentJSON;

  let deployerKumo: EthersKumo;
  let kumo: EthersKumo;
  let otherKumos: EthersKumo[];
  let mockAssets: MockAssets[] = []


  let mockAssetAddress1: string;
  let mockAsset1: any;

  let mockAssetName1: string;
  mockAssetName1 = "ctx";

  const gasLimit = BigNumber.from(2500000);



  const connectUsers = (users: Signer[]) =>
    Promise.all(users.map(user => connectToDeployment(deployment, user)));



  const openTroves = (users: Signer[], params: TroveCreationParams<Decimalish>[], mockAssetAddress1: string) =>
    params
      .map(
        (params, i) => () =>
          Promise.all([
            connectToDeployment(deployment, users[i]),
            sendTo(users[i], 0.1).then(tx => tx.wait())
          ]).then(async ([kumo]) => {
            await kumo.openTrove(params, mockAssetAddress1, undefined, { gasLimit });
          })
      )
      .reduce((a, b) => a.then(b), Promise.resolve());

  const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
    funder.sendTransaction({
      to: user.getAddress(),
      value: Decimal.from(value).add(GAS_BUDGET).hex,
      nonce
    });

  const sendToEach = async (users: Signer[], value: Decimalish) => {
    const txCount = await provider.getTransactionCount(funder.getAddress());
    const txs = await Promise.all(users.map((user, i) => sendTo(user, value, txCount + i)));

    // Wait for the last tx to be mined.
    await txs[txs.length - 1].wait();
  };

  before(async () => {
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    deployment = await deployKumo(deployer);
    mockAssets = mockAssetContracts.map(assetCont => {
      const mockAssetAddress = deployment.addresses[assetCont.contract];
      const mockAsset = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
      return { assetName: assetCont.name, assetAddress: mockAssetAddress, assetContract: mockAsset }
    })
    kumo = await connectToDeployment(deployment, user);

    expect(kumo).to.be.an.instanceOf(EthersKumo);

  });

  // Always setup same initial balance for user
  beforeEach(async () => {
    const targetBalance = BigNumber.from(STARTING_BALANCE.hex);

    const gasPrice = BigNumber.from(100e9); // 100 Gwei

    const balance = await user.getBalance();
    const txCost = gasLimit.mul(gasPrice);

    if (balance.eq(targetBalance)) {
      return;
    }

    if (balance.gt(targetBalance) && balance.lte(targetBalance.add(txCost))) {
      await funder.sendTransaction({
        to: user.getAddress(),
        value: targetBalance.add(txCost).sub(balance).add(1),
        gasLimit,
        gasPrice
      });

      await user.sendTransaction({
        to: funder.getAddress(),
        value: 1,
        gasLimit,
        gasPrice
      });
    } else {
      if (balance.lt(targetBalance)) {
        await funder.sendTransaction({
          to: user.getAddress(),
          value: targetBalance.sub(balance),
          gasLimit,
          gasPrice
        });
      } else {
        await user.sendTransaction({
          to: funder.getAddress(),
          value: balance.sub(targetBalance).sub(txCost),
          gasLimit,
          gasPrice
        });
      }
    }

    expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
  });


  describe("shouldGetPrice", () => {
    for (const mockAssetContract of mockAssetContracts) {
      it(`should get the price ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const price = await kumo.getPrice(mockAssetAddress);
        expect(price).to.be.an.instanceOf(Decimal);
      });
    }
  })

  describe("findHintForCollateralRatio", () => {
    for (const mockAssetContract of mockAssetContracts) {
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
    }
  });


  describe("Trove", () => {
    for (const mockAssetContract of mockAssetContracts) {
      it(`should have no Trove initially ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const trove = await kumo.getTrove(mockAssetAddress);
        expect(trove.isEmpty).to.be.true;
      });

      it(`should fail to create an undercollateralized Trove ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const price = await kumo.getPrice(mockAssetAddress);
        const undercollateralized = new Trove(KUSD_MINIMUM_DEBT.div(price), KUSD_MINIMUM_DEBT);
        await expect(kumo.openTrove(Trove.recreate(undercollateralized), mockAssetAddress)).to
          .eventually.be.rejected;
      });

      it(`should fail to create a Trove with too little debt ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const withTooLittleDebt = new Trove(Decimal.from(50), KUSD_MINIMUM_DEBT.sub(1));

        await expect(kumo.openTrove(Trove.recreate(withTooLittleDebt), mockAssetAddress)).to
          .eventually.be.rejected;
      });

      const withSomeBorrowing = { depositCollateral: 50, borrowKUSD: KUSD_MINIMUM_NET_DEBT.add(100) };

      it(`should create a Trove with some borrowing ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const { newTrove, fee } = await kumo.openTrove(
          withSomeBorrowing,
          mockAssetAddress,
          undefined,
          { gasLimit }
        );
        expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing));
        expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(withSomeBorrowing.borrowKUSD)}`);
      });

      it(`should fail to withdraw all the collateral while the Trove has debt ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const trove = await kumo.getTrove(mockAssetAddress);
        await expect(kumo.withdrawCollateral(mockAssetAddress, trove.collateral)).to.eventually.be.rejected;
      });

      const repaySomeDebt = { repayKUSD: 10 };

      it(`should repay some debt ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const { newTrove, fee } = await kumo.repayKUSD(mockAssetAddress, repaySomeDebt.repayKUSD);
        expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing).adjust(repaySomeDebt));
        expect(`${fee}`).to.equal("0");
      });

      const borrowSomeMore = { borrowKUSD: 20 };

      it(`should borrow some more ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const { newTrove, fee } = await kumo.borrowKUSD(mockAssetAddress, borrowSomeMore.borrowKUSD);
        expect(newTrove).to.deep.equal(
          Trove.create(withSomeBorrowing).adjust(repaySomeDebt).adjust(borrowSomeMore)
        );
        expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowSomeMore.borrowKUSD)}`);
      });

      const depositMoreCollateral = { depositCollateral: 1 };

      it(`should deposit more collateral ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const { newTrove } = await kumo.depositCollateral(
          mockAssetAddress,
          depositMoreCollateral.depositCollateral
        );
        expect(newTrove).to.deep.equal(
          Trove.create(withSomeBorrowing)
            .adjust(repaySomeDebt)
            .adjust(borrowSomeMore)
            .adjust(depositMoreCollateral)
        );
      });

      const repayAndWithdraw = { repayKUSD: 60, withdrawCollateral: 0.5 };

      it(`should repay some debt and withdraw some collateral at the same time ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const mockContract = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
        const {
          rawReceipt,
          details: { newTrove }
        } = await waitForSuccess(kumo.send.adjustTrove(repayAndWithdraw, mockAssetAddress));

        expect(newTrove).to.deep.equal(
          Trove.create(withSomeBorrowing)
            .adjust(repaySomeDebt)
            .adjust(borrowSomeMore)
            .adjust(depositMoreCollateral)
            .adjust(repayAndWithdraw)
        );

        const asset1Balance = await mockContract.balanceOf(user.getAddress())
        const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(500).sub(451).add(0.5).hex);

        expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);
      });

      const borrowAndDeposit = { borrowKUSD: 60, depositCollateral: 0.5 };

      it(`should borrow more and deposit some collateral at the same time ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const mockContract = new ethers.Contract(mockAssetAddress, ERC20ABI, provider.getSigner())
        const {
          rawReceipt,
          details: { newTrove, fee }
        } = await waitForSuccess(kumo.send.adjustTrove(borrowAndDeposit, mockAssetAddress));

        expect(newTrove).to.deep.equal(
          Trove.create(withSomeBorrowing)
            .adjust(repaySomeDebt)
            .adjust(borrowSomeMore)
            .adjust(depositMoreCollateral)
            .adjust(repayAndWithdraw)
            .adjust(borrowAndDeposit)
        );

        expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowAndDeposit.borrowKUSD)}`);

        const asset1Balance = await mockContract.balanceOf(user.getAddress())
        const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(500).sub(451).add(0.5).sub(0.5).hex);

        expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);
      });

      it(`should close the Trove with some KUSD from another user ${mockAssetContract.name}`, async () => {
        const mockAssetAddress = deployment.addresses[mockAssetContract.contract];
        const price = await kumo.getPrice(mockAssetAddress);
        const initialTrove = await kumo.getTrove(mockAssetAddress);
        const kusdBalance = await kumo.getKUMOBalance(mockAssetAddress);
        const kusdShortage = initialTrove.netDebt.sub(kusdBalance);

        let funderTrove = Trove.create({ depositCollateral: 1, borrowKUSD: kusdShortage });
        funderTrove = funderTrove.setDebt(Decimal.max(funderTrove.debt, KUSD_MINIMUM_DEBT));
        funderTrove = funderTrove.setCollateral(funderTrove.debt.mulDiv(1.51, price));

        const funderKumo = await connectToDeployment(deployment, funder);
        await funderKumo.openTrove(Trove.recreate(funderTrove), mockAssetAddress, undefined, {
          gasLimit
        });
        await funderKumo.sendKUSD(await user.getAddress(), kusdShortage);

        const { params } = await kumo.closeTrove(mockAssetAddress);

        expect(params).to.deep.equal({
          withdrawCollateral: initialTrove.collateral,
          repayKUSD: initialTrove.netDebt
        });

        const finalTrove = await kumo.getTrove(mockAssetAddress);
        expect(finalTrove.isEmpty).to.be.true;
      });
    }
  });


  describe("SendableEthersKumo", () => {
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
499000000000000000000
49000000000000000000
