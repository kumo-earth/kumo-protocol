import React from "react";
import { Heading } from "theme-ui";
import useUserViewParam from "../hooks/useUserViewParam";
import { startCase } from "lodash";

const UserView = () => {
  const userViewParam = useUserViewParam();
  const paramView = userViewParam
    .split(" ")
    .map(param => {
      const prm = param.toLocaleLowerCase();
      if (prm === "nbc" || prm === "csc") {
        return prm.toUpperCase();
      } else {
        return startCase(prm);
      }
    })
    .join(" ");
  document.title = `kumo - ${paramView}`
  return <Heading as="h1">{paramView}</Heading>;
};
export default UserView;
