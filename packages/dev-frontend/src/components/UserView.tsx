import { Box, Heading } from "theme-ui";
import useUserViewParam from "../hooks/useUserViewParam";

const UserView = () => {
  const userViewParam = useUserViewParam();
  return <Heading as="h1" sx={{ fontWeight: 'medium' }}>{userViewParam}</Heading>;
};
export default UserView;
