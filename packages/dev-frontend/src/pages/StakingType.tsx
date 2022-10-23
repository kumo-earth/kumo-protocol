import { useState, useEffect } from "react";

import { useHistory } from "react-router-dom";
import { Grid, Box } from "theme-ui";
import { Stability } from "../components/Stability/Stability";
import { StakingTypeCard } from "../components/StakingTypeCard/StakingTypeCard";
import { useDashboard } from "../hooks/DashboardContext";
import { useDialogState, Dialog } from "reakit/Dialog";

export const StakingType: React.FC = () => {
  const dialog = useDialogState();
  const { vaults } = useDashboard();
  const [stakeDeposit, setStakeDeposit] = useState(false);
  const history = useHistory();

  useEffect(() => {
    if (!dialog.visible) {
      history.push("/staking/stability");
    }
  }, [dialog.visible]);

  const style = {
    top: "45%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 470,
    // bgcolor: "background.paper",
    bgcolor: 'white',
    border: "none",
    boxShadow: 24,
    p: 0
  };
  return (
    <Grid
      sx={{
        width: "100%",
        display: "grid",
        gridGap: 2,
        gridTemplateColumns: `repeat(auto-fill, minmax(400px, 1fr))`,
        height: "100%",
        pt: 2
      }}
    >
      {vaults.map(vault => {
        return (
          <StakingTypeCard
            key={vault.type}
            vault={vault}
            handleViewStakeDeposit={() => {
              setStakeDeposit(true);
              dialog.setVisible(true);
              history.push(`/staking/stability/${vault.type}`);
            }}
          />
        );
      })}
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
