import { Box, Flex, Text } from "theme-ui";

import { Icon } from "./Icon";

type InfoMessageProps = {
  title: string;
  icon?: React.ReactNode;
};

export const InfoMessage: React.FC<InfoMessageProps> = ({ title, children, icon }) => (
  <Box sx={{ mx: 1, mb: 3 }}>
    <Flex sx={{ alignItems: "center", mb: "10px" }}>
      <Box sx={{ mr: "12px", fontSize: "20px", color: "primary" }}>{icon || <Icon name="info-circle" />}</Box>

      <Text as="p" variant="medium">{title}</Text>
    </Flex>

    <Text>{children}</Text>
  </Box>
);
