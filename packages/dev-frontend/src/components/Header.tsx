import React from "react";
import { KumoStoreState } from "@liquity/lib-base";
import { useKumoSelector } from "@liquity/lib-react";
import { Container, Flex, Box } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { useKumo } from "../hooks/KumoContext";

import { KumoLogo } from "./KumoLogo";
import { Nav } from "./Nav";
import { SideNav } from "./SideNav";

const logoHeight = "32px";

const select = ({ frontend }: KumoStoreState) => ({
  frontend
});

export const Header: React.FC = ({ children }) => {
  const {
    config: { frontendTag }
  } = useKumo();
  const { frontend } = useKumoSelector(select);
  const isFrontendRegistered = frontendTag === AddressZero || frontend.status === "registered";

  return (
    <Container variant="header">
      <Flex sx={{ alignItems: "center", flex: 1, width: 'fit-content', padding: "0 30px", height: "128px", zIndex: "100000", }}>
        <Box
          sx={{
            mx: [2, 3],
            width: "0px",
            height: "100%",
            // borderLeft: ["none", "1px solid lightgrey"]
          }}
        />
        {isFrontendRegistered && (
          // <>
          //   <SideNav />
          //   <Nav />
          // </>
          <SideNav />
        )}
      </Flex>

      {children}
    </Container>
  );
};
