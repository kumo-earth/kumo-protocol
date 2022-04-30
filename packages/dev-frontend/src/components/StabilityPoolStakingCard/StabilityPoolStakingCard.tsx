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
        backgroundColor: "rgb(48, 53, 83)",
        transition: "box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
        boxShadow:
          "rgba(0, 0, 0, 0.2) 0px 2px 1px -1px, rgba(0, 0, 0, 0.14) 0px 1px 1px 0px, rgba(0, 0, 0, 0.12) 0px 1px 3px 0px",
        border: "none",
        overflow: "hidden",
        borderRadius: "20px",
        color: "white",
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
