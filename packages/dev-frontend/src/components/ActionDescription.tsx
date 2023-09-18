import { ReactNode } from "react";
import { Box, Flex, Text } from "theme-ui";

import { Icon } from "./Icon";

export const ActionDescription: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-around",

      mb: [2, 3],
      p: 3,

      border: 1,
      borderRadius: "8px",
      borderColor: "muted",
      boxShadow: 2,
    }}
  >
    <Flex sx={{ alignItems: "center" }}>
      <Icon name="info-circle" size="lg" color="#da357a"/>
      <Text sx={{ ml: 2 }}>{children}</Text>
    </Flex>
  </Box>
);

export const Amount: React.FC<{ children: ReactNode }> = ({ children }) => (
  <Text sx={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{children}</Text>
);
