import React from "react";
import { Box, Image } from "theme-ui";
import kumoLogos from "../asset/images/kumoLogo.svg"

type KumoLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const KumoLogo: React.FC<KumoLogoProps> = ({ height, ...boxProps }) => (
  <Box sx={{ lineHeight: 0 }} {...boxProps}>
    <Image src={kumoLogos} sx={{ height }} />
  </Box>
);
