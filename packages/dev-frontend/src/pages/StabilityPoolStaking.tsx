import React from "react";
import { Grid } from "theme-ui";
import { StabilityPoolStakingCard } from "../components/StabilityPoolStakingCard/StabilityPoolStakingCard";


export const StabilityPoolStaking: React.FC = () => {
  return (
    <Grid sx={{
      width: "100%",
      display: "grid",
      gridGap: 3,
      gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`,
      // mt: 5,
      mt: 6,
      px: 5,
      pb: 4
    }}>
      <StabilityPoolStakingCard
        stakingType={"stability"}
        title="Stability Pool Staking"
        description="Stability pools play a critical role in the systems’ 
        liquidation process as KUSD from the stability pool are used toward liquidations."
       
      />
      <StabilityPoolStakingCard
        title="Liquidity Mining"
        description="Help bootstrap the KUMO ecosystem by providing and staking liquidity to receive rewards."
        stakingType={"liquidity"}
      />
    </Grid>
  );
};
