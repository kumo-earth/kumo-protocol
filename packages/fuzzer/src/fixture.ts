import { Signer } from "@ethersproject/abstract-signer";

import {
  Decimal,
  Decimalish,
  KUMOStake,
  KUSD_MINIMUM_DEBT,
  StabilityDeposit,
  TransactableKumo,
  Trove,
  TroveAdjustmentParams
} from "@liquity/lib-base";

import { EthersKumo as Kumo } from "@liquity/lib-ethers";

import {
  createRandomTrove,
  shortenAddress,
  benford,
  getListOfTroveOwners,
  listDifference,
  getListOfTroves,
  randomCollateralChange,
  randomDebtChange,
  objToString
} from "./utils";

import { GasHistogram } from "./GasHistogram";

type _GasHistogramsFrom<T> = {
  [P in keyof T]: T[P] extends (...args: never[]) => Promise<infer R> ? GasHistogram<R> : never;
};

type GasHistograms = Pick<
  _GasHistogramsFrom<TransactableKumo>,
  | "openTrove"
  | "adjustTrove"
  | "closeTrove"
  | "redeemKUSD"
  | "depositKUSDInStabilityPool"
  | "withdrawKUSDFromStabilityPool"
  | "stakeKUMO"
  | "unstakeKUMO"
>;

export class Fixture {
  private readonly deployerKumo: Kumo;
  private readonly funder: Signer;
  private readonly funderKumo: Kumo;
  private readonly funderAddress: string;
  private readonly frontendAddress: string;
  private readonly gasHistograms: GasHistograms;

  private price: Decimal;

  totalNumberOfLiquidations = 0;

  private constructor(
    deployerKumo: Kumo,
    funder: Signer,
    funderKumo: Kumo,
    funderAddress: string,
    frontendAddress: string,
    price: Decimal
  ) {
    this.deployerKumo = deployerKumo;
    this.funder = funder;
    this.funderKumo = funderKumo;
    this.funderAddress = funderAddress;
    this.frontendAddress = frontendAddress;
    this.price = price;

    this.gasHistograms = {
      openTrove: new GasHistogram(),
      adjustTrove: new GasHistogram(),
      closeTrove: new GasHistogram(),
      redeemKUSD: new GasHistogram(),
      depositKUSDInStabilityPool: new GasHistogram(),
      withdrawKUSDFromStabilityPool: new GasHistogram(),
      stakeKUMO: new GasHistogram(),
      unstakeKUMO: new GasHistogram()
    };
  }

  static async setup(
    deployerKumo: Kumo,
    funder: Signer,
    funderKumo: Kumo,
    frontendAddress: string,
    frontendKumo: Kumo
  ) {
    const funderAddress = await funder.getAddress();
    const price = await deployerKumo.getPrice();

    await frontendKumo.registerFrontend(Decimal.from(10).div(11));

    return new Fixture(
      deployerKumo,
      funder,
      funderKumo,
      funderAddress,
      frontendAddress,
      price
    );
  }

