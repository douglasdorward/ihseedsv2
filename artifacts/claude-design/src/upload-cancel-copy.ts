export function uploadCancelCopy(filenames: string[]) {
  if (filenames.length === 1) {
    return {
      title: "Cancel this upload?",
      body: `Are you sure you want to cancel the upload of “${filenames[0]}”? This file will be deleted from the image library and will not be attached to a product. This cannot be undone.`,
      confirmLabel: "Delete upload",
    };
  }
  const preview = filenames.length <= 5
    ? ` These files are ${filenames.map((name) => `“${name}”`).join(", ")}.`
    : "";
  return {
    title: "Cancel these uploads?",
    body: `Are you sure you want to cancel these ${filenames.length} uploads?${preview} They will be deleted from the image library and will not be attached to any product. Any product matches chosen in this window will not be saved. This cannot be undone. To keep the files in the library without matching them now, close this warning and press Skip.`,
    confirmLabel: "Delete uploads",
  };
}
