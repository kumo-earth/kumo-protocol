import React from "react";
import { Flex, Box, Text, Container, Divider } from "theme-ui";
import { KumoLogo } from "../KumoLogo";
import { Link } from "../Link";

export const Sidebar: React.FC = props => {
  return (
    <Container variant="sideBarOverlay">
      <Flex variant="layout.sideBar" sx={{ flex: 1 }}>
        <KumoLogo height={"20px"} variant="layout.sideBarLogo" />
        <Box as="nav" variant="layout.sideBarNav">
          <Link to="/">Dashboard</Link>
          <Link to="/portfolio">Portfolio</Link>
          <Link to="/staking">Staking</Link>
          <Link to="/stats/protocol">Stats</Link>
        </Box>
      </Flex>
      <Divider sx={{ color: "muted" }} />
      <Flex sx={{ flexDirection: "column", pl: 4, pb: 4 }}>
        {/* <Link to="/#">Medium</Link> */}
        <Link to={{ pathname: "https://discord.gg/smxnnmG6" }} target="_blank" >Discord</Link>
        <Link to="/#">Twitter</Link>
      </Flex>
    </Container>
  );
};