  private async sendKUSDFromFunder(toAddress: string, amount: Decimalish) {
    amount = Decimal.from(amount);

    const kusdBalance = await this.funderKumo.getKUSDBalance();

    if (kusdBalance.lt(amount)) {
      const trove = await this.funderKumo.getTrove();
      const total = await this.funderKumo.getTotal();
      const fees = await this.funderKumo.getFees();

      const targetCollateralRatio =
        trove.isEmpty || !total.collateralRatioIsBelowCritical(this.price)
          ? 1.51
          : Decimal.max(trove.collateralRatio(this.price).add(0.00001), 1.11);

      let newTrove = trove.isEmpty ? Trove.create({ depositCollateral: 1, borrowKUSD: 0 }) : trove;
      newTrove = newTrove.adjust({ borrowKUSD: amount.sub(kusdBalance).mul(2) });

      if (newTrove.debt.lt(KUSD_MINIMUM_DEBT)) {
        newTrove = newTrove.setDebt(KUSD_MINIMUM_DEBT);
      }

      newTrove = newTrove.setCollateral(newTrove.debt.mulDiv(targetCollateralRatio, this.price));

      if (trove.isEmpty) {
        const params = Trove.recreate(newTrove, fees.borrowingRate());
        console.log(`[funder] openTrove(${objToString(params)})`);
        await this.funderKumo.openTrove(params);
      } else {
        let newTotal = total.add(newTrove).subtract(trove);

        if (
          !total.collateralRatioIsBelowCritical(this.price) &&
          newTotal.collateralRatioIsBelowCritical(this.price)
        ) {
          newTotal = newTotal.setCollateral(newTotal.debt.mulDiv(1.51, this.price));
          newTrove = trove.add(newTotal).subtract(total);
        }

        const params = trove.adjustTo(newTrove, fees.borrowingRate());
        console.log(`[funder] adjustTrove(${objToString(params)})`);
        await this.funderKumo.adjustTrove(params);
      }
    }

    await this.funderKumo.sendKUSD(toAddress, amount);
  }

  async setRandomPrice() {
    this.price = this.price.add(200 * Math.random() + 100).div(2);
    console.log(`[deployer] setPrice(${this.price})`);
    await this.deployerKumo.setPrice(this.price);

    return this.price;
  }

