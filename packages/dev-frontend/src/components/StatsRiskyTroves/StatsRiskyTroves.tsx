import React from "react";
import { Box } from "theme-ui";
import { RiskyTroves } from "../RiskyTroves";


export const StatsRiskyTroves: React.FC = () => {
  return (
    <Box sx={{ my: 6, mt: 5, height: "90%", minWidth: "250px" }}>
      <RiskyTroves pageSize={10} />
    </Box>
  );
};
