import React from "react";
import { Container } from "theme-ui";

import { SideNav } from "./SideNav";

export const Header: React.FC = ({ children }) => {

  return (
    <Container variant="header">
      <SideNav />
      {children}
    </Container>
  );
};
