import { Grid } from "theme-ui";
import { Percent, KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

import { StabilityPoolStakingCard } from "../components/StabilityPoolStakingCard/StabilityPoolStakingCard";

const select = ({
  numberOfTroves,
  price,
  total,
  kusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedKUMO,
  frontend
}: KumoStoreState) => ({
  numberOfTroves,
  price,
  total,
  kusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedKUMO,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const StabilityPoolStaking: React.FC = () => {
  const { price, total } = useKumoSelector(select);

  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  return (
    <Grid sx={{ p: 6, gridGap: 4, gridTemplateColumns: ["auto-fill", "1fr 1fr"] }}>
      <StabilityPoolStakingCard
        stakingType={"stability"}
        title="Stability Pool Staking"
        description="Stability pools play a critical role in the systems’ 
        liquidation process as KUSD from the stability pool are used toward liquidations."
        totalCollateralRatioPct={totalCollateralRatioPct.prettify()}
        total={total}
      />
      <StabilityPoolStakingCard
        title="Liquidity Mining"
        description="Help bootstrap the Vesta ecosystem by providing and staking liquidity to receive rewards."
        stakingType={"liquidity"}
        totalCollateralRatioPct={totalCollateralRatioPct.prettify()}
        total={total}
      />
    </Grid>
  );
};
