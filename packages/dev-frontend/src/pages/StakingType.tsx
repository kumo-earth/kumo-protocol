import { useState } from "react";
import { Grid, Box } from "theme-ui";
import { Stability } from "../components/Stability/Stability";
import { StakingTypeCard } from "../components/StakingTypeCard/StakingTypeCard";
import { useStabilityView } from "../components/Stability/context/StabilityViewContext";
import { Modal } from "@mui/material";

export const StakingType: React.FC = () => {
  const { view } = useStabilityView();
  const [stakeDeposit, setStakeDeposit] = useState(false);
  console.log("viewview", view);
  const style = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4
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
      {stakeDeposit ? (
        <Modal
          open={true}
          onClose={() => setStakeDeposit(false)}
          aria-labelledby="parent-modal-title"
          aria-describedby="parent-modal-description"
        >
          <Box sx={{ ...style, position: "absolute" }}>
            <Stability />
          </Box>
        </Modal>
      ) : (
        <StakingTypeCard
          collateralType={"eth"}
          handleViewStakeDeposit={() => setStakeDeposit(true)}
        />
      )}
    </Grid>
  );
};
