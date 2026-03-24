import { redirect } from "react-router";

export async function loader() {
  return redirect("/app");
}

export default function IndexRedirect() {
  return null;
}