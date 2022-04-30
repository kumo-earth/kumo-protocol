import { Grid } from "theme-ui";
import { Percent, KumoStoreState } from "@liquity/lib-base";
import { useKumoSelector } from "@liquity/lib-react";
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
