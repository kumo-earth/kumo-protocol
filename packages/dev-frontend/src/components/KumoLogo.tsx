import React from "react";
import { useHistory } from "react-router-dom";
import { Box, Image } from "theme-ui";
import kumoLogos from "../asset/images/kumoLogo.svg";

type KumoLogoProps = React.ComponentProps<typeof Box> & {
  height?: number | string;
};

export const KumoLogo: React.FC<KumoLogoProps> = ({ height,  ...boxProps }) => {
  const history = useHistory();
  return (
    <Box sx={{ lineHeight: 0 }} {...boxProps}>
      <Image src={kumoLogos} sx={{ height }} variant="primary"  onClick={() => history.push("/dashboard")} />
    </Box>
  );
};
