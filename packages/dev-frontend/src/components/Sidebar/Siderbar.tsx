import React, { useCallback } from "react";
import { Flex, Box, Text } from "theme-ui";
import { LiquityLogo } from "../LiquityLogo";
import { Link } from "../Link";

export const Sidebar: React.FC = props => {
  return (
    <Flex
      sx={{
        flexDirection: "column",
        backgroundColor: "#091325 !important",
        borderRight: "1px solid #4f4f4f",
        overflowY: "auto",
        zIndex: "10000 !important",
        color: "white !important",
        height: "100%"
      }}
    >
      <Box sx={{ display: "flex", p: "2rem", alignItems: "center" }}>
        <LiquityLogo height={"32px"} />
        <Text
          sx={{
            fontSize: 4,
            fontWeight: "bold",
            marginLeft: "8px"
          }}
        >
          Kumo{" "}
        </Text>
      </Box>
      <Box as="nav" sx={{ display: ["none", "flex"], flexDirection: "column", p: "2rem" }}>
        <Link to="/">Dashboard</Link>
        <Link to="/staking" sx={{ mt: "1rem !important" }}>
          Staking
        </Link>
        <Link to="/farm" sx={{ mt: "1rem !important" }}>
          Farm
        </Link>
        <Link sx={{ fontSize: 1, mt: "1rem !important" }} to="/risky-troves">
          Risky Troves
        </Link>
        <Link sx={{ fontSize: 1, mt: "1rem !important" }} to="/redemption">
          Redemption
        </Link>
      </Box>
    </Flex>
  );
};
