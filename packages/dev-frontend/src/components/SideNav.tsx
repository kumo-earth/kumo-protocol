import React, { useState, useRef } from "react";
import { Box, Button, Container, Divider, Flex } from "theme-ui";
import { UserAccount } from "../components/UserAccount";
import { Icon } from "./Icon";
import { KumoLogo } from "./KumoLogo";
import appBackground from "../asset/images/appBackground.svg";
import { Link } from "./Link";

const logoHeight = "32px";

export const SideNav: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);

  if (!isVisible) {
    return (
      <Button sx={{ display: ["flex", "none"] }} variant="icon" onClick={() => setIsVisible(true)}>
        <Icon name="bars" size="lg" />
      </Button>
    );
  }
  return (
    <Container
      variant="sideNavOverlay"
      ref={overlay}
      onClick={e => {
        if (e.target === overlay.current) {
          setIsVisible(false);
        }
      }}
      sx={{ backgroundImage: `url(${appBackground})` }}
    >
      <Flex variant="layout.sidenav">
        <Flex sx={{ justifyContent: 'space-between', px: 2, pt: 4, alignItems: 'center' }}>
          <KumoLogo height={logoHeight} p={2} />
          <Button
            sx={{ pr: 5 }}
            variant="icon"
            onClick={() => setIsVisible(false)}
          >
            <Icon name="times" size="2x" />
          </Button>

        </Flex>
        <Box as="nav" sx={{ m: 3, mt: 1 }} onClick={() => setIsVisible(false)}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/portfolio">Portfolio</Link>
          <Link to="/staking">Staking</Link>
          <Link to="/redemption">Redemption</Link>
          <Link to="/stats">Stats</Link>
        </Box>
      </Flex>

      <Divider sx={{ color: "muted" }} />
      <Flex sx={{ flexDirection: "column", pl: 6 }} variant="layout.newTabLinks">
        <Link to={{ pathname: " https://docs.kumo.earth" }} target="_blank" style={{ color: 'black' }}>Documentation</Link>
        <Link to={{ pathname: "https://discord.gg/smxnnmG6" }} target="_blank" style={{ color: 'black' }}>Discord</Link>
        <Link to={{ pathname: "https://twitter.com/Kumo_DAO" }} target="_blank" style={{ color: 'black' }}>Twitter</Link>
      </Flex>
      <Box sx={{ display: ["flex", "none"], flexDirection: 'column', pl: 3, mt: 1 }} onClick={() => setIsVisible(false)}><UserAccount /></Box>
    </Container>
  );
};
