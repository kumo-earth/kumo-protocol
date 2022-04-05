import { Container, Grid, Card, Image, Text } from "theme-ui";
import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../hooks/LiquityContext";
import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { SystemStats } from "../components/SystemStats";
import { PriceManager } from "../components/PriceManager";
import { Staking } from "../components/Staking/Staking";
import { StabilityPoolStakingCard } from "../components/StabilityPoolStakingCard/StabilityPoolStakingCard";

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  frontend
}: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const StabilityPoolStaking: React.FC = () => {
  const {
    numberOfTroves,
    price,
    lusdInStabilityPool,
    total,
    borrowingRate,
    totalStakedLQTY,
    kickbackRate
  } = useLiquitySelector(select);

  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  return (
    <Grid
      sx={{
        width: "100%",
        display: "grid",
        gridGap: 2,
        gridTemplateColumns: `repeat(auto-fill, minmax(400px, 1fr))`,
        height: "100%"
      }}
    >
      <StabilityPoolStakingCard
        stakingType={"stability"}
        totalCollateralRatioPct={totalCollateralRatioPct.prettify()}
        total={total}
      />
       <StabilityPoolStakingCard
        stakingType={"liquidity"}
        totalCollateralRatioPct={totalCollateralRatioPct.prettify()}
        total={total}
      />
    </Grid>
  );
};
