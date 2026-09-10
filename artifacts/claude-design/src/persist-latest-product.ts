export type PersistLatestProductOptions<TDraft, TProduct> = {
  getLatestDraft: () => TDraft;
  saveDraft?: (draft: TDraft) => Promise<unknown>;
  publish: (draft: TDraft) => Promise<TProduct>;
  reconcile: (product: TProduct) => void;
};

export async function persistLatestProductAndPublish<TDraft, TProduct>({
  getLatestDraft,
  saveDraft,
  publish,
  reconcile,
}: PersistLatestProductOptions<TDraft, TProduct>): Promise<TProduct> {
  if (saveDraft) await saveDraft(getLatestDraft());
  const publishedProduct = await publish(getLatestDraft());
  reconcile(publishedProduct);
  return publishedProduct;
}
