import React from "react";
import { Flex, Box, Text, Container } from "theme-ui";
import { KumoLogo } from "../KumoLogo";
import { Link } from "../Link";

export const Sidebar: React.FC = props => {
  return (
    <Container variant="sideBarOverlay">
      <Flex variant="layout.sideBar">
        <KumoLogo height={"20px"} variant="layout.sideBarLogo" />
        <Box  as='nav' variant="layout.sideBarNav">
          <Link to="/">Dashboard</Link>
          <Link to="/staking">Staking</Link>
          <Link to="/redemption">Redeem</Link>
          <Link to="/risky-troves">Risky Troves</Link>  
          <Link to="/farm">Farm</Link>
        </Box>
      </Flex>
    </Container>
  );
};
