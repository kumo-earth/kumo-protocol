import { Divider, Flex, Heading, Text } from "theme-ui";
import { DashboadHeaderItem } from "../components/DashboardHeaderItem";
import { useDashboard } from "../hooks/DashboardContext";

export const Portfolio: React.FC = () => {
  const { totalTroveCollDebt } = useDashboard();

  return (
    <Flex sx={{ flexDirection: "column" }}>
      <Flex sx={{ height: "max-content", px: 5, pb: 4 }}>
        <DashboadHeaderItem title={"MY TOTAL COLLATERAL"} value={`$ ${totalTroveCollDebt.totalTroveColl}`} />
        <DashboadHeaderItem title={"MY TOTAL DEPT"} value={`${totalTroveCollDebt.totalTroveDebt} KUSD`} />
      </Flex>
      <Divider sx={{ color: "muted" }} />
      <Flex sx={{ height: "max-content", px: 5, pb: 4, flexDirection: "column" }}>
        <Heading as='h2'>Vault</Heading>
        <Text as='p' sx={{ mt: 3 }}>
          You have no open vaults! Open vaults and mint KUSD in the Products page.
        </Text>
      </Flex>
    </Flex>
  );
};
