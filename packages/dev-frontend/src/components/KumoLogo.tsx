import React from "react";
import { Box, Image } from "theme-ui";

type KumoLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const KumoLogo: React.FC<KumoLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <Image src="./kusd-icon.png" sx={{ height }} />
  </Box>
);
