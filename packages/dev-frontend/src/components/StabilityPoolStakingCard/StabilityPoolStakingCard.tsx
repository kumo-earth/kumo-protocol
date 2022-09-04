import React from "react";
import { useHistory } from "react-router-dom";
import {  Box, Card, Heading, Text } from "theme-ui";

type CollateralCardProps = {
  stakingType?: string;
  totalCollateralRatioPct?: string;
  total?: { collateral: any; debt: any };
};

export const StabilityPoolStakingCard: React.FC<CollateralCardProps> = ({
  stakingType = "url(https://vestafinance.xyz//img/cards/stability_staking.png)",
  totalCollateralRatioPct,
  total
}) => {
  const history = useHistory();

  const getStakingImg = (sType: string) => {
    if (sType === "stability") {
      return "url(https://vestafinance.xyz//img/cards/stability_staking.png)";
    } else if (sType === "liquidity") {
      return "url(https://vestafinance.xyz//img/cards/liquidity_staking.png)";
    }
  };
  return (
    <Card
      sx={{
        border: "none",
        borderRadius: "20px",
        height: "max-content"
      }}
      onClick={() => stakingType === "stability" && history.push(`/staking/${stakingType}`)}
    >
      <Box
        sx={{
          backgroundImage: () => getStakingImg(stakingType),
          width: "100%",
          height: "300px",
          backgroundSize: "cover",
          backgroundPosition: "50%"
        }}
      ></Box>
      <Box sx={{ m: "2rem 1.5rem 2rem 1.5rem" }}>
        <Heading>Liquidity Mining</Heading>
        <Text as={"p"} sx={{ mt: "1rem" }}>
          Help bootstrap the Kumo ecosystem by providing and staking liquidity to receive rewards.
        </Text>
      </Box>
    </Card>
  );
};
