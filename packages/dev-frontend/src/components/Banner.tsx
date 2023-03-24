import React from "react";
import { Progress, Alert, Heading } from "theme-ui";
import { useViewBanner } from "../hooks/useViewBanner";

export const Banner: React.FC<{ bannerHeading : string,  visibility: number }> = ({ bannerHeading, visibility, children }) => {
  const { isViewBannerCheck, changeInProgress } = useViewBanner(visibility);
  return !isViewBannerCheck ? (
    <Alert
      sx={{
        position: "absolute",
        width: "35%",
        top: 5,
        left: 0,
        right: 0,
        m: "auto",
        p: 3,
        backgroundColor: "#f0cfdc",
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        alignItems: "flex-start",
        zIndex: 9999999
      }}
    >
      <Heading as="h3" sx={{ mb: 2, color: "black" }}>
        {bannerHeading}
      </Heading>
      <Heading as="h4" sx={{ mb: 2, color: "black" }}>
        {children}
        {/* <Text sx={{ fontWeight: "bold" }}>Safety Check:</Text> Always verify you're on{" "}
        <Text sx={{ fontWeight: "bold" }}>app.kumo.earth</Text>! */}
      </Heading>
      <Progress max={visibility} value={changeInProgress} sx={{ color: "#da357a", mb: 1 }} />
    </Alert>
  ) : null;
};
