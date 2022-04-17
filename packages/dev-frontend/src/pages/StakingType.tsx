import { useState } from "react";
import { useHistory } from "react-router-dom";
import { Grid, Box } from "theme-ui";
import { Stability } from "../components/Stability/Stability";
import { StakingTypeCard } from "../components/StakingTypeCard/StakingTypeCard";
import { useStabilityView } from "../components/Stability/context/StabilityViewContext";
import { useDashboard } from "../hooks/DashboardContext";
import { Modal } from "@mui/material";

export const StakingType: React.FC = () => {
  const { vaults } = useDashboard();
  const [stakeDeposit, setStakeDeposit] = useState(false);
  const history = useHistory();
  const style = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 470,
    bgcolor: "background.paper",
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
        height: "100%"
      }}
    >
      {vaults.map(vault => {
        // const totalCollateralRatioPct = new Percent(vault.collateralRatio);
        return (
          <StakingTypeCard
            collateralType={vault.type}
            handleViewStakeDeposit={() => {
              setStakeDeposit(true);
              history.push(`/staking/stability/${vault.type}`);
            }}
          />
        );
      })}
      {stakeDeposit && (
        <Modal
          open={true}
          onClose={() => {
            setStakeDeposit(false);
            history.push("/staking/stability");
          }}
          aria-labelledby="parent-modal-title"
          aria-describedby="parent-modal-description"
        >
          <Box sx={{ ...style, position: "absolute" }}>
            <Stability />
          </Box>
        </Modal>
      )}
    </Grid>
  );
};
