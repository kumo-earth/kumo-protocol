import { Box, Flex, Text, Heading } from "theme-ui";

type DashboadHeaderItemProps = React.ComponentProps<typeof Box> & {
  title: string;
  value: string;
  fontSize?: number;
};

export const DashboadHeaderItem: React.FC<DashboadHeaderItemProps> = ({ title, value, fontSize }) => (
  <Box sx={{ pt: "12px" }}>
    <Flex sx={{ flexDirection: "column", mr: 5 }}>
      <Text as="p" variant="textBold">
        {title}
      </Text>
      <Heading as="h1" sx={{ mt: 1, fontSize }}>
        {value}
      </Heading>
    </Flex>
  </Box>
);