  async liquidateRandomNumberOfTroves(price: Decimal) {
    const kusdInStabilityPoolBefore = await this.deployerKumo.getKUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${kusdInStabilityPoolBefore}`);

    const trovesBefore = await getListOfTroves(this.deployerKumo);

    if (trovesBefore.length === 0) {
      console.log("// No Troves to liquidate");
      return;
    }

    const troveOwnersBefore = trovesBefore.map(trove => trove.ownerAddress);
    const lastTrove = trovesBefore[trovesBefore.length - 1];

    if (!lastTrove.collateralRatioIsBelowMinimum(price)) {
      console.log("// No Troves to liquidate");
      return;
    }

    const maximumNumberOfTrovesToLiquidate = Math.floor(50 * Math.random()) + 1;
    console.log(`[deployer] liquidateUpTo(${maximumNumberOfTrovesToLiquidate})`);
    await this.deployerKumo.liquidateUpTo(maximumNumberOfTrovesToLiquidate);

    const troveOwnersAfter = await getListOfTroveOwners(this.deployerKumo);
    const liquidatedTroves = listDifference(troveOwnersBefore, troveOwnersAfter);

    if (liquidatedTroves.length > 0) {
      for (const liquidatedTrove of liquidatedTroves) {
        console.log(`// Liquidated ${shortenAddress(liquidatedTrove)}`);
      }
    }

    this.totalNumberOfLiquidations += liquidatedTroves.length;

    const kusdInStabilityPoolAfter = await this.deployerKumo.getKUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${kusdInStabilityPoolAfter}`);
  }

  async openRandomTrove(userAddress: string, liquity: Kumo) {
    const total = await liquity.getTotal();
    const fees = await liquity.getFees();

    let newTrove: Trove;

    const cannotOpen = (newTrove: Trove) =>
      newTrove.debt.lt(KUSD_MINIMUM_DEBT) ||
      (total.collateralRatioIsBelowCritical(this.price)
        ? !newTrove.isOpenableInRecoveryMode(this.price)
        : newTrove.collateralRatioIsBelowMinimum(this.price) ||
          total.add(newTrove).collateralRatioIsBelowCritical(this.price));

    // do {
    newTrove = createRandomTrove(this.price);
    // } while (cannotOpen(newTrove));

    await this.funder.sendTransaction({
      to: userAddress,
      value: newTrove.collateral.hex
    });

    const params = Trove.recreate(newTrove, fees.borrowingRate());

    if (cannotOpen(newTrove)) {
      console.log(
        `// [${shortenAddress(userAddress)}] openTrove(${objToString(params)}) expected to fail`
      );

      await this.gasHistograms.openTrove.expectFailure(() =>
        liquity.openTrove(params, undefined, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] openTrove(${objToString(params)})`);

      await this.gasHistograms.openTrove.expectSuccess(() =>
        liquity.send.openTrove(params, undefined, { gasPrice: 0 })
      );
    }
  }

  async randomlyAdjustTrove(userAddress: string, liquity: Kumo, trove: Trove) {
    const total = await liquity.getTotal();
    const fees = await liquity.getFees();
    const x = Math.random();

    const params: TroveAdjustmentParams<Decimal> =
      x < 0.333
        ? randomCollateralChange(trove)
        : x < 0.666
        ? randomDebtChange(trove)
        : { ...randomCollateralChange(trove), ...randomDebtChange(trove) };

    const cannotAdjust = (trove: Trove, params: TroveAdjustmentParams<Decimal>) => {
      if (
        params.withdrawCollateral?.gte(trove.collateral) ||
        params.repayKUSD?.gt(trove.debt.sub(KUSD_MINIMUM_DEBT))
      ) {
        return true;
      }

      const adjusted = trove.adjust(params, fees.borrowingRate());

      return (
        (params.withdrawCollateral?.nonZero || params.borrowKUSD?.nonZero) &&
        (adjusted.collateralRatioIsBelowMinimum(this.price) ||
          (total.collateralRatioIsBelowCritical(this.price)
            ? adjusted._nominalCollateralRatio.lt(trove._nominalCollateralRatio)
            : total.add(adjusted).subtract(trove).collateralRatioIsBelowCritical(this.price)))
      );
    };

    if (params.depositCollateral) {
      await this.funder.sendTransaction({
        to: userAddress,
        value: params.depositCollateral.hex
      });
    }

    if (params.repayKUSD) {
      await this.sendKUSDFromFunder(userAddress, params.repayKUSD);
    }

    if (cannotAdjust(trove, params)) {
      console.log(
        `// [${shortenAddress(userAddress)}] adjustTrove(${objToString(params)}) expected to fail`
      );

      await this.gasHistograms.adjustTrove.expectFailure(() =>
        liquity.adjustTrove(params, undefined, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] adjustTrove(${objToString(params)})`);

      await this.gasHistograms.adjustTrove.expectSuccess(() =>
        liquity.send.adjustTrove(params, undefined, { gasPrice: 0 })
      );
    }
  }

  async closeTrove(userAddress: string, liquity: Kumo, trove: Trove) {
    const total = await liquity.getTotal();

    if (total.collateralRatioIsBelowCritical(this.price)) {
      // Cannot close Trove during recovery mode
      console.log("// Skipping closeTrove() in recovery mode");
      return;
    }

    await this.sendKUSDFromFunder(userAddress, trove.netDebt);

    console.log(`[${shortenAddress(userAddress)}] closeTrove()`);

    await this.gasHistograms.closeTrove.expectSuccess(() =>
      liquity.send.closeTrove({ gasPrice: 0 })
    );
  }

  async redeemRandomAmount(userAddress: string, liquity: Kumo) {
    const total = await liquity.getTotal();

    if (total.collateralRatioIsBelowMinimum(this.price)) {
      console.log("// Skipping redeemKUSD() when TCR < MCR");
      return;
    }

    const amount = benford(10000);
    await this.sendKUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] redeemKUSD(${amount})`);

    try {
      await this.gasHistograms.redeemKUSD.expectSuccess(() =>
        liquity.send.redeemKUSD(amount, undefined, { gasPrice: 0 })
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("amount too low to redeem")) {
        console.log("// amount too low to redeem");
      } else {
        throw error;
      }
    }
  }

  async depositRandomAmountInStabilityPool(userAddress: string, liquity: Kumo) {
    const amount = benford(20000);

    await this.sendKUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] depositKUSDInStabilityPool(${amount})`);

    await this.gasHistograms.depositKUSDInStabilityPool.expectSuccess(() =>
      liquity.send.depositKUSDInStabilityPool(amount, this.frontendAddress, {
        gasPrice: 0
      })
    );
  }

  async withdrawRandomAmountFromStabilityPool(
    userAddress: string,
    liquity: Kumo,
    deposit: StabilityDeposit
  ) {
    const [lastTrove] = await liquity.getTroves({
      first: 1,
      sortedBy: "ascendingCollateralRatio"
    });

    const amount = deposit.currentKUSD.mul(1.1 * Math.random()).add(10 * Math.random());

    const cannotWithdraw = (amount: Decimal) =>
      amount.nonZero && lastTrove.collateralRatioIsBelowMinimum(this.price);

    if (cannotWithdraw(amount)) {
      console.log(
        `// [${shortenAddress(userAddress)}] ` +
          `withdrawKUSDFromStabilityPool(${amount}) expected to fail`
      );

      await this.gasHistograms.withdrawKUSDFromStabilityPool.expectFailure(() =>
        liquity.withdrawKUSDFromStabilityPool(amount, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] withdrawKUSDFromStabilityPool(${amount})`);

      await this.gasHistograms.withdrawKUSDFromStabilityPool.expectSuccess(() =>
        liquity.send.withdrawKUSDFromStabilityPool(amount, { gasPrice: 0 })
      );
    }
  }

  async stakeRandomAmount(userAddress: string, liquity: Kumo) {
    const kumoBalance = await this.funderKumo.getKUMOBalance();
    const amount = kumoBalance.mul(Math.random() / 2);

    await this.funderKumo.sendKUMO(userAddress, amount);

    if (amount.eq(0)) {
      console.log(`// [${shortenAddress(userAddress)}] stakeKUMO(${amount}) expected to fail`);

      await this.gasHistograms.stakeKUMO.expectFailure(() =>
        liquity.stakeKUMO(amount, { gasPrice: 0 })
      );
    } else {
      console.log(`[${shortenAddress(userAddress)}] stakeKUMO(${amount})`);

      await this.gasHistograms.stakeKUMO.expectSuccess(() =>
        liquity.send.stakeKUMO(amount, { gasPrice: 0 })
      );
    }
  }

  async unstakeRandomAmount(userAddress: string, liquity: Kumo, stake: KUMOStake) {
    const amount = stake.stakedKUMO.mul(1.1 * Math.random()).add(10 * Math.random());

    console.log(`[${shortenAddress(userAddress)}] unstakeKUMO(${amount})`);

    await this.gasHistograms.unstakeKUMO.expectSuccess(() =>
      liquity.send.unstakeKUMO(amount, { gasPrice: 0 })
    );
  }

  async sweepKUSD(liquity: Kumo) {
    const kusdBalance = await liquity.getKUSDBalance();

    if (kusdBalance.nonZero) {
      await liquity.sendKUSD(this.funderAddress, kusdBalance, { gasPrice: 0 });
    }
  }

  async sweepKUMO(liquity: Kumo) {
    const kumoBalance = await liquity.getKUMOBalance();

    if (kumoBalance.nonZero) {
      await liquity.sendKUMO(this.funderAddress, kumoBalance, { gasPrice: 0 });
    }
  }

  summarizeGasStats(): string {
    return Object.entries(this.gasHistograms)
      .map(([name, histo]) => {
        const results = histo.getResults();

        return (
          `${name},outOfGas,${histo.outOfGasFailures}\n` +
          `${name},failure,${histo.expectedFailures}\n` +
          results
            .map(([intervalMin, frequency]) => `${name},success,${frequency},${intervalMin}\n`)
            .join("")
        );
      })
      .join("");
  }
}
