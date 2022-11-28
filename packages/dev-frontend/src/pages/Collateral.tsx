import { useState } from "react";
import { useParams } from "react-router-dom";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";
import { Grid, Flex, Heading, Text, Box } from "theme-ui";

import { Trove } from "../components/Trove/Trove";
import { Stability } from "../components/Stability/Stability";
import { AssetStats } from "../components/AssetStats";
import { useDashboard } from "../hooks/DashboardContext";
import { useDialogState, Dialog } from "reakit/Dialog";
import { StakingCardV1 } from "../components/StakingCardV1/StakingCardV1";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

const style = {
  top: "45%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 470,
  // bgcolor: "background.paper",
  bgcolor: "white",
  border: "none",
  boxShadow: 24,
  p: 0
};

export const Collateral: React.FC = () => {
  const dialog = useDialogState();
  const { vaults } = useKumoSelector(select);
  const [stakeDeposit, setStakeDeposit] = useState(false);
  const { collateralType } = useParams<{ collateralType: string }>();
  const vault = vaults.find(vault => vault.asset === collateralType);

  console.log("vaultCollateral", vault);
  return (
    <Grid
      columns={[2, "1fr 1fr"]}
      sx={{
        width: "100%",
        gridGap: 2,
        p: 5
      }}
    >
      <Flex sx={{ height: "max-content", width: "95%", mt: 6 }}>
        <Trove />
      </Flex>
      <Flex sx={{ flexDirection: "column", width: "95%" }}>
        <Text as="p" variant="large" sx={{ mb: 3 }}>
          System Overview
        </Text>
        <AssetStats
          total={vault.total}
          kusdMintedCap={vault?.kusdMintedCap}
          minNetDebt={vault?.minNetDebt}
          collateralType={collateralType}
        />
        <Text as="p" variant="large" sx={{ my: 3, mt: 5 }}>
          Stability Pool
        </Text>
        <StakingCardV1
          key={vault?.asset}
          totalKUSD={vault?.kusdInStabilityPool}
          userKUSD={vault?.stabilityDeposit?.currentKUSD}
          vault={vault}
          handleViewStakeDeposit={() => {
            setStakeDeposit(true);
            dialog.setVisible(true);
          }}
        />
      </Flex>
      {stakeDeposit && (
        <Dialog {...dialog}>
          <Box sx={{ ...style, position: "absolute" }}>
            <Stability />
          </Box>
        </Dialog>
      )}
    </Grid>
  );
};
