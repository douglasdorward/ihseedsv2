import { permanentRedirect } from "next/navigation";
import { CATALOGUE_INDEX_PATH } from "../../../lib/catalogue-paths";

export default function ProductCategoriesRedirect() {
  permanentRedirect(CATALOGUE_INDEX_PATH);
}
