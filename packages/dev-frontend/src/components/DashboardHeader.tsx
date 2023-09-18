import React, { ReactNode } from "react";
import { Box } from "theme-ui";

export const DashboadHeader: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <Box variant="layout.dashboadHeader">{children}</Box>;
};
