import { Decimal } from "@kumodao/lib-base";
import React from "react";
import { Flex, Box, Card, Text, Heading, Divider, Paragraph } from "theme-ui";

type StatsTVCardProps = {
  title: string;
  totalValueLocked: Decimal;
  data: { name: string; value: string }[];
};

export const StatsTVCard: React.FC<StatsTVCardProps> = ({ title,totalValueLocked, data }) => {
  return (
    <Card variant="base">
      <Box sx={{ px: 4, py: 5 }}>
        <Flex
          sx={{
            flexDirection: "column",
            m: 1,
            mb: 4,
            py: 4,
            px: 3,
            bg: "secondary",
            borderRadius: 16,
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <Heading as="h1" sx={{ fontWeight: 600 }}>
            {title}
          </Heading>
          <Heading as="h2">$ {totalValueLocked.prettify(0)}</Heading>
          {/* <Text as="p" sx={{ fontWeight: "bold" }}>
            Yesterday: $ 0
          </Text> */}
        </Flex>
        {data?.map(dtVal => (
          <Flex sx={{ justifyContent: "space-between", mx: 2, mb: 2}}>
            <Heading as="h4">{dtVal?.name}</Heading>
            <Heading as="h4">{dtVal?.value}</Heading>
          </Flex>
        ))}
      </Box>
    </Card>
  );
};
