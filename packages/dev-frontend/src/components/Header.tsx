import React from "react";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { Container, Flex, Box } from "theme-ui";
import { AddressZero } from "@ethersproject/constants";
import { useKumo } from "../hooks/KumoContext";

import { SideNav } from "./SideNav";

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
      <SideNav />
      {children}
    </Container>
  );
};
