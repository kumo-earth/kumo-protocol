import { useParams } from "react-router-dom";
import { Box, Flex } from "theme-ui";
import { Link } from "../components/Link";
import { StatsRiskyTroves } from "../components/StatsRiskyTroves/StatsRiskyTroves";
import { ProtocolStats } from "./ProtocolStats";

export const Stats: React.FC = () => {
  const { statsType = "protocol" || "vaults" } = useParams<{ statsType: string }>();

  const renderStatsView = (view: string) => {
    switch (view) {
      case "protocol":
        return <ProtocolStats />;
      case "vaults":
        return <StatsRiskyTroves />;
      default:
        return <ProtocolStats />;
    }
  };

  return (
    <Flex sx={{ py: 4, px: [3, 5], height: "100%", flexDirection: "column" }}>
      <Flex>
        <Link
          to="/stats/protocol"
          sx={{
            py: [1, 2],
            px: [2, 3],
            mr: 2,
            fontSize: [1, 2],
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            letterSpacing: "inherit",
            backgroundColor: "#f0cfdc",
            borderRadius: '72px',
          }}
        >
          PROTOCOL STATISTICS
        </Link>
        <Link
          to="/stats/vaults"
          sx={{
            py: [1, 2],
            px: [2, 3],
            mr: 2,
            fontSize: [1, 2],
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            letterSpacing: "inherit",
            backgroundColor: "#f0cfdc",
            borderRadius: '72px',
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
