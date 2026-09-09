export type PersistLatestProductOptions<TDraft, TProduct> = {
  getLatestDraft: () => TDraft;
  saveDraft: (draft: TDraft) => Promise<TProduct>;
  publish: () => Promise<TProduct>;
  reconcile: (product: TProduct) => void;
};

export async function persistLatestProductAndPublish<TDraft, TProduct>({
  getLatestDraft,
  saveDraft,
  publish,
  reconcile,
}: PersistLatestProductOptions<TDraft, TProduct>): Promise<TProduct> {
  const savedProduct = await saveDraft(getLatestDraft());
  reconcile(savedProduct);
  const publishedProduct = await publish();
  reconcile(publishedProduct);
  return publishedProduct;
}