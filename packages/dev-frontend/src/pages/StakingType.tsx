import { useState, useEffect } from "react";

import { useHistory } from "react-router-dom";
import { Grid, Box } from "theme-ui";
import { Stability } from "../components/Stability/Stability";
import { StakingTypeCard } from "../components/StakingTypeCard/StakingTypeCard";
import { useDialogState, Dialog } from "reakit/Dialog";
import { KumoStoreState } from "@kumodao/lib-base";
import { useKumoSelector } from "@kumodao/lib-react";

const select = ({ vaults }: KumoStoreState) => ({
  vaults
});

export const StakingType: React.FC = () => {
  const dialog = useDialogState();
  const { vaults } = useKumoSelector(select);
  const [stakeDeposit, setStakeDeposit] = useState(false);
  const history = useHistory();

  useEffect(() => {
    if (!dialog.visible) {
      setStakeDeposit(false)
      history.push("/staking/stability");
    }
  }, [dialog.visible]);

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
  return (
    <Grid
      // sx={{
      //   width: "100%",
      //   display: "grid",
      //   gridGap: 2,
      //   gridTemplateColumns: `repeat(auto-fill, minmax(400px, 1fr))`,
      //   height: "100%",
      //   p: 6
      // }}
      sx={{ p: 6, gridGap: 4, gridTemplateColumns: ["auto-fill", "1fr 1fr"] }}
    >
      {vaults.map(vault => {
        return (
          <StakingTypeCard
            key={vault.asset}
            vault={vault}
            handleViewStakeDeposit={() => {
              setStakeDeposit(true);
              dialog.setVisible(true);
              history.push(`/staking/stability/${vault.asset}`);
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
