import { Wallet } from "@ethersproject/wallet";

import { Decimal, KUSD_MINIMUM_DEBT, Trove } from "@liquity/lib-base";
import { EthersKumo } from "@liquity/lib-ethers";

import { deployer, funder, provider } from "../globals";

export interface WarzoneParams {
  troves: number;
}

export const warzone = async ({ troves: numberOfTroves }: WarzoneParams) => {
  const deployerKumo = await EthersKumo.connect(deployer);

  const price = await deployerKumo.getPrice();

  for (let i = 1; i <= numberOfTroves; ++i) {
    const user = Wallet.createRandom().connect(provider);
    const userAddress = await user.getAddress();
    const debt = KUSD_MINIMUM_DEBT.add(99999 * Math.random());
    const collateral = debt.mulDiv(1.11 + 3 * Math.random(), price);

    const liquity = await EthersKumo.connect(user);

    await funder.sendTransaction({
      to: userAddress,
      value: Decimal.from(collateral).hex
    });

    const fees = await liquity.getFees();

    await liquity.openTrove(
      Trove.recreate(new Trove(collateral, debt), fees.borrowingRate()),
      { borrowingFeeDecayToleranceMinutes: 0 },
      { gasPrice: 0 }
    );

    if (i % 4 === 0) {
      const kusdBalance = await liquity.getKUSDBalance();
      await liquity.depositKUSDInStabilityPool(kusdBalance);
    }

    if (i % 10 === 0) {
      console.log(`Created ${i} Troves.`);
    }

    //await new Promise(resolve => setTimeout(resolve, 4000));
  }
};
