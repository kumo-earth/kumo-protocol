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

const STARTING_BALANCE = Decimal.from(100);

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

// TODO make the testcases isolated

describe("EthersKumo", () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let deployment: _KumoDeploymentJSON;

  let deployerKumo: EthersKumo;
  let kumo: EthersKumo;
  let otherKumos: EthersKumo[];

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
    mockAssetAddress1 = deployment.addresses.mockAsset1;
    mockAsset1 = new ethers.Contract(mockAssetAddress1, ERC20ABI, provider.getSigner())
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

  it("should get the price", async () => {
    const price = await kumo.getPrice(mockAssetAddress1);
    expect(price).to.be.an.instanceOf(Decimal);
  });

  describe("findHintForCollateralRatio", () => {
    it("should pick the closest approx hint", async () => {
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

      await fakeKumo.openTrove(params, mockAssetAddress1, undefined, { gasLimit });

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
  });

  describe("Trove", () => {

    it("should have no Trove initially", async () => {
      const trove = await kumo.getTrove(mockAssetAddress1);
      expect(trove.isEmpty).to.be.true;
    });

    it("should fail to create an undercollateralized Trove", async () => {
      const price = await kumo.getPrice(mockAssetAddress1);
      const undercollateralized = new Trove(KUSD_MINIMUM_DEBT.div(price), KUSD_MINIMUM_DEBT);
      await expect(kumo.openTrove(Trove.recreate(undercollateralized), mockAssetAddress1)).to
        .eventually.be.rejected;
    });

    it("should fail to create a Trove with too little debt", async () => {
      const withTooLittleDebt = new Trove(Decimal.from(50), KUSD_MINIMUM_DEBT.sub(1));

      await expect(kumo.openTrove(Trove.recreate(withTooLittleDebt), mockAssetAddress1)).to
        .eventually.be.rejected;
    });

    const withSomeBorrowing = { depositCollateral: 50, borrowKUSD: KUSD_MINIMUM_NET_DEBT.add(100) };

    it("should create a Trove with some borrowing", async () => {
      const { newTrove, fee } = await kumo.openTrove(
        withSomeBorrowing,
        mockAssetAddress1,
        undefined,
        { gasLimit }
      );
      expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing));
      expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(withSomeBorrowing.borrowKUSD)}`);
    });

    it("should fail to withdraw all the collateral while the Trove has debt", async () => {
      const trove = await kumo.getTrove(mockAssetAddress1);
      await expect(kumo.withdrawCollateral(mockAssetAddress1, trove.collateral)).to.eventually.be.rejected;
    });

    const repaySomeDebt = { repayKUSD: 10 };

    it("should repay some debt", async () => {
      const { newTrove, fee } = await kumo.repayKUSD(mockAssetAddress1, repaySomeDebt.repayKUSD);
      expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing).adjust(repaySomeDebt));
      expect(`${fee}`).to.equal("0");
    });

    const borrowSomeMore = { borrowKUSD: 20 };

    it("should borrow some more", async () => {
      const { newTrove, fee } = await kumo.borrowKUSD(mockAssetAddress1, borrowSomeMore.borrowKUSD);
      expect(newTrove).to.deep.equal(
        Trove.create(withSomeBorrowing).adjust(repaySomeDebt).adjust(borrowSomeMore)
      );
      expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowSomeMore.borrowKUSD)}`);
    });

    const depositMoreCollateral = { depositCollateral: 1 };

    it("should deposit more collateral", async () => {
      const { newTrove } = await kumo.depositCollateral(
        mockAssetAddress1,
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

    it("should repay some debt and withdraw some collateral at the same time", async () => {
      const {
        rawReceipt,
        details: { newTrove }
      } = await waitForSuccess(kumo.send.adjustTrove(repayAndWithdraw, mockAssetAddress1));

      expect(newTrove).to.deep.equal(
        Trove.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
          .adjust(repayAndWithdraw)
      );

      const asset1Balance = await mockAsset1.balanceOf(user.getAddress())
      const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(50).sub(1).add(0.5).hex);

      expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);
    });

    const borrowAndDeposit = { borrowKUSD: 60, depositCollateral: 0.5 };

    it("should borrow more and deposit some collateral at the same time", async () => {
      const {
        rawReceipt,
        details: { newTrove, fee }
      } = await waitForSuccess(kumo.send.adjustTrove(borrowAndDeposit, mockAssetAddress1));

      expect(newTrove).to.deep.equal(
        Trove.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
          .adjust(repayAndWithdraw)
          .adjust(borrowAndDeposit)
      );

      expect(`${fee}`).to.equal(`${MINIMUM_BORROWING_RATE.mul(borrowAndDeposit.borrowKUSD)}`);

      const asset1Balance = await mockAsset1.balanceOf(user.getAddress())
      const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(50).sub(1).add(0.5).sub(0.5).hex);

      expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);
    });

    it("should close the Trove with some KUSD from another user", async () => {
      const price = await kumo.getPrice(mockAssetAddress1);
      const initialTrove = await kumo.getTrove(mockAssetAddress1);
      const kusdBalance = await kumo.getKUMOBalance(mockAssetAddress1);
      const kusdShortage = initialTrove.netDebt.sub(kusdBalance);

      let funderTrove = Trove.create({ depositCollateral: 1, borrowKUSD: kusdShortage });
      funderTrove = funderTrove.setDebt(Decimal.max(funderTrove.debt, KUSD_MINIMUM_DEBT));
      funderTrove = funderTrove.setCollateral(funderTrove.debt.mulDiv(1.51, price));

      const funderKumo = await connectToDeployment(deployment, funder);
      await funderKumo.openTrove(Trove.recreate(funderTrove), mockAssetAddress1, undefined, {
        gasLimit
      });
      await funderKumo.sendKUSD(await user.getAddress(), kusdShortage);

      const { params } = await kumo.closeTrove(mockAssetAddress1);

      expect(params).to.deep.equal({
        withdrawCollateral: initialTrove.collateral,
        repayKUSD: initialTrove.netDebt
      });

      const finalTrove = await kumo.getTrove(mockAssetAddress1);
      expect(finalTrove.isEmpty).to.be.true;
    });
  });

  describe("SendableEthersKumo", () => {
    it("should parse failed transactions without throwing", async () => {
      // By passing a gasLimit, we avoid automatic use of estimateGas which would throw
      const tx = await kumo.send.openTrove(
        { depositCollateral: 0.01, borrowKUSD: 0.01 },
        mockAssetAddress1,
        undefined,
        { gasLimit: 1e6 }
      );
      const { status } = await tx.waitForReceipt();

      expect(status).to.equal("failed");
    });
  });

  describe("Frontend", () => {
    it("should have no frontend initially", async () => {
      const frontend = await kumo.getFrontendStatus(mockAssetName1, await user.getAddress());

      assertStrictEqual(frontend.status, "unregistered" as const);
    });

    it("should register a frontend", async () => {
      await kumo.registerFrontend(mockAssetName1, 0.75);
    });

    it("should have a frontend now", async () => {
      const frontend = await kumo.getFrontendStatus(mockAssetName1, await user.getAddress());

      assertStrictEqual(frontend.status, "registered" as const);
      expect(`${frontend.kickbackRate}`).to.equal("0.75");
    });

    it("other user's deposit should be tagged with the frontend's address", async () => {
      const frontendTag = await user.getAddress();

      await funder.sendTransaction({
        to: otherUsers[0].getAddress(),
        value: Decimal.from(20.1).hex
      });

      const otherKumo = await connectToDeployment(deployment, otherUsers[0], frontendTag);
      await otherKumo.openTrove(
        { depositCollateral: 20, borrowKUSD: KUSD_MINIMUM_DEBT },
        mockAssetAddress1,
        undefined,
        { gasLimit }
      );

      await otherKumo.depositKUSDInStabilityPool(KUSD_MINIMUM_DEBT, mockAssetName1);

      const deposit = await otherKumo.getStabilityDeposit(mockAssetName1);
      expect(deposit.frontendTag).to.equal(frontendTag);
    });
  });

  describe("StabilityPool - TEST", () => {
    before(async () => {
      // Deploy new instances of the contracts, for a clean state
      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;

      [deployerKumo, kumo, ...otherKumos] = await connectUsers([
        deployer,
        user,
        ...otherUsers.slice(0, 1)
      ]);

      await funder.sendTransaction({
        to: otherUsers[0].getAddress(),
        value: KUSD_MINIMUM_DEBT.div(170).hex
      });
    });

    const initialTroveOfDepositor = Trove.create({
      depositCollateral: KUSD_MINIMUM_DEBT.div(100),
      borrowKUSD: KUSD_MINIMUM_NET_DEBT
    });

    const smallStabilityDeposit = Decimal.from(10);

    it("should make a small stability deposit", async () => {
      const { newTrove } = await kumo.openTrove(
        Trove.recreate(initialTroveOfDepositor),
        mockAssetAddress1,
      );
      expect(newTrove).to.deep.equal(initialTroveOfDepositor);

      const details = await kumo.depositKUSDInStabilityPool(smallStabilityDeposit, mockAssetName1);

      expect(details).to.deep.equal({
        kusdLoss: Decimal.from(0),
        newKUSDDeposit: smallStabilityDeposit,
        collateralGain: Decimal.from(0),
        kumoReward: Decimal.from(0),
        change: {
          depositKUSD: smallStabilityDeposit
        }
      });
    });

    const troveWithVeryLowICR = Trove.create({
      depositCollateral: KUSD_MINIMUM_DEBT.div(180),
      borrowKUSD: KUSD_MINIMUM_NET_DEBT
    });

    it("other user should make a Trove with very low ICR", async () => {
      const { newTrove } = await otherKumos[0].openTrove(
        Trove.recreate(troveWithVeryLowICR),
        mockAssetAddress1,
        undefined,
        { gasLimit }
      );

      const price = await kumo.getPrice(mockAssetAddress1);
      expect(Number(`${newTrove.collateralRatio(price)}`)).to.be.below(1.15);
    });

    const dippedPrice = Decimal.from(190);

    it("the price should take a dip", async () => {
      await deployerKumo.setPrice(mockAssetAddress1, dippedPrice);

      const price = await kumo.getPrice(mockAssetAddress1);
      expect(`${price}`).to.equal(`${dippedPrice}`);
    });

    it("should liquidate other user's Trove", async () => {
      const details = await kumo.liquidateUpTo(mockAssetAddress1, 1, { gasLimit });

      expect(details).to.deep.equal({
        liquidatedAddresses: [await otherUsers[0].getAddress()],

        collateralGasCompensation: troveWithVeryLowICR.collateral.mul(0.005), // 0.5%
        kusdGasCompensation: KUSD_LIQUIDATION_RESERVE,

        totalLiquidated: new Trove(
          troveWithVeryLowICR.collateral
            .mul(0.995) // -0.5% gas compensation
            .add("0.000000000000000001"), // tiny imprecision
          troveWithVeryLowICR.debt
        )
      });

      const otherTrove = await otherKumos[0].getTrove(mockAssetAddress1);
      expect(otherTrove.isEmpty).to.be.true;
    });

    it("should have a depleted stability deposit and some collateral gain", async () => {
      const stabilityDeposit = await kumo.getStabilityDeposit(mockAssetName1);

      expect(stabilityDeposit).to.deep.equal(
        new StabilityDeposit(
          smallStabilityDeposit,
          Decimal.ZERO,
          troveWithVeryLowICR.collateral
            .mul(0.995) // -0.5% gas compensation
            .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
            .sub("0.000000000000000005"), // tiny imprecision
          Decimal.ZERO,
          AddressZero
        )
      );
    });

    it("the Trove should have received some liquidation shares", async () => {
      const trove = await kumo.getTrove(mockAssetAddress1);

      expect(trove).to.deep.equal({
        ownerAddress: await user.getAddress(),
        status: "open",

        ...initialTroveOfDepositor
          .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
          .addCollateral(
            troveWithVeryLowICR.collateral
              .mul(0.995) // -0.5% gas compensation
              .mulDiv(troveWithVeryLowICR.debt.sub(smallStabilityDeposit), troveWithVeryLowICR.debt)
              .add("0.000000000000000001") // tiny imprecision
          )
      });
    });

    it("total should equal the Trove", async () => {
      const trove = await kumo.getTrove(mockAssetAddress1);

      const numberOfTroves = await kumo.getNumberOfTroves(mockAssetAddress1);
      expect(numberOfTroves).to.equal(1);

      const total = await kumo.getTotal(mockAssetAddress1);
      expect(total).to.deep.equal(
        trove.addCollateral("0.000000000000000001") // tiny imprecision
      );
    });

    it("should transfer the gains to the Trove", async () => {
      const details = await kumo.transferCollateralGainToTrove(mockAssetAddress1, mockAssetName1, { gasLimit });

      expect(details).to.deep.equal({
        kusdLoss: smallStabilityDeposit,
        newKUSDDeposit: Decimal.ZERO,
        kumoReward: Decimal.ZERO,

        collateralGain: troveWithVeryLowICR.collateral
          .mul(0.995) // -0.5% gas compensation
          .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
          .sub("0.000000000000000005"), // tiny imprecision

        newTrove: initialTroveOfDepositor
          .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
          .addCollateral(
            troveWithVeryLowICR.collateral
              .mul(0.995) // -0.5% gas compensation
              .sub("0.000000000000000005") // tiny imprecision
          )
      });

      const stabilityDeposit = await kumo.getStabilityDeposit(mockAssetName1);
      expect(stabilityDeposit.isEmpty).to.be.true;
    });

    describe("when people overstay", () => {
      before(async () => {
        // Deploy new instances of the contracts, for a clean state
        deployment = await deployKumo(deployer);
        mockAssetAddress1 = deployment.addresses.mockAsset1;


        const otherUsersSubset = otherUsers.slice(0, 5);
        [deployerKumo, kumo, ...otherKumos] = await connectUsers([
          deployer,
          user,
          ...otherUsersSubset
        ]);

        await sendToEach(otherUsersSubset, 0.1);

        let price = Decimal.from(200);
        await deployerKumo.setPrice(mockAssetAddress1, price);

        // Use this account to print KUSD
        await kumo.openTrove(
          { depositCollateral: 50, borrowKUSD: 5000 },
          mockAssetAddress1,

          undefined,
          { gasLimit }
        );

        // otherKumos[0-2] will be independent stability depositors
        await kumo.sendKUSD(await otherUsers[0].getAddress(), 3000);
        await kumo.sendKUSD(await otherUsers[1].getAddress(), 1000);
        await kumo.sendKUSD(await otherUsers[2].getAddress(), 1000);

        // otherKumos[3-4] will be Trove owners whose Troves get liquidated
        await otherKumos[3].openTrove(
          { depositCollateral: 21, borrowKUSD: 2900 },
          mockAssetAddress1,
          undefined,
          { gasLimit }
        );
        await otherKumos[4].openTrove(
          { depositCollateral: 21, borrowKUSD: 2900 },
          mockAssetAddress1,
          undefined,
          { gasLimit }
        );

        await otherKumos[0].depositKUSDInStabilityPool(3000, mockAssetName1);
        await otherKumos[1].depositKUSDInStabilityPool(1000, mockAssetName1);
        // otherKumos[2] doesn't deposit yet

        // Tank the price so we can liquidate
        price = Decimal.from(150);
        await deployerKumo.setPrice(mockAssetAddress1, price);

        // Liquidate first victim
        await kumo.liquidate(mockAssetAddress1, await otherUsers[3].getAddress());
        expect((await otherKumos[3].getTrove(mockAssetAddress1)).isEmpty).to.be.true;

        // Now otherKumos[2] makes their deposit too
        await otherKumos[2].depositKUSDInStabilityPool(1000, mockAssetName1);

        // Liquidate second victim
        await kumo.liquidate(mockAssetAddress1, await otherUsers[4].getAddress());
        expect((await otherKumos[4].getTrove(mockAssetAddress1)).isEmpty).to.be.true;

        // Stability Pool is now empty
        expect(`${await kumo.getKUSDInStabilityPool(mockAssetName1)}`).to.equal("0");
      });

      it("should still be able to withdraw remaining deposit", async () => {
        for (const l of [otherKumos[0], otherKumos[1], otherKumos[2]]) {
          const stabilityDeposit = await l.getStabilityDeposit(mockAssetName1);
          await l.withdrawKUSDFromStabilityPool(stabilityDeposit.currentKUSD, mockAssetName1);
        }
      });
    });
  });

  describe("Redemption", () => {
    const troveCreations = [
      { depositCollateral: 99, borrowKUSD: 4600 },
      { depositCollateral: 20, borrowKUSD: 2000 }, // net debt: 2010
      { depositCollateral: 20, borrowKUSD: 2100 }, // net debt: 2110.5
      { depositCollateral: 20, borrowKUSD: 2200 } //  net debt: 2211
    ];

    before(async function () {
      if (network.name !== "hardhat") {
        // Redemptions are only allowed after a bootstrap phase of 2 weeks.
        // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
        this.skip();
      }

      // Deploy new instances of the contracts, for a clean slate
      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;
      mockAsset1 = new ethers.Contract(mockAssetAddress1, ERC20ABI, provider.getSigner())

      const otherUsersSubset = otherUsers.slice(0, 3);
      [deployerKumo, kumo, ...otherKumos] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset
      ]);

      await sendToEach(otherUsersSubset, 0.1);
    });

    it("should fail to redeem during the bootstrap phase", async () => {
      await kumo.openTrove(troveCreations[0], mockAssetAddress1, undefined, { gasLimit });
      await otherKumos[0].openTrove(troveCreations[1], mockAssetAddress1, undefined, {
        gasLimit
      });
      await otherKumos[1].openTrove(troveCreations[2], mockAssetAddress1, undefined, {
        gasLimit
      });
      await otherKumos[2].openTrove(troveCreations[3], mockAssetAddress1, undefined, {
        gasLimit
      });

      await expect(kumo.redeemKUSD(mockAssetAddress1, 4326.5)).to.eventually.be.rejected;
    });

    const someKUSD = Decimal.from(4326.5);

    it("should redeem some KUSD after the bootstrap phase", async () => {
      // Fast-forward 15 days
      await increaseTime(60 * 60 * 24 * 15);

      expect(`${await otherKumos[0].getCollateralSurplusBalance(mockAssetAddress1)}`).to.equal("0");
      expect(`${await otherKumos[1].getCollateralSurplusBalance(mockAssetAddress1)}`).to.equal("0");
      expect(`${await otherKumos[2].getCollateralSurplusBalance(mockAssetAddress1)}`).to.equal("0");

      const expectedTotal = troveCreations
        .map(params => Trove.create(params))
        .reduce((a, b) => a.add(b));

      const total = await kumo.getTotal(mockAssetAddress1);
      expect(total).to.deep.equal(expectedTotal);

      const expectedDetails = {
        attemptedKUSDAmount: someKUSD,
        actualKUSDAmount: someKUSD,
        collateralTaken: someKUSD.div(200),
        fee: new Fees(0, 0.99, 2, new Date(), new Date(), false)
          .redemptionRate(someKUSD.div(total.debt))
          .mul(someKUSD.div(200))
      };

      const { rawReceipt, details } = await waitForSuccess(kumo.send.redeemKUSD(mockAssetAddress1, someKUSD));
      expect(details).to.deep.equal(expectedDetails);

      // const balance = Decimal.fromBigNumberString(`${await user.getBalance()}`);
      const asset1Balance = await mockAsset1.balanceOf(user.getAddress())
      const expectedBalance = BigNumber.from(STARTING_BALANCE.sub(99).add(expectedDetails.collateralTaken).sub(expectedDetails.fee).hex);
      expect(`${asset1Balance}`).to.equal(`${expectedBalance}`);

      // BigNumber.from(STARTING_BALANCE.sub(50).sub(1).add(0.5).hex)

      expect(`${await kumo.getKUSDBalance()}`).to.equal("273.5");

      expect(`${(await otherKumos[0].getTrove(mockAssetAddress1)).debt}`).to.equal(
        `${Trove.create(troveCreations[1]).debt.sub(
          someKUSD
            .sub(Trove.create(troveCreations[2]).netDebt)
            .sub(Trove.create(troveCreations[3]).netDebt)
        )}`
      );

      expect((await otherKumos[1].getTrove(mockAssetAddress1)).isEmpty).to.be.true;
      expect((await otherKumos[2].getTrove(mockAssetAddress1)).isEmpty).to.be.true;
    });

    it("should claim the collateral surplus after redemption", async () => {
      const asset1balanceBefore1 = await mockAsset1.balanceOf(otherUsers[1].getAddress())
      const asset1balanceBefore2 = await mockAsset1.balanceOf(otherUsers[2].getAddress())

      expect(`${await otherKumos[0].getCollateralSurplusBalance(mockAssetAddress1)}`).to.equal("0");

      const surplus1 = await otherKumos[1].getCollateralSurplusBalance(mockAssetAddress1);
      const trove1 = Trove.create(troveCreations[2]);
      expect(`${surplus1}`).to.equal(`${trove1.collateral.sub(trove1.netDebt.div(200))}`);

      const surplus2 = await otherKumos[2].getCollateralSurplusBalance(mockAssetAddress1);
      const trove2 = Trove.create(troveCreations[3]);
      expect(`${surplus2}`).to.equal(`${trove2.collateral.sub(trove2.netDebt.div(200))}`);

      const { rawReceipt: receipt1 } = await waitForSuccess(
        otherKumos[1].send.claimCollateralSurplus(mockAssetAddress1)
      );

      const { rawReceipt: receipt2 } = await waitForSuccess(
        otherKumos[2].send.claimCollateralSurplus(mockAssetAddress1)
      );

      expect(`${await otherKumos[0].getCollateralSurplusBalance(mockAssetAddress1)}`).to.equal("0");
      expect(`${await otherKumos[1].getCollateralSurplusBalance(mockAssetAddress1)}`).to.equal("0");
      expect(`${await otherKumos[2].getCollateralSurplusBalance(mockAssetAddress1)}`).to.equal("0");

      const asset1balanceAfter1 = await mockAsset1.balanceOf(otherUsers[1].getAddress())
      const asset1balanceAfter2 = await mockAsset1.balanceOf(otherUsers[2].getAddress())

      expect(`${asset1balanceAfter1}`).to.equal(
        `${asset1balanceBefore1.add(surplus1.hex)}`
      );

      expect(`${asset1balanceAfter2}`).to.equal(
        `${asset1balanceBefore2.add(surplus2.hex)}`
      );
    });

    it("borrowing rate should be maxed out now", async () => {
      const borrowKUSD = Decimal.from(10);

      const { fee, newTrove } = await kumo.borrowKUSD(mockAssetAddress1, borrowKUSD);
      expect(`${fee}`).to.equal(`${borrowKUSD.mul(MAXIMUM_BORROWING_RATE)}`);

      expect(newTrove).to.deep.equal(
        Trove.create(troveCreations[0]).adjust({ borrowKUSD }, MAXIMUM_BORROWING_RATE)
      );
    });
  });

  describe("Redemption truncation", () => {
    const troveCreationParams = { depositCollateral: 20, borrowKUSD: 2000 };
    const netDebtPerTrove = Trove.create(troveCreationParams).netDebt;
    const amountToAttempt = Decimal.from(3000);
    const expectedRedeemable = netDebtPerTrove.mul(2).sub(KUSD_MINIMUM_NET_DEBT);

    before(function () {
      if (network.name !== "hardhat") {
        // Redemptions are only allowed after a bootstrap phase of 2 weeks.
        // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
        this.skip();
      }
    });

    beforeEach(async () => {
      // Deploy new instances of the contracts, for a clean state
      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;
      mockAsset1 = new ethers.Contract(mockAssetAddress1, ERC20ABI, provider.getSigner())

      const otherUsersSubset = otherUsers.slice(0, 3);
      [deployerKumo, kumo, ...otherKumos] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset
      ]);

      await sendToEach(otherUsersSubset, 0.1);

      await kumo.openTrove(
        { depositCollateral: 99, borrowKUSD: 5000 },
        mockAssetAddress1,
        undefined,
        { gasLimit }
      );
      await otherKumos[0].openTrove(troveCreationParams, mockAssetAddress1, undefined, {
        gasLimit
      });
      await otherKumos[1].openTrove(troveCreationParams, mockAssetAddress1, undefined, {
        gasLimit
      });
      await otherKumos[2].openTrove(troveCreationParams, mockAssetAddress1, undefined, {
        gasLimit
      });

      await increaseTime(60 * 60 * 24 * 15);
    });

    it("should truncate the amount if it would put the last Trove below the min debt", async () => {
      const redemption = await kumo.populate.redeemKUSD(mockAssetAddress1, amountToAttempt);
      expect(`${redemption.attemptedKUSDAmount}`).to.equal(`${amountToAttempt}`);
      expect(`${redemption.redeemableKUSDAmount}`).to.equal(`${expectedRedeemable}`);
      expect(redemption.isTruncated).to.be.true;

      const { details } = await waitForSuccess(redemption.send());
      expect(`${details.attemptedKUSDAmount}`).to.equal(`${expectedRedeemable}`);
      expect(`${details.actualKUSDAmount}`).to.equal(`${expectedRedeemable}`);
    });

    it("should increase the amount to the next lowest redeemable value", async () => {
      const increasedRedeemable = expectedRedeemable.add(KUSD_MINIMUM_NET_DEBT);

      const initialRedemption = await kumo.populate.redeemKUSD(mockAssetAddress1, amountToAttempt);
      const increasedRedemption = await initialRedemption.increaseAmountByMinimumNetDebt();
      expect(`${increasedRedemption.attemptedKUSDAmount}`).to.equal(`${increasedRedeemable}`);
      expect(`${increasedRedemption.redeemableKUSDAmount}`).to.equal(`${increasedRedeemable}`);
      expect(increasedRedemption.isTruncated).to.be.false;

      const { details } = await waitForSuccess(increasedRedemption.send());
      expect(`${details.attemptedKUSDAmount}`).to.equal(`${increasedRedeemable}`);
      expect(`${details.actualKUSDAmount}`).to.equal(`${increasedRedeemable}`);
    });

    it("should fail to increase the amount if it's not truncated", async () => {
      const redemption = await kumo.populate.redeemKUSD(mockAssetAddress1, netDebtPerTrove);
      expect(redemption.isTruncated).to.be.false;

      expect(() => redemption.increaseAmountByMinimumNetDebt()).to.throw(
        "can only be called when amount is truncated"
      );
    });
  });

  describe("Redemption gas checks", function () {
    this.timeout("5m");

    const massivePrice = Decimal.from(1000000);

    const amountToBorrowPerTrove = Decimal.from(2000);
    const netDebtPerTrove = MINIMUM_BORROWING_RATE.add(1).mul(amountToBorrowPerTrove);
    const collateralPerTrove = netDebtPerTrove
      .add(KUSD_LIQUIDATION_RESERVE)
      .mulDiv(1.5, massivePrice);

    const amountToRedeem = netDebtPerTrove.mul(_redeemMaxIterations);
    const amountToDeposit = MINIMUM_BORROWING_RATE.add(1)
      .mul(amountToRedeem)
      .add(KUSD_LIQUIDATION_RESERVE)
      .mulDiv(2, massivePrice);

    before(async function () {
      if (network.name !== "hardhat") {
        // Redemptions are only allowed after a bootstrap phase of 2 weeks.
        // Since fast-forwarding only works on Hardhat EVM, skip these tests elsewhere.
        this.skip();
      }

      // Deploy new instances of the contracts, for a clean state
      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;
      const otherUsersSubset = otherUsers.slice(0, _redeemMaxIterations);
      expect(otherUsersSubset).to.have.length(_redeemMaxIterations);

      [deployerKumo, kumo, ...otherKumos] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset
      ]);

      await deployerKumo.setPrice(mockAssetAddress1, massivePrice);
      await sendToEach(otherUsersSubset, 0.1);

      for (const otherKumo of otherKumos) {
        await otherKumo.openTrove(
          {
            depositCollateral: collateralPerTrove,
            borrowKUSD: amountToBorrowPerTrove
          },
          mockAssetAddress1,

          undefined,
          { gasLimit }
        );
      }

      await increaseTime(60 * 60 * 24 * 15);
    });

    it("should redeem using the maximum iterations and almost all gas", async () => {
      await kumo.openTrove(
        {
          depositCollateral: amountToDeposit,
          borrowKUSD: amountToRedeem
        },
        mockAssetAddress1,

        undefined,
        { gasLimit }
      );

      const { rawReceipt } = await waitForSuccess(kumo.send.redeemKUSD(mockAssetAddress1, amountToRedeem));

      const gasUsed = rawReceipt.gasUsed.toNumber();
      // gasUsed is ~half the real used amount because of how refunds work, see:
      // https://ethereum.stackexchange.com/a/859/9205
      expect(gasUsed).to.be.at.least(4900000, "should use close to 10M gas");
    });
  });

  describe("Liquidity mining", () => {
    before(async () => {
      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;
      [deployerKumo, kumo] = await connectUsers([deployer, user]);
    });

    const someUniTokens = 1000;

    it("should obtain some UNI LP tokens", async () => {
      await kumo._mintUniToken(someUniTokens);

      const uniTokenBalance = await kumo.getUniTokenBalance();
      expect(`${uniTokenBalance}`).to.equal(`${someUniTokens}`);
    });

    it("should fail to stake UNI LP before approving the spend", async () => {
      await expect(kumo.stakeUniTokens(someUniTokens)).to.eventually.be.rejected;
    });

    it("should stake UNI LP after approving the spend", async () => {
      const initialAllowance = await kumo.getUniTokenAllowance();
      expect(`${initialAllowance}`).to.equal("0");

      await kumo.approveUniTokens();

      const newAllowance = await kumo.getUniTokenAllowance();
      expect(newAllowance.isZero).to.be.false;

      await kumo.stakeUniTokens(someUniTokens);

      const uniTokenBalance = await kumo.getUniTokenBalance();
      expect(`${uniTokenBalance}`).to.equal("0");

      const stake = await kumo.getLiquidityMiningStake();
      expect(`${stake}`).to.equal(`${someUniTokens}`);
    });

    it("should have an KUMO reward after some time has passed", async function () {
      this.timeout("20s");

      // Liquidity mining rewards are seconds-based, so we don't need to wait long.
      // By actually waiting in real time, we avoid using increaseTime(), which only works on
      // Hardhat EVM.
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Trigger a new block with a dummy TX.
      await kumo._mintUniToken(0);

      const kumoReward = Number(await kumo.getLiquidityMiningKUMOReward());
      expect(kumoReward).to.be.at.least(1); // ~0.2572 per second [(4e6/3) / (60*24*60*60)]

      await kumo.withdrawKUMORewardFromLiquidityMining();
      const kumoBalance = Number(await kumo.getKUMOBalance());
      expect(kumoBalance).to.be.at.least(kumoReward); // may have increased since checking
    });

    it("should partially unstake", async () => {
      await kumo.unstakeUniTokens(someUniTokens / 2);

      const uniTokenStake = await kumo.getLiquidityMiningStake();
      expect(`${uniTokenStake}`).to.equal(`${someUniTokens / 2}`);

      const uniTokenBalance = await kumo.getUniTokenBalance();
      expect(`${uniTokenBalance}`).to.equal(`${someUniTokens / 2}`);
    });

    it("should unstake remaining tokens and withdraw remaining KUMO reward", async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await kumo._mintUniToken(0); // dummy block
      await kumo.exitLiquidityMining();

      const uniTokenStake = await kumo.getLiquidityMiningStake();
      expect(`${uniTokenStake}`).to.equal("0");

      const kumoReward = await kumo.getLiquidityMiningKUMOReward();
      expect(`${kumoReward}`).to.equal("0");

      const uniTokenBalance = await kumo.getUniTokenBalance();
      expect(`${uniTokenBalance}`).to.equal(`${someUniTokens}`);
    });

    it("should have no more rewards after the mining period is over", async function () {
      if (network.name !== "hardhat") {
        // increaseTime() only works on Hardhat EVM
        this.skip();
      }

      await kumo.stakeUniTokens(someUniTokens);
      await increaseTime(2 * 30 * 24 * 60 * 60);
      await kumo.exitLiquidityMining();

      const remainingKUMOReward = await kumo.getRemainingLiquidityMiningKUMOReward();
      expect(`${remainingKUMOReward}`).to.equal("0");

      const kumoBalance = Number(await kumo.getKUMOBalance());
      expect(kumoBalance).to.be.within(1333333, 1333334);
    });
  });

  // Test workarounds related to https://github.com/kumo/dev/issues/600
  describe("Hints (adjustTrove)", () => {
    let eightOtherUsers: Signer[];

    before(async () => {
      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;
      eightOtherUsers = otherUsers.slice(0, 8);
      kumo = await connectToDeployment(deployment, user);

      await openTroves(eightOtherUsers, [
        { depositCollateral: 30, borrowKUSD: 2000 }, // 0
        { depositCollateral: 30, borrowKUSD: 2100 }, // 1
        { depositCollateral: 30, borrowKUSD: 2200 }, // 2
        { depositCollateral: 30, borrowKUSD: 2300 }, // 3
        // Test 1:           30,             2400
        { depositCollateral: 30, borrowKUSD: 2500 }, // 4
        { depositCollateral: 30, borrowKUSD: 2600 }, // 5
        { depositCollateral: 30, borrowKUSD: 2700 }, // 6
        { depositCollateral: 30, borrowKUSD: 2800 } //  7
        // Test 2:           30,             2900
        // Test 2 (other):   30,             3000
        // Test 3:           30,             3100 -> 3200
      ], mockAssetAddress1);
    });

    // Test 1
    it("should not use extra gas when a Trove's position doesn't change", async () => {
      const { newTrove: initialTrove } = await kumo.openTrove(
        {
          depositCollateral: 30,
          borrowKUSD: 2400
        },
        mockAssetAddress1,

        undefined,
        { gasLimit }
      );

      // Maintain the same ICR / position in the list
      const targetTrove = initialTrove.multiply(1.1);

      const { rawReceipt } = await waitForSuccess(
        kumo.send.adjustTrove(initialTrove.adjustTo(targetTrove), mockAssetAddress1)
      );

      const gasUsed = rawReceipt.gasUsed.toNumber();
      // Higher gas usage due to asset parameter. ToDO: Estimate gas (25000 before asset)
      expect(gasUsed).to.be.at.most(310000);
    });

    // Test 2
    it("should not traverse the whole list when bottom Trove moves", async () => {
      const bottomKumo = await connectToDeployment(deployment, eightOtherUsers[7]);

      const initialTrove = await kumo.getTrove(mockAssetAddress1);
      const bottomTrove = await bottomKumo.getTrove(mockAssetAddress1);

      const targetTrove = Trove.create({ depositCollateral: 30, borrowKUSD: 2900 });
      const interferingTrove = Trove.create({ depositCollateral: 30, borrowKUSD: 3000 });

      const tx = await kumo.populate.adjustTrove(initialTrove.adjustTo(targetTrove), mockAssetAddress1);

      // Suddenly: interference!
      await bottomKumo.adjustTrove(bottomTrove.adjustTo(interferingTrove), mockAssetAddress1);

      const { rawReceipt } = await waitForSuccess(tx.send());

      const gasUsed = rawReceipt.gasUsed.toNumber();
      // Higher gas usage due to asset parameter. ToDO: Estimate gas (31000 before asset)
      expect(gasUsed).to.be.at.most(355000);
    });

    // Test 3
    it("should not traverse the whole list when lowering ICR of bottom Trove", async () => {
      const initialTrove = await kumo.getTrove(mockAssetAddress1);

      const targetTrove = [
        Trove.create({ depositCollateral: 30, borrowKUSD: 3100 }),
        Trove.create({ depositCollateral: 30, borrowKUSD: 3200 })
      ];

      await kumo.adjustTrove(initialTrove.adjustTo(targetTrove[0]), mockAssetAddress1);
      // Now we are the bottom Trove

      // Lower our ICR even more
      const { rawReceipt } = await waitForSuccess(
        kumo.send.adjustTrove(targetTrove[0].adjustTo(targetTrove[1]), mockAssetAddress1)
      );

      const gasUsed = rawReceipt.gasUsed.toNumber();
      // Higher gas usage due to asset parameter. ToDO: Estimate gas (24000 before asset)
      expect(gasUsed).to.be.at.most(270000);
    });
  });

  describe("Gas estimation", () => {
    const troveWithICRBetween = (a: Trove, b: Trove) => a.add(b).multiply(0.5);

    let rudeUser: Signer;
    let fiveOtherUsers: Signer[];
    let rudeKumo: EthersKumo;

    before(async function () {
      if (network.name !== "hardhat") {
        this.skip();
      }

      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;

      [rudeUser, ...fiveOtherUsers] = otherUsers.slice(0, 6);

      [deployerKumo, kumo, rudeKumo, ...otherKumos] = await connectUsers([
        deployer,
        user,
        rudeUser,
        ...fiveOtherUsers
      ]);

      await openTroves(fiveOtherUsers, [
        { depositCollateral: 20, borrowKUSD: 2040 },
        { depositCollateral: 20, borrowKUSD: 2050 },
        { depositCollateral: 20, borrowKUSD: 2060 },
        { depositCollateral: 20, borrowKUSD: 2070 },
        { depositCollateral: 20, borrowKUSD: 2080 }
      ], mockAssetAddress1);

      await increaseTime(60 * 60 * 24 * 15);
    });

    it("should include enough gas for updating lastFeeOperationTime", async () => {
      await kumo.openTrove(
        { depositCollateral: 20, borrowKUSD: 2090 },
        mockAssetAddress1,

        undefined,
        { gasLimit }
      );

      // We just updated lastFeeOperationTime, so this won't anticipate having to update that
      // during estimateGas
      const tx = await kumo.populate.redeemKUSD(mockAssetAddress1, 1);
      const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

      // Fast-forward 2 minutes.
      await increaseTime(120);

      // Required gas has just went up.
      const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();
      expect(gasIncrease).to.be.within(4000, 9000);

      // This will now have to update lastFeeOperationTime
      await waitForSuccess(tx.send());

      // Decay base-rate back to 0
      await increaseTime(100000000);
    });

    it("should include enough gas for one extra traversal", async () => {
      const troves = await kumo.getTroves(mockAssetAddress1, {
        first: 10,
        sortedBy: "ascendingCollateralRatio"
      });

      const trove = await kumo.getTrove(mockAssetAddress1);
      const newTrove = troveWithICRBetween(troves[4], troves[5]);

      // First, we want to test a non-borrowing case, to make sure we're not passing due to any
      // extra gas we add to cover a potential lastFeeOperationTime update
      const adjustment = trove.adjustTo(newTrove);
      expect(adjustment.borrowKUSD).to.be.undefined;

      const tx = await kumo.populate.adjustTrove(adjustment, mockAssetAddress1);
      const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

      // A terribly rude user interferes
      const rudeTrove = newTrove.addDebt(1);
      const rudeCreation = Trove.recreate(rudeTrove);
      await openTroves([rudeUser], [rudeCreation], mockAssetAddress1);

      const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

      await waitForSuccess(tx.send());
      expect(gasIncrease).to.be.within(10000, 25000);

      assertDefined(rudeCreation.borrowKUSD);
      const kusdShortage = rudeTrove.debt.sub(rudeCreation.borrowKUSD);

      await kumo.sendKUSD(await rudeUser.getAddress(), kusdShortage);
      await rudeKumo.closeTrove(mockAssetAddress1);
    });

    it("should include enough gas for both when borrowing", async () => {
      const troves = await kumo.getTroves(mockAssetAddress1, {
        first: 10,
        sortedBy: "ascendingCollateralRatio"
      });

      const trove = await kumo.getTrove(mockAssetAddress1);
      const newTrove = troveWithICRBetween(troves[1], troves[2]);

      // Make sure we're borrowing
      const adjustment = trove.adjustTo(newTrove);
      expect(adjustment.borrowKUSD).to.not.be.undefined;

      const tx = await kumo.populate.adjustTrove(adjustment, mockAssetAddress1);
      const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

      // A terribly rude user interferes again
      await openTroves([rudeUser], [Trove.recreate(newTrove.addDebt(1))], mockAssetAddress1);

      // On top of that, we'll need to update lastFeeOperationTime
      await increaseTime(120);

      const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

      await waitForSuccess(tx.send());
      expect(gasIncrease).to.be.within(15000, 30000);
    });
  });

  describe("Gas estimation (KUMO issuance)", () => {
    const estimate = (tx: PopulatedEthersKumoTransaction) =>
      provider.estimateGas(tx.rawPopulatedTransaction);

    before(async function () {
      if (network.name !== "hardhat") {
        this.skip();
      }

      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;
      [deployerKumo, kumo] = await connectUsers([deployer, user]);
    });

    it("should include enough gas for issuing KUMO", async function () {
      this.timeout("1m");

      await kumo.openTrove(
        { depositCollateral: 40, borrowKUSD: 4000 },
        mockAssetAddress1,
        undefined,
        { gasLimit }
      );
      await kumo.depositKUSDInStabilityPool(19, mockAssetName1);

      await increaseTime(60);

      // This will issue KUMO for the first time ever. That uses a whole lotta gas, and we don't
      // want to pack any extra gas to prepare for this case specifically, because it only happens
      // once.
      await kumo.withdrawGainsFromStabilityPool(mockAssetName1);

      const claim = await kumo.populate.withdrawGainsFromStabilityPool(mockAssetName1);
      const deposit = await kumo.populate.depositKUSDInStabilityPool(1, mockAssetName1);
      const withdraw = await kumo.populate.withdrawKUSDFromStabilityPool(1, mockAssetName1);

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

      await deployerKumo.openTrove(creation, mockAssetAddress1, undefined, { gasLimit });
      await deployerKumo.depositKUSDInStabilityPool(creation.borrowKUSD, mockAssetName1);
      await deployerKumo.setPrice(mockAssetAddress1, 198);

      const liquidateTarget = await kumo.populate.liquidate(mockAssetAddress1, await deployer.getAddress());
      const liquidateMultiple = await kumo.populate.liquidateUpTo(mockAssetAddress1, 40);

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

  describe("Gas estimation fee decay", () => {
    before(async function () {
      if (network.name !== "hardhat") {
        this.skip();
      }

      this.timeout("1m");

      deployment = await deployKumo(deployer);
      mockAssetAddress1 = deployment.addresses.mockAsset1;
      const [redeemedUser, ...someMoreUsers] = otherUsers.slice(0, 21);
      [kumo, ...otherKumos] = await connectUsers([user, ...someMoreUsers]);

      // Create a "slope" of Troves with similar, but slightly decreasing ICRs
      await openTroves(
        someMoreUsers,
        someMoreUsers.map((_, i) => ({
          depositCollateral: 20,
          borrowKUSD: KUSD_MINIMUM_NET_DEBT.add(i / 10)
        })), mockAssetAddress1
      );

      // Sweep KUSD
      await Promise.all(
        otherKumos.map(async otherKumo =>
          otherKumo.sendKUSD(await user.getAddress(), await otherKumo.getKUSDBalance())
        )
      );

      const price = await kumo.getPrice(mockAssetAddress1);

      // Create a "designated victim" Trove that'll be redeemed
      const redeemedTroveDebt = await kumo
        .getKUSDBalance()
        .then(x => x.div(10).add(KUSD_LIQUIDATION_RESERVE));
      const redeemedTroveCollateral = redeemedTroveDebt.mulDiv(1.1, price);
      const redeemedTrove = new Trove(redeemedTroveCollateral, redeemedTroveDebt);

      await openTroves([redeemedUser], [Trove.recreate(redeemedTrove)], mockAssetAddress1);

      // Jump past bootstrap period
      await increaseTime(60 * 60 * 24 * 15);

      // Increase the borrowing rate by redeeming
      const { actualKUSDAmount } = await kumo.redeemKUSD(mockAssetAddress1, redeemedTrove.netDebt);

      expect(`${actualKUSDAmount}`).to.equal(`${redeemedTrove.netDebt}`);

      const borrowingRate = await kumo.getFees(mockAssetAddress1).then(fees => Number(fees.borrowingRate()));
      expect(borrowingRate).to.be.within(0.04, 0.049); // make sure it's high, but not clamped to 5%
    });

    it("should predict the gas increase due to fee decay", async function () {
      this.timeout("1m");

      const [bottomTrove] = await kumo.getTroves(mockAssetAddress1, {
        first: 1,
        sortedBy: "ascendingCollateralRatio"
      });

      const borrowingRate = await kumo.getFees(mockAssetAddress1).then(fees => fees.borrowingRate());

      for (const [borrowingFeeDecayToleranceMinutes, roughGasHeadroom] of [
        [10, 133000],
        [20, 251000],
        [30, 335000]
      ]) {
        const tx = await kumo.populate.openTrove(
          Trove.recreate(bottomTrove, borrowingRate),
          mockAssetAddress1,
          {
            borrowingFeeDecayToleranceMinutes
          }
        );
        expect(tx.gasHeadroom).to.be.within(roughGasHeadroom - 1000, roughGasHeadroom + 1000);
      }
    });

    it("should include enough gas for the TX to succeed after pending", async function () {
      this.timeout("1m");

      const [bottomTrove] = await kumo.getTroves(mockAssetAddress1, {
        first: 1,
        sortedBy: "ascendingCollateralRatio"
      });

      const borrowingRate = await kumo.getFees(mockAssetAddress1).then(fees => fees.borrowingRate());

      const tx = await kumo.populate.openTrove(
        Trove.recreate(bottomTrove.multiply(2), borrowingRate),
        mockAssetAddress1,
        { borrowingFeeDecayToleranceMinutes: 60 },
        { gasLimit }
      );

      await increaseTime(60 * 60);
      await waitForSuccess(tx.send());
    });
  });
});
