import type { ProductPhoto } from "@workspace/api-client-react";
import { moveProductPhoto, productPhotoFilled, productPhotoFilledIndex, removeProductPhoto } from "./product-photos";

export function ProductPhotoOrderButtons({
  photos,
  index,
  onChange,
}: {
  photos: ProductPhoto[];
  index: number;
  onChange: (photos: ProductPhoto[]) => void;
}) {
  if (!productPhotoFilled(photos[index])) return null;
  const filledIndex = productPhotoFilledIndex(photos, index);
  const lastFilled = photos.filter(productPhotoFilled).length - 1;
  return (
    <span className="admin-photo-order">
      <button type="button" aria-label="Move photo up" disabled={filledIndex <= 0} onClick={() => onChange(moveProductPhoto(photos, index, -1))}>↑ Up</button>
      <button type="button" aria-label="Move photo down" disabled={filledIndex >= lastFilled} onClick={() => onChange(moveProductPhoto(photos, index, 1))}>↓ Down</button>
      <button type="button" className="danger" aria-label="Remove photo from this product" onClick={() => onChange(removeProductPhoto(photos, index))}>Remove</button>
    </span>
  );
}
