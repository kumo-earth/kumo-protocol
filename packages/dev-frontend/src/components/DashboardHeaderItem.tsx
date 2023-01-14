import { Box, Flex, Text, Heading } from "theme-ui";

type DashboadHeaderItemProps = React.ComponentProps<typeof Box> & {
  title: string;
  value: string;
  fontSize?: number;
};

export const DashboadHeaderItem: React.FC<DashboadHeaderItemProps> = ({
  title,
  value,
  fontSize
}) => (

  <Flex sx={{ flexDirection: "column", ml: 1, mr: 8, pt: "12px" }}>
    <Text as="p" variant="normalBold">
      {title}
    </Text>
    <Text as="p" variant="xlarge" sx={{ fontSize }}>
      {value}
    </Text>
    {/* <Heading as="h1" sx={{ mt: 1, fontSize }}>
        {value}
      </Heading> */}
  </Flex>

);
