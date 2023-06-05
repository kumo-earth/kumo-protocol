import React from "react";
import { Grid } from "theme-ui";

export const DashboadContent: React.FC = ({ children }) => {
  return (
    <Grid
      sx={{
        width: "100%",
        display: "grid",
        gridGap: 3,
        gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`,
        mt: 5,
        px: 5
      }}
    >
      {children}
    </Grid>
  );
};
