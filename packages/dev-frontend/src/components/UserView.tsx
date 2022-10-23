import { Box, Heading } from "theme-ui";
import useUserViewParam from "../hooks/useUserViewParam";

const UserView = () => {
  const userViewParam = useUserViewParam();
  return <Heading as="h2">{userViewParam}</Heading>;
};
export default UserView;
