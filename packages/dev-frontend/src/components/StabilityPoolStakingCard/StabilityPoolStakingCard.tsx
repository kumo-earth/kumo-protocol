import React from "react";
import { useHistory } from "react-router-dom";
import {  Box, Card, Heading, Text } from "theme-ui";

type CollateralCardProps = {
  title: string,
  description: string,
  stakingType?: string;
  totalCollateralRatioPct?: string;
  total?: { collateral: any; debt: any };
};

export const StabilityPoolStakingCard: React.FC<CollateralCardProps> = ({
  title, 
  description,
  stakingType = "url(https://assets.website-files.com/62e0a7c58c1c3ac32d0e3136/631959bb22c9cd67a1483971_australian-carbon-token.jpg)",
  totalCollateralRatioPct,
  total
}) => {
  const history = useHistory();

  const getStakingImg = (sType: string) => {
    if (sType === "stability") {
      return "url(https://academy-public.coinmarketcap.com/optimized-uploads/e3a7a7c24fc24e109733d9fb52ec0bf8.jpeg)";
    } else if (sType === "liquidity") {
      return "url(https://media-exp1.licdn.com/dms/image/C4E12AQH-5K2ECNvgig/article-cover_image-shrink_600_2000/0/1622985659317?e=2147483647&v=beta&t=VyxhQFRDuzDnk-w97_Op_PHc_d1_-rcGjV3lwt093pg)";
    }
  };
  return (
    <Card
      variant="StabilityPoolStakingCard"
      onClick={() => history.push(`/staking/${stakingType}`)}
    >
      <Box
        sx={{
          backgroundImage: () => getStakingImg(stakingType),
          width: "100%",
          height: "300px",
          backgroundSize: "cover",
          backgroundPosition: "50%",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20
        }}
      ></Box>
      <Box sx={{ m: "2rem 1.5rem 2rem 1.5rem" }}>
        <Heading>{title}</Heading>
        <Text as={"p"} sx={{ mt: "1rem" }}>
          {description}
        </Text>
      </Box>
    </Card>
  );
};
