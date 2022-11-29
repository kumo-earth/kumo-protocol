import { Heading } from "theme-ui";
import useUserViewParam from "../hooks/useUserViewParam";
import _ from "lodash";

const UserView = () => {
  const userViewParam = useUserViewParam();
  const paramView = userViewParam
    .split(" ")
    .map((param, index) => {
      const prm = param.toLocaleLowerCase();
      if (prm === "ctx" || prm === "cty") {
        return _.toUpper(prm);
      } else {
        return _.startCase(prm);
      }
    })
    .join(" ");
  document.title = `kumo - ${paramView}`
  return <Heading as="h1">{paramView}</Heading>;
};
export default UserView;
