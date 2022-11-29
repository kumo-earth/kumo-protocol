import { useParams } from "react-router-dom";
import { Box, Flex } from "theme-ui";
import { Link } from "../components/Link";
import { StatsLiquidation } from "../components/StatsLiquidation/StatsLiquidation";
import { StatsRiskyTroves } from "../components/StatsRiskyTroves/StatsRiskyTroves";
import { ProtocolStats } from "./ProtocolStats";

export const Stats: React.FC = () => {
  const { statsType } = useParams<{ statsType: string }>();
  
  const renderStatsView = (view: string) => {
    switch (view) {
      case "protocol":
        return  <ProtocolStats />;
      case "vaults":
        return  <StatsRiskyTroves />;
      // case "liquidations":
      //     return <StatsLiquidation />;
      default:
        return <Box>protocol</Box>;
    }
  };

  return (
    <Flex sx={{ px: 8, py: 7, height: "100%", flexDirection: "column" }}>
      <Flex>
        <Link
          to="protocol"
          sx={{
            py: 1,
            px: 2,
            mr: 2,
            letterSpacing: "inherit",
            backgroundColor: "#f0cfdc",
            borderRadius: "8px"
          }}
        >
          PROTOCOL STATISTICS
        </Link>
        <Link
          to="vaults"
          sx={{
            py: 1,
            px: 2,
            mr: 2,
            letterSpacing: "inherit",
            backgroundColor: "#f0cfdc",
            borderRadius: "8px"
          }}
        >
          RISKY Vaults
        </Link>
        {/* <Link
          to="liquidations"
          sx={{
            py: 1,
            px: 2,
            letterSpacing: "inherit",
            backgroundColor: "#f0cfdc",
            borderRadius: "8px"
          }}
        >
          LIQUIDATION STATISTICS
        </Link> */}
      </Flex>
      <Box sx={{ flex: 1 }}>{renderStatsView(statsType)}</Box>
    </Flex>
  );
};
