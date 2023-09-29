import React from "react";
import { NavLink as RouterLink, NavLinkProps as RouterLinkProps } from "react-router-dom";
import { NavLink as ThemeUINavLink, NavLinkProps as ThemeUILinkProps } from "theme-ui";

type CombinedProps = ThemeUILinkProps & RouterLinkProps;

const ExactLink: React.FC<CombinedProps> = props => {
  return <RouterLink {...props} />;
};

export const Link: React.FC<CombinedProps> = props => {
  return <ThemeUINavLink {...props} as={ExactLink} />;
};
