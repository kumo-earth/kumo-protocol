import React from "react";
import { useHistory } from "react-router-dom";
import { Box, Card, Heading, Text } from "theme-ui";
import stabilityPoolStaking from "../../asset/images/stability_pool_gradient.png";
import stabilityMiningGradient from "../../asset/images/liquidity_mining_gradient.png";

type CollateralCardProps = {
  title: string;
  description: string;
  stakingType: string;
};

export const StabilityPoolStakingCard: React.FC<CollateralCardProps> = ({
  title,
  description,
  stakingType
}) => {
  const history = useHistory();

  const getStakingImg = (sType: string) => {
    if (sType === "stability") {
      return `${stabilityPoolStaking}`;
    } else if (sType === "liquidity") {
      return `${stabilityMiningGradient}`;
    }
  };
  return (
    <Card variant="StabilityPoolStakingCard" onClick={() => history.push(`/staking/${stakingType}`)}>
      <Box
        sx={{
          width: "100%",
          height: "300px",
          p: 2,
          px: 3,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20
        }}
      >
        <img src={getStakingImg(stakingType)} height="100%" width={"100%"} />
      </Box>
      <Box sx={{ m: 3 }}>
        <Heading>{title}</Heading>
        <Text as="p" variant="normalBold" sx={{ mt: "1rem" }}>
          {description}
        </Text>
      </Box>
    </Card>
  );
};
