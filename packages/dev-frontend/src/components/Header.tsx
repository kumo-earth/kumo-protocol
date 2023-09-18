import React, {ReactNode} from "react";
import { Container } from "theme-ui";

import { SideNav } from "./SideNav";

export const Header: React.FC<{ children: ReactNode }> = ({ children }) => {

  return (
    <Container variant="header">
      <SideNav />
      {children}
    </Container>
  );
};
