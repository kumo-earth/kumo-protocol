import { Grid, Container, Box, Heading } from "theme-ui";
import { Percent } from "@kumodao/lib-base";
import { CollateralCard } from "../components/ColleteralCard/ColleteralCard";
import { useDashboard } from "../hooks/DashboardContext";

export const Dashboard: React.FC = () => {
  const { vaults, totalCollDebt } = useDashboard();

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Container sx={{ display: "flex", mt: 2, mb: 4 }}>
        <Box>
          <Heading
            as="h6"
            sx={{
              fontSize: 14,
              color: "#f9f8f9",
              padding: "1.5rem 1.5rem 10px 1.5rem"
            }}
          >
            TOTAL COLLATERAL
          </Heading>
          <Heading
            as="h4"
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "32px",
              color: "#f9f8f9",
              padding: "0 1.5rem 30px 1.5rem"
            }}
          >
            ${totalCollDebt.totalColl.prettify(0)}
          </Heading>
        </Box>
        <Box>
          <Heading
            as="h6"
            sx={{
              fontSize: 14,
              color: "#f9f8f9",
              padding: "1.5rem 1.5rem 10px 1.5rem"
            }}
          >
            TOTAL DEBT
          </Heading>
          <Heading
            as="h4"
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "32px",
              color: "#f9f8f9",
              padding: "0 1.5rem 30px 1.5rem"
            }}
          >
            ${totalCollDebt.totalDebt.prettify(0)}
          </Heading>
        </Box>
        <Box>
          <Heading
            as="h6"
            sx={{
              fontSize: 14,
              color: "#f9f8f9",
              padding: "1.5rem 1.5rem 10px 1.5rem"
            }}
          >
            TOTAL CARBON CREDITS
          </Heading>
          <Heading
            as="h4"
            sx={{
              fontFamily: "Roboto, Helvetica, Arial, sans-serif",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              fontSize: "32px",
              color: "#f9f8f9",
              padding: "0 1.5rem 30px 1.5rem"
            }}
          >
            {totalCollDebt.totalCarbonCredits.prettify(0)}
          </Heading>
        </Box>
      </Container>
      <Grid
        sx={{
          width: "100%",
          display: "grid",
          gridGap: 2,
          gridTemplateColumns: `repeat(auto-fill, minmax(400px, 1fr))`
          // height: "100%"
        }}
      >
        {vaults.map(vault => {
          const totalCollateralRatioPct = new Percent(vault.collateralRatio);

          return (
            <CollateralCard
              collateralType={vault.type}
              totalCollateralRatioPct={totalCollateralRatioPct.prettify()}
              usersTroves={vault.usersTroves}
              key={vault.type}
            />
          );
        })}
      </Grid>
    </div>
  );
};
