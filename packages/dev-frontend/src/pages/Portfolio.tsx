import { Divider, Flex, Heading, Text } from "theme-ui";
import { DashboadHeaderItem } from "../components/DashboardHeaderItem";
import { useDashboard } from "../hooks/DashboardContext";

export const Portfolio: React.FC = () => {
  const { totalTroveCollDebt } = useDashboard();

  return (
    <Flex sx={{ flexDirection: "column" }}>
      <Flex sx={{ height: "max-content", px: 5, pb: 4 }}>
        <DashboadHeaderItem title={"MY TOTAL COLLATERAL"} value={`$ ${totalTroveCollDebt.totalTroveColl.prettify(0)}`} />
        <DashboadHeaderItem title={"MY MINTED KUSD"} value={`$ ${totalTroveCollDebt.totalTroveDebt.prettify(2)}`} />
        <DashboadHeaderItem title={"MY TOTAL CARBON TOKENS"} value={`${totalTroveCollDebt.troveTotalCarbonCredits.prettify(0)}`} />
      </Flex>
      <Divider sx={{ color: "muted" }} />
      <Flex sx={{ height: "max-content", px: 5, pb: 4, flexDirection: "column" }}>
        <Heading as='h2'>Vault</Heading>
        <Text as='p' sx={{ mt: 3 }}>
          You have no open vaults! Open vaults and mint KUSD in the Dashboard page.
        </Text>
      </Flex>
    </Flex>
  );
};
