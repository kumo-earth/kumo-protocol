import { Box, Flex, Heading } from "theme-ui";

type DashboadHeaderItemProps = React.ComponentProps<typeof Box> & {
  title: string;
  value: string;
};

export const DashboadHeaderItem: React.FC<DashboadHeaderItemProps> = ({ title, value }) => (
  <Box sx={{ paddingTop: "12px" }}>
    <Flex sx={{ flexDirection: "column", mr: 5 }}>
      <Heading
        as="h4"
    
      >
        {title}
      </Heading>
      <Heading
        as="h1"
        sx={{ fontWeight: "bold", mt: 1 }}
      >
        {value}
      </Heading>
    </Flex>
  </Box>
);
